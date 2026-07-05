import { Button } from "@anorvis/ui/button";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { initials } from "@/features/chat/api/client";
import { AgentBarSkeleton } from "@/features/chat/components/loading";
import { useChatController } from "@/features/chat/hooks/use-chat-controller";
import { useChatStore } from "@/features/chat/stores/chat-store";

export function AgentBar() {
  const { agents, selectedAgentKey, status } = useChatStore();
  const { selectAgent } = useChatController();
  if (status === "loading") {
    return <AgentBarSkeleton count={agents.length || undefined} />;
  }

  return agents.map((agent) => (
    <Button
      key={agent.key}
      type="button"
      variant="outline"
      className={cn(
        workspacePageStyles.actionButton,
        "h-auto min-w-36 justify-start gap-2 px-2.5 py-1.5 normal-case tracking-normal",
        agent.key === selectedAgentKey &&
          "border-foreground bg-foreground/5 text-foreground",
      )}
      onClick={() => void selectAgent(agent.key)}
    >
      <span
        className={cn(
          "grid size-7 place-items-center border border-border text-[0.6rem] font-semibold",
          agent.key === selectedAgentKey
            ? "border-foreground text-foreground"
            : "text-muted-foreground",
        )}
      >
        {initials(agent.name || agent.key)}
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-[0.65rem]">{agent.name}</span>
        <span className="block truncate text-[0.55rem] font-normal opacity-70">
          {agent.key}
        </span>
      </span>
    </Button>
  ));
}
