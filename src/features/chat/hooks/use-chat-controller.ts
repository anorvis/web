import {
  archiveSession,
  cacheSession,
  createSession,
  fetchMessages,
  fetchRuns,
  fetchSessions,
  type GatewayMessage,
  type GatewaySessionSummary,
  mergeSessionLists,
  postMessage,
  readCachedSessions,
  removeCachedSession,
  rewindSession,
} from "@/features/chat/api/client";
import { useChatStore } from "@/features/chat/stores/chat-store";

let loadSequence = 0;
let liveRunId: string | null = null;

export function setChatLiveRunId(runId: string | null) {
  liveRunId = runId;
}

export function getChatLiveRunId() {
  return liveRunId;
}

function setBusy(sessionsLoading: boolean, messagesLoading: boolean) {
  const store = useChatStore.getState();
  store.setSessionsLoading(sessionsLoading);
  store.setMessagesLoading(messagesLoading);
  store.setError(null);
}

export function useChatController() {
  const loadSessionsForAgent = async (agent: string, search?: string) => {
    const store = useChatStore.getState();
    const query = search ?? store.query;
    const sequence = loadSequence + 1;
    loadSequence = sequence;
    setBusy(true, false);

    try {
      const cachedSessions = query.trim() ? [] : readCachedSessions();
      const remoteSessions = await fetchSessions(agent, query);
      if (loadSequence !== sequence) return;
      store.setSessions(
        mergeSessionLists(remoteSessions, cachedSessions, agent),
      );
      store.setSelectedSessionId(null);
      store.setMessages([]);
      store.setSessionsLoading(false);
      store.setMessagesLoading(false);
      store.setStatus("idle");
    } catch (error) {
      store.setError(error instanceof Error ? error.message : "load failed");
      store.setSessionsLoading(false);
      store.setMessagesLoading(false);
      store.setStatus("error");
    }
  };

  const restoreActiveRunForSession = async (
    agent: string,
    session: GatewaySessionSummary,
  ) => {
    const store = useChatStore.getState();
    const activeRun = (await fetchRuns())
      .filter(
        (run) =>
          run.agent === agent &&
          run.status === "running" &&
          run.piSessionId === session.piSessionId,
      )
      .sort((a, b) =>
        (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt),
      )[0];
    if (!activeRun) return;
    liveRunId = activeRun.id;
    store.setStatus("sending");
    store.setLiveActivityMessages([
      {
        id: `restored-${activeRun.id}`,
        sender: "tool",
        displayName: "Activity",
        content: "Tool call: resumed active agent run",
        createdAt: activeRun.startedAt ?? activeRun.createdAt,
      },
    ]);
  };

  const selectAgent = async (agent: string) => {
    const store = useChatStore.getState();
    store.setSelectedAgentKey(agent);
    store.setQuery("");
    store.setSelectedSessionId(null);
    store.setMessages([]);
    store.setEditingMessage(null);
    store.setLiveActivityMessages([]);
    liveRunId = null;
    await loadSessionsForAgent(agent, "");
  };

  const selectSession = async (session: GatewaySessionSummary) => {
    const store = useChatStore.getState();
    const sequence = loadSequence + 1;
    loadSequence = sequence;
    store.setSelectedSessionId(session.id);
    store.setEditingMessage(null);
    store.setMessagesLoading(true);
    store.setError(null);
    store.setLiveActivityMessages([]);
    liveRunId = null;
    try {
      const nextMessages = await fetchMessages(session.id);
      if (loadSequence !== sequence) return;
      store.setMessages(nextMessages);
      store.setMessagesLoading(false);
      store.setStatus("idle");
      await restoreActiveRunForSession(store.selectedAgentKey ?? "", session);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : "load failed");
      store.setMessagesLoading(false);
      store.setStatus("error");
    }
  };

  const createNewSession = async () => {
    const store = useChatStore.getState();
    if (!store.selectedAgentKey) return null;
    setBusy(true, true);
    try {
      const session = await createSession(store.selectedAgentKey);
      cacheSession(session);
      store.setSessions((current) => [session, ...current]);
      store.setSelectedSessionId(session.id);
      store.setMessages([]);
      store.setEditingMessage(null);
      store.setLiveActivityMessages([]);
      liveRunId = null;
      store.setSessionsLoading(false);
      store.setMessagesLoading(false);
      store.setStatus("idle");
      return session;
    } catch (error) {
      store.setError(
        error instanceof Error ? error.message : "failed to create session",
      );
      store.setSessionsLoading(false);
      store.setMessagesLoading(false);
      store.setStatus("error");
      return null;
    }
  };

  const searchSessions = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const store = useChatStore.getState();
    if (!store.selectedAgentKey) return;
    await loadSessionsForAgent(store.selectedAgentKey, store.query);
  };

  const archiveChatSession = async (session: GatewaySessionSummary) => {
    const store = useChatStore.getState();
    const previousSessions = store.sessions;
    const previousSelectedSessionId = store.selectedSessionId;
    const previousMessages = store.messages;
    removeCachedSession(session.id);
    store.setSessions((current) =>
      current.filter((entry) => entry.id !== session.id),
    );
    if (store.selectedSessionId === session.id) {
      store.setSelectedSessionId(null);
      store.setMessages([]);
      store.setEditingMessage(null);
      store.setLiveActivityMessages([]);
      liveRunId = null;
    }
    try {
      await archiveSession(session.id);
    } catch (error) {
      store.setSessions(previousSessions);
      store.setSelectedSessionId(previousSelectedSessionId);
      store.setMessages(previousMessages);
      store.setError(error instanceof Error ? error.message : "archive failed");
    }
  };

  const sendMessage = async (
    event?: React.FormEvent,
    overrideText?: string,
  ) => {
    event?.preventDefault();
    const store = useChatStore.getState();
    const text = (overrideText ?? store.input).trim();
    if (!text || !store.selectedAgentKey) return;
    let session =
      store.sessions.find((entry) => entry.id === store.selectedSessionId) ??
      null;
    if (!session) session = await createNewSession();
    if (!session) return;

    const requestAgentKey = store.selectedAgentKey;
    const requestSessionId = session.id;
    const editingMessage = store.editingMessage;
    store.setInput("");
    store.setEditingMessage(null);
    store.setStatus("sending");
    store.setError(null);
    store.setLiveActivityMessages([]);
    liveRunId = null;
    const optimisticMessage: GatewayMessage = {
      id: `local-${crypto.randomUUID()}`,
      sender: "user",
      displayName: "You",
      content: text,
      createdAt: new Date().toISOString(),
    };
    store.setMessages((current) => {
      if (!editingMessage) return [...current, optimisticMessage];
      const targetIndex = current.findIndex(
        (message) => message.id === editingMessage.id,
      );
      return [
        ...(targetIndex === -1 ? current : current.slice(0, targetIndex)),
        optimisticMessage,
      ];
    });

    try {
      if (editingMessage) {
        const rewind = await rewindSession({
          session,
          messageId: editingMessage.id,
          content: editingMessage.content,
        });
        session = { ...session, ...rewind.session };
      }
      const response = await postMessage(session, text);
      const assistantMessages =
        response.assistantMessages ??
        (response.assistantMessage ? [response.assistantMessage] : []);
      const updatedSession = {
        ...session,
        title: session.messageCount === 0 ? text.slice(0, 56) : session.title,
        messageCount: editingMessage
          ? useChatStore.getState().messages.length + assistantMessages.length
          : session.messageCount + 2,
        lastMessagePreview:
          assistantMessages.at(-1)?.content ?? text.slice(0, 96),
        lastMessageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      cacheSession(updatedSession);
      store.setSessions((current) =>
        current.map((entry) =>
          entry.id === requestSessionId
            ? { ...entry, ...updatedSession }
            : entry,
        ),
      );
      const latest = useChatStore.getState();
      if (
        latest.selectedAgentKey === requestAgentKey &&
        latest.selectedSessionId === requestSessionId
      ) {
        store.setMessages((current) => [
          ...current.filter((message) => message.id !== optimisticMessage.id),
          ...(response.userMessage
            ? [response.userMessage]
            : [optimisticMessage]),
          ...assistantMessages,
        ]);
        store.setLiveActivityMessages([]);
        liveRunId = null;
        store.setStatus("idle");
      }
    } catch (error) {
      const latest = useChatStore.getState();
      if (
        latest.selectedAgentKey === requestAgentKey &&
        latest.selectedSessionId === requestSessionId
      ) {
        store.setError(error instanceof Error ? error.message : "send failed");
        if (editingMessage) {
          store.setMessages(editingMessage.originalMessages);
        }
        store.setStatus("error");
      }
    }
  };

  const editMessage = (message: GatewayMessage) => {
    const store = useChatStore.getState();
    if (store.status === "sending" || message.sender !== "user") return;
    const targetIndex = store.messages.findIndex(
      (entry) => entry.id === message.id,
    );
    store.setEditingMessage({
      id: message.id,
      content: message.content,
      draft: message.content,
      originalMessages: store.messages,
    });
    if (targetIndex !== -1) {
      store.setMessages(store.messages.slice(0, targetIndex + 1));
    }
    store.setError(null);
  };

  const setEditingDraft = (draft: string) => {
    const store = useChatStore.getState();
    store.setEditingMessage((current) =>
      current ? { ...current, draft } : current,
    );
  };

  const submitEdit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const store = useChatStore.getState();
    const draft = store.editingMessage?.draft ?? "";
    await sendMessage(undefined, draft);
  };

  const cancelEdit = () => {
    const store = useChatStore.getState();
    if (store.editingMessage) {
      store.setMessages(store.editingMessage.originalMessages);
    }
    store.setEditingMessage(null);
    store.setInput("");
  };

  return {
    archiveSession: archiveChatSession,
    cancelEdit,
    createSession: createNewSession,
    editMessage,
    loadSessionsForAgent,
    searchSessions,
    selectAgent,
    selectSession,
    sendMessage,
    setEditingDraft,
    submitEdit,
  };
}
