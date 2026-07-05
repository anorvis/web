import { Workspace, WorkspaceHeader } from "@/components/layout/workspace";
import { LifeDashboard } from "@/features/life/components/life-dashboard";
import { formatPageDate } from "@/lib/workspace/view-utils";

export default function Life() {
  return (
    <Workspace>
      <WorkspaceHeader
        header="life"
        title="life"
        subtitle={formatPageDate()}
        description={`"memento mori."`}
      >
        <LifeDashboard />
      </WorkspaceHeader>
    </Workspace>
  );
}
