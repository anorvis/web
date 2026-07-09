import { expect, test } from "@playwright/test";

test.skip(
  !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "development",
  "prod landing scenario only runs when VERCEL_ENV is a hosted deployment value",
);

test("production runtime renders landing instead of private workspace", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByText("production landing", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("runtime-gated")).toBeVisible();
  await expect(
    page.getByText("prod never mounts the private app"),
  ).toBeVisible();
  await expect(page.getByText("retry connection")).toHaveCount(0);

  const notFound = await page.goto("/life");
  expect(notFound?.status()).toBe(404);
});
