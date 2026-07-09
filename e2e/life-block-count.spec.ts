import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";

type CreatedEvent = { id: string; summary: string };
function todayIsoAt(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

async function createEvent(request: APIRequestContext, summary: string) {
  const response = await request.post("/api/life/events", {
    data: {
      summary,
      startAt: todayIsoAt(14),
      endAt: todayIsoAt(15),
      tag: "count-check",
    },
  });
  expect(
    response.ok(),
    `create failed ${response.status()}: ${await response.text()}`,
  ).toBe(true);
  return (await response.json()) as CreatedEvent;
}

async function expectBlocks(page: Page, count: number) {
  await expect(
    page
      .locator("button", { hasText: "blocks" })
      .filter({ hasText: String(count) })
      .first(),
  ).toBeVisible();
}

async function setMode(page: Page, mode: "day" | "week" | "month") {
  await page.getByRole("button", { name: /day|week|month/ }).click();
  await page.getByRole("menuitemradio", { name: mode }).click();
}

test("life blocks metric follows day, week, month ranges and refreshes after UI delete", async ({
  page,
  request,
}) => {
  await createEvent(request, "E2E Count Alpha");
  const deleteTarget = await createEvent(request, "E2E Count Beta");

  await page.goto("/life");
  await expectBlocks(page, 2);

  await setMode(page, "day");
  await expectBlocks(page, 2);
  await setMode(page, "month");
  await expectBlocks(page, 2);
  await setMode(page, "week");
  await expectBlocks(page, 2);

  await page.getByText(deleteTarget.summary).first().click();
  await page.getByRole("button", { name: "delete" }).click();
  await expectBlocks(page, 1);

  await setMode(page, "day");
  await expectBlocks(page, 1);
  await setMode(page, "month");
  await expectBlocks(page, 1);
});
