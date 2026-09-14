import {test, expect} from '@playwright/test';

test('presets retain selection and can return to showcase after edits and reset', async ({page}) => {
  await page.goto('/');
  const menu=page.locator('#preset');
  await expect(menu).toHaveValue('showcase');
  for (const [name,count] of [['compact',3],['neutral',3],['showcase',6]] as const) {
    await menu.focus();
    await menu.selectOption(name);
    await expect(menu).toHaveValue(name);
    await expect(page.locator('.folder-tab')).toHaveCount(count);
    await expect(menu).toBeFocused();
  }
  await page.locator('[data-path="options.cabinet.label"]').fill('My collection');
  await expect(menu).toHaveValue('custom');
  await menu.selectOption('showcase');
  await expect(menu).toHaveValue('showcase');
  await expect(page.locator('[data-path="options.cabinet.label"]')).toHaveValue('Dossier\nFolders');
  await menu.selectOption('compact');
  await page.locator('#reset').click();
  await expect(menu).toHaveValue('showcase');
  await expect(page.locator('.folder-tab')).toHaveCount(6);
});

test('record menus, block kind, field selects, and action limits stay synchronized', async ({page}) => {
  await page.goto('/');
  const record=page.locator('#record-select');
  await record.selectOption('2');
  await expect(record).toHaveValue('2');
  await page.locator('[data-path="options.records.2.title"]').fill('Updated studio');
  await expect(record.locator('option:checked')).toHaveText('3. Updated studio');
  await page.locator('[data-action="record-up"]').click();
  await expect(record).toHaveValue('1');
  await expect(record.locator('option:checked')).toHaveText('2. Updated studio');
  await page.locator('[data-action="record-duplicate"]').click();
  await expect(record).toHaveValue('6');
  await expect(record.locator('option:checked')).toHaveText('7. Updated studio copy');
  await expect(page.locator('[data-action="record-down"]')).toBeDisabled();
  await page.locator('[data-action="record-remove"]').click();
  await expect(record).toHaveValue('5');
  await page.locator('[data-path="options.cabinet.font"]').selectOption('mono');
  await page.locator('[data-path="options.records.5.tab.mode"]').selectOption('both');
  await expect(page.locator('[data-path="options.cabinet.font"]')).toHaveValue('mono');
  await expect(page.locator('[data-path="options.records.5.tab.mode"]')).toHaveValue('both');
  await page.getByText('Record content',{exact:true}).click();
  await page.locator('#new-block-kind').selectOption('timeline');
  for(let i=0;i<2;i++) {
    await page.locator('[data-action="block-add"]').click();
    await expect(page.locator('#new-block-kind')).toHaveValue('timeline');
    await expect(page.locator('[data-block-card]').last().locator('summary').first()).toContainText('timeline');
  }
  await page.getByText('Collection',{exact:true}).click();
  await page.locator('[data-action="record-up"]').click();
  await expect(page.locator('#preset')).not.toBeVisible();
});

test('pending text cannot overwrite a preset and imported configs have an honest selection', async ({page}) => {
  await page.goto('/');
  await page.locator('[data-path="options.records.0.title"]').fill('Pending edit');
  await page.locator('#preset').selectOption('neutral');
  await page.waitForTimeout(350);
  await expect(page.locator('#preset')).toHaveValue('neutral');
  await expect(page.locator('#record-select option').first()).toHaveText('1. Notes');
  const downloaded=page.waitForEvent('download');
  await page.locator('#export-json').click();
  const file=await downloaded;
  await page.locator('#import-json').setInputFiles((await file.path())!);
  await expect(page.locator('#preset')).toHaveValue('custom');
  await page.locator('#preset').selectOption('showcase');
  await expect(page.locator('.folder-tab')).toHaveCount(6);
});
