import { expect, test, type Page } from "@playwright/test";

const root = (page: Page) => page.locator("[data-dossier]");
const dialog = (page: Page) => page.locator("dialog[data-dossier-dialog]");
const tab = (page: Page, id: string) =>
  page.locator(`button[data-company="${id}"]`);
const folder = (page: Page, id: string) =>
  page.locator(`[data-folder="${id}"]`);

async function nextFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function expectCloseInTabBand(page: Page, id = "orbit-market") {
  const close = await page.locator("[data-record-close]").boundingBox();
  const sheet = await folder(page, id).locator(".folder-sizing").boundingBox();
  const selectedTab = await tab(page, id).boundingBox();
  const body = await folder(page, id)
    .locator(".folder-back-shadow")
    .boundingBox();
  const right = close!.x + close!.width;
  const atRightEdge = Math.abs(right - sheet!.x - sheet!.width) < 1.5;
  const besideTab = Math.abs(right - (selectedTab!.x - 12)) < 1.5;
  expect(
    atRightEdge || besideTab,
    "Close aligns right or clears the selected tab by 12px",
  ).toBe(true);
  expect(
    right <= selectedTab!.x - 11.5 ||
      close!.x >= selectedTab!.x + selectedTab!.width + 11.5,
    "Close does not overlap the selected company tab",
  ).toBe(true);
  expect(
    Math.abs(close!.y + close!.height - (body!.y - 12)),
    "Close sits 12px above the rendered folder body",
  ).toBeLessThan(1.5);
  expect(close!.y).toBeGreaterThanOrEqual(15.5);
  await expect(page.locator("[data-record-close]")).toBeInViewport({
    ratio: 1,
  });
}

async function companyIds(page: Page) {
  return page
    .locator("[data-folder]")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => (node as HTMLElement).dataset.folder!)
        .filter(Boolean),
    );
}

async function stackingOrder(page: Page) {
  return page
    .locator("[data-folder]")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: (node as HTMLElement).dataset.folder,
        z: getComputedStyle(node).zIndex,
      })),
    );
}

async function openRecord(page: Page, id: string) {
  await tab(page, id).click();
  await expect(root(page)).toHaveAttribute("data-state", "open");
  await expect(dialog(page)).toBeVisible();
}

async function closeRecord(page: Page) {
  await page.locator("[data-record-close]").click();
  await expect(root(page)).toHaveAttribute("data-state", "closed");
  await expect(dialog(page)).not.toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/fixture.html");
  await expect(root(page)).toHaveAttribute("data-state", "closed");
  await page.evaluate(() => document.fonts.ready);
});

test("hover lifts the first, middle, and last folder without changing stack order", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Touch has no hover state.");
  const ids = await companyIds(page);
  const order = await stackingOrder(page);
  for (const id of [ids[0], ids[Math.floor(ids.length / 2)], ids.at(-1)!]) {
    await page.mouse.move(0, 0);
    await page.waitForTimeout(260);
    const before = await folder(page, id)
      .locator(".folder-sizing")
      .boundingBox();
    await tab(page, id).hover();
    await expect
      .poll(async () => {
        const after = await folder(page, id)
          .locator(".folder-sizing")
          .boundingBox();
        return before!.y - after!.y;
      })
      .toBeGreaterThan(8);
    expect(await stackingOrder(page)).toEqual(order);
    await expect(root(page)).toHaveAttribute("data-state", "closed");
  }
});

