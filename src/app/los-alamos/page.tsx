import { Workspace, WorkspaceHeader } from "@/components/layout/workspace";
import { LosAlamosDashboard } from "@/features/life-intelligence/components/pages";
import { formatPageDate } from "@/lib/workspace/view-utils";

export default function LosAlamos() {
  return (
    <Workspace>
      <WorkspaceHeader
        header="los alamos"
        title="los alamos"
        subtitle={formatPageDate()}
        description="lab space for models, simulations, research, and deeper experiments"
      >
        <LosAlamosDashboard />
      </WorkspaceHeader>
    </Workspace>
  );
}
