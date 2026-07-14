import "server-only";

import { fetchOverview } from "@/features/overview/api/overview";
import type { OverviewData } from "@/features/overview/types/overview";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

type GatewayAgent = {
  key: string;
  name: string;
};

async function getAgentRuntime(): Promise<
  Pick<OverviewData, "agentStatus" | "agentCount">
> {
  try {
    // Process-local sidecar status: this remains on the local gateway because it
    // describes live agent processes, not durable product data.
    const agents = await gatewayFetchJson<GatewayAgent[]>("/v1/agents");
    return {
      agentStatus: agents.length > 0 ? "online" : "idle",
      agentCount: agents.length,
    };
  } catch {
    return { agentStatus: "offline", agentCount: 0 };
  }
}

export async function getOverviewData(
  _timezone: string,
): Promise<OverviewData> {
  const [overview, agentRuntime] = await Promise.all([
    fetchOverview(),
    getAgentRuntime(),
  ]);
  return {
    ...overview,
    ...agentRuntime,
  };
}
