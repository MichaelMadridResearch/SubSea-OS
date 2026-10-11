import { expect, test, type Locator, type Page } from "@playwright/test";

const TILE_NOTE = "Map tiles unavailable. The route geometry is still shown.";

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return box!;
}

function center(box: { x: number; y: number; width: number; height: number }) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("operator@demo.invalid");
  await page.getByLabel("Password").fill("demo-only-not-a-secret");
  await page.getByRole("button", { name: "Sign in", disabled: false }).click();
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
}

test("fictional harbor light map pans, zooms, and stays on fixture geometry", async ({ page }) => {
  await signIn(page);
  const map = page.getByRole("img", { name: "Harbor Light route map" });
  await expect(map).toBeVisible();
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeVisible();

  const vertices = page.getByRole("list", { name: "Route vertices" });
  await expect(vertices).toContainText("1, 53.5");
  await expect(vertices).toContainText("1.2, 53.6");
  await expect(vertices).toContainText("1.5, 53.7");

  const markers = page.locator("button.map-marker");
  await expect(markers).toHaveCount(4);
  await expect(markers.filter({ hasText: "Offshore substation" })).toBeVisible();
  await expect(markers.filter({ hasText: "Landfall" })).toBeVisible();
  await expect(markers.filter({ hasText: "Anomaly A" })).toBeVisible();
  await expect(markers.filter({ hasText: "Anomaly B" })).toBeVisible();
  await expect(markers.filter({ hasText: "Anomaly A" }).locator("img")).toHaveAttribute(
    "src",
    "/map/anomaly-high.svg",
  );
  const key = page.getByRole("list", { name: "Map key" });
  await expect(key).toContainText("Critical");
  await expect(key).toContainText("High");
  await expect(key).toContainText("Cable");
  await expect(key).toContainText("Survey");
  await expect(key).toContainText("Vessel");
  await expect(key.locator("[style*='/map/anomaly-selected.svg']")).toBeVisible();
  await expect(key.locator("[style*='/map/anomaly-high.svg']")).toBeVisible();
  await expect(map).toHaveAttribute("data-map-fitted", "true");
  await expect(map).toHaveAttribute("data-route-points", "3");
  const mapBox = await boxOf(map);
  for (const marker of await markers.all()) {
    const markerCenter = center(await boxOf(marker));
    expect(markerCenter.x).toBeGreaterThanOrEqual(mapBox.x);
    expect(markerCenter.x).toBeLessThanOrEqual(mapBox.x + mapBox.width);
    expect(markerCenter.y).toBeGreaterThanOrEqual(mapBox.y);
    expect(markerCenter.y).toBeLessThanOrEqual(mapBox.y + mapBox.height);
  }

  const marker = markers.first();
  const beforeZoom = await boxOf(marker);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect
    .poll(async () => {
      const next = await marker.boundingBox();
      return next ? `${Math.round(next.x)}:${Math.round(next.y)}` : "";
    })
    .not.toBe(`${Math.round(beforeZoom.x)}:${Math.round(beforeZoom.y)}`);

  const beforePan = await boxOf(marker);
  const canvasBox = await boxOf(canvas);
  const startX = canvasBox.x + canvasBox.width / 2;
  const startY = canvasBox.y + canvasBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 40, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => {
      const next = await marker.boundingBox();
      return next ? `${Math.round(next.x)}:${Math.round(next.y)}` : "";
    })
    .not.toBe(`${Math.round(beforePan.x)}:${Math.round(beforePan.y)}`);

  await page.getByRole("button", { name: "Recenter map" }).click();
  const substation = markers.filter({ hasText: "Offshore substation" });
  await substation.click();
  await expect(substation).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".maplibregl-popup")).toContainText("Temperature and load");
  const anomaly = markers.filter({ hasText: "Anomaly A" });
  await anomaly.click();
  await expect(anomaly.locator("img").first()).toHaveAttribute("src", "/map/anomaly-selected.svg");
  await expect(page.getByRole("button", { name: "Recenter map" })).toBeVisible();
  await expect(page.getByText(TILE_NOTE).or(page.locator(".maplibregl-ctrl-attrib"))).toBeVisible();
});

test("fictional map keeps geometry when tiles fail", async ({ page }) => {
  await page.route(/openfreemap\.org/i, (route) => route.abort());
  await signIn(page);
  await expect(page.getByRole("img", { name: "Harbor Light route map" })).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: TILE_NOTE })).toBeVisible();
  await expect(page.locator("button.map-marker", { hasText: "Offshore substation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Harbor Light route map" })).toHaveAttribute(
    "data-route-points",
    "3",
  );
});
