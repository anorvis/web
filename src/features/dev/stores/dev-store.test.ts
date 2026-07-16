import { afterEach, describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/query/keys";
import { useDevStore } from "./dev-store";

afterEach(() => {
  useDevStore.getState().setActiveTab("operations");
});

describe("dev tab state", () => {
  it("starts on operations and keeps its context query isolated", () => {
    expect(useDevStore.getState().activeTab).toBe("operations");
    expect(queryKeys.dev.context()).toEqual(["dev", "context"]);
  });

  it("switches to the maintainer tab with isolated query keys", () => {
    useDevStore.getState().setActiveTab("maintainer");
    expect(useDevStore.getState().activeTab).toBe("maintainer");

    expect(queryKeys.dev.maintainerStatus()).toEqual([
      "dev",
      "maintainer",
      "status",
    ]);
    expect(queryKeys.dev.maintainerTickets("pending", 2)).toEqual([
      "dev",
      "maintainer",
      "tickets",
      "pending",
      2,
    ]);
  });
});
