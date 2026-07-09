import { Workspace, WorkspaceHeader } from "@/components/layout/workspace";
import { HomeDashboard } from "@/features/overview/components/home-dashboard";
import { formatPageDate } from "@/lib/workspace/view-utils";

export default function Home() {
  return (
    <Workspace>
      <WorkspaceHeader
        header="home"
        title="home"
        subtitle={formatPageDate()}
        description="cross-pillar discoveries, signals, and recommendations"
      >
        <HomeDashboard />
      </WorkspaceHeader>
    </Workspace>
  );
}
