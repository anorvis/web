"use client";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { decodeUnknownResult } from "@/lib/effect/schema";
import { queryKeys } from "@/lib/query/keys";

const StreamEventSchema = Schema.Struct({
  type: Schema.optional(Schema.String),
});
const StreamEventMessageSchema = Schema.parseJson(StreamEventSchema);

type StreamEvent = typeof StreamEventSchema.Type;

const EVENT_TYPES = [
  "calendar.changed",
  "task.changed",
  "job.changed",
  "integration.changed",
  "auth.changed",
  "health.changed",
  "finance.changed",
  "run.log.appended",
  "agent.trace.finished",
];

function invalidateCalendarCaches() {
  window.dispatchEvent(new CustomEvent("anorvis:calendar-cache-invalidated"));
}

function invalidateLifeReadCaches() {
  window.dispatchEvent(new CustomEvent("anorvis:life-read-cache-invalidated"));
}

function invalidateForEvent(queryClient: QueryClient, type: string) {
  if (type.includes("calendar")) {
    invalidateLifeReadCaches();
    invalidateCalendarCaches();
    void queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
  } else if (type.includes("task")) {
    invalidateLifeReadCaches();
    invalidateCalendarCaches();
    void queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
    void queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.life.tasks() });
  } else if (type.includes("job")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.dev.jobs() });
  } else if (type.includes("finance")) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.finance.snapshot(),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
  } else if (type.includes("integration") || type.includes("auth")) {
    invalidateLifeReadCaches();
    void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.integrations() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
  } else if (type.includes("health")) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.health.dashboard(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.health.recipes(),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
  }
}

function parseEvent(message: MessageEvent<string>): StreamEvent | null {
  const decoded = decodeUnknownResult(StreamEventMessageSchema, message.data);
  return decoded.ok ? decoded.value : null;
}

export function AppQueryEvents() {
  const queryClient = useQueryClient();

  useMountEffect(() => {
    let closed = false;
    let events: EventSource | null = null;
    let reconnectTimer: number | null = null;
    const handleMessage = (message: MessageEvent<string>) => {
      const event = parseEvent(message);
      invalidateForEvent(queryClient, event?.type ?? message.type);
    };

    const closeEvents = () => {
      if (!events) return;
      for (const type of EVENT_TYPES) {
        events.removeEventListener(type, handleMessage);
      }
      events.close();
      events = null;
    };

    const reconnectEvents = () => {
      if (closed || reconnectTimer != null) return;
      closeEvents();
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        openEvents();
      }, 1_000);
    };

    const openEvents = () => {
      if (closed) return;
      closeEvents();
      events = new EventSource("/api/events");
      events.onerror = reconnectEvents;
      for (const type of EVENT_TYPES) {
        events.addEventListener(type, handleMessage);
      }
    };

    openEvents();

    return () => {
      closed = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      closeEvents();
    };
  });

  return null;
}
