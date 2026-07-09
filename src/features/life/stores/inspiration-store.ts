"use client";

import { Schema } from "effect";
import { create } from "zustand";
import { decodeUnknownResult } from "@/lib/effect/schema";

const STORAGE_KEY = "anorvis.life.inspiration-board.v1";

export type InspirationConfig = {
  boardUrl: string;
  cadenceMinutes: number;
  imageUrls: string[];
};

const InspirationConfigJsonSchema = Schema.parseJson(
  Schema.Struct({
    boardUrl: Schema.String,
    cadenceMinutes: Schema.optional(Schema.Unknown),
    imageUrls: Schema.optional(Schema.Array(Schema.Unknown)),
  }),
);

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
    const decoded = decodeUnknownResult(InspirationConfigJsonSchema, raw);
    if (!decoded.ok) return null;
    return {
      boardUrl: decoded.value.boardUrl,
      cadenceMinutes:
        typeof decoded.value.cadenceMinutes === "number"
          ? decoded.value.cadenceMinutes
          : 60,
      imageUrls: (decoded.value.imageUrls ?? []).filter(
        (url): url is string => typeof url === "string",
      ),
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
