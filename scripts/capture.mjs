import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5196");
await page.locator("#preview[data-enhanced]").waitFor();
await page.screenshot({ path: "previews/desktop.png", fullPage: true });
console.log(
  await page
    .locator("#preview")
    .evaluate((el) => ({
      layout: el.dataset.layout,
      box: el.getBoundingClientRect().toJSON(),
      tabs: [...el.querySelectorAll(".folder-tab")].map((b) =>
        b.getBoundingClientRect().toJSON(),
      ),
    })),
);
await page
  .getByRole("button", { name: "Open Orbit Market", exact: true })
  .click();
await page.waitForFunction(
  () => document.querySelector("#preview")?.dataset.state === "open",
);
await page.screenshot({ path: "previews/open-record.png" });
await page.keyboard.press("Escape");
await page.waitForFunction(
  () => document.querySelector("#preview")?.dataset.state === "closed",
);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "previews/mobile.png", fullPage: true });
console.log({ errors });
await browser.close();
