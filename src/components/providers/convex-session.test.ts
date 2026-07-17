import { afterEach, describe, expect, it, vi } from "vitest";
import { startSilentRetry } from "./convex-session";

afterEach(() => {
  vi.useRealTimers();
});

describe("startSilentRetry", () => {
  it("recovers silently after a transient startup failure", async () => {
    vi.useFakeTimers();
    const task = vi
      .fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(new Error("backend starting"))
      .mockResolvedValueOnce(true);
    const onSuccess = vi.fn();

    const stop = startSilentRetry(task, onSuccess);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);

    expect(task).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledOnce();
    stop();
  });

  it("cancels a pending retry on unmount", async () => {
    vi.useFakeTimers();
    const task = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);

    const stop = startSilentRetry(task);
    await Promise.resolve();
    stop();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(task).toHaveBeenCalledOnce();
  });
});
