import { expect, test } from "@playwright/test";

const osUrl = "http://127.0.0.1:8877";
const token = "e2e-token";

test("web talks through Anorvis OS without leaking provider secrets", async ({
  request,
}) => {
  const taskResponse = await request.post("/api/life/tasks", {
    data: { title: "E2E tailnet task", priority: "high" },
  });
  expect(
    taskResponse.ok(),
    `POST /api/life/tasks failed ${taskResponse.status()}: ${await taskResponse.text()}`,
  ).toBe(true);

  const planResponse = await request.get("/api/life/plan");
  expect(planResponse.ok()).toBe(true);
  const planText = await planResponse.text();
  expect(planText).toContain("E2E tailnet task");

  const createProvider = await fetch(`${osUrl}/v1/providers`, {
    method: "POST",
    headers: osHeaders(),
    body: JSON.stringify({
      id: "demo-token",
      displayName: "Demo Token",
      category: "productivity",
      capabilities: ["demo.read"],
      authType: "token",
    }),
  });
  expect(createProvider.ok).toBe(true);

  const rawToken = "e2e-super-secret";
  const saveToken = await request.post("/api/integrations/save-token", {
    data: { provider: "demo-token", token: rawToken },
  });
  expect(saveToken.ok()).toBe(true);
  expect(await saveToken.json()).toMatchObject({ ok: true });

  const providersResponse = await fetch(`${osUrl}/v1/providers`, {
    headers: osHeaders(),
  });
  expect(providersResponse.ok).toBe(true);
  const providersText = await providersResponse.text();
  expect(providersText).toContain("demo-token");
  expect(providersText).toContain("connected");
  expect(providersText).not.toContain(rawToken);
  expect(providersText).not.toContain(Buffer.from(rawToken).toString("base64"));

  const statusResponse = await fetch(`${osUrl}/v1/os/status`, {
    headers: osHeaders(),
  });
  expect(statusResponse.ok).toBe(true);
  const status = (await statusResponse.json()) as {
    storage: { sqlite: string; sync: string };
    services: string[];
  };
  expect(status.storage.sqlite).toBe("centralized");
  expect(status.storage.sync).toBe("files-only");
  expect(status.services).toContain("integrations");
  expect(status.services).toContain("llm-wiki");
});

function osHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}
