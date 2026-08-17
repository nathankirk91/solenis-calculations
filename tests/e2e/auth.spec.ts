import { expect, test } from "@playwright/test";

test.describe("authentication gates", () => {
  test("login page renders sign-in form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText("Springvale sign in")).toBeVisible();
    await expect(page.getByText("Solenis")).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in/i }),
    ).toBeVisible();
  });

  test("home redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("inspections catalog redirects to login", async ({ page }) => {
    await page.goto("/inspections");
    await expect(page).toHaveURL(/\/login/);
  });

  test("permits catalog redirects to login", async ({ page }) => {
    await page.goto("/permits");
    await expect(page).toHaveURL(/\/login/);
  });

  test("inspection PDF view redirects to login", async ({ page }) => {
    await page.goto("/inspections/submissions/example/pdf/view");
    await expect(page).toHaveURL(/\/login/);
  });

  test("permit PDF view redirects to login", async ({ page }) => {
    await page.goto("/permits/runs/example/pdf/view");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login form shows validation errors for empty submit", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/valid email|email/i).first()).toBeVisible();
  });
});
