import { Workspace, WorkspaceHeader } from "@/components/layout/workspace";
import { HealthDashboard } from "@/features/health/components/health-dashboard";
import { formatPageDate } from "@/lib/workspace/view-utils";

export default function Health() {
  return (
    <Workspace>
      <WorkspaceHeader
        header="health"
        title="health"
        subtitle={formatPageDate()}
        description="body, sleep, food, training, medical records, and habit signals"
      >
        <HealthDashboard />
      </WorkspaceHeader>
    </Workspace>
  );
}
