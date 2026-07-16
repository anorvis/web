import { afterEach, describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/query/keys";
import { useDevStore } from "./dev-store";

afterEach(() => {
  useDevStore.getState().setActiveTab("operations");
});

describe("dev operations state", () => {
  it("starts on operations and keeps its context query isolated", () => {
    expect(useDevStore.getState().activeTab).toBe("operations");
    expect(queryKeys.dev.context()).toEqual(["dev", "context"]);

    useDevStore.getState().setActiveTab("jobs");
    expect(useDevStore.getState().activeTab).toBe("jobs");
  });
});
