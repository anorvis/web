import { gatewayFetch } from "@/lib/anorvis-gateway";
import { encodeLocalSseEvent, getLocalEventHub } from "@/lib/local-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 10_000;
const UPSTREAM_RECONNECT_DELAY_MS = 1_000;

type HeartbeatTimer = ReturnType<typeof setInterval>;
const activeHeartbeats = new Set<HeartbeatTimer>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function GET(request: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      let upstreamAbort: AbortController | null = null;

      const send = (chunk: string | Uint8Array) => {
        if (closed) return;
        const payload =
          typeof chunk === "string" ? encoder.encode(chunk) : chunk;
        try {
          controller.enqueue(payload);
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        activeHeartbeats.delete(heartbeat);
        unsubscribeLocalEvents();
        upstreamAbort?.abort();
        void upstreamReader?.cancel().catch(() => {});
        try {
          controller.close();
        } catch {
          // The client may already have closed the socket.
        }
      };

      const heartbeat = setInterval(() => {
        send(": proxy-heartbeat\n\n");
      }, HEARTBEAT_INTERVAL_MS);
      activeHeartbeats.add(heartbeat);
      const unsubscribeLocalEvents = getLocalEventHub().subscribe((event) => {
        send(encodeLocalSseEvent(event));
      });
      request.signal.addEventListener("abort", close, { once: true });

      const pumpUpstream = async () => {
        while (!closed) {
          upstreamAbort = new AbortController();
          try {
            const upstream = await gatewayFetch("/v1/events", {
              headers: { Accept: "text/event-stream" },
              signal: upstreamAbort.signal,
            });

            if (!upstream.ok || !upstream.body) {
              send(
                `event: gateway.error\ndata: {"status":${upstream.status}}\n\n`,
              );
              await delay(UPSTREAM_RECONNECT_DELAY_MS);
              continue;
            }

            upstreamReader = upstream.body.getReader();
            while (!closed) {
              const result = await upstreamReader.read();
              if (result.done) break;
              send(result.value);
            }
          } catch {
            if (closed) return;
          } finally {
            void upstreamReader?.cancel().catch(() => {});
            upstreamReader = null;
            upstreamAbort = null;
          }

          if (!closed) await delay(UPSTREAM_RECONNECT_DELAY_MS);
        }
      };

      void pumpUpstream();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
