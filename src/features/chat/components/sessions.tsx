import { Badge } from "@anorvis/ui/badge";
import { Button } from "@anorvis/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@anorvis/ui/card";
import { Input } from "@anorvis/ui/input";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import {
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
} from "lucide-react";
import { formatTime } from "@/features/chat/api/client";
import { SessionListSkeleton } from "@/features/chat/components/loading";
import { useChatController } from "@/features/chat/hooks/use-chat-controller";
import { useChatStore } from "@/features/chat/stores/chat-store";

export function SessionsPanel() {
  const agents = useChatStore((state) => state.agents);
  const query = useChatStore((state) => state.query);
  const selectedAgentKey = useChatStore((state) => state.selectedAgentKey);
  const selectedSessionId = useChatStore((state) => state.selectedSessionId);
  const sessions = useChatStore((state) => state.sessions);
  const sessionsLoading = useChatStore((state) => state.sessionsLoading);
  const sidebarCollapsed = useChatStore((state) => state.sidebarCollapsed);
  const status = useChatStore((state) => state.status);
  const setQuery = useChatStore((state) => state.setQuery);
  const setSidebarCollapsed = useChatStore(
    (state) => state.setSidebarCollapsed,
  );
  const { archiveSession, createSession, searchSessions, selectSession } =
    useChatController();
  const selectedAgent =
    agents.find((agent) => agent.key === selectedAgentKey) ?? null;
  const initialLoading = status === "loading";

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        className={cn(
          workspacePageStyles.actionButton,
          "absolute left-5 top-4 z-10",
        )}
        onClick={() => setSidebarCollapsed((current) => !current)}
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen className="size-3" />
        ) : (
          <PanelLeftClose className="size-3" />
        )}
        <span className="sr-only">
          {sidebarCollapsed ? "Show sessions" : "Collapse sessions"}
        </span>
      </Button>
      {!sidebarCollapsed && (
        <Card
          className={cn(workspacePageStyles.card, "min-h-0 overflow-hidden")}
        >
          <CardHeader className={cn(workspacePageStyles.cardHeader, "pl-16")}>
            <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-start gap-3">
              <div className="min-w-0">
                <p className={workspacePageStyles.cardLabel}>{"// sessions"}</p>
                <CardTitle className={workspacePageStyles.cardTitle}>
                  {selectedAgent?.name ?? "No agent selected"}
                </CardTitle>
                <CardDescription className={workspacePageStyles.cardBodyText}>
                  {sessions.length} session{sessions.length === 1 ? "" : "s"}
                </CardDescription>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className={cn(workspacePageStyles.actionButton)}
                onClick={() => void createSession()}
                disabled={!selectedAgentKey || sessionsLoading}
              >
                <Plus className="size-3" />
                <span className="sr-only">New conversation</span>
              </Button>
            </div>
            <form onSubmit={searchSessions} className="mt-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search messages"
                  className={cn(
                    workspacePageStyles.inlineInput,
                    "h-8 pl-7 text-[0.6rem] placeholder:text-[0.6rem] md:text-[0.6rem]",
                  )}
                />
              </div>
            </form>
          </CardHeader>

          <CardContent className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
            {initialLoading || sessionsLoading ? (
              <SessionListSkeleton />
            ) : sessions.length === 0 ? (
              <div className="border border-dashed border-border p-4 text-[0.65rem] text-muted-foreground">
                No matching sessions. Start a new conversation or try another
                search.
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group relative w-full border p-3 text-left transition hover:border-foreground hover:text-foreground",
                      session.id === selectedSessionId
                        ? "border-foreground bg-foreground/5"
                        : "border-border bg-transparent",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void selectSession(session)}
                      className="w-full text-left"
                    >
                      <div className="pr-20">
                        <p
                          className={cn(
                            workspacePageStyles.listLabel,
                            "line-clamp-1",
                          )}
                        >
                          {session.title}
                        </p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[0.65rem] text-muted-foreground">
                        {session.lastMessagePreview ?? "Empty conversation"}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[0.55rem] uppercase tracking-[0.25em] text-muted-foreground">
                        <span>{session.messageCount} messages</span>
                        <span>{formatTime(session.lastMessageAt)}</span>
                      </div>
                    </button>
                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void archiveSession(session)}
                        className="flex size-6 items-center justify-center text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                        aria-label="Archive chat"
                      >
                        <Archive className="size-3" />
                      </button>
                      <Badge
                        variant="outline"
                        className={workspacePageStyles.badgeSmall}
                      >
                        {session.surface}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
