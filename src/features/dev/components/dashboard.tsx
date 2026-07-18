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
  // the tab renders only once the local gateway confirms it is enabled.
  // While loading, on gateway errors, or when disabled the derived tab
  // collapses back to operations even if the store still says maintainer.
  const maintainerVisible = statusQuery.data?.enabled === true;
  const tab = maintainerVisible ? activeTab : "operations";

  const refresh = () => {
    if (tab === "operations") {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dev.agentUsageRoot(),
      });
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: queryKeys.dev.maintainerStatus(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.dev.maintainerTicketsRoot(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.dev.maintainerLinear(),
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
      ) : (
        <AgentUsagePanel maintainerScopeVisible={maintainerVisible} />
      )}
    </div>
  );
}
