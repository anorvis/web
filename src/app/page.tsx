import { Workspace, WorkspaceHeader } from "@/components/layout/workspace";
import { GoogleSyncArrival } from "@/features/integrations/components/google-sync-arrival";
import { HomeDashboard } from "@/features/overview/components/home-dashboard";
import { formatPageDate } from "@/lib/workspace/view-utils";

export default function Home() {
  return (
    <Workspace>
      <WorkspaceHeader
        header="home"
        title="home"
        subtitle={formatPageDate()}
        className="h-[min(48rem,calc(100dvh-5rem))]"
      >
        <GoogleSyncArrival />
        <HomeDashboard />
      </WorkspaceHeader>
    </Workspace>
  );
}