test("tab lower edges keep a steady lift and remain clickable while the pointer stays in place", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Touch has no hover state.");
  const ids = await companyIds(page);
  const order = await stackingOrder(page);
  for (const id of [ids[0], ids[Math.floor(ids.length / 2)], ids.at(-1)!]) {
    for (const edge of ["center", "left", "right"] as const) {
      await page.mouse.move(0, 0);
      await page.waitForTimeout(240);
      const sizing = folder(page, id).locator(".folder-sizing");
      const restingY = (await sizing.boundingBox())!.y;
      const button = (await tab(page, id).boundingBox())!;
      const point = {
        x:
          edge === "left"
            ? button.x + 2.5
            : edge === "right"
              ? button.x + button.width - 2.5
              : button.x + button.width / 2,
        y: button.y + button.height - 1.25,
      };
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(250);
      const lifts: number[] = [];
      for (let sample = 0; sample < 6; sample++) {
        // Repeated input at the same location rechecks browser hit testing as
        // the paper moves away from the original bottom edge.
        await page.mouse.move(point.x, point.y);
        await page.waitForTimeout(50);
        lifts.push(restingY - (await sizing.boundingBox())!.y);
      }
      expect(
        Math.min(...lifts),
        `${id} ${edge} bottom edge stays fully raised`,
      ).toBeGreaterThan(15.8);
      expect(
        Math.max(...lifts) - Math.min(...lifts),
        `${id} ${edge} bottom edge does not oscillate`,
      ).toBeLessThan(0.2);
      expect(await stackingOrder(page)).toEqual(order);
      await page.mouse.move(0, 0);
      await expect
        .poll(
          async () => Math.abs((await sizing.boundingBox())!.y - restingY),
          { message: `${id} lowers when the pointer leaves` },
        )
        .toBeLessThan(0.2);
    }
  }
  const first = (await tab(page, ids[0]).boundingBox())!;
  const adjacent = (await tab(page, ids[1]).boundingBox())!;
  const firstRestingY = (await folder(page, ids[0])
    .locator(".folder-sizing")
    .boundingBox())!.y;
  const adjacentRestingY = (await folder(page, ids[1])
    .locator(".folder-sizing")
    .boundingBox())!.y;
  await page.mouse.move(
    first.x + first.width / 2,
    first.y + first.height - 1.25,
  );
  await page.waitForTimeout(250);
  const target = {
    x: adjacent.x + adjacent.width / 2,
    y: adjacent.y + adjacent.height - 1.25,
  };
  await page.mouse.move(target.x, target.y);
  await expect
    .poll(
      async () =>
        adjacentRestingY -
        (await folder(page, ids[1]).locator(".folder-sizing").boundingBox())!.y,
    )
    .toBeGreaterThan(15.8);
  await expect
    .poll(async () =>
      Math.abs(
        (await folder(page, ids[0]).locator(".folder-sizing").boundingBox())!
          .y - firstRestingY,
      ),
    )
    .toBeLessThan(0.2);
  await page.mouse.click(target.x, target.y);
  await expect(root(page)).toHaveAttribute("data-state", "opening");
  await expect(page.locator("[data-folder][data-selected]")).toHaveAttribute(
    "data-folder",
    ids[1],
  );
  await expect(root(page)).toHaveAttribute("data-state", "open");
  await closeRecord(page);
});

test("cabinet handoffs into and out of the dialog preserve its rendered position", async ({
  page,
  isMobile,
}) => {
  type Rect = { x: number; y: number; width: number; height: number };
  type Transfer = { destination: string; before: Rect; after: Rect };
  await page.evaluate(() => {
    const scene = document.querySelector(".cabinet-scene")!;
    const cabinet = document.querySelector(".cabinet-front")!;
    const transfers: Transfer[] = [];
    Object.assign(window, { __cabinetTransfers: transfers });
    const capture = (): Rect => {
      const box = cabinet.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const append = Element.prototype.append;
    Element.prototype.append = function (...nodes) {
      const movingCabinet = nodes.includes(scene);
      const before = movingCabinet ? capture() : null;
      const destination = this.className;
      append.apply(this, nodes);
      // Read after the complete synchronous handoff, before any motion frame.
      if (before)
        queueMicrotask(() =>
          transfers.push({ destination, before, after: capture() }),
        );
    };
  });
  const viewports = isMobile
    ? [page.viewportSize()!]
    : [page.viewportSize()!, { width: 1129, height: 981 }];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await nextFrames(page);
    await openRecord(page, "orbit-market");
    await closeRecord(page);
  }
  const transfers = await page.evaluate(
    () =>
      (window as Window & { __cabinetTransfers: Transfer[] })
        .__cabinetTransfers,
  );
  expect(transfers).toHaveLength(viewports.length * 2);
  for (const [index, transfer] of transfers.entries()) {
    expect(transfer.destination).toBe(
      index % 2 ? "scene-home" : "dialog-scene-slot",
    );
    for (const dimension of ["x", "y", "width", "height"] as const) {
      expect(
        Math.abs(transfer.after[dimension] - transfer.before[dimension]),
        `${transfer.destination} preserves cabinet ${dimension}`,
      ).toBeLessThan(0.5);
    }
  }
});

