import { Workspace, WorkspaceHeader } from "@/components/layout/workspace";
import { Chat } from "@/features/chat/components/chat";
import { formatPageDate } from "@/lib/workspace/view-utils";

export default function ChatPage() {
  return (
    <Workspace>
      <WorkspaceHeader
        header="agents"
        title="chat"
        subtitle={formatPageDate()}
        description="direct agent conversations"
        className="h-[calc(100vh-5.75rem)] overflow-hidden"
      >
        <Chat className="min-h-0 flex-1 p-0" pageMode />
      </WorkspaceHeader>
    </Workspace>
  );
}
