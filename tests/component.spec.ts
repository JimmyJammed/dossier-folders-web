import { test, expect } from "@playwright/test";
const root = "#fixture";
async function ready(page: any) {
  await page.goto("/tests/fixture.html");
  await expect(page.locator(root)).toHaveAttribute("data-enhanced", "");
}
async function open(page: any, id = "orbit-market") {
  await page.evaluate((id: string) => (window as any).fixture.api.open(id), id);
  await expect(page.locator(root)).toHaveAttribute("data-state", "open");
}
async function reduced(page: any) {
  await page.evaluate(() =>
    (window as any).fixture.api.update({ motion: "reduced" }),
  );
  await expect(page.locator(root)).toHaveAttribute("data-enhanced", "");
}
test("counts 0/1/3/6/12, text tabs and long labels remain operable", async ({
  page,
}) => {
  await ready(page);
  for (const count of [0, 1, 3, 6, 12]) {
    await page.evaluate((count) => {
      const f = (window as any).fixture;
      f.api.update({
        motion: "reduced",
        records: Array.from({ length: count }, (_, i) => ({
          ...f.options.records[i % 6],
          id: `record-${i}`,
          title: `Record ${i}`,
          tab: {
            mode: "text",
            label: "A long descriptive label for a fictional record",
          },
        })),
      });
    }, count);
    await expect(page.locator(".folder-tab")).toHaveCount(count);
    if (!count) {
      await expect(page.getByText("No records yet.")).toBeVisible();
      continue;
    }
    await expect(page.locator(root)).toHaveAttribute("data-enhanced", "");
    await open(page, `record-${count - 1}`);
    await page.keyboard.press("Escape");
    await expect(page.locator(root)).toHaveAttribute("data-state", "closed");
    await expect(
      page.locator(`[data-company="record-${count - 1}"]`),
    ).toBeFocused();
  }
});
test("invalid update is atomic; valid update while open closes and releases body", async ({
  page,
}) => {
  await ready(page);
  await reduced(page);
  await open(page);
  const error = await page.evaluate(() => {
    try {
      (window as any).fixture.api.update({ records: [{ id: "bad" }] });
    } catch (e) {
      return String(e);
    }
  });
  expect(error).toContain("records[0]");
  await expect(page.locator(root)).toHaveAttribute("data-state", "open");
  await page.evaluate(() => {
    const f = (window as any).fixture;
    f.api.update({ records: f.options.records.slice(1) });
  });
  await expect(page.locator(".folder-tab")).toHaveCount(5);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});
