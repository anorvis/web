import { parseLiveTranscript } from "@/features/chat/components/messages";
import {
  getChatLiveRunId,
  setChatLiveRunId,
} from "@/features/chat/hooks/use-chat-controller";
import { useChatStore } from "@/features/chat/stores/chat-store";
import { useMountEffect } from "@/hooks/use-mount-effect";

type StreamEvent = {
  type: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
};

type PiSessionResponse = {
  content: string | null;
};

const MAX_LIVE_ACTIVITY_MESSAGES = 300;

async function fetchPiSession(
  runId: string,
): Promise<PiSessionResponse | null> {
  const response = await fetch(
    `/api/dev/runs/${encodeURIComponent(runId)}/pi-session`,
    { cache: "no-store" },
  );
  if (response.status === 404 || response.status === 502) return null;
  if (!response.ok) {
    throw new Error(`Pi session request failed with status ${response.status}`);
  }
  return (await response.json()) as PiSessionResponse;
}

export function useLiveActivity() {
  const { setLiveActivityMessages } = useChatStore();
  useMountEffect(() => {
    const events = new EventSource("/api/events");

    const appendLiveActivity = (label: string, event: StreamEvent) => {
      setLiveActivityMessages((current) => {
        const next = [
          ...current,
          {
            id: `live-${event.type}-${event.createdAt ?? Date.now()}-${current.length}`,
            sender: "tool",
            displayName: "Activity",
            content: label,
            createdAt: event.createdAt ?? new Date().toISOString(),
          },
        ];
        return next.slice(-MAX_LIVE_ACTIVITY_MESSAGES);
      });
    };

    const parseEvent = (message: MessageEvent<string>): StreamEvent | null => {
      try {
        const parsed = JSON.parse(message.data) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return null;
        }
        const record = parsed as Record<string, unknown>;
        return {
          type: typeof record.type === "string" ? record.type : message.type,
          payload:
            record.payload &&
            typeof record.payload === "object" &&
            !Array.isArray(record.payload)
              ? (record.payload as Record<string, unknown>)
              : undefined,
          createdAt:
            typeof record.createdAt === "string" ? record.createdAt : undefined,
        };
      } catch {
        return null;
      }
    };

    const handleStarted = (message: MessageEvent<string>) => {
      const event = parseEvent(message);
      const payload = event?.payload;
      if (!event || payload?.agent !== useChatStore.getState().selectedAgentKey)
        return;
      const runId = typeof payload.runId === "string" ? payload.runId : null;
      setChatLiveRunId(runId);
      setLiveActivityMessages([]);
      appendLiveActivity("Tool call: started agent run", event);
    };

    const handleLog = (message: MessageEvent<string>) => {
      const event = parseEvent(message);
      const payload = event?.payload;
      if (!event || payload?.runId !== getChatLiveRunId()) return;
      const logType =
        typeof payload.type === "string" ? payload.type : event.type;
      appendLiveActivity(`Tool call: ${logType}`, event);
    };

    const handleFinished = (message: MessageEvent<string>) => {
      const event = parseEvent(message);
      const payload = event?.payload;
      if (!event || payload?.runId !== getChatLiveRunId()) return;
      appendLiveActivity("Tool result: finished agent run", event);
      setChatLiveRunId(null);
    };

    const handleFailed = (message: MessageEvent<string>) => {
      const event = parseEvent(message);
      const payload = event?.payload;
      if (!event || payload?.runId !== getChatLiveRunId()) return;
      appendLiveActivity("Tool result: agent run failed", event);
      setChatLiveRunId(null);
    };

    events.addEventListener("agent.trace.started", handleStarted);
    events.addEventListener("run.log.appended", handleLog);
    events.addEventListener("agent.trace.finished", handleFinished);
    events.addEventListener("agent.trace.failed", handleFailed);

    return () => {
      events.removeEventListener("agent.trace.started", handleStarted);
      events.removeEventListener("run.log.appended", handleLog);
      events.removeEventListener("agent.trace.finished", handleFinished);
      events.removeEventListener("agent.trace.failed", handleFailed);
      events.close();
    };
  });

  useMountEffect(() => {
    let inFlight = false;
    const pollTranscript = async () => {
      const runId = getChatLiveRunId();
      if (!runId || inFlight) return;
      inFlight = true;
      try {
        const payload = await fetchPiSession(runId);
        if (!payload?.content) return;
        const transcriptMessages = parseLiveTranscript({
          runId,
          content: payload.content,
        });
        if (transcriptMessages.length > 0 && getChatLiveRunId() === runId) {
          setLiveActivityMessages(transcriptMessages);
        }
      } catch (error) {
        console.error(error);
      } finally {
        inFlight = false;
      }
    };

    const interval = window.setInterval(() => {
      void pollTranscript();
    }, 750);

    return () => window.clearInterval(interval);
  });
}
