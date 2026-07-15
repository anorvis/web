import { create } from "zustand";

type DetailTab = "logs" | "output" | "pi";
type ActiveTab = "operations" | "jobs" | "memory" | "stream";
type SseStatus = "connecting" | "connected" | "fallback";

type OsEvent = {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
};

type DevStore = {
  selectedRunId: string | null;
  activeTab: ActiveTab;
  detailTab: DetailTab;
  sseStatus: SseStatus;
  liveOsEvents: OsEvent[];
  streamPage: number;
  streamPageSize: number;
  setSelectedRunId: (runId: string | null) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setDetailTab: (tab: DetailTab) => void;
  setSseStatus: (status: SseStatus) => void;
  addLiveOsEvent: (event: OsEvent) => void;
  setStreamPage: (page: number | ((current: number) => number)) => void;
  setStreamPageSize: (pageSize: number) => void;
};

export const useDevStore = create<DevStore>((set) => ({
  selectedRunId: null,
  activeTab: "operations",
  detailTab: "logs",
  sseStatus: "connecting",
  liveOsEvents: [],
  streamPage: 0,
  streamPageSize: 10,
  setSelectedRunId: (selectedRunId) => set({ selectedRunId }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setDetailTab: (detailTab) => set({ detailTab }),
  setSseStatus: (sseStatus) => set({ sseStatus }),
  addLiveOsEvent: (event) =>
    set((state) => ({
      liveOsEvents: [
        event,
        ...state.liveOsEvents.filter((current) => current.id !== event.id),
      ].slice(0, 500),
    })),
  setStreamPage: (streamPage) =>
    set((state) => ({
      streamPage:
        typeof streamPage === "function"
          ? streamPage(state.streamPage)
          : streamPage,
    })),
  setStreamPageSize: (streamPageSize) => set({ streamPageSize }),
}));
