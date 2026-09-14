import { test, expect } from "@playwright/test";
test("default static HTML contains every fictional record without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5196");
  await expect(page.locator(".record-company")).toHaveCount(6);
  await expect(
    page.getByText("Northstar Archive", { exact: true }),
  ).toBeVisible();
  await context.close();
});
test("editor changes colors, count, tab labels, content and resets", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#preview")).toHaveAttribute("data-enhanced", "");
  await page.locator('[data-path="options.records.0.fill"]').fill("#225588");
  await expect(page.locator('[data-folder="orbit-market"]')).toHaveAttribute(
    "style",
    /225588/,
  );
  await page.locator('[data-action="record-add"]').click();
  await expect(page.locator(".folder-tab")).toHaveCount(7);
  await page
    .locator('[data-path="options.records.6.title"]')
    .fill("Example Company");
  await expect(page.locator(".record-company").last()).toHaveText(
    "Example Company",
  );
  await page.locator('[data-action="record-up"]').click();
  await expect(page.locator(".record-company").nth(5)).toHaveText(
    "Example Company",
  );
  await page.locator('[data-action="record-remove"]').click();
  await expect(page.locator(".folder-tab")).toHaveCount(6);
  await page.locator("#reset").click();
  await expect(page.locator('[data-folder="orbit-market"]')).toHaveAttribute(
    "style",
    /663cc4/,
  );
});
test("content blocks can be added, edited, reordered, and removed", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Record content", { exact: true }).click();
  await page.locator("#new-block-kind").selectOption("text");
  await page.locator('[data-action="block-add"]').click();
  const block = page.locator('[data-block-card="3"]');
  await block.locator("summary").click();
  await block.locator('[data-path$=".heading"]').fill("A custom chapter");
  await expect(
    page.locator(".record-section-title", { hasText: "A custom chapter" }),
  ).toHaveCount(1);
  await block
    .locator('[data-path$=".paragraphs"]')
    .fill('["Hello ", [{"strong":"world"}]]');
  await expect(
    page.locator('[data-folder="orbit-market"] strong', { hasText: "world" }),
  ).toHaveCount(1);
  await block.locator('[data-action="block-up"]').click();
  await page.locator('[data-block-card="2"] summary').click();
  await page.locator('[data-action="block-remove"][data-block="2"]').click();
  await expect(
    page.locator(".record-section-title", { hasText: "A custom chapter" }),
  ).toHaveCount(0);
});
test("invalid configuration preserves the preview; JSON export round trips", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#import-json").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.locator("#editor-status")).toContainText("version");
  await expect(page.locator(".folder-tab")).toHaveCount(6);
  const download = page.waitForEvent("download");
  await page.locator("#export-json").click();
  const file = await download;
  const path = await file.path();
  expect(file.suggestedFilename()).toBe("dossier.config.json");
  await page.locator("#import-json").setInputFiles(path!);
  await expect(page.locator("#editor-status")).toContainText(
    "Configuration imported",
  );
  await expect(page.locator(".folder-tab")).toHaveCount(6);
});
test("local asset upload exports a portable ZIP and resets object URLs", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator('[data-asset="options.records.0.tab.logo.src"]')
    .setInputFiles({
      name: "sample.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="red"/></svg>',
      ),
    });
  await expect(
    page.locator('[data-folder="orbit-market"] .folder-tab img'),
  ).toHaveAttribute("src", /^blob:/);
  const download = page.waitForEvent("download");
  await page.locator("#export-zip").click();
  expect((await download).suggestedFilename()).toBe("dossier-config.zip");
  await expect(page.locator("#editor-status")).toContainText("exported");
  await page.locator("#reset").click();
  await expect(
    page.locator('[data-folder="orbit-market"] .folder-tab img'),
  ).not.toHaveAttribute("src", /^blob:/);
});
test("200 percent zoom equivalent keeps editor and modal reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 500 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.locator('[data-path="options.motion"]').selectOption("reduced");
  await page
    .getByRole("button", { name: "Open Northstar Archive", exact: true })
    .click();
  await expect(page.locator("#preview")).toHaveAttribute("data-state", "open");
  await expect(page.locator("[data-record-close]")).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open Northstar Archive", exact: true }),
  ).toBeFocused();
});
test("auto ink chooses accessible contrast on middle-gray folders", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-path="options.records.0.fill"]').fill("#808080");
  await expect(page.locator('[data-folder="orbit-market"]')).toHaveAttribute(
    "style",
    /808080/,
  );
  await page.locator('[data-action="auto-ink"]').click();
  await expect(page.locator("#contrast")).toContainText(
    "Meets normal-text AA contrast",
  );
});
