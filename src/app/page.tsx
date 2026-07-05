import { Workspace, WorkspaceHeader } from "@/components/layout/workspace";
import { HomeDashboard } from "@/features/life-intelligence/components/pages";
import { formatPageDate } from "@/lib/workspace/view-utils";

export default function Home() {
  return (
    <Workspace>
      <WorkspaceHeader
        header="home"
        title="home"
        subtitle={formatPageDate()}
        description="cross-pillar discoveries, signals, and recommended experiments"
      >
        <HomeDashboard />
      </WorkspaceHeader>
    </Workspace>
  );
}
