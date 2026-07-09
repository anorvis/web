"use client";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { decodeUnknownResult } from "@/lib/effect/schema";
import {
  checkBrowserLocalBackendToken,
  ensureBrowserLocalBackendToken,
  getStoredBrowserLocalBackendToken,
  resolveBrowserLocalBackendUrl,
  shouldUseBrowserLocalBackend,
} from "@/lib/local-backend-client";
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
    void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
  }
}

function parseEvent(message: MessageEvent<string>): StreamEvent | null {
  const decoded = decodeUnknownResult(StreamEventMessageSchema, message.data);
  return decoded.ok ? decoded.value : null;
}

function eventSourceUrl(token?: string) {
  if (!shouldUseBrowserLocalBackend()) return "/api/events";
  if (!token) return null;
  const url = new URL("/v1/events", resolveBrowserLocalBackendUrl());
  url.searchParams.set("access_token", token);
  return url.toString();
}

export function AppQueryEvents() {
  const queryClient = useQueryClient();

  useMountEffect(() => {
    let closed = false;
    let events: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let browserLocalAuthStale = false;
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

    const reconnectBrowserLocalEvents = () => {
      if (
        closed ||
        !shouldUseBrowserLocalBackend() ||
        reconnectTimer != null ||
        browserLocalAuthStale
      ) {
        return;
      }
      closeEvents();
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void verifyBrowserLocalAuthAndReopen();
      }, 1_000);
    };

    const verifyBrowserLocalAuthAndReopen = async () => {
      const token = getStoredBrowserLocalBackendToken();
      if (token) {
        const tokenAccepted = await checkBrowserLocalBackendToken(token).catch(
          () => true,
        );
        if (!tokenAccepted) {
          browserLocalAuthStale = true;
          window.dispatchEvent(
            new CustomEvent("anorvis:local-backend-auth-stale"),
          );
          return;
        }
      }
      await openEvents();
    };

    const openEvents = async () => {
      let token: string | undefined;
      try {
        token = shouldUseBrowserLocalBackend()
          ? await ensureBrowserLocalBackendToken()
          : undefined;
      } catch {
        browserLocalAuthStale = true;
        window.dispatchEvent(
          new CustomEvent("anorvis:local-backend-auth-stale"),
        );
        return;
      }
      const url = eventSourceUrl(token);
      if (closed || !url) return;
      closeEvents();
      events = new EventSource(url);
      events.onerror = reconnectBrowserLocalEvents;
      for (const type of EVENT_TYPES) {
        events.addEventListener(type, handleMessage);
      }
    };

    void openEvents();

    return () => {
      closed = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      closeEvents();
    };
  });

  return null;
}
