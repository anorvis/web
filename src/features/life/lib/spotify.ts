export type SpotifyNowPlayingResponse = {
  is_playing: boolean;
  progress_ms: number;
  item: {
    name: string;
    duration_ms: number;
    artists: { name: string }[];
    album: { name: string };
  } | null;
};

export type SpotifyRecentlyPlayedResponse = {
  items: {
    track: {
      name: string;
      artists: { name: string }[];
      album: { name: string };
    };
    played_at: string;
  }[];
};

export type SpotifyState =
  | {
      playing: true;
      track: string;
      artist: string;
      progressMs: number;
      durationMs: number;
    }
  | {
      playing: false;
      reauth?: undefined;
      lastTrack: string | null;
      lastArtist: string | null;
      lastPlayedAt: string | null;
    }
  | { playing: false; reauth: true };

export function shapeNowPlaying(
  response: SpotifyNowPlayingResponse | null,
): SpotifyState {
  if (!response || !response.item) {
    return {
      playing: false,
      lastTrack: null,
      lastArtist: null,
      lastPlayedAt: null,
    };
  }

  return {
    playing: true,
    track: response.item.name,
    artist: response.item.artists.map((a) => a.name).join(", "),
    progressMs: response.progress_ms,
    durationMs: response.item.duration_ms,
  };
}

export function shapeRecentTrack(
  response: SpotifyRecentlyPlayedResponse,
): SpotifyState {
  if (response.items.length === 0) {
    return {
      playing: false,
      lastTrack: null,
      lastArtist: null,
      lastPlayedAt: null,
    };
  }

  const item = response.items[0];
  return {
    playing: false,
    lastTrack: item.track.name,
    lastArtist: item.track.artists.map((a) => a.name).join(", "),
    lastPlayedAt: item.played_at,
  };
}

export function formatProgress(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
