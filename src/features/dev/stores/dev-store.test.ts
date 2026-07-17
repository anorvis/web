import { afterEach, describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/query/keys";
import { useDevStore } from "./dev-store";

afterEach(() => {
  useDevStore.getState().setActiveTab("operations");
});

describe("dev tab state", () => {
  it("starts on operations", () => {
    expect(useDevStore.getState().activeTab).toBe("operations");
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
