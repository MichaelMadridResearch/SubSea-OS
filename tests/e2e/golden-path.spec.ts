import { expect, test } from "@playwright/test";

test("fictional alert becomes an advisory case", async ({ page }) => {
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

  const evidence = page.getByRole("link", { name: "Evidence", exact: true });
  await expect(evidence).toHaveAttribute("href", `/cases/${caseId}/evidence`);
  await evidence.click();
  await expect(page).toHaveURL(`/cases/${caseId}/evidence`);
  const timeline = page.getByRole("list", { name: "Evidence timeline" });
  await expect(timeline).toContainText("alert_imported");
  await expect(timeline).toContainText("location_mapped");
  await expect(timeline).toContainText("case_opened");
  await expect(timeline).toContainText(
    "Alert location is a vertex of the stored route. No proximity threshold was applied.",
  );
  await expect(timeline).toContainText("No shutdown or dispatch was performed.");
});
