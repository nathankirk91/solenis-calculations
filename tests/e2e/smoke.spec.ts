import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("login page has app branding in document title", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/solenis/i);
  });

  test("logout route is reachable without a session", async ({ page }) => {
    await page.goto("/logout");
    await expect(page).toHaveURL(/\/login/);
  });
});
