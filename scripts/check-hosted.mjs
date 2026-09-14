import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
const url = process.argv[2];
if (!url) throw new Error("Pass the demo URL.");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(new URL(url).origin))
      errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(url);
  await page.locator("#preview[data-enhanced]").waitFor();
  await page
    .getByRole("button", { name: "Open Orbit Market", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector("#preview")?.dataset.state === "open",
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.querySelector("#preview")?.dataset.state === "closed",
  );
  let waiting = page.waitForEvent("download");
  await page.locator("#export-json").click();
  const json = await waiting;
  await page.locator("#import-json").setInputFiles(await json.path());
  await page.waitForTimeout(300);
  const missing = await page
    .locator(".folder-tab img")
    .evaluateAll((images) =>
      images
        .filter((i) => !i.complete || i.naturalWidth === 0)
        .map((i) => i.src),
    );
  if (missing.length) throw new Error(`Missing imported assets: ${missing}`);
  waiting = page.waitForEvent("download");
  await page.locator("#export-zip").click();
  const bundle = await waiting;
  const files = unzipSync(readFileSync(await bundle.path()));
  const config = JSON.parse(strFromU8(files["dossier.config.json"]));
  if (!files[config.options.records[0].tab.logo.src])
    throw new Error("ZIP asset missing");
  if (!files["assets/orbit-demo.mp4"]) throw new Error("ZIP video missing");
  await page.reload();
  await page.locator("#preview[data-enhanced]").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    )
  )
    throw new Error("Mobile overflow");
  await page
    .getByRole("button", { name: "Open Northstar Archive", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector("#preview")?.dataset.state === "open",
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.querySelector("#preview")?.dataset.state === "closed",
  );
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    `Passed: ${url}; desktop/mobile, refresh, JSON import, ZIP asset contents, lazy motion, open/close, no missing assets or browser errors.`,
  );
} finally {
  await browser.close();
}
