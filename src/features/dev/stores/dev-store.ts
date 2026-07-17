import { create } from "zustand";

type ActiveTab = "operations" | "maintainer";

type DevStore = {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
};

export const useDevStore = create<DevStore>((set) => ({
  activeTab: "operations",
  setActiveTab: (activeTab) => set({ activeTab }),
}));
