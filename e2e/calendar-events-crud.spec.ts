import { expect, test } from "@playwright/test";

type CalendarEvent = {
  id: string;
  summary: string;
  startAt?: string;
  endAt?: string;
};

type CalendarResponse = {
  events?: CalendarEvent[];
  items?: CalendarEvent[];
};

const range =
  "timeMin=2026-07-13T00:00:00.000Z&timeMax=2026-07-17T23:59:59.999Z";

function eventsFrom(payload: CalendarResponse): CalendarEvent[] {
  return payload.events ?? payload.items ?? [];
}

test("calendar events can be created, listed, updated, and deleted through web API routes", async ({
  request,
}) => {
  const created = await request.post("/api/life/events", {
    data: {
      summary: "E2E local planning block",
      startAt: "2026-07-15T14:00:00.000Z",
      endAt: "2026-07-15T15:00:00.000Z",
      location: "studio",
      description: "created through web API",
      tag: "planning",
    },
  });
  expect(
    created.ok(),
    `create failed ${created.status()}: ${await created.text()}`,
  ).toBe(true);
  expect(created.status()).toBe(201);
  const event = (await created.json()) as CalendarEvent;
  expect(event).toMatchObject({ summary: "E2E local planning block" });
  expect(event.id).toEqual(expect.any(String));

  const listed = await request.get(`/api/life/calendar?${range}`);
  expect(
    listed.ok(),
    `list after create failed ${listed.status()}: ${await listed.text()}`,
  ).toBe(true);
  expect(eventsFrom((await listed.json()) as CalendarResponse)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: event.id,
        summary: "E2E local planning block",
      }),
    ]),
  );

  const patched = await request.patch(
    `/api/life/events/${encodeURIComponent(event.id)}`,
    {
      data: {
        summary: "E2E updated planning block",
        startAt: "2026-07-15T16:00:00.000Z",
        endAt: "2026-07-15T17:00:00.000Z",
        location: "library",
        description: "updated through web API",
        tag: "focus",
      },
    },
  );
  expect(
    patched.ok(),
    `update failed ${patched.status()}: ${await patched.text()}`,
  ).toBe(true);
  expect(await patched.json()).toMatchObject({
    id: event.id,
    summary: "E2E updated planning block",
    startAt: "2026-07-15T16:00:00.000Z",
    endAt: "2026-07-15T17:00:00.000Z",
  });

  const listedAfterUpdate = await request.get(`/api/life/calendar?${range}`);
  expect(listedAfterUpdate.ok()).toBe(true);
  expect(
    eventsFrom((await listedAfterUpdate.json()) as CalendarResponse),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: event.id,
        summary: "E2E updated planning block",
      }),
    ]),
  );

  const deleted = await request.delete(
    `/api/life/events/${encodeURIComponent(event.id)}`,
  );
  expect(
    deleted.status(),
    `delete failed ${deleted.status()}: ${await deleted.text()}`,
  ).toBe(204);

  const listedAfterDelete = await request.get(`/api/life/calendar?${range}`);
  expect(listedAfterDelete.ok()).toBe(true);
  expect(
    eventsFrom((await listedAfterDelete.json()) as CalendarResponse),
  ).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ id: event.id })]),
  );
});
