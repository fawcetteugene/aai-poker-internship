import { test, expect } from "@playwright/test";

test("play, save through the real API, and reload the same hand from PostgreSQL", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Every hand tells a story." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fold", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("player-3")).toContainText("Your action");
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: /^Bet \d/ })).toBeDisabled();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Fold", exact: true }).click();
  const saving = page.waitForResponse(
    (r) => r.url().endsWith("/api/hands") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Fold", exact: true }).click();
  const response = await saving;
  expect(response.status()).toBe(201);
  const hand = await response.json();
  expect(hand.payoffs).toEqual([-20, 20, 0, 0, 0, 0]);
  await expect(
    page.getByText("Hand saved. Winnings are shown at each seat."),
  ).toBeVisible();
  await expect(
    page.getByTestId("history-hand").filter({ hasText: hand.id }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByTestId("history-hand").filter({ hasText: hand.id }),
  ).toBeVisible();
});

test("all-in hand runs to showdown and displays settlement", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Starting stack", { exact: false }).fill("80");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const saving = page.waitForResponse(
    (r) => r.url().endsWith("/api/hands") && r.request().method() === "POST",
  );
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "All-in", exact: true }).click();
  const response = await saving;
  expect(response.status()).toBe(201);
  const hand = await response.json();
  expect(hand.board).toHaveLength(5);
  expect(hand.payoffs.reduce((sum: number, n: number) => sum + n, 0)).toBe(0);
  await expect(page.getByText("HAND COMPLETE", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Hand saved. Winnings are shown at each seat."),
  ).toBeVisible();
});

test("a failed save keeps the completed hand and retry persists it", async ({
  page,
}) => {
  let block = true;
  await page.route("**/api/hands", async (route) => {
    if (route.request().method() === "POST" && block) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Database unavailable" }),
      });
    } else await route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Fold", exact: true }).click();
  await expect(
    page.getByText("Database unavailable", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset", exact: true }),
  ).toBeDisabled();
  block = false;
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(
    page.getByText("Hand saved. Winnings are shown at each seat."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset", exact: true }),
  ).toBeEnabled();
});

test("mobile layout stays within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(
    page.getByRole("button", { name: "Call 40", exact: true }),
  ).toBeVisible();
});
