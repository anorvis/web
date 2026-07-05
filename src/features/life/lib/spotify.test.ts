import { describe, expect, it } from "vitest";
import {
  formatProgress,
  type SpotifyNowPlayingResponse,
  type SpotifyRecentlyPlayedResponse,
  shapeNowPlaying,
  shapeRecentTrack,
} from "./spotify";

const nowPlaying: SpotifyNowPlayingResponse = {
  is_playing: true,
  progress_ms: 154000,
  item: {
    name: "A Love Supreme",
    duration_ms: 462000,
    artists: [{ name: "John Coltrane" }],
    album: { name: "A Love Supreme" },
  },
};

const recentlyPlayed: SpotifyRecentlyPlayedResponse = {
  items: [
    {
      track: {
        name: "So What",
        artists: [{ name: "Miles Davis" }],
        album: { name: "Kind of Blue" },
      },
      played_at: "2026-03-15T08:30:00.000Z",
    },
  ],
};

describe("shapeNowPlaying", () => {
  it("shapes currently-playing response", () => {
    const result = shapeNowPlaying(nowPlaying);
    expect(result).toEqual({
      playing: true,
      track: "A Love Supreme",
      artist: "John Coltrane",
      progressMs: 154000,
      durationMs: 462000,
    });
  });

  it("null item (ad playing) → playing false", () => {
    const result = shapeNowPlaying({
      is_playing: true,
      progress_ms: 0,
      item: null,
    });
    expect(result.playing).toBe(false);
  });

  it("null response (204) → playing false", () => {
    const result = shapeNowPlaying(null);
    expect(result.playing).toBe(false);
  });
});

describe("shapeRecentTrack", () => {
  it("shapes recent track as fallback", () => {
    const result = shapeRecentTrack(recentlyPlayed);
    expect(result).toEqual({
      playing: false,
      lastTrack: "So What",
      lastArtist: "Miles Davis",
      lastPlayedAt: "2026-03-15T08:30:00.000Z",
    });
  });

  it("empty recently-played → null last track", () => {
    const result = shapeRecentTrack({ items: [] });
    expect(result).toEqual({
      playing: false,
      lastTrack: null,
      lastArtist: null,
      lastPlayedAt: null,
    });
  });
});

describe("formatProgress", () => {
  it("formats correctly", () => {
    expect(formatProgress(154000)).toBe("2:34");
  });

  it("handles zero", () => {
    expect(formatProgress(0)).toBe("0:00");
  });
});
