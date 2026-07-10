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
        description="read-only, multi-currency view of accounts, transactions, positions, and spending"
      >
        <FinanceDashboard />
      </WorkspaceHeader>
    </Workspace>
  );
}
