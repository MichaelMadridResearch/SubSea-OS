import { expect, test } from "@playwright/test";

const ACTION_NAME = /approve|dispatch|shutdown/i;

test("read-only feasibility for the fictional case", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("status")).toContainText("Harbor Light export cable. Advisory only.");
  await page.getByLabel("Email").fill("operator@demo.invalid");
  await page.getByLabel("Password").fill("demo-only-not-a-secret");
  await page.getByRole("button", { name: "Sign in", disabled: false }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harbor Light" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Harbor Light route map" })).toBeVisible();
  await page.getByRole("button", { name: "Import alert" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("FICTIONAL-ALERT-001")).toBeVisible();
  const caseOpened = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response.ok() &&
      new URL(response.url()).pathname === "/backend/cases"
    );
  });
  await page.getByRole("button", { name: "Open response case" }).click();
  await caseOpened;
  await expect(page).toHaveURL("/");

  const cases = page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: /^Cases(?:\s*\d+)?$/ });
  await expect(cases).toHaveAttribute("href", "/cases");
  await cases.click();
  await expect(page).toHaveURL("/cases");

  const alertCase = page.getByRole("link", { name: "FICTIONAL-ALERT-001" });
  await expect(alertCase).toHaveAttribute("href", /\/cases\/[^/]+$/);
  await alertCase.click();
  await expect(page).toHaveURL(/\/cases\/[^/]+$/);
  const caseId = new URL(page.url()).pathname.split("/")[2];
  expect(caseId).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Case open" })).toBeVisible();

  const feasibility = page.getByRole("link", { name: "Feasibility", exact: true });
  await expect(feasibility).toHaveAttribute("href", `/cases/${caseId}/feasibility`);
  await expect(page.getByRole("link", { name: "Decision", exact: true })).toHaveAttribute(
    "href",
    `/cases/${caseId}/decision`,
  );
  await expect(page.getByRole("link", { name: "Audit", exact: true })).toHaveAttribute(
    "href",
    `/cases/${caseId}/audit`,
  );

  await feasibility.click();
  await expect(page).toHaveURL(`/cases/${caseId}/feasibility`);
  await expect(page.locator("body")).toContainText("Not calculated.");
  await expect(page.locator("body")).toContainText("FICTIONAL-ALERT-001");
  await expect(page.locator("body")).toContainText("Stored readiness");
  await expect(page.locator("body")).toContainText("Vessel");
  await expect(page.locator("body")).toContainText("Spares");
  await expect(page.locator("body")).toContainText("Blocks immediate action.");
  await expect(page.getByRole("button", { name: ACTION_NAME, disabled: false })).toHaveCount(0);
  await expect(page.getByRole("link", { name: ACTION_NAME, disabled: false })).toHaveCount(0);
});
