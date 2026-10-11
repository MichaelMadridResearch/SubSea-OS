import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

test("queue row opens a fictional response review and focuses its marker", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill("operator@demo.invalid");
  await page.getByLabel("Password").fill("demo-only-not-a-secret");
  await page.getByRole("button", { name: "Sign in", disabled: false }).click();
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Response review" })).toContainText(
    "wind-turbine.svg",
  );

  await page.getByRole("button", { name: "Review response for SR-021" }).click();
  const review = page.getByRole("region", { name: "Response review" });
  await expect(review).toContainText("Alert to intervention");
  await expect(review).toContainText("Reading T1");
  await expect(review).toContainText("Preserved advisory step");
  await expect(review).toContainText("harbor-light-replay-1");
  await expect(review).toContainText("Evidence corroborated");
  await expect(review).toContainText("Delay pressure is advisory context, not a score term.");
  await expect(review).toContainText("Readiness stance constrained");
  await expect(review).toContainText("Temporary stabilization is not leading");
  await expect(review).toContainText("Repair mobilization is not leading");
  await expect(review).toContainText("New reading");
  await expect(review).toContainText("Advisory next step");
  await expect(review).toContainText("Request a targeted inspection");
  await expect(review).toContainText("External impact");
  await expect(review).toContainText("No proximity match was applied.");
  await expect(review).toContainText("No equipment was controlled.");
  await expect(review).toContainText("Prepare a derate review is not available");
  await expect(review.getByRole("list", { name: "Closed cases" })).toContainText(
    "FICTIONAL-CLOSED-02",
  );
  await expect(page.locator("button.map-marker", { hasText: "Anomaly A" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("img", { name: "Harbor Light route map" })).toBeVisible();
  await page.locator("button.map-marker", { hasText: "Anomaly A" }).hover();
  await expect(page.locator("article.queue-card-linked")).toContainText("SR-021");

  await page.getByRole("button", { name: "Review response for FICTIONAL-MIXED-01" }).click();
  await expect(review).toContainText("Certainty is limited.");
  await expect(review).toContainText("Insulation degradation");
  await expect(review).toContainText("Overheating");
  await expect(review).toContainText("No map symbol was added.");
  await expect(review).toContainText("Urgency");
  await expect(review).toContainText("Weather window");
  await expect(review).toContainText("Advisory score");
  await expect(review).toContainText("What would reduce uncertainty");
  await expect(review).toContainText("Decision audit");
  await expect(review).toContainText("Execution burden");
  await expect(review).toContainText("Continue monitoring");
  await expect(review).toContainText("Consequence proxy");
  await expect(review).toContainText("If action waits");
  await expect(review).toContainText("Prepare a derate review is available");
  await expect(review).toContainText("Delay pathway");
  await expect(review).toContainText("The same leading option holds.");
  await expect(review).toContainText("Incident package");
  await expect(review).toContainText("What matched");
  await expect(review).toContainText("It does not replace the current advisory score.");
  await expect(review).toContainText("The tie still limits certainty.");
  await expect(review).toContainText("Closed-case playback");
  await expect(review).toContainText("Live re-scoring is still deferred.");
  await expect(review).toContainText("Temporary stabilization");
  await expect(review).toContainText("Prepare repair mobilization");
  await expect(review).toContainText("Precedent influence does not replace the current advisory score.");
  await expect(review).toContainText("not a currency amount");
  await expect(review).toContainText("Evidence conflicting");
  await expect(review).toContainText("Readiness stance delayed");
  await expect(review).toContainText("Why this action");
  await expect(review).toContainText("Not calculated. No crew or tool record is stored.");
  const downloadPromise = page.waitForEvent("download");
  await review.getByRole("button", { name: "Download incident package" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("incident-package-FICTIONAL-MIXED-01.json");
  const payload = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(payload.recommendation).toBe("Continue monitoring");
  expect(payload.human_approval).toBe(
    "A person approves the next step. This software does not control equipment.",
  );
  expect(payload.rule_version).toBe("harbor-light-rules-3");
  expect(payload.stream_session).toBe("harbor-light-replay-1");
  expect(payload.corroboration_summary.length).toBeGreaterThan(0);
  expect(payload.missing_evidence_summary).toContain("Strain is absent");
  expect(payload.readiness_stances.length).toBe(3);
  expect(payload.recommendation_rationales.length).toBe(3);
  expect(payload.hazard_history.length).toBeGreaterThan(0);
  expect(payload.action_history[0]).toContain("does not replace the five-term score");
  await review.getByRole("button", { name: "Replay stream" }).click();
  await expect(review).toContainText("Replay step T1");
  await review.getByRole("button", { name: "Pause stream" }).click();
  await expect(page.locator("button.map-marker")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Review response for FICTIONAL-ALERT-001" })).toHaveText(
    "Review response",
  );
});