test("two instances share record IDs without DOM collisions or competing scroll locks", async ({
  page,
}) => {
  await ready(page);
  await reduced(page);
  await page.evaluate(() => {
    const f = (window as any).fixture,
      el = document.createElement("section");
    el.id = "second";
    document.body.append(el);
    f.second = f.createDossierFolders(el, { ...f.options, motion: "reduced" });
  });
  await expect(page.locator("#second")).toHaveAttribute("data-enhanced", "");
  const ids = await page
    .locator("[id]")
    .evaluateAll((els) => els.map((e) => e.id));
  expect(new Set(ids).size).toBe(ids.length);
  await open(page);
  await page.evaluate(() =>
    (window as any).fixture.second.open("wander-atlas"),
  );
  await expect(page.locator("#second")).toHaveAttribute("data-state", "open");
  await expect(page.locator(root)).toHaveAttribute("data-state", "closed");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.evaluate(() => {
    const s = (window as any).fixture.second;
    s.destroy();
    s.destroy();
  });
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await open(page);
});
test("container width selects stacked layout independently of viewport", async ({
  page,
}) => {
  await ready(page);
  await page
    .locator(root)
    .evaluate((el) => ((el as HTMLElement).style.width = "360px"));
  await expect(page.locator(root)).toHaveAttribute("data-layout", "stack");
  const rows = await page
    .locator(".folder-tab")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  for (let i = 1; i < rows.length; i++)
    expect(rows[i] - rows[i - 1]).toBeGreaterThanOrEqual(44);
  await reduced(page);
  await open(page, "northstar-archive");
  await page.keyboard.press("Escape");
  await expect(
    page.locator('[data-company="northstar-archive"]'),
  ).toBeFocused();
});
test("reduced motion and Save-Data retain complete content and manual media", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      value: Object.assign(new EventTarget(), { saveData: true }),
      configurable: true,
    }),
  );
  await ready(page);
  await open(page);
  await expect(page.locator(root)).toHaveAttribute("data-motion", "reduced");
  const video = page.locator('[data-folder="orbit-market"] video');
  await expect(video).toHaveAttribute("src", /orbit-demo.mp4/);
  expect(
    await video.evaluate((v: HTMLVideoElement) => v.paused && v.controls),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await open(page, "wander-atlas");
  await expect(page.locator("[data-gallery-toggle]")).toHaveText(
    "Resume slideshow",
  );
  await page.locator("[data-gallery-next]").click();
  await expect(page.locator("[data-gallery-image]").nth(1)).toBeVisible();
});
test("video is lazy, errors are recoverable, and multiple media blocks render", async ({
  page,
}) => {
  await ready(page);
  expect(
    await page
      .locator('[data-folder="orbit-market"] video')
      .getAttribute("src"),
  ).toBeNull();
  await page.route("**/orbit-demo.mp4", (r) => r.abort());
  await page.evaluate(() => {
    const f = (window as any).fixture;
    f.errors = [];
    f.api.update({
      motion: "reduced",
      onMediaError: (e: any) => f.errors.push(e),
    });
  });
  await open(page);
  const video = page.locator('[data-folder="orbit-market"] video');
  await video.evaluate((v: HTMLVideoElement) =>
    v.dispatchEvent(new Event("error")),
  );
  await expect(
    page.locator('[data-folder="orbit-market"] [data-video-status]'),
  ).toContainText("Video unavailable");
  expect(
    await page.evaluate(() => (window as any).fixture.errors.length),
  ).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await open(page, "fieldnote-labs");
  await expect(
    page.locator('[data-folder="fieldnote-labs"] .record-media'),
  ).toHaveCount(2);
});
test("gallery decode failure stops rotation and manual navigation can recover", async ({
  page,
}) => {
  await ready(page);
  await reduced(page);
  await page.evaluate(() => {
    const original = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      return this.src.includes("wander-1.svg")
        ? Promise.reject(new Error("decode failed"))
        : original.call(this);
    };
  });
  await open(page, "wander-atlas");
  await page.locator("[data-gallery-next]").click();
  await expect(
    page.locator('[data-folder="wander-atlas"] [data-video-status]'),
  ).toContainText("Image unavailable");
  await expect(page.locator("[data-gallery-toggle]")).toHaveText(
    "Resume slideshow",
  );
  await expect(page.locator("[data-gallery-image]").first()).toBeVisible();
});
test("manual gallery pause persists after closing and reopening", async ({
  page,
}) => {
  await ready(page);
  await open(page, "wander-atlas");
  await expect(page.locator("[data-gallery-toggle]")).toHaveText(
    "Pause slideshow",
  );
  await page.locator("[data-gallery-toggle]").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(root)).toHaveAttribute("data-state", "closed");
  await open(page, "wander-atlas");
  await expect(page.locator("[data-gallery-toggle]")).toHaveText(
    "Resume slideshow",
  );
});
test("blocked motion module leaves readable content and manual gallery controls", async ({
  page,
}) => {
  await page.route("**/src/controller.ts*", (r) => r.abort());
  await page.goto("/tests/fixture.html");
  await expect(page.locator(".record-company")).toHaveCount(6);
  await expect(page.locator(root)).not.toHaveAttribute("data-enhanced");
  await expect(page.locator(".record-company").last()).toBeVisible();
  await page.locator("[data-gallery-next]").click();
  await expect(page.locator("[data-gallery-image]").nth(1)).toBeVisible();
});
test("print returns an open scene to document flow", async ({ page }) => {
  await ready(page);
  await reduced(page);
  await open(page, "juniper-works");
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator(".record-company").last()).toBeVisible();
  expect(
    await page
      .locator(".record-scroll")
      .first()
      .evaluate((e) => getComputedStyle(e).overflow),
  ).toBe("visible");
});
test("callbacks expose transitions and destroy restores original host", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    const f = (window as any).fixture;
    f.events = [];
    f.api.update({
      motion: "reduced",
      onOpen: (id: string) => f.events.push(`open:${id}`),
      onClose: (id: string) => f.events.push(`close:${id}`),
      onStateChange: (s: any) => f.events.push(s.phase),
    });
  });
  await open(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(root)).toHaveAttribute("data-state", "closed");
  expect(await page.evaluate(() => (window as any).fixture.events)).toEqual(
    expect.arrayContaining([
      "opening",
      "open",
      "open:orbit-market",
      "closed",
      "close:orbit-market",
    ]),
  );
  await page.evaluate(() => {
    const f = (window as any).fixture;
    f.api.destroy();
    f.api.destroy();
  });
  await expect(page.locator(root)).toBeEmpty();
});
test("a delayed native close event cannot dismiss a newly reopened record", async ({
  page,
}) => {
  await ready(page);
  await reduced(page);
  await open(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(root)).toHaveAttribute("data-state", "closed");
  await open(page, "northstar-archive");
  await page.locator("dialog").dispatchEvent("close");
  await expect(page.locator(root)).toHaveAttribute("data-state", "open");
});
test("narrow desktop embeds keep stacked controls touch-sized", async ({
  page,
}) => {
  await ready(page);
  await page
    .locator(root)
    .evaluate((el) => ((el as HTMLElement).style.width = "320px"));
  await expect(page.locator(root)).toHaveAttribute("data-layout", "stack");
  const boxes = await page
    .locator(".folder-tab")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  for (const box of boxes) {
    expect(box.height).toBeGreaterThanOrEqual(43.5);
    expect(box.width).toBeGreaterThanOrEqual(100);
  }
  await page.locator('[data-company="northstar-archive"]').click();
  await expect(page.locator(root)).toHaveAttribute("data-state", "open");
});
test("video playback suspends offscreen, on hidden pages, and after close", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    const f = (window as any).fixture;
    const records = structuredClone(f.options.records);
    records[0].blocks.push({
      kind: "text",
      paragraphs: Array.from(
        { length: 24 },
        () =>
          "A longer narrative keeps the media fully outside the reading viewport when scrolled to the end.",
      ),
    });
    f.api.update({ records });
  });
  await open(page);
  const video = page.locator('[data-folder="orbit-market"] video');
  await video.scrollIntoViewIfNeeded();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(false);
  await page
    .locator('[data-folder="orbit-market"] .record-scroll')
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator(root)).toHaveAttribute("data-state", "closed");
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
});
test("blocked autoplay leaves native controls and readable content", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () =>
      Promise.reject(new DOMException("Blocked", "NotAllowedError"));
  });
  await ready(page);
  await open(page);
  const video = page.locator('[data-folder="orbit-market"] video');
  await video.scrollIntoViewIfNeeded();
  await expect(
    page.locator('[data-folder="orbit-market"] [data-video-status]'),
  ).toContainText("Use the video controls");
  expect(await video.evaluate((v: HTMLVideoElement) => v.controls)).toBe(true);
  await expect(
    page.locator('[data-folder="orbit-market"] .record-headline'),
  ).toBeVisible();
});
