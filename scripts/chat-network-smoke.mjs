#!/usr/bin/env node
import { chromium } from "@playwright/test";

const baseUrl = process.env.ANORVIS_WEB_URL || "http://127.0.0.1:3000";
const durationMs = Number(process.env.ANORVIS_CHAT_SMOKE_MS || 35_000);

const browser = await chromium.launch({
  headless: process.env.HEADLESS !== "0",
});
const page = await browser.newPage();
const startedAt = Date.now();
const hits = [];

function record(kind, detail, url) {
  const at = Date.now() - startedAt;
  const path = url.replace(baseUrl, "");
  hits.push({ at, kind, detail, path });
  console.log(
    `${String(at).padStart(6)}ms ${kind.padEnd(4)} ${detail} ${path}`,
  );
}

function isInteresting(url) {
  return (
    url.includes("/api/agents") ||
    url.includes("/api/events") ||
    url.includes("/api/chat")
  );
}

page.on("request", (request) => {
  const url = request.url();
  if (isInteresting(url)) record("REQ", request.method(), url);
});

page.on("response", (response) => {
  const url = response.url();
  if (url.includes("/api/events"))
    record("RESP", String(response.status()), url);
});

page.on("requestfinished", (request) => {
  const url = request.url();
  if (url.includes("/api/events")) record("FIN", "finished", url);
});

page.on("requestfailed", (request) => {
  const url = request.url();
  if (isInteresting(url))
    record("FAIL", request.failure()?.errorText ?? "failed", url);
});

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.waitForTimeout(1_000);
await page.keyboard.press(
  process.platform === "darwin" ? "Meta+K" : "Control+K",
);
await page.waitForTimeout(durationMs);

const agentRequests = hits.filter(
  (hit) => hit.kind === "REQ" && hit.path === "/api/agents",
);
const eventRequests = hits.filter(
  (hit) => hit.kind === "REQ" && hit.path === "/api/events",
);
const failures = hits.filter((hit) => hit.kind === "FAIL");

console.log(
  "SUMMARY",
  JSON.stringify(
    {
      agentRequests: agentRequests.length,
      eventRequests: eventRequests.length,
      failures: failures.length,
      agentRequestTimesMs: agentRequests.map((hit) => hit.at),
      eventRequestTimesMs: eventRequests.map((hit) => hit.at),
    },
    null,
    2,
  ),
);

await browser.close();
