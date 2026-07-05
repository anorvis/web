"use client";

import { create } from "zustand";

const STORAGE_KEY = "anorvis.life.inspiration-board.v1";

export type InspirationConfig = {
  boardUrl: string;
  cadenceMinutes: number;
  imageUrls: string[];
};

type InspirationState = {
  config: InspirationConfig | null;
  hydrate: () => void;
  save: (config: InspirationConfig) => void;
  clear: () => void;
};

function readConfig(): InspirationConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InspirationConfig>;
    if (!parsed.boardUrl || typeof parsed.boardUrl !== "string") return null;
    return {
      boardUrl: parsed.boardUrl,
      cadenceMinutes:
        typeof parsed.cadenceMinutes === "number" ? parsed.cadenceMinutes : 60,
      imageUrls: Array.isArray(parsed.imageUrls)
        ? parsed.imageUrls.filter(
            (url): url is string => typeof url === "string",
          )
        : [],
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function writeConfig(config: InspirationConfig | null) {
  if (typeof window === "undefined") return;
  if (!config) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export const useInspirationStore = create<InspirationState>((set) => ({
  config: null,
  hydrate: () => set({ config: readConfig() }),
  save: (config) => {
    writeConfig(config);
    set({ config });
  },
  clear: () => {
    writeConfig(null);
    set({ config: null });
  },
}));
