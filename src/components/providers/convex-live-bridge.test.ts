import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, type Mock, vi } from "vitest";
import type { IntegrationPublication } from "@/lib/convex-functions";
import {
  type ConvexWatchClient,
  subscribeConvexLiveUpdates,
} from "./convex-live-bridge";

interface BridgeHarness {
  emit: (connections: IntegrationPublication[]) => void;
  fail: (error: Error) => void;
  cleanup: () => void;
  invalidations: Mock<QueryClient["invalidateQueries"]>;
  clearLife: Mock<() => void>;
  clearCalendar: Mock<() => void>;
  onError: Mock<(error: Error) => void>;
  unsubscribe: Mock<() => void>;
  onUpdate: Mock<(callback: () => void) => () => void>;
  events: string[];
}

function connection(
  provider: string,
  sequence: number,
): IntegrationPublication {
  return {
    provider,
    status: "connected",
    sync: { sequence, lastSyncedAt: 1_720_000_000_000 },
  };
}

function createHarness(): BridgeHarness {
  let current: IntegrationPublication[] | undefined;
  let watchError: Error | undefined;
  let notify = () => {};
  const unsubscribe = vi.fn();
  const onUpdate = vi.fn((callback: () => void) => {
    notify = callback;
    return unsubscribe;
  });
  const client: ConvexWatchClient = {
    watchQuery: vi.fn(() => ({
      onUpdate,
      localQueryResult: () => {
        if (!watchError) return current;
        const error = watchError;
        watchError = undefined;
        throw error;
      },
    })),
  };
  const events: string[] = [];
  const invalidations = vi.fn<QueryClient["invalidateQueries"]>(
    async (filters) => {
      events.push(`invalidate:${JSON.stringify(filters?.queryKey)}`);
    },
  );
  const clearLife = vi.fn(() => {
    events.push("clear:life");
  });
  const clearCalendar = vi.fn(() => {
    events.push("clear:calendar");
  });
  const onError = vi.fn();
  const cleanup = subscribeConvexLiveUpdates(client, {
    queryClient: { invalidateQueries: invalidations },
    clearLife,
    clearCalendar,
    onError,
  });
  return {
    emit: (connections) => {
      current = connections;
      notify();
    },
    fail: (error) => {
      watchError = error;
      notify();
    },
    cleanup,
    invalidations,
    clearLife,
    clearCalendar,
    onError,
    unsubscribe,
    onUpdate,
    events,
  };
}

function invalidatedKeys(
  harness: BridgeHarness,
): Array<readonly unknown[] | undefined> {
  return harness.invalidations.mock.calls.map((call) => call[0]?.queryKey);
}

const baseline = [
  connection("google", 4),
  connection("hevy", 7),
  connection("snaptrade", 2),
  connection("pinterest", 3),
];

describe("ConvexLiveBridge", () => {
  it("uses the first publication only as its sequence baseline", () => {
    const harness = createHarness();

    harness.emit(baseline);

    expect(harness.onUpdate).toHaveBeenCalledOnce();
    expect(harness.invalidations).not.toHaveBeenCalled();
    expect(harness.clearLife).not.toHaveBeenCalled();
    expect(harness.clearCalendar).not.toHaveBeenCalled();
  });

  it.each([
    {
      provider: "google",
      expected: [
        ["life", "snapshot"],
        ["life", "calendar"],
        ["overview"],
        ["integrations"],
      ],
      clearsLife: true,
      clearsCalendar: true,
    },
    {
      provider: "hevy",
      expected: [
        ["health", "dashboard"],
        ["health", "workouts"],
        ["health", "workout"],
        ["health", "sources"],
        ["health", "hevy-routines"],
        ["health", "hevy-exercise-templates"],
        ["life", "snapshot"],
        ["overview"],
        ["integrations"],
      ],
      clearsLife: true,
      clearsCalendar: false,
    },
    {
      provider: "snaptrade",
      expected: [
        ["finance", "snapshot"],
        ["finance", "snaptrade", "settings"],
        ["overview"],
        ["integrations"],
      ],
      clearsLife: false,
      clearsCalendar: false,
    },
    {
      provider: "pinterest",
      expected: [
        ["life", "pinterest", "board-images"],
        ["life", "snapshot"],
        ["overview"],
        ["integrations"],
      ],
      clearsLife: true,
      clearsCalendar: false,
    },
  ])(
    "fans out a $provider sequence increment to its exact prefixes once",
    ({ provider, expected, clearsLife, clearsCalendar }) => {
      const harness = createHarness();
      harness.emit(baseline);

      harness.emit(
        baseline.map((item) =>
          item.provider === provider
            ? connection(provider, item.sync.sequence + 1)
            : item,
        ),
      );

      expect(invalidatedKeys(harness)).toEqual(expected);
      expect(harness.clearLife).toHaveBeenCalledTimes(clearsLife ? 1 : 0);
      expect(harness.clearCalendar).toHaveBeenCalledTimes(
        clearsCalendar ? 1 : 0,
      );
      const firstInvalidation = harness.events.findIndex((event) =>
        event.startsWith("invalidate:"),
      );
      if (clearsLife) {
        expect(harness.events.indexOf("clear:life")).toBeLessThan(
          firstInvalidation,
        );
      }
      if (clearsCalendar) {
        expect(harness.events.indexOf("clear:calendar")).toBeLessThan(
          firstInvalidation,
        );
      }
    },
  );

  it("ignores equal and lower replayed sequence payloads", () => {
    const harness = createHarness();
    harness.emit([connection("hevy", 8)]);

    harness.emit([connection("hevy", 8)]);
    harness.emit([connection("hevy", 7)]);
    harness.emit([connection("hevy", 8)]);

    expect(harness.invalidations).not.toHaveBeenCalled();
    expect(harness.clearLife).not.toHaveBeenCalled();
  });

  it("combines simultaneous provider changes without duplicating shared keys", () => {
    const harness = createHarness();
    harness.emit(baseline);

    harness.emit([
      connection("google", 5),
      connection("hevy", 8),
      connection("snaptrade", 2),
      connection("pinterest", 4),
    ]);

    expect(invalidatedKeys(harness)).toEqual([
      ["life", "snapshot"],
      ["life", "calendar"],
      ["health", "dashboard"],
      ["health", "workouts"],
      ["health", "workout"],
      ["health", "sources"],
      ["health", "hevy-routines"],
      ["health", "hevy-exercise-templates"],
      ["life", "pinterest", "board-images"],
      ["overview"],
      ["integrations"],
    ]);
    expect(harness.clearLife).toHaveBeenCalledOnce();
    expect(harness.clearCalendar).toHaveBeenCalledOnce();
  });

  it("reports subscription errors without stopping later updates", () => {
    const harness = createHarness();
    const error = new Error("subscription failed");

    expect(() => harness.fail(error)).not.toThrow();
    expect(harness.onError).toHaveBeenCalledWith(error);

    harness.emit([connection("snaptrade", 1)]);
    harness.emit([connection("snaptrade", 2)]);
    expect(invalidatedKeys(harness)).toEqual([
      ["finance", "snapshot"],
      ["finance", "snaptrade", "settings"],
      ["overview"],
      ["integrations"],
    ]);
  });

  it("unsubscribes when its mount cleanup runs", () => {
    const harness = createHarness();

    harness.cleanup();

    expect(harness.unsubscribe).toHaveBeenCalledOnce();
  });
});
