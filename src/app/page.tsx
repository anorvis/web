import { Workspace, WorkspaceHeader } from "@/components/layout/workspace";
import { GoogleSyncArrival } from "@/features/integrations/components/google-sync-arrival";
import { HomeDashboard } from "@/features/overview/components/home-dashboard";
import { IntegrationsCatalog } from "@/features/overview/components/integrations-catalog";
import { formatPageDate } from "@/lib/workspace/view-utils";

export default function Home() {
  return (
    <Workspace>
      <WorkspaceHeader header="home" title="home" subtitle={formatPageDate()}>
        <GoogleSyncArrival />
        <HomeDashboard />
        <IntegrationsCatalog />
      </WorkspaceHeader>
    </Workspace>
  );
}