test("extraction keeps the tab in view and clears sibling tabs before foreground depth", async ({
  page,
  isMobile,
}) => {
  const viewports = isMobile
    ? [page.viewportSize()!]
    : [page.viewportSize()!, { width: 1280, height: 720 }];
  const id = (await companyIds(page)).at(-1)!;
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await tab(page, id).click();
    const promoted = await page.waitForFunction((selectedId) => {
      const record = document.querySelector<HTMLElement>(
        `[data-folder="${selectedId}"]`,
      )!;
      const cabinet = document.querySelector(".cabinet-front")!;
      if (
        Number(getComputedStyle(record).zIndex) <=
        Number(getComputedStyle(cabinet).zIndex)
      )
        return false;
      const paintedBounds = (node: Element) => {
        const sizing = node.querySelector<HTMLElement>(".folder-sizing")!;
        const rect = sizing.getBoundingClientRect();
        const style = getComputedStyle(sizing);
        const localHeight = parseFloat(style.height);
        const scale = rect.height / localHeight;
        // Mobile keeps its full reading layout but masks the closed paper to a
        // compact cover. Clearance concerns the painted sheet, not hidden content.
        const inset =
          style.clipPath
            .match(/^inset\(([^)]*)\)/)?.[1]
            .split(/\s+round\s+/)[0]
            .trim()
            .split(/\s+/) ?? [];
        const pixels = (value = "0") =>
          parseFloat(value) * (value.endsWith("%") ? localHeight / 100 : 1);
        return {
          top: rect.top + pixels(inset[0]) * scale,
          bottom: rect.bottom - pixels(inset[2] ?? inset[0]) * scale,
        };
      };
      const selectedRect = paintedBounds(record);
      const siblingTop = Math.min(
        ...Array.from(document.querySelectorAll("[data-folder]"))
          .filter((node) => node !== record)
          .map((node) => paintedBounds(node).top),
      );
      return { top: selectedRect.top, bottom: selectedRect.bottom, siblingTop };
    }, id);
    const geometry = (await promoted.jsonValue()) as {
      top: number;
      bottom: number;
      siblingTop: number;
    };
    expect(
      geometry.top,
      `extracted tab inset at ${viewport.width}×${viewport.height}`,
    ).toBeGreaterThanOrEqual(23.5);
    expect(
      geometry.bottom,
      "selected folder clears the highest sibling tab before moving in front",
    ).toBeLessThan(geometry.siblingTop + 1);
    await expect(root(page)).toHaveAttribute("data-state", "open");
    await closeRecord(page);
  }
});

