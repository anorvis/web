"use client";

import { Badge } from "@anorvis/ui/badge";
import { Button } from "@anorvis/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@anorvis/ui/card";
import { Spinner } from "@anorvis/ui/spinner";
import { chatStyles, workspacePageStyles } from "@anorvis/ui/styles";
import { Textarea } from "@anorvis/ui/textarea";
import { cn } from "@anorvis/ui/utils";
import {
  ArrowDown,
  Check,
  Copy,
  Maximize2,
  Minimize2,
  Pencil,
  Send,
  X,
} from "lucide-react";
import { memo, useMemo, useRef } from "react";
import {
  fetchAgents,
  formatTime,
  type GatewayMessage,
  initials,
} from "@/features/chat/api/client";
import { ConversationSkeleton } from "@/features/chat/components/loading";
import {
  ActivityGroup,
  groupChatMessages,
  MessageContent,
} from "@/features/chat/components/messages";
import { SessionsPanel } from "@/features/chat/components/sessions";
import { useChatController } from "@/features/chat/hooks/use-chat-controller";
import { useLiveActivity } from "@/features/chat/hooks/use-live-activity";
import { useChatStore } from "@/features/chat/stores/chat-store";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useMountEffect } from "@/hooks/use-mount-effect";

type ChatProps = {
  className?: string;
  onClose?: () => void;
  pageMode?: boolean;
};

