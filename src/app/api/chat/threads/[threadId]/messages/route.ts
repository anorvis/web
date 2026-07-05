import { type NextRequest, NextResponse } from "next/server";
import {
  type GatewayAgent,
  type GatewayMessage,
  gatewayErrorResponse,
  gatewayFetchJson,
  resolveWebGatewaySession,
} from "@/lib/anorvis-gateway";
import { runAnorvisSdkAgent } from "@/lib/anorvis-sdk-runner";
import { getLocalEventHub, type LocalEventPayload } from "@/lib/local-events";

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

async function listMessagesForAgent(input: {
  threadId: string;
  agent: string;
}): Promise<GatewayMessage[]> {
  const sessionMapping = await resolveWebGatewaySession({
    userId: LOCAL_USER_ID,
    threadId: input.threadId,
    agent: input.agent,
  });
  return gatewayFetchJson<GatewayMessage[]>(
    `/v1/chat/sessions/${sessionMapping.record.id}/messages`,
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    const { threadId } = await context.params;
    const agent = request.nextUrl.searchParams.get("agent")?.trim();
    if (!agent) {
      return NextResponse.json({ error: "agent is required" }, { status: 400 });
    }

    return NextResponse.json(await listMessagesForAgent({ threadId, agent }));
  } catch (error) {
    return gatewayErrorResponse(error);
  }
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

async function sendToAgent(input: {
  threadId: string;
  agent: GatewayAgent;
  content: string;
}) {
  const sessionMapping = await resolveWebGatewaySession({
    userId: LOCAL_USER_ID,
    threadId: input.threadId,
    agent: input.agent.key,
  });

  const traceRunId = `${input.agent.key}-${crypto.randomUUID()}`;
  let startedTraceRunId = traceRunId;

  const beforeMessages = await gatewayFetchJson<GatewayMessage[]>(
    `/v1/chat/sessions/${sessionMapping.record.id}/messages`,
  );
  const beforeMessageIds = new Set(beforeMessages.map((message) => message.id));

  const prompt = input.content;

  let sdkResult: Awaited<ReturnType<typeof runAnorvisSdkAgent>>;
  try {
    sdkResult = await runAnorvisSdkAgent({
      userId: LOCAL_USER_ID,
      threadId: input.threadId,
      agent: input.agent.key,
      prompt,
      displayText: input.content,
      onRunStarted: (runId) => {
        startedTraceRunId = runId;
        publishAgentTrace({ agent: input.agent, runId, type: "started" });
      },
    });
  } catch (error) {
    publishAgentTrace({
      agent: input.agent,
      runId: startedTraceRunId,
      type: "failed",
      payload: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }

  const afterMessages = await gatewayFetchJson<GatewayMessage[]>(
    `/v1/chat/sessions/${sessionMapping.record.id}/messages`,
  );
  const newMessages = afterMessages.filter(
    (message) => !beforeMessageIds.has(message.id),
  );
  const userMessage =
    newMessages.find((message) => message.sender === "user") ?? null;
  const assistantMessage =
    [...newMessages]
      .reverse()
      .find((message) => message.sender === input.agent.key) ??
    ({
      id: `${input.agent.key}-${crypto.randomUUID()}`,
      sender: input.agent.key,
      displayName: input.agent.name,
      content: sdkResult.text,
      createdAt: new Date().toISOString(),
    } satisfies GatewayMessage);

  publishAgentTrace({
    agent: input.agent,
    runId: sdkResult.runId ?? startedTraceRunId,
    type: "finished",
  });
  return { userMessage, assistantMessage };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    let body: { content?: string; agent?: string };
    try {
      body = (await request.json()) as { content?: string; agent?: string };
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    const content = body.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 },
      );
    }

    const agent = body.agent?.trim();
    if (!agent) {
      return NextResponse.json({ error: "agent is required" }, { status: 400 });
    }

    const { threadId } = await context.params;
    const target = resolveAgentTargetFrom({
      agent,
      agents: await listGatewayAgents(),
    });
    const reply = await sendToAgent({
      threadId,
      agent: target,
      content,
    });

    return NextResponse.json({
      userMessage: reply.userMessage,
      assistantMessages: [reply.assistantMessage],
      replies: [reply],
    });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
