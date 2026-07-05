"use client";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { queryKeys } from "@/lib/query/keys";

type StreamEvent = {
  type?: string;
};

function invalidateForEvent(queryClient: QueryClient, type: string) {
  if (type.includes("calendar")) {
    void queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
  } else if (type.includes("task") || type.includes("job")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
    void queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dev.jobs() });
  } else if (type.includes("integration") || type.includes("auth")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.integrations() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
  } else if (type.includes("health")) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.health.dashboard(),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
  }
}

function parseEvent(message: MessageEvent<string>): StreamEvent | null {
  try {
    const parsed = JSON.parse(message.data) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as StreamEvent)
      : null;
  } catch {
    return null;
  }
}

export function AppQueryEvents() {
  const queryClient = useQueryClient();

  useMountEffect(() => {
    const events = new EventSource("/api/events");
    const handleMessage = (message: MessageEvent<string>) => {
      const event = parseEvent(message);
      invalidateForEvent(queryClient, event?.type ?? message.type);
    };

    const eventTypes = [
      "calendar.changed",
      "task.changed",
      "job.changed",
      "integration.changed",
      "auth.changed",
      "health.changed",
      "run.log.appended",
      "agent.trace.finished",
    ];
    for (const type of eventTypes) {
      events.addEventListener(type, handleMessage);
    }

    return () => {
      for (const type of eventTypes) {
        events.removeEventListener(type, handleMessage);
      }
      events.close();
    };
  });

  return null;
}
