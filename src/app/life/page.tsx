import { Workspace, WorkspaceHeader } from "@/components/layout/workspace";
import { GoogleSyncArrival } from "@/features/integrations/components/google-sync-arrival";
import { LifeDashboard } from "@/features/life/components/life-dashboard";
import { formatPageDate } from "@/lib/workspace/view-utils";

export default function Life() {
  return (
    <Workspace>
      <WorkspaceHeader
        header="life"
        title="life"
        subtitle={formatPageDate()}
        description="time, attention, commitments, routines, and reviewable agent changes"
      >
        <GoogleSyncArrival />
        <LifeDashboard />
      </WorkspaceHeader>
    </Workspace>
  );
}
