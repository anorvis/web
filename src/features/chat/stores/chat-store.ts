import { create } from "zustand";
import type {
  GatewayAgent,
  GatewayMessage,
  GatewaySessionSummary,
} from "@/features/chat/api/client";

type ChatStatus = "idle" | "loading" | "sending" | "error";

export type EditingMessage = {
  id: string;
  content: string;
  draft: string;
  originalMessages: GatewayMessage[];
};

type ChatStore = {
  agents: GatewayAgent[];
  sessions: GatewaySessionSummary[];
  messages: GatewayMessage[];
  liveActivityMessages: GatewayMessage[];
  status: ChatStatus;
  sessionsLoading: boolean;
  messagesLoading: boolean;
  error: string | null;
  selectedAgentKey: string | null;
  selectedSessionId: string | null;
  query: string;
  input: string;
  editingMessage: EditingMessage | null;
  sidebarCollapsed: boolean;
  isFullscreen: boolean;
  setAgents: (agents: GatewayAgent[]) => void;
  setSessions: (
    sessions:
      | GatewaySessionSummary[]
      | ((current: GatewaySessionSummary[]) => GatewaySessionSummary[]),
  ) => void;
  setMessages: (
    messages:
      | GatewayMessage[]
      | ((current: GatewayMessage[]) => GatewayMessage[]),
  ) => void;
  setLiveActivityMessages: (
    liveActivityMessages:
      | GatewayMessage[]
      | ((current: GatewayMessage[]) => GatewayMessage[]),
  ) => void;
  setStatus: (status: ChatStatus) => void;
  setSessionsLoading: (sessionsLoading: boolean) => void;
  setMessagesLoading: (messagesLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedAgentKey: (selectedAgentKey: string | null) => void;
  setSelectedSessionId: (selectedSessionId: string | null) => void;
  setQuery: (query: string) => void;
  setInput: (input: string) => void;
  setEditingMessage: (
    editingMessage:
      | EditingMessage
      | null
      | ((current: EditingMessage | null) => EditingMessage | null),
  ) => void;
  setSidebarCollapsed: (
    sidebarCollapsed: boolean | ((current: boolean) => boolean),
  ) => void;
  setIsFullscreen: (
    isFullscreen: boolean | ((current: boolean) => boolean),
  ) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  agents: [],
  sessions: [],
  messages: [],
  liveActivityMessages: [],
  status: "loading",
  sessionsLoading: false,
  messagesLoading: false,
  error: null,
  selectedAgentKey: null,
  selectedSessionId: null,
  query: "",
  input: "",
  editingMessage: null,
  sidebarCollapsed: false,
  isFullscreen: false,
  setAgents: (agents) => set({ agents }),
  setSessions: (sessions) =>
    set((state) => ({
      sessions:
        typeof sessions === "function" ? sessions(state.sessions) : sessions,
    })),
  setMessages: (messages) =>
    set((state) => ({
      messages:
        typeof messages === "function" ? messages(state.messages) : messages,
    })),
  setLiveActivityMessages: (liveActivityMessages) =>
    set((state) => ({
      liveActivityMessages:
        typeof liveActivityMessages === "function"
          ? liveActivityMessages(state.liveActivityMessages)
          : liveActivityMessages,
    })),
  setStatus: (status) => set({ status }),
  setSessionsLoading: (sessionsLoading) => set({ sessionsLoading }),
  setMessagesLoading: (messagesLoading) => set({ messagesLoading }),
  setError: (error) => set({ error }),
  setSelectedAgentKey: (selectedAgentKey) => set({ selectedAgentKey }),
  setSelectedSessionId: (selectedSessionId) => set({ selectedSessionId }),
  setQuery: (query) => set({ query }),
  setInput: (input) => set({ input }),
  setEditingMessage: (editingMessage) =>
    set((state) => ({
      editingMessage:
        typeof editingMessage === "function"
          ? editingMessage(state.editingMessage)
          : editingMessage,
    })),
  setSidebarCollapsed: (sidebarCollapsed) =>
    set((state) => ({
      sidebarCollapsed:
        typeof sidebarCollapsed === "function"
          ? sidebarCollapsed(state.sidebarCollapsed)
          : sidebarCollapsed,
    })),
  setIsFullscreen: (isFullscreen) =>
    set((state) => ({
      isFullscreen:
        typeof isFullscreen === "function"
          ? isFullscreen(state.isFullscreen)
          : isFullscreen,
    })),
}));
