import { Workspace, WorkspaceHeader } from "@/components/layout/workspace";
import { FinanceDashboard } from "@/features/finance/components/finance-dashboard";
import { formatPageDate } from "@/lib/workspace/view-utils";

export default function Finance() {
  return (
    <Workspace>
      <WorkspaceHeader
        header="finance"
        title="finance"
        subtitle={formatPageDate()}
        description="accounts, transactions, positions, categories, planning, and simulation boundaries"
      >
        <FinanceDashboard />
      </WorkspaceHeader>
    </Workspace>
  );
}