test("the camera scales one rigid folder while tab, logo, text, and media keep their relative geometry", async ({
  page,
}) => {
  type Rect = { x: number; y: number; width: number; height: number };
  type Sample = {
    state: string;
    angle: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    sheet: Rect;
    nodes: Array<{ selector: string; local: Rect; screen: Rect }>;
  };
  const collect = (id: string, phase: "opening" | "closing") =>
    page.evaluate(
      ({ selectedId, activePhase }) =>
        new Promise<{ initial: Sample; samples: Sample[] }>((resolve) => {
          const record = document.querySelector(
            `[data-folder="${selectedId}"]`,
          )!;
          const sizing = record.querySelector<HTMLElement>(".folder-sizing")!;
          const cover = record.querySelector<HTMLElement>(".folder-cover")!;
          const selectors = [
            ".folder-tab",
            ".folder-tab img",
            ".folder-tab span",
            ".folder-content",
            ".record-header",
            ".record-headline",
            ".record-summary",
            ".record-phone",
          ];
          const rect = (node: Element) => {
            const box = node.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
          };
          const capture = (): Sample => {
            const sheet = rect(sizing);
            const style = getComputedStyle(sizing);
            const scaleX = sheet.width / parseFloat(style.width);
            const scaleY = sheet.height / parseFloat(style.height);
            return {
              state:
                document.querySelector<HTMLElement>("[data-dossier]")!.dataset
                  .state!,
              angle: Math.abs(Number(cover.dataset.foldAngle)),
              width: sizing.offsetWidth,
              height: sizing.offsetHeight,
              scaleX,
              scaleY,
              sheet,
              nodes: selectors.flatMap((selector) => {
                const node = record.querySelector(selector);
                if (!node) return [];
                const screen = rect(node);
                return [
                  {
                    selector,
                    screen,
                    local: {
                      x: (screen.x - sheet.x) / scaleX,
                      y: (screen.y - sheet.y) / scaleY,
                      width: screen.width / scaleX,
                      height: screen.height / scaleY,
                    },
                  },
                ];
              }),
            };
          };
          const initial = capture();
          const samples: Sample[] = [];
          const started = performance.now();
          let active = false,
            lastSample = -Infinity;
          const frame = (now: number) => {
            const sample = capture();
            if (sample.state === activePhase) active = true;
            const complete =
              active &&
              sample.state === (activePhase === "opening" ? "open" : "closed");
            if (active && (now - lastSample > 25 || complete)) {
              samples.push(sample);
              lastSample = now;
            }
            if (complete || now - started > 6500) resolve({ initial, samples });
            else requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        }),
      { selectedId: id, activePhase: phase },
    );
  for (const id of ["orbit-market", (await companyIds(page)).at(-1)!]) {
    await tab(page, id).scrollIntoViewIfNeeded();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const openingPromise = collect(id, "opening");
    await tab(page, id).click();
    const opening = await openingPromise;
    await expect(root(page)).toHaveAttribute("data-state", "open");
    const closingPromise = collect(id, "closing");
    await page.locator("[data-record-close]").click();
    const closing = await closingPromise;
    await expect(root(page)).toHaveAttribute("data-state", "closed");
    const canonical = opening.initial;
    expect(canonical.scaleX).toBeCloseTo(0.9, 3);
    expect(opening.samples.at(-1)!.scaleX).toBeCloseTo(1, 3);
    expect(closing.samples.at(-1)!.scaleX).toBeCloseTo(0.9, 3);
    for (const [phase, motion] of [
      ["opening", opening],
      ["closing", closing],
    ] as const) {
      expect(motion.samples.length).toBeGreaterThan(10);
      for (const sample of motion.samples) {
        expect(sample.width, `${id} canonical width during ${phase}`).toBe(
          canonical.width,
        );
        expect(sample.height, `${id} canonical height during ${phase}`).toBe(
          canonical.height,
        );
        expect(
          sample.scaleX,
          `${id} uniform camera scale during ${phase}`,
        ).toBeCloseTo(sample.scaleY, 3);
        for (const [index, node] of sample.nodes.entries()) {
          for (const dimension of ["x", "y", "width", "height"] as const) {
            expect(
              Math.abs(
                node.local[dimension] - canonical.nodes[index].local[dimension],
              ),
              `${id} ${node.selector} local ${dimension} during ${phase}`,
            ).toBeLessThan(0.35);
          }
        }
      }
      const folding = motion.samples.filter(
        (sample) => sample.angle > 3 && sample.angle < 165,
      );
      expect(folding.length).toBeGreaterThanOrEqual(3);
      const resting =
        phase === "opening" ? opening.samples.at(-1)! : closing.initial;
      for (const sample of folding) {
        for (const dimension of ["x", "y", "width", "height"] as const) {
          expect(
            Math.abs(sample.sheet[dimension] - resting.sheet[dimension]),
            `${id} sheet ${dimension} stays still while the cover ${phase === "opening" ? "opens" : "closes"}`,
          ).toBeLessThan(1.5);
        }
        for (const [index, node] of sample.nodes.entries()) {
          for (const dimension of ["x", "y", "width", "height"] as const) {
            expect(
              Math.abs(
                node.screen[dimension] - resting.nodes[index].screen[dimension],
              ),
              `${id} ${node.selector} screen ${dimension} during the fold`,
            ).toBeLessThan(1.5);
          }
        }
      }
    }
  }
});

test("the closed cover hides the company header throughout transport in both directions", async ({
  page,
}) => {
  const id = (await companyIds(page)).at(-1)!;
  const sampleTransport = (phase: "opening" | "closing") =>
    page.evaluate(
      ({ selectedId, activePhase }) =>
        new Promise<Array<{ contentPaintTop: number; coverTop: number }>>(
          (resolve) => {
            const samples: Array<{
              contentPaintTop: number;
              coverTop: number;
            }> = [];
            const started = performance.now();
            let active = false;
            const frame = () => {
              const state =
                document.querySelector<HTMLElement>("[data-dossier]")!.dataset
                  .state;
              const record = document.querySelector(
                `[data-folder="${selectedId}"]`,
              )!;
              const sizing =
                record.querySelector<HTMLElement>(".folder-sizing")!;
              const cover = record.querySelector<HTMLElement>(".folder-cover")!;
              const content =
                record.querySelector<HTMLElement>(".folder-content")!;
              const scaleY = new DOMMatrix(getComputedStyle(sizing).transform)
                .m22;
              if (state === activePhase) {
                active = true;
                if (
                  Math.abs(Number(cover.dataset.foldAngle)) < 0.1 &&
                  scaleY < 0.99
                ) {
                  const clip = getComputedStyle(content).clipPath.match(
                    /^inset\(\s*([\d.]+)px/,
                  );
                  const clipTop = clip ? Number(clip[1]) : 0;
                  const textTop = Math.min(
                    ...Array.from(
                      record.querySelectorAll(
                        ".record-company, .record-role, .record-dates",
                      ),
                    ).map((node) => node.getBoundingClientRect().top),
                  );
                  samples.push({
                    contentPaintTop: Math.max(
                      textTop,
                      content.getBoundingClientRect().top + clipTop * scaleY,
                    ),
                    coverTop: cover.getBoundingClientRect().top,
                  });
                }
              }
              if (
                (active &&
                  state === (activePhase === "opening" ? "open" : "closed")) ||
                performance.now() - started > 6000
              )
                resolve(samples);
              else requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
          },
        ),
      { selectedId: id, activePhase: phase },
    );
  const opening = sampleTransport("opening");
  await tab(page, id).click();
  const openingSamples = await opening;
  await expect(root(page)).toHaveAttribute("data-state", "open");
  const closing = sampleTransport("closing");
  await page.locator("[data-record-close]").click();
  const closingSamples = await closing;
  await expect(root(page)).toHaveAttribute("data-state", "closed");
  for (const [phase, samples] of [
    ["opening", openingSamples],
    ["closing", closingSamples],
  ] as const) {
    expect(samples.length, `${phase} transport samples`).toBeGreaterThanOrEqual(
      3,
    );
    for (const sample of samples) {
      expect(
        sample.contentPaintTop,
        `content remains behind the opaque ${phase} cover`,
      ).toBeGreaterThanOrEqual(sample.coverTop - 1.5);
    }
  }
});

test("the opening cover projects symmetrically toward the viewer around a fixed bottom hinge", async ({
  page,
}) => {
  await tab(page, "orbit-market").click();
  const sample = await page.waitForFunction(() => {
    const record = document.querySelector('[data-folder="orbit-market"]')!;
    const cover = record.querySelector<HTMLElement>(".folder-cover")!;
    const angle = Math.abs(Number(cover.dataset.foldAngle));
    if (angle < 40 || angle > 70) return false;
    const outline = cover.querySelector<SVGPathElement>(
      ".cover-outside [data-cover-outline]",
    )!;
    const matrix = outline.getScreenCTM()!;
    const length = outline.getTotalLength();
    const points = Array.from({ length: 401 }, (_, index) => {
      const point = outline
        .getPointAtLength((length * index) / 400)
        .matrixTransform(matrix);
      return { x: point.x, y: point.y };
    });
    const left = Math.min(...points.map((point) => point.x));
    const right = Math.max(...points.map((point) => point.x));
    const top = Math.min(...points.map((point) => point.y));
    const bottom = Math.max(...points.map((point) => point.y));
    const band = (bottom - top) * 0.2;
    const width = (entries: typeof points) =>
      Math.max(...entries.map((point) => point.x)) -
      Math.min(...entries.map((point) => point.x));
    const sheet = record
      .querySelector(".folder-sizing")!
      .getBoundingClientRect();
    return {
      angle,
      left,
      right,
      bottom,
      topWidth: width(points.filter((point) => point.y < top + band)),
      bottomWidth: width(points.filter((point) => point.y > bottom - band)),
      sheetWidth: sheet.width,
      sheetCenter: sheet.x + sheet.width / 2,
      sheetBottom: sheet.bottom,
      fill: getComputedStyle(outline).fill,
      opacity: getComputedStyle(outline.parentElement!).opacity,
    };
  });
  const shape = (await sample.jsonValue()) as {
    angle: number;
    left: number;
    right: number;
    bottom: number;
    topWidth: number;
    bottomWidth: number;
    sheetWidth: number;
    sheetCenter: number;
    sheetBottom: number;
    fill: string;
    opacity: string;
  };
  expect(shape.right - shape.left).toBeGreaterThan(shape.sheetWidth * 1.035);
  expect(shape.topWidth).toBeGreaterThan(shape.bottomWidth * 1.03);
  expect(
    Math.abs((shape.left + shape.right) / 2 - shape.sheetCenter),
  ).toBeLessThan(2);
  expect(Math.abs(shape.bottom - (shape.sheetBottom - 3))).toBeLessThan(2);
  expect(shape.fill).not.toBe("none");
  expect(Number(shape.opacity)).toBeGreaterThan(0.95);
  await expect(root(page)).toHaveAttribute("data-state", "open");
});

test("Escape interrupts opening and repeated cycles leave no modal or scroll lock", async ({
  page,
}) => {
  await tab(page, "orbit-market").click();
  await page.keyboard.press("Escape");
  await expect(root(page)).toHaveAttribute("data-state", "closed");
  await expect(dialog(page)).not.toBeVisible();
  await expect(tab(page, "orbit-market")).toBeFocused();
  for (let cycle = 0; cycle < 3; cycle++) {
    await openRecord(page, "orbit-market");
    await closeRecord(page);
  }
  expect(
    await page.evaluate(() => document.querySelectorAll("dialog[open]").length),
  ).toBe(0);
  expect(
    await page.evaluate(() => getComputedStyle(document.body).overflow),
  ).not.toBe("hidden");
});

test("brand fill remains the same from closed to hover to open", async ({
  page,
  isMobile,
}) => {
  const brandColor = async () =>
    folder(page, "orbit-market").evaluate((node) =>
      getComputedStyle(node).getPropertyValue("--folder-color").trim(),
    );
  const closedColor = await brandColor();
  expect(closedColor).not.toBe("");
  if (!isMobile) {
    await tab(page, "orbit-market").hover();
    expect(await brandColor()).toBe(closedColor);
  }
  await openRecord(page, "orbit-market");
  expect(await brandColor()).toBe(closedColor);
  await expect(
    folder(page, "orbit-market").locator(".record-company"),
  ).toHaveText("Orbit Market");
});

test("resizing a rear record before or during close keeps its tab visible and focused", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "This regression starts at a desktop viewport and crosses the mobile breakpoint.",
  );
  const desktopViewport = page.viewportSize()!;
  const id = (await companyIds(page)).at(-1)!;
  await openRecord(page, id);
  await page.setViewportSize({ width: 390, height: 664 });
  await expect(page.locator("[data-record-close]")).toBeInViewport();
  await expect(folder(page, id).locator(".record-scroll")).toBeInViewport();
  await expect(tab(page, id)).toBeInViewport({ ratio: 0.95 });
  await closeRecord(page);
  await expect(tab(page, id)).toBeInViewport({ ratio: 0.95 });
  await expect(tab(page, id)).toBeFocused();
  await page.setViewportSize(desktopViewport);
  await openRecord(page, id);
  await page.locator("[data-record-close]").click();
  await expect(root(page)).toHaveAttribute("data-state", "closing");
  await page.setViewportSize({ width: 390, height: 664 });
  await expect(root(page)).toHaveAttribute("data-state", "closed");
  await expect(tab(page, id)).toBeInViewport({ ratio: 0.95 });
  await expect(tab(page, id)).toBeFocused();
});

test("thin scroll-edge fades show only the content available above and below", async ({
  page,
}) => {
  const record = folder(page, "orbit-market");
  const frame = record.locator(".record-scroll-frame");
  const scroll = record.locator(".record-scroll");
  const top = frame.locator('[data-scroll-edge="top"]');
  const bottom = frame.locator('[data-scroll-edge="bottom"]');
  await expect(top).toHaveCSS("opacity", "0");
  await expect(bottom).toHaveCSS("opacity", "0");
  await openRecord(page, "orbit-market");
  expect(
    await scroll.evaluate((node) => node.scrollHeight - node.clientHeight),
  ).toBeGreaterThan(20);
  await expect(frame).toHaveAttribute("data-scroll-above", "false");
  await expect(frame).toHaveAttribute("data-scroll-below", "true");
  await expect(top).toHaveCSS("opacity", "0");
  await expect(bottom).toHaveCSS("opacity", "1");
  for (const edge of [top, bottom]) {
    await expect(edge).toHaveAttribute("aria-hidden", "true");
    await expect(edge).toHaveCSS("pointer-events", "none");
    const style = await edge.evaluate((node) => ({
      height: node.getBoundingClientRect().height,
      mask:
        getComputedStyle(node).maskImage ||
        getComputedStyle(node).getPropertyValue("-webkit-mask-image"),
    }));
    expect(style.height).toBeGreaterThan(0);
    expect(style.height).toBeLessThanOrEqual(24.5);
    expect(style.mask).toContain("linear-gradient");
  }
  await expect(scroll).toHaveCSS("filter", "none");
  await expect(scroll).toHaveCSS("mask-image", "none");
  await scroll.evaluate((node) => {
    node.scrollTop = (node.scrollHeight - node.clientHeight) / 2;
  });
  await expect(frame).toHaveAttribute("data-scroll-above", "true");
  await expect(frame).toHaveAttribute("data-scroll-below", "true");
  await expect(top).toHaveCSS("opacity", "1");
  await expect(bottom).toHaveCSS("opacity", "1");
  await scroll.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(frame).toHaveAttribute("data-scroll-above", "true");
  await expect(frame).toHaveAttribute("data-scroll-below", "false");
  await expect(top).toHaveCSS("opacity", "1");
  await expect(bottom).toHaveCSS("opacity", "0");
  await closeRecord(page);
  await expect(top).toHaveCSS("opacity", "0");
  await expect(bottom).toHaveCSS("opacity", "0");
});

test("Escape during the fold reverses to a usable closed cabinet", async ({
  page,
}) => {
  await tab(page, "orbit-market").click();
  await page.waitForFunction(() => {
    const cover = document.querySelector<HTMLElement>(
      '[data-folder="orbit-market"] .folder-cover',
    )!;
    const angle = Math.abs(Number(cover.dataset.foldAngle));
    return angle > 8 && angle < 160;
  });
  await page.keyboard.press("Escape");
  await expect(root(page)).toHaveAttribute("data-state", "closed");
  await expect(dialog(page)).not.toBeVisible();
  await expect(tab(page, "orbit-market")).toBeFocused();
  await openRecord(page, "orbit-market");
  await closeRecord(page);
});

test("unchanged viewport events preserve opening and closing motion", async ({
  page,
}) => {
  const dispatchResize = () =>
    page.evaluate(() => {
      window.dispatchEvent(new Event("resize"));
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
  await tab(page, "orbit-market").click();
  await dispatchResize();
  await nextFrames(page);
  await expect(root(page)).toHaveAttribute("data-state", "opening");
  await expect(page.locator("[data-record-close]")).toBeHidden();
  await expect(root(page)).toHaveAttribute("data-state", "open");
  await page.locator("[data-record-close]").click();
  await dispatchResize();
  await nextFrames(page);
  await expect(root(page)).toHaveAttribute("data-state", "closing");
  await expect(page.locator("[data-record-close]")).toBeHidden();
  await expect(root(page)).toHaveAttribute("data-state", "closed");
});

test("scrollbar-only visual viewport growth preserves motion and Close alignment", async ({
  page,
  isMobile,
}) => {
  if (!isMobile) await page.setViewportSize({ width: 1129, height: 981 });
  // Headless scrollbar behavior differs by engine. Reserve exactly the 15px
  // document gutter observed in Safari, then model its visualViewport event.
  const before = await page.evaluate(() => {
    document.documentElement.style.width = `${innerWidth - 15}px`;
    const width = document.documentElement.getBoundingClientRect().width;
    Object.defineProperty(window.visualViewport!, "width", {
      configurable: true,
      get: () => width,
    });
    window.dispatchEvent(new Event("resize"));
    window.visualViewport!.dispatchEvent(new Event("resize"));
    return { document: width, visual: window.visualViewport!.width };
  });
  await nextFrames(page);
  const canonical = await folder(page, "orbit-market")
    .locator(".folder-sizing")
    .evaluate((node: HTMLElement) => ({
      width: node.offsetWidth,
      height: node.offsetHeight,
    }));
  await tab(page, "orbit-market").click();
  const after = await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, "width");
    window.visualViewport!.dispatchEvent(new Event("resize"));
    return {
      document: document.documentElement.getBoundingClientRect().width,
      visual: window.visualViewport!.width,
    };
  });
  expect(after.document).toBeCloseTo(before.document, 1);
  expect(after.visual - before.visual).toBeCloseTo(15, 1);
  await nextFrames(page);
  await expect(root(page)).toHaveAttribute("data-state", "opening");
  expect(
    await folder(page, "orbit-market")
      .locator(".folder-sizing")
      .evaluate((node: HTMLElement) => ({
        width: node.offsetWidth,
        height: node.offsetHeight,
      })),
  ).toEqual(canonical);
  await expect(root(page)).toHaveAttribute("data-state", "open");
  await expectCloseInTabBand(page);
  await closeRecord(page);
});

