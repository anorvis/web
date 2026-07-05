import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
  type GatewayAgent,
  type GatewayMessage,
  gatewayErrorResponse,
  gatewayFetchJson,
} from "@/lib/anorvis-gateway";
import { runAnorvisSdkAgent } from "@/lib/anorvis-sdk-runner";
import { getLocalEventHub, type LocalEventPayload } from "@/lib/local-events";
import { branchPiSession } from "./pi-session-branch";
import {
  enrichMessagesWithRunActivity,
  readRunTranscriptEvents,
  toToolMessage,
} from "./pi-transcript";

export const runtime = "nodejs";

const LOCAL_USER_ID = "local";

async function listGatewayAgents(): Promise<GatewayAgent[]> {
  return gatewayFetchJson<GatewayAgent[]>("/v1/agents");
}

function resolveAgentTargetFrom(input: {
  agent: string;
  agents: GatewayAgent[];
}): GatewayAgent {
  const target = input.agents.find((entry) => entry.key === input.agent);
  if (!target) {
    throw new Error(
      `Unknown agent: ${input.agent}. Available agents: ${input.agents.map((entry) => entry.key).join(", ") || "none"}`,
    );
  }
  return target;
}

function publishAgentTrace(input: {
  agent: GatewayAgent;
  runId: string;
  type: string;
  payload?: LocalEventPayload;
}) {
  getLocalEventHub().publish(`agent.trace.${input.type}`, {
    agent: input.agent.key,
    displayName: input.agent.name,
    runId: input.runId,
    ...(input.payload ?? {}),
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params;
    const messages = await gatewayFetchJson<GatewayMessage[]>(
      `/v1/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    );
    return NextResponse.json(
      await enrichMessagesWithRunActivity({
        sessionId,
        messages,
      }),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params;
    let body: { content?: string; agent?: string; piSessionId?: string };
    try {
      body = (await request.json()) as {
        content?: string;
        agent?: string;
        piSessionId?: string;
      };
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    const content = body.content?.trim();
    const agentKey = body.agent?.trim();
    const piSessionId = body.piSessionId?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 },
      );
    }
    if (!agentKey || !piSessionId) {
      return NextResponse.json(
        { error: "agent and piSessionId are required" },
        { status: 400 },
      );
    }

    const agent = resolveAgentTargetFrom({
      agent: agentKey,
      agents: await listGatewayAgents(),
    });
    const beforeMessages = await gatewayFetchJson<GatewayMessage[]>(
      `/v1/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    );
    const beforeMessageIds = new Set(
      beforeMessages.map((message) => message.id),
    );

    const traceRunId = `${agent.key}-${crypto.randomUUID()}`;
    let startedTraceRunId = traceRunId;
    let sdkResult: Awaited<ReturnType<typeof runAnorvisSdkAgent>>;
    try {
      sdkResult = await runAnorvisSdkAgent({
        userId: LOCAL_USER_ID,
        threadId: sessionId,
        agent: agent.key,
        prompt: content,
        displayText: content,
        piSessionId,
        onRunStarted: (runId) => {
          startedTraceRunId = runId;
          publishAgentTrace({ agent, runId, type: "started" });
        },
      });
    } catch (error) {
      publishAgentTrace({
        agent,
        runId: startedTraceRunId,
        type: "failed",
        payload: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
    const afterMessages = await gatewayFetchJson<GatewayMessage[]>(
      `/v1/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    );
    const newMessages = afterMessages.filter(
      (message) => !beforeMessageIds.has(message.id),
    );
    const userMessage =
      newMessages.find((message) => message.sender === "user") ?? null;
    const assistantMessage =
      [...newMessages]
        .reverse()
        .find((message) => message.sender === agent.key) ??
      ({
        id: `${agent.key}-${crypto.randomUUID()}`,
        sender: agent.key,
        displayName: agent.name,
        content: sdkResult.text,
        createdAt: new Date().toISOString(),
      } satisfies GatewayMessage);
    const toolMessages = sdkResult.runId
      ? (
          await readRunTranscriptEvents({
            id: sdkResult.runId,
            sessionId,
            instruction: content,
            createdAt: assistantMessage.createdAt,
          })
        ).map(toToolMessage)
      : [];
    publishAgentTrace({
      agent,
      runId: sdkResult.runId ?? startedTraceRunId,
      type: "finished",
    });

    return NextResponse.json({
      userMessage,
      assistantMessage,
      assistantMessages: [...toolMessages, assistantMessage],
    });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params;
    let body: {
      messageId?: string;
      content?: string;
      agent?: string;
      piSessionId?: string;
    };
    try {
      body = (await request.json()) as {
        messageId?: string;
        content?: string;
        agent?: string;
        piSessionId?: string;
      };
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    const messageId = body.messageId?.trim();
    const content = body.content?.trim();
    const agentKey = body.agent?.trim();
    const piSessionId = body.piSessionId?.trim();
    if (!messageId || !content || !agentKey || !piSessionId) {
      return NextResponse.json(
        { error: "messageId, content, agent, and piSessionId are required" },
        { status: 400 },
      );
    }

    const persistedMessages = await gatewayFetchJson<GatewayMessage[]>(
      `/v1/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    );
    const rewindMessage =
      persistedMessages.find((message) => message.id === messageId) ??
      [...persistedMessages]
        .reverse()
        .find(
          (message) =>
            message.sender === "user" && message.content.trim() === content,
        );
    if (!rewindMessage) {
      return NextResponse.json(
        { error: "Could not find the message to edit in this session." },
        { status: 409 },
      );
    }

    const nextPiSessionId = `${piSessionId}-edit-${randomUUID()}`;
    await branchPiSession({
      agent: agentKey,
      fromPiSessionId: piSessionId,
      toPiSessionId: nextPiSessionId,
      rewindContent: content,
    });
    return NextResponse.json(
      await gatewayFetchJson(
        `/v1/chat/sessions/${encodeURIComponent(sessionId)}/rewind`,
        {
          method: "PATCH",
          body: JSON.stringify({
            messageId: rewindMessage.id,
            piSessionId: nextPiSessionId,
          }),
        },
      ),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
