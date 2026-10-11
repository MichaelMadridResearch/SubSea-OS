import { expect, test } from "@playwright/test";

const SUGGESTED = "Suggested step: Request engineering review at advisory score 12.";

test("advisory workflow stays fixture-backed and consistent", async ({ page }) => {
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

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: /^Cases(?:\s*\d+)?$/ })
    .click();
  await page.getByRole("link", { name: "FICTIONAL-ALERT-001" }).click();
  await expect(page).toHaveURL(/\/cases\/[^/]+$/);
  const caseId = new URL(page.url()).pathname.split("/")[2];

  const overviewConsequence = page.getByRole("region", { name: "Consequence over time" });
  await expect(overviewConsequence).toContainText("Service exposure");
  await expect(overviewConsequence).toContainText("Delay sensitivity");
  await expect(overviewConsequence).toContainText("Consequence reduction");
  await expect(overviewConsequence).toContainText("No inspection record is stored for this window.");
  await expect(page.locator("body")).toContainText(SUGGESTED);

  await page.getByRole("link", { name: "Feasibility", exact: true }).click();
  const blockers = page.getByRole("list", { name: "Blocking constraints" });
  const inspection = (await blockers.locator("li", { hasText: "Inspection" }).innerText()).trim();
  expect(inspection).toContain("Blocks immediate action.");

  await page.getByRole("link", { name: "Options", exact: true }).click();
  await expect(page).toHaveURL(`/cases/${caseId}/options`);
  const prerequisites = page.getByRole("region", { name: "Option prerequisites" });
  await expect(prerequisites).toContainText(inspection);
  await expect(prerequisites).toContainText("Not calculated.");
  await expect(prerequisites).toContainText("No option is approved or dispatchable.");
  await expect(page.locator("body")).toContainText(SUGGESTED);

  await page.getByRole("link", { name: "Decision", exact: true }).click();
  await expect(page.getByRole("list", { name: "Blocking constraints" })).toContainText(inspection);
  await expect(page.getByRole("region", { name: "Consequence over time" })).toContainText(
    "Service exposure",
  );
  const pack = page.getByRole("region", { name: "Case pack preview" });
  await expect(pack).toContainText("FICTIONAL-ALERT-001");
  await expect(pack).toContainText("harbor-light-rules-3");
  await expect(pack).toContainText(SUGGESTED);
  await expect(pack).toContainText("Not stored.");
  await expect(pack).toContainText("Not calculated.");
  await expect(pack).toContainText(inspection);
  await expect(pack).toContainText("No inspection record is stored for this window.");
  await expect(pack).toContainText("Harbor Light fixture replay. Not a live feed.");
  await expect(pack).toContainText(
    "A person approves the next step. This software does not control equipment.",
  );
  await expect(pack).toContainText("Download stays unavailable");
  for (const title of [
    "Case summary",
    "Anomaly summary",
    "Leading hypothesis",
    "Suggested step",
    "Supporting evidence",
    "Conflicting evidence",
    "Missing evidence",
    "Feasibility bands",
    "Assumptions",
    "Rule version",
    "Provenance summary",
    "Decision trace",
    "Case chronology",
    "Approval",
    "Export status",
  ]) {
    await expect(pack.getByText(title, { exact: true }).first()).toBeVisible();
  }
  const handoff = page.getByRole("region", { name: "Downstream handoff" });
  await expect(handoff).toContainText("Handoff contract");
  await expect(handoff).toContainText("Target system type");
  await expect(handoff).toContainText("This does not send a handoff.");
  await expect(handoff).toContainText("Send handoff is unavailable.");
  await expect(handoff).toContainText(SUGGESTED);
  await expect(handoff).toContainText(inspection);
  await expect(handoff).toContainText("harbor-light-rules-3");
  await expect(handoff).toContainText("Not stored.");
  await expect(handoff.getByRole("button", { name: "Send handoff" })).toBeDisabled();

  await page.getByRole("link", { name: "Audit", exact: true }).click();
  await expect(page).toHaveURL(`/cases/${caseId}/audit`);
  await expect(page.locator("body")).toContainText(SUGGESTED);
  await expect(page.getByRole("region", { name: "Case pack preview" })).toContainText(SUGGESTED);
  await expect(page.getByRole("region", { name: "Downstream handoff" })).toContainText(SUGGESTED);
  await expect(page.getByRole("button", { name: "Send handoff" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /approve|dispatch|shutdown/i, disabled: false })).toHaveCount(
    0,
  );
});