test("unchanged connection events preserve motion while real accessibility preferences settle it", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const connection = Object.assign(new EventTarget(), { saveData: false });
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: connection,
    });
  });
  await page.reload();
  await expect(root(page)).toHaveAttribute("data-state", "closed");
  await tab(page, "orbit-market").click();
  await page.evaluate(() =>
    (
      navigator as Navigator & { connection: EventTarget }
    ).connection.dispatchEvent(new Event("change")),
  );
  await nextFrames(page);
  await expect(root(page)).toHaveAttribute("data-state", "opening");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(root(page)).toHaveAttribute("data-state", "open", {
    timeout: 500,
  });
  await closeRecord(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(root(page)).toHaveAttribute("data-motion", "full");
  await tab(page, "orbit-market").click();
  await page.evaluate(() => {
    const connection = (
      navigator as Navigator & {
        connection: EventTarget & { saveData: boolean };
      }
    ).connection;
    connection.saveData = true;
    connection.dispatchEvent(new Event("change"));
  });
  await expect(root(page)).toHaveAttribute("data-state", "open", {
    timeout: 500,
  });
  await expect(root(page)).toHaveAttribute("data-motion", "reduced");
  await closeRecord(page);
});

test("viewport changes during opening and closing settle into usable states", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Desktop window resizing exercises the common resize recovery path.",
  );
  await tab(page, "orbit-market").click();
  await page.setViewportSize({ width: 1080, height: 760 });
  await expect(root(page)).toHaveAttribute("data-state", "open");
  await expectCloseInTabBand(page);
  const resized = await folder(page, "orbit-market")
    .locator(".folder-sizing")
    .boundingBox();
  const layoutWidth = await page.evaluate(
    () => document.documentElement.getBoundingClientRect().width,
  );
  expect(resized!.width).toBeCloseTo(layoutWidth - 96, 0);
  expect(resized!.y + resized!.height).toBeLessThanOrEqual(760 - 15.5);
  await page.locator("[data-record-close]").click();
  await page.setViewportSize({ width: 1260, height: 860 });
  await expect(root(page)).toHaveAttribute("data-state", "closed");
  await expect(dialog(page)).not.toBeVisible();
  await openRecord(page, "orbit-market");
  await closeRecord(page);
});

