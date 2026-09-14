import {test, expect} from '@playwright/test';

test('demo tabs keep transparent labels and stable type while the folder lifts', async ({page, isMobile}) => {
  test.skip(isMobile, 'Hover is a mouse interaction.');
  await page.goto('/');
  await expect(page.locator('#preview')).toHaveAttribute('data-enhanced', '');
  const tab = page.locator('.folder-tab').nth(2);
  const appearance = () => tab.evaluate(el => {
    const c = getComputedStyle(el), label = getComputedStyle(el.querySelector('span, img')!);
    return {background: c.backgroundColor, shadow: c.boxShadow, color: label.color, font: label.font, opacity: label.opacity};
  });
  const before = await appearance();
  expect(before.background).toBe('rgba(0, 0, 0, 0)');
  const folder = page.locator('[data-folder]').nth(2);
  const start = await folder.boundingBox();
  await tab.hover();
  await page.waitForTimeout(300);
  expect(await appearance()).toEqual(before);
  expect((await folder.boundingBox())!.y).toBeLessThan(start!.y - 5);
});

test('intermediate and narrow embeds use one continuous paper tab with reachable controls', async ({page}) => {
  for (const width of [1024, 1200, 1440]) {
    await page.setViewportSize({width, height: 900});
    await page.goto('/');
    await expect(page.locator('#preview')).toHaveAttribute('data-enhanced', '');
    const geometry = await page.locator('[data-folder]').first().evaluate(el => {
      const tab = el.querySelector<HTMLElement>('.folder-tab')!;
      const sizing = el.querySelector<HTMLElement>('.folder-sizing')!;
      const matrix = new DOMMatrix(getComputedStyle(sizing).transform);
      const band = Number.parseFloat(getComputedStyle(sizing).getPropertyValue('--df-tab-height'));
      return {background: getComputedStyle(tab).backgroundColor, tabHeight: tab.getBoundingClientRect().height, bandHeight: band * matrix.a,
        compact: el.closest('.dossier')!.getAttribute('data-compact-tabs'), path: el.querySelector('.folder-shape')!.getAttribute('d')};
    });
    expect(geometry.background).toBe('rgba(0, 0, 0, 0)');
    if (geometry.compact === 'true') {
      expect(geometry.tabHeight).toBeGreaterThanOrEqual(43.5);
      expect(geometry.bandHeight).toBeGreaterThan(geometry.tabHeight);
    }
    // The original sloped SVG shoulder is retained rather than a rounded rectangle.
    expect(geometry.path).toContain(' L');
  }
});

test('scroll-lock viewport change preserves extraction, transport, and unfolding', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  // Deterministically model the 15px classic scrollbar Safari removes on modal
  // scroll lock. Headless browsers normally use zero-width overlay scrollbars.
  await page.addInitScript(() => {
    Object.defineProperty(window.visualViewport, 'width', {configurable: true, get: () => innerWidth - (document.body?.style.overflow === 'hidden' ? 0 : 15)});
  });
  await page.goto('/');
  await expect(page.locator('#preview')).toHaveAttribute('data-motion', 'full');
  await page.evaluate(() => {
    const root = document.querySelector('#preview')!;
    (window as any).phases = [];
    root.addEventListener('dossier:state', () => {
      (window as any).phases.push({phase: root.getAttribute('data-state'), time: performance.now()});
      if (root.getAttribute('data-state') === 'opening') requestAnimationFrame(() => visualViewport!.dispatchEvent(new Event('resize')));
    });
  });
  const tab = page.locator('.folder-tab').first();
  await tab.click();
  await page.waitForTimeout(350);
  await expect(page.locator('#preview')).toHaveAttribute('data-state', 'opening');
  const sheet = page.locator('[data-selected] .folder-sizing');
  const before = await sheet.boundingBox();
  await page.waitForTimeout(1100);
  await expect(page.locator('#preview')).toHaveAttribute('data-state', 'opening');
  const during = await sheet.boundingBox();
  expect(Math.abs(during!.width - before!.width) + Math.abs(during!.y - before!.y)).toBeGreaterThan(10);
  await expect(page.locator('#preview')).toHaveAttribute('data-state', 'open');
  const elapsed = await page.evaluate(() => {
    const p = (window as any).phases;
    return p.find((s: any) => s.phase === 'open').time - p.find((s: any) => s.phase === 'opening').time;
  });
  expect(elapsed).toBeGreaterThan(2400);
  await page.keyboard.press('Escape');
  await expect(page.locator('#preview')).toHaveAttribute('data-state', 'closed');
});
