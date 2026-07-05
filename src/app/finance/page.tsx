import { Workspace, WorkspaceHeader } from "@/components/layout/workspace";
import { FinanceSurface } from "@/features/life-intelligence/components/pages";
import { formatPageDate } from "@/lib/workspace/view-utils";

export default function Finance() {
  return (
    <Workspace>
      <WorkspaceHeader
        header="finance"
        title="finance"
        subtitle={formatPageDate()}
        description="cashflow, allocation planning, money movement, and future scenarios"
      >
        <FinanceSurface />
      </WorkspaceHeader>
    </Workspace>
  );
}
