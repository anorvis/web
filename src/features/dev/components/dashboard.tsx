"use client";

import { Button } from "@anorvis/ui/button";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { useQueryClient } from "@tanstack/react-query";
import { AgentUsagePanel } from "@/features/dev/components/agent-usage";
import { MaintainerPanel } from "@/features/dev/components/maintainer-panel";
import { useDevStore } from "@/features/dev/stores/dev-store";
import { queryKeys } from "@/lib/query/keys";

export function DevPlatformDashboard() {
  const queryClient = useQueryClient();
  const { activeTab, setActiveTab } = useDevStore();

  const refresh = () => {
    if (activeTab === "operations") {
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
              activeTab === "operations" && "border-foreground text-foreground",
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
              activeTab === "maintainer" && "border-foreground text-foreground",
            )}
            onClick={() => setActiveTab("maintainer")}
          >
            maintainer
          </Button>
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

      {activeTab === "operations" ? <AgentUsagePanel /> : <MaintainerPanel />}
    </div>
  );
}
