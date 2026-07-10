const YOUTUBE_HOSTS: Record<string, true> = {
  "youtube.com": true,
  "www.youtube.com": true,
  "m.youtube.com": true,
  "music.youtube.com": true,
  "youtu.be": true,
  "www.youtu.be": true,
  "youtube-nocookie.com": true,
  "www.youtube-nocookie.com": true,
};

// YouTube video ids are always 11 chars from this alphabet. Validating the
// shape keeps arbitrary path segments from being framed as an embed.
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function extractVideoId(parsed: URL, host: string): string | null {
  // youtu.be/<id>
  if (host === "youtu.be" || host === "www.youtu.be") {
    return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
  }
  // youtube.com/watch?v=<id>
  const watchId = parsed.searchParams.get("v");
  if (watchId) return watchId;
  // youtube.com/embed/<id> and youtube.com/shorts/<id>
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (
    segments.length >= 2 &&
    (segments[0] === "embed" || segments[0] === "shorts")
  ) {
    return segments[1];
  }
  return null;
}

/**
 * Normalizes a YouTube URL (watch, youtu.be, embed, or shorts form) into a
 * privacy-preserving youtube-nocookie embed URL. Returns null for anything that
 * is not a well-formed http(s) YouTube URL resolving to a valid 11-char video
 * id, so no arbitrary host is ever framed. Append `?autoplay=1` at the call site.
 */
export function youtubeEmbedUrl(url: string | null): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS[host]) return null;

  const id = extractVideoId(parsed, host);
  if (!id || !VIDEO_ID_PATTERN.test(id)) return null;

  return `https://www.youtube-nocookie.com/embed/${id}`;
}
