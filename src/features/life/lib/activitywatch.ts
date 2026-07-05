type AWEvent = {
  timestamp: string;
  duration: number;
  data: { app: string; title: string };
};

type AWBucketsResponse = Record<
  string,
  { id: string; type: string; hostname: string }
>;

export type ScreenTimeData = {
  totalHours: number;
  topApps: { name: string; hours: number }[];
};

export function aggregateByApp(
  events: AWEvent[],
): { name: string; hours: number }[] {
  const byApp = new Map<string, number>();

  for (const event of events) {
    const app = event.data.app;
    byApp.set(app, (byApp.get(app) ?? 0) + event.duration);
  }

  return [...byApp.entries()]
    .map(([name, seconds]) => ({
      name,
      hours: Math.round((seconds / 3600) * 10) / 10,
    }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 2);
}

export function findWindowBucket(buckets: AWBucketsResponse): string | null {
  for (const key of Object.keys(buckets)) {
    if (key.startsWith("aw-watcher-window")) return key;
  }
  return null;
}

export async function getScreenTime(): Promise<ScreenTimeData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const bucketsRes = await fetch("http://localhost:5600/api/0/buckets", {
      signal: controller.signal,
    });
    if (!bucketsRes.ok) return null;

    const buckets = (await bucketsRes.json()) as AWBucketsResponse;
    const bucketId = findWindowBucket(buckets);
    if (!bucketId) return null;

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const eventsRes = await fetch(
      `http://localhost:5600/api/0/buckets/${encodeURIComponent(bucketId)}/events?start=${todayStart.toISOString()}&end=${tomorrowStart.toISOString()}`,
      { signal: controller.signal },
    );
    if (!eventsRes.ok) return null;

    const events = (await eventsRes.json()) as AWEvent[];
    const topApps = aggregateByApp(events);
    const totalHours =
      Math.round((events.reduce((sum, e) => sum + e.duration, 0) / 3600) * 10) /
      10;

    return { totalHours, topApps };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
