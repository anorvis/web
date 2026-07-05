import { type GatewayMessage, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { isRecord } from "@/lib/guards";

export type GatewayRun = {
  id: string;
  sessionId: string | null;
  instruction: string;
  createdAt: string;
};

type PiTranscriptEvent = {
  id: string;
  runId: string;
  instruction: string;
  content: string;
  createdAt: string;
};

function field(value: Record<string, unknown>, key: string): string | null {
  const fieldValue = value[key];
  return typeof fieldValue === "string" && fieldValue.trim()
    ? fieldValue.trim()
    : null;
}

function toolName(value: Record<string, unknown>): string {
  return (
    field(value, "toolName") ??
    field(value, "name") ??
    field(value, "tool") ??
    "unknown"
  );
}

function command(value: Record<string, unknown>): string | null {
  return isRecord(value.args)
    ? (field(value.args, "command") ??
        field(value.args, "cmd") ??
        field(value.args, "script"))
    : null;
}

function contentParts(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    if (entry.type === "toolCall") {
      const cmd = command(entry);
      const name =
        toolName(entry) === "unknown" && cmd ? "bash" : toolName(entry);
      return [
        [
          `Tool call: ${name}${cmd ? ` - ${cmd}` : ""}`,
          "```json",
          JSON.stringify(entry, null, 2),
          "```",
        ].join("\n"),
      ];
    }
    if (typeof entry.text === "string") return [entry.text];
    if (typeof entry.content === "string") return [entry.content];
    return [JSON.stringify(entry, null, 2)];
  });
}

function parsePiTranscriptEvents(input: {
  content: string;
  run: GatewayRun;
}): PiTranscriptEvent[] {
  const toolNamesById = new Map<string, string>();
  const events: PiTranscriptEvent[] = [];
  for (const [index, line] of input.content
    .split("\n")
    .filter(Boolean)
    .entries()) {
    let value: unknown;
    try {
      value = JSON.parse(line) as unknown;
    } catch {
      continue;
    }
    if (
      !isRecord(value) ||
      value.type !== "message" ||
      !isRecord(value.message)
    )
      continue;
    const message = value.message;
    if (Array.isArray(message.content)) {
      for (const entry of message.content) {
        if (!isRecord(entry) || entry.type !== "toolCall") continue;
        const id =
          field(entry, "toolUseId") ??
          field(entry, "toolCallId") ??
          field(entry, "id");
        if (id) toolNamesById.set(id, toolName(entry));
      }
    }
    const role = typeof message.role === "string" ? message.role : "unknown";
    const hasToolCall =
      role === "assistant" &&
      Array.isArray(message.content) &&
      message.content.some(
        (entry) => isRecord(entry) && entry.type === "toolCall",
      );
    if (role !== "toolResult" && !hasToolCall) continue;
    const content = contentParts(message.content).join("\n").trim();
    if (!content) continue;
    const id =
      field(message, "toolUseId") ??
      field(message, "toolCallId") ??
      field(message, "id");
    const name =
      role === "toolResult" && id
        ? (toolNamesById.get(id) ?? "unknown")
        : "activity";
    events.push({
      id:
        typeof value.id === "string"
          ? `run-${input.run.id}-${value.id}`
          : `run-${input.run.id}-event-${index}`,
      runId: input.run.id,
      instruction: input.run.instruction,
      content:
        role === "toolResult"
          ? [
              `Tool result: ${name}`,
              content,
              "",
              "Raw result:",
              "```json",
              JSON.stringify(message, null, 2),
              "```",
            ].join("\n")
          : content,
      createdAt:
        typeof value.timestamp === "string"
          ? value.timestamp
          : input.run.createdAt,
    });
  }
  return events;
}

export async function readRunTranscriptEvents(
  run: GatewayRun,
): Promise<PiTranscriptEvent[]> {
  try {
    const result = await gatewayFetchJson<{ content: string | null }>(
      `/v1/runs/${encodeURIComponent(run.id)}/pi-session`,
    );
    return result.content
      ? parsePiTranscriptEvents({ content: result.content, run })
      : [];
  } catch {
    return [];
  }
}

export function toToolMessage(event: PiTranscriptEvent): GatewayMessage {
  return {
    id: event.id,
    sender: "tool",
    displayName: "Tool activity",
    content: event.content,
    createdAt: event.createdAt,
  };
}

function sortMessages(messages: GatewayMessage[]): GatewayMessage[] {
  return [...messages].sort((a, b) =>
    a.createdAt === b.createdAt ? 0 : a.createdAt.localeCompare(b.createdAt),
  );
}

export async function enrichMessagesWithRunActivity(input: {
  sessionId: string;
  messages: GatewayMessage[];
}): Promise<GatewayMessage[]> {
  const runs = (
    await gatewayFetchJson<GatewayRun[]>("/v1/runs").catch(() => [])
  ).filter((run) => run.sessionId === input.sessionId);
  const events = (
    await Promise.all(runs.map((run) => readRunTranscriptEvents(run)))
  ).flat();
  if (events.length === 0) return input.messages;
  const remaining = [...events];
  const result: GatewayMessage[] = [];
  for (const message of input.messages) {
    result.push(message);
    if (message.sender !== "user") continue;
    const matching = remaining.filter(
      (event) => event.instruction.trim() === message.content.trim(),
    );
    for (const event of matching) {
      result.push(toToolMessage(event));
      remaining.splice(remaining.indexOf(event), 1);
    }
  }
  return sortMessages([...result, ...remaining.map(toToolMessage)]);
}
