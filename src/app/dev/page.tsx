import { Workspace, WorkspaceHeader } from "@/components/layout/workspace";
import { DevPlatformDashboard } from "@/features/dev/components/dashboard";
import { DevOwnerGate } from "@/features/dev/components/owner-gate";
import { formatPageDate } from "@/lib/workspace/view-utils";

export default async function Dev() {
  return (
    <DevOwnerGate>
      <Workspace>
        <WorkspaceHeader
          header="terminal"
          title="dev"
          subtitle={formatPageDate()}
          description={`"the best way to predict the future is to invent it."`}
        >
          <DevPlatformDashboard />
        </WorkspaceHeader>
      </Workspace>
    </DevOwnerGate>
  );
}