test("keyboard activation supports Enter and Space and keeps modal focus contained", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Desktop keyboard access; mobile touch has its own case.",
  );
  await tab(page, "orbit-market").focus();
  await page.keyboard.press("Enter");
  await expect(root(page)).toHaveAttribute("data-state", "open");
  await expect(page.locator("[data-record-close]")).toBeFocused();
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog(page).evaluate((node) =>
        node.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog(page).evaluate((node) =>
      node.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(root(page)).toHaveAttribute("data-state", "closed");
  await expect(tab(page, "orbit-market")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(root(page)).toHaveAttribute("data-state", "open");
  await page.keyboard.press("Escape");
  await expect(root(page)).toHaveAttribute("data-state", "closed");
  await expect(tab(page, "orbit-market")).toBeFocused();
});

test("mobile touch opens tabs and closes the inset sheet without requiring hover", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Uses real touch input in the mobile browser context.");
  await tab(page, "orbit-market").tap();
  await expect(root(page)).toHaveAttribute("data-state", "open");
  await expect(
    folder(page, "orbit-market").locator(".record-scroll"),
  ).toBeVisible();
  await page.locator("[data-record-close]").tap();
  await expect(root(page)).toHaveAttribute("data-state", "closed");
  await expect(tab(page, "orbit-market")).toBeFocused();
  const ids = await companyIds(page);
  await tab(page, ids.at(-1)!).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    window.scrollTo({
      left: 0,
      top: scrollY + rect.top - innerHeight / 2,
      behavior: "instant",
    });
  });
  await nextFrames(page);
  expect(
    await page
      .locator("[data-tab-rail]")
      .evaluateAll((nodes) =>
        nodes.every((node) => Math.abs(node.scrollLeft) <= 1),
      ),
  ).toBe(true);
  await tab(page, ids.at(-1)!).tap();
  await expect(root(page)).toHaveAttribute("data-state", "open");
  await page.locator("[data-record-close]").tap();
  await expect(root(page)).toHaveAttribute("data-state", "closed");
  await expect(tab(page, ids.at(-1)!)).toBeFocused();
});
