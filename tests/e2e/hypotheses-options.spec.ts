import { expect, test, type Page } from "@playwright/test";

const ACTION_NAME = /approve|dispatch|shutdown|score|prefer/i;

async function expectNoEnabledAction(page: Page) {
  await expect(page.getByRole("button", { name: ACTION_NAME, disabled: false })).toHaveCount(0);
  await expect(page.getByRole("link", { name: ACTION_NAME, disabled: false })).toHaveCount(0);
}

test("read-only hypotheses and options for the fictional case", async ({ page }) => {
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

  const hypotheses = page.getByRole("link", { name: "Hypotheses", exact: true });
  await expect(hypotheses).toHaveAttribute("href", `/cases/${caseId}/hypotheses`);
  const options = page.getByRole("link", { name: "Options", exact: true });
  await expect(options).toHaveAttribute("href", `/cases/${caseId}/options`);
  const evidence = page.getByRole("link", { name: "Evidence", exact: true });
  await expect(evidence).toHaveAttribute("href", `/cases/${caseId}/evidence`);
  const feasibility = page.getByRole("link", { name: "Feasibility", exact: true });
  await expect(feasibility).toHaveAttribute("href", `/cases/${caseId}/feasibility`);
  const decision = page.getByRole("link", { name: "Decision", exact: true });
  await expect(decision).toHaveAttribute("href", `/cases/${caseId}/decision`);
  const audit = page.getByRole("link", { name: "Audit", exact: true });
  await expect(audit).toHaveAttribute("href", `/cases/${caseId}/audit`);

  await evidence.click();
  await expect(page).toHaveURL(`/cases/${caseId}/evidence`);
  await expect(page.getByRole("list", { name: "Evidence timeline" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Evidence provenance" })).toBeVisible();
  await expect(page.locator("body")).toContainText("Missing evidence");
  await expect(page.locator("body")).toContainText("Conflicts with the assessment");
  await expectNoEnabledAction(page);

  await hypotheses.click();
  await expect(page).toHaveURL(`/cases/${caseId}/hypotheses`);
  await expect(page.locator("body")).toContainText("Display only. Not scored.");
  await expect(page.locator("body")).toContainText("Not calculated.");
  await expect(page.locator("body")).toContainText("FICTIONAL-ALERT-001");
  await expect(page.getByRole("table", { name: "Ranked explanations" })).toContainText(
    "Leading explanation.",
  );
  await expect(page.locator("body")).toContainText("Supporting");
  await expect(page.locator("body")).toContainText("Conflicting");
  await expect(page.locator("body")).toContainText("Missing");
  await expectNoEnabledAction(page);

  await page.getByRole("link", { name: "Options", exact: true }).click();
  await expect(page).toHaveURL(`/cases/${caseId}/options`);
  await expect(page.locator("body")).toContainText("Not calculated.");
  await expect(page.locator("body")).toContainText("FICTIONAL-ALERT-001");
  await expect(page.locator("body")).toContainText("Suggested step");
  await expect(page.locator("body")).toContainText("Request engineering review");
  await expect(page.locator("body")).toContainText("Consequence reduction");
  await expect(page.locator("body")).toContainText("Expected impact");
  await expect(page.locator("body")).toContainText("Assumptions");
  await expectNoEnabledAction(page);
});
