"use client";

import { Button } from "@anorvis/ui/button";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMaintainerStatus } from "@/features/dev/api/dev";
import { AgentUsagePanel } from "@/features/dev/components/agent-usage";
import { MaintainerPanel } from "@/features/dev/components/maintainer-panel";
import { useDevStore } from "@/features/dev/stores/dev-store";
import { queryKeys } from "@/lib/query/keys";

export function DevPlatformDashboard() {
  const queryClient = useQueryClient();
  const { activeTab, setActiveTab } = useDevStore();
  const statusQuery = useQuery({
    queryKey: queryKeys.dev.maintainerStatus(),
    queryFn: fetchMaintainerStatus,
  });
  // Fail closed: installs without the maintainer never see its surfaces, so
  // that tab renders only once the local gateway confirms it is enabled.
  // While loading, on gateway errors, or when disabled a stale maintainer
  // selection collapses back to operations. The monitor tab has no such
  // gate: monitor telemetry is local and stays visible regardless of the
  // maintainer status request.
  const maintainerVisible = statusQuery.data?.enabled === true;
  const tab =
    activeTab === "maintainer" && !maintainerVisible ? "operations" : activeTab;

  const refresh = () => {
    if (tab === "maintainer") {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dev.maintainerStatus(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dev.maintainerTicketsRoot(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dev.maintainerLinear(),
      });
      return;
    }
    // Operations and monitor both render agent usage; one root key covers
    // every scope and page.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.dev.agentUsageRoot(),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              workspacePageStyles.actionButton,
              tab === "operations" && "border-foreground text-foreground",
            )}
            onClick={() => setActiveTab("operations")}
          >
            operations
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              workspacePageStyles.actionButton,
              tab === "monitor" && "border-foreground text-foreground",
            )}
            onClick={() => setActiveTab("monitor")}
          >
            monitor
          </Button>
          {maintainerVisible ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                workspacePageStyles.actionButton,
                tab === "maintainer" && "border-foreground text-foreground",
              )}
              onClick={() => setActiveTab("maintainer")}
            >
              maintainer
            </Button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={workspacePageStyles.actionButton}
          onClick={refresh}
        >
          refresh
        </Button>
      </div>

      {tab === "maintainer" ? (
        <MaintainerPanel />
      ) : tab === "monitor" ? (
        <AgentUsagePanel key="monitor" scope="monitor" />
      ) : (
        <AgentUsagePanel
          key="operations"
          maintainerScopeVisible={maintainerVisible}
        />
      )}
    </div>
  );
}
