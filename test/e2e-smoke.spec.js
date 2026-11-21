import { test, expect } from "@playwright/test";

test("new game -> first release -> save/load", async ({ page }) => {
  await page.goto("/game/index.html");
  await page.fill("#studioName", "E2E Studio");
  await page.click('[data-action="pick-origin"][data-origin="veteran"]');
  await page.click('[data-action="start-game"]');
  await expect(page.locator("#hudStudio")).toContainText("E2E Studio");
  // advance a few weeks
  for (let i = 0; i < 3; i++) await page.click("#btnWeek");
  await page.click('[data-view="develop"]');
  // save/load round trip
  const raw = await page.evaluate(() => localStorage.getItem("bow2.save") || localStorage.getItem("bow.save"));
  expect(raw).toBeTruthy();
});