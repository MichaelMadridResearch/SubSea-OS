import { expect, test } from "@playwright/test";

const SUGGESTED = "Suggested step: Request engineering review at advisory score 12.";
const MISSING = "No inspection record is stored for this window.";
const APPROVAL = "A person approves the next step. This software does not control equipment.";

test("decision and audit stay consistent with the stored case", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill("operator@demo.invalid");
  await page.getByLabel("Password").fill("demo-only-not-a-secret");
  await page.getByRole("button", { name: "Sign in", disabled: false }).click();
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
  await page.getByRole("button", { name: "Import alert" }).click();
  const caseOpened = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response.ok() &&
      new URL(response.url()).pathname === "/backend/cases"
    );
  });
  await page.getByRole("button", { name: "Open response case" }).click();
  await caseOpened;

  const cases = page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: /^Cases(?:\s*\d+)?$/ });
  await cases.click();
  await page.getByRole("link", { name: "FICTIONAL-ALERT-001" }).click();
  await expect(page).toHaveURL(/\/cases\/[^/]+$/);
  const caseId = new URL(page.url()).pathname.split("/")[2];
  await expect(page.locator("body")).toContainText(SUGGESTED);

  await page.getByRole("link", { name: "Options", exact: true }).click();
  await expect(page).toHaveURL(`/cases/${caseId}/options`);
  await expect(page.locator("body")).toContainText(SUGGESTED);
  await expect(page.locator("body")).toContainText("Not calculated.");

  await page.getByRole("link", { name: "Hypotheses", exact: true }).click();
  await expect(page.locator("body")).toContainText(MISSING);
  await expect(page.locator("body")).toContainText("not a chance of failure");

  await page.getByRole("link", { name: "Decision", exact: true }).click();
  await expect(page).toHaveURL(`/cases/${caseId}/decision`);
  await expect(page.getByRole("region", { name: "Decision record" })).toContainText(SUGGESTED);
  await expect(page.locator("body")).toContainText(MISSING);
  await expect(page.locator("body")).toContainText(APPROVAL);
  await expect(page.locator("body")).toContainText("Blocks immediate action.");
  await expect(page.getByRole("button", { name: "Record approval" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /approve|dispatch|shutdown/i, disabled: false })).toHaveCount(
    0,
  );

  await page.getByRole("link", { name: "Audit", exact: true }).click();
  await expect(page).toHaveURL(`/cases/${caseId}/audit`);
  const audit = page.getByRole("region", { name: "Audit record" });
  await expect(audit).toContainText("harbor-light-rules-3");
  await expect(audit).toContainText("Harbor Light fixture replay. Not a live feed.");
  await expect(audit).toContainText("Not stored. No override is recorded.");
  await expect(audit).toContainText("Not stored. No reviewer is recorded.");
  await expect(audit).toContainText(MISSING);
  await expect(audit).toContainText(SUGGESTED);
  await expect(page.getByRole("table", { name: "Decision trace", exact: true })).toBeVisible();
});