function placeCaretAtEnd(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function truncateSessionId(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export function Chat({ className, onClose, pageMode = false }: ChatProps) {
  const agents = useChatStore((state) => state.agents);
  const sessions = useChatStore((state) => state.sessions);
  const messages = useChatStore((state) => state.messages);
  const liveActivityMessages = useChatStore(
    (state) => state.liveActivityMessages,
  );
  const status = useChatStore((state) => state.status);
  const sessionsLoading = useChatStore((state) => state.sessionsLoading);
  const messagesLoading = useChatStore((state) => state.messagesLoading);
  const error = useChatStore((state) => state.error);
  const selectedAgentKey = useChatStore((state) => state.selectedAgentKey);
  const selectedSessionId = useChatStore((state) => state.selectedSessionId);
  const sidebarCollapsed = useChatStore((state) => state.sidebarCollapsed);
  const isFullscreen = useChatStore((state) => state.isFullscreen);
  const setSelectedAgentKey = useChatStore(
    (state) => state.setSelectedAgentKey,
  );
  const setIsFullscreen = useChatStore((state) => state.setIsFullscreen);
  const setAgents = useChatStore((state) => state.setAgents);
  const setStatus = useChatStore((state) => state.setStatus);
  const setError = useChatStore((state) => state.setError);
  const { loadSessionsForAgent } = useChatController();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.key === selectedAgentKey) ?? null,
    [agents, selectedAgentKey],
  );
  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );
  const chatRenderItems = useMemo(
    () => groupChatMessages([...messages, ...liveActivityMessages]),
    [messages, liveActivityMessages],
  );
  const isAgentResponding = status === "sending";
  const displayStatus =
    isAgentResponding || status === "error"
      ? status
      : sessionsLoading || messagesLoading || status === "loading"
        ? "loading"
        : "idle";
  const initialChatLoading = status === "loading";

  const { isAtBottom, scrollToBottom } = useChatScroll({
    scrollRef,
    loadMoreRef,
    messageCount:
      messages.length +
      liveActivityMessages.length +
      (isAgentResponding ? 1 : 0),
    totalCount:
      messages.length +
      liveActivityMessages.length +
      (isAgentResponding ? 1 : 0),
    hasMore: false,
    loadMore: async () => {},
  });

  useLiveActivity();

  useMountEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const availableAgents = await fetchAgents();
        if (cancelled) return;
        setAgents(availableAgents);
        const firstAgent = availableAgents[0]?.key ?? null;
        setSelectedAgentKey(firstAgent);
        if (firstAgent) {
          await loadSessionsForAgent(firstAgent, "");
        } else {
          setStatus("idle");
        }
      } catch (initError) {
        if (!cancelled) {
          setError(
            initError instanceof Error
              ? initError.message
              : "failed to connect to anorvis-os",
          );
          setStatus("error");
        }
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  });

  return (
    <div
      className={cn(
        chatStyles.shell,
        isFullscreen && chatStyles.fullscreen,
        className,
      )}
    >
      {!pageMode && (
        <header
          className={cn(
            workspacePageStyles.header,
            "flex shrink-0 items-start justify-between gap-4",
          )}
        >
          <div className="min-w-0 space-y-2">
            <p className={workspacePageStyles.eyebrow}>{"// chat"}</p>
            <h1 className={workspacePageStyles.title}>Agent conversations</h1>
            <p className={workspacePageStyles.subtitle}>
              Choose an agent, then search or resume one of their OS sessions.
            </p>
          </div>
          <div className={chatStyles.statusRow}>
            {displayStatus === "loading" || displayStatus === "sending" ? (
              <Spinner className="size-4" />
            ) : null}
            <Badge
              variant={displayStatus === "error" ? "destructive" : "outline"}
              className={workspacePageStyles.badge}
            >
              {displayStatus}
            </Badge>
            {onClose && (
              <Button
                variant="outline"
                size="icon-sm"
                className={cn(
                  chatStyles.closeButton,
                  "border-red-500/40 text-red-500 hover:border-red-500 hover:bg-red-500/10 hover:text-red-600",
                )}
                onClick={onClose}
              >
                <X className="size-3" />
                <span className="sr-only">Close</span>
              </Button>
            )}
          </div>
        </header>
      )}

      {error && <div className={workspacePageStyles.errorText}>{error}</div>}

      <div
        className={cn(
          chatStyles.layout,
          sidebarCollapsed
            ? chatStyles.layoutCollapsed
            : chatStyles.layoutExpanded,
        )}
      >
        <SessionsPanel />

        <Card
          className={cn(workspacePageStyles.card, "min-h-0 overflow-hidden")}
        >
          <CardHeader
            className={cn(
              workspacePageStyles.cardHeader,
              sidebarCollapsed && "pl-16",
            )}
          >
            <div className={chatStyles.conversationHeader}>
              <div className="flex min-w-0 items-center gap-3">
                <div className={chatStyles.avatar}>
                  {initials(selectedAgent?.name ?? "Agent")}
                </div>
                <div className="min-w-0">
                  <p className={workspacePageStyles.cardLabel}>
                    {"// conversation"}
                  </p>
                  <CardTitle className={workspacePageStyles.cardTitle}>
                    {selectedAgent?.name ?? "Select an agent"}
                  </CardTitle>
                  <CardDescription
                    className={cn(workspacePageStyles.cardBodyText, "min-w-0")}
                  >
                    {messagesLoading
                      ? "Loading conversation"
                      : isAgentResponding
                        ? `${selectedAgent?.name ?? "Agent"} is responding`
                        : selectedSession
                          ? null
                          : "Choose or start a session"}
                  </CardDescription>
                  {!messagesLoading && !isAgentResponding && selectedSession ? (
                    <div className={chatStyles.sessionIdRow}>
                      <span className="truncate">
                        Session {truncateSessionId(selectedSession.piSessionId)}
                      </span>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className={chatStyles.sessionCopyButton}
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            selectedSession.piSessionId,
                          )
                        }
                      >
                        <Copy className="size-3" />
                        <span className="sr-only">Copy session id</span>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className={cn(workspacePageStyles.actionButton, "shrink-0")}
                onClick={() => setIsFullscreen((current) => !current)}
              >
                {isFullscreen ? (
                  <Minimize2 className="size-3" />
                ) : (
                  <Maximize2 className="size-3" />
                )}
                <span className="sr-only">
                  {isFullscreen ? "Exit fullscreen" : "Open fullscreen"}
                </span>
              </Button>
            </div>
          </CardHeader>

          <CardContent ref={scrollRef} className={chatStyles.cardContent}>
            {initialChatLoading || messagesLoading ? (
              <ConversationSkeleton />
            ) : messages.length === 0 ? (
              <div className={chatStyles.emptyState}>
                <div className={chatStyles.emptyAvatar}>
                  {initials(selectedAgent?.name ?? "Agent")}
                </div>
                <h2 className={workspacePageStyles.cardTitle}>
                  Start a conversation with {selectedAgent?.name ?? "an agent"}
                </h2>
                <p className={chatStyles.emptyText}>
                  Pick an existing OS session, search by message contents, or
                  send a message to create a new session.
                </p>
              </div>
            ) : (
              <div className={chatStyles.messageList}>
                {chatRenderItems.map((item) => {
                  if (item.type === "activityGroup") {
                    const isLiveGroup = item.messages.some((message) =>
                      message.id.startsWith("live-"),
                    );
                    return (
                      <div key={item.id} className="flex justify-start">
                        <ActivityGroup
                          messages={item.messages}
                          live={isLiveGroup && isAgentResponding}
                        />
                      </div>
                    );
                  }

                  const message = item.message;
                  return <ChatMessageRow key={item.id} message={message} />;
                })}
                {isAgentResponding && selectedAgent && (
                  <div className="flex justify-start">
                    <div className={chatStyles.pendingMessage}>
                      <div className={chatStyles.messageMeta}>
                        <Spinner className="size-3" />
                        <span>{selectedAgent.name} responding</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            chatStyles.typingDot,
                            chatStyles.typingDotStrong,
                          )}
                        />
                        <span
                          className={cn(
                            chatStyles.typingDot,
                            chatStyles.typingDotMedium,
                          )}
                        />
                        <span
                          className={cn(
                            chatStyles.typingDot,
                            chatStyles.typingDotWeak,
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={loadMoreRef} />
            {!isAtBottom && !initialChatLoading && !messagesLoading && (
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className={chatStyles.jumpToBottomButton}
                onClick={() => scrollToBottom("smooth")}
              >
                <ArrowDown className="size-3" />
                <span className="sr-only">Jump to latest message</span>
              </Button>
            )}
          </CardContent>

          <ChatComposer selectedAgentName={selectedAgent?.name ?? null} />
        </Card>
      </div>
    </div>
  );
}

const ChatMessageRow = memo(function ChatMessageRow({
  message,
}: {
  message: GatewayMessage;
}) {
  const isUser = message.sender === "user";
  const status = useChatStore((state) => state.status);
  const editingMessage = useChatStore((state) => state.editingMessage);
  const { cancelEdit, editMessage, setEditingDraft, submitEdit } =
    useChatController();
  const isEditing = editingMessage?.id === message.id;
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={chatStyles.messageCluster}>
        <div
          className={cn(
            chatStyles.messageBubble,
            isUser
              ? chatStyles.userMessageBubble
              : chatStyles.agentMessageBubble,
          )}
        >
          <div className={chatStyles.messageMeta}>
            <span>{isUser ? "You" : message.displayName}</span>
            <span>{formatTime(message.createdAt)}</span>
          </div>
          {isEditing ? (
            <div
              key={editingMessage.id}
              ref={(element) => {
                if (!element || status === "sending") return;
                if (element.dataset.initialized === "true") return;
                element.textContent = editingMessage.draft;
                element.dataset.initialized = "true";
                requestAnimationFrame(() => {
                  element.focus();
                  placeCaretAtEnd(element);
                });
              }}
              contentEditable={status !== "sending"}
              suppressContentEditableWarning
              className={chatStyles.inlineEditText}
              onInput={(event) =>
                setEditingDraft(event.currentTarget.innerText)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitEdit();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEdit();
                }
              }}
            />
          ) : (
            <MessageContent content={message.content} />
          )}
        </div>
        {isUser && (
          <div className={chatStyles.messageActionRow}>
            {isEditing ? (
              <>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className={chatStyles.editCancelButton}
                  onClick={cancelEdit}
                  disabled={status === "sending"}
                >
                  <X className="size-3" />
                  <span className="sr-only">Cancel edit</span>
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className={chatStyles.inlineEditSubmitButton}
                  disabled={
                    !editingMessage.draft.trim() || status === "sending"
                  }
                  onClick={() => void submitEdit()}
                >
                  {status === "sending" ? (
                    <Spinner className="size-3" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  <span className="sr-only">Submit edit</span>
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className={chatStyles.messageEditButton}
                disabled={status === "sending"}
                onClick={() => editMessage(message)}
              >
                <Pencil className="size-3" />
                <span className="sr-only">Edit message</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

function ChatComposer({
  selectedAgentName,
}: {
  selectedAgentName: string | null;
}) {
  const input = useChatStore((state) => state.input);
  const selectedAgentKey = useChatStore((state) => state.selectedAgentKey);
  const status = useChatStore((state) => state.status);
  const setInput = useChatStore((state) => state.setInput);
  const { sendMessage } = useChatController();
  const isAgentResponding = status === "sending";

  return (
    <form onSubmit={sendMessage} className={chatStyles.composer}>
      <div className={chatStyles.composerInner}>
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={
            selectedAgentName
              ? `Message ${selectedAgentName}`
              : "Select an agent to start"
          }
          rows={1}
          disabled={!selectedAgentKey || status === "sending"}
          className={cn(
            chatStyles.textarea,
            "max-h-36 min-h-14 text-[0.6rem] leading-relaxed placeholder:text-[0.6rem] md:text-[0.6rem]",
          )}
        />
        <Button
          type="submit"
          variant="outline"
          size="icon-sm"
          className={chatStyles.sendButton}
          disabled={!input.trim() || !selectedAgentKey || status === "sending"}
        >
          {isAgentResponding ? (
            <Spinner className="size-3" />
          ) : (
            <Send className="size-3" />
          )}
          <span className="sr-only">
            {isAgentResponding ? "Sending" : "Send"}
          </span>
        </Button>
      </div>
    </form>
  );
}
