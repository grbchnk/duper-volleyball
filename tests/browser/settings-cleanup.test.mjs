import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { openSettingsSection, settleSettings } from './settings-helpers.mjs';

test(
  'settings keep their frame, scroll without covering controls and reset only their category',
  { timeout: 60000 },
  async (t) => {
    const server = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('../../', import.meta.url),
      env: { ...process.env, PORT: '0' },
      windowsHide: true,
    });
    t.after(() => server.kill());
    const base = await new Promise((resolve, reject) => {
      server.on('error', reject);
      server.stdout.on('data', (d) => {
        const u = String(d).match(/http:\/\/127\.0\.0\.1:\d+/);
        if (u) resolve(u[0]);
      });
    });
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    assert.equal(await page.locator('#startup-error').isVisible(), false);
    assert.equal(await page.locator('#team-preset-grid').count(), 0);
    assert.equal(await page.locator('#shot-canvas').count(), 0);
    const sizes = [];
    for (const label of [
      'Матч и управление',
      'Физика и помощь',
      'Приёмы и подачи',
      'Звук',
      'Моя команда',
      'Руки и анимация',
      'Приёмы и подачи',
    ]) {
      await openSettingsSection(page, label);
      sizes.push(
        await page.locator('dialog[open]').evaluate((d) => {
          const b = d.getBoundingClientRect();
          return [b.x, b.y, b.width, b.height];
        }),
      );
    }
    for (const size of sizes) assert.deepEqual(size, sizes[0]);
    await openSettingsSection(page, 'Моя команда');
    await page.locator('[data-head="bear"]').click();
    await settleSettings(page);
    const head = await page.locator('.head-choice[aria-pressed="true"]').getAttribute('data-head');
    assert.equal(head, 'bear');
    await page.setViewportSize({ width: 390, height: 760 });
    const body = page.locator('#team-body');
    await body.scrollIntoViewIfNeeded();
    assert.equal(
      await body.evaluate((e) => {
        const r = e.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === e;
      }),
      true,
    );
    await openSettingsSection(page, 'Руки и анимация');
    await page.locator('#physics-armLength').fill('1.3');
    await settleSettings(page);
    await openSettingsSection(page, 'Физика и помощь');
    await page.locator('#physics-gravity').fill('12');
    await settleSettings(page);
    await page.locator('#reset-physics').click();
    await settleSettings(page);
    assert.equal(await page.locator('#physics-gravity').inputValue(), '10.1');
    await openSettingsSection(page, 'Руки и анимация');
    assert.equal(await page.locator('#physics-armLength').inputValue(), '1.3');
    await openSettingsSection(page, 'Моя команда');
    assert.equal(
      await page.locator('.head-choice[aria-pressed="true"]').getAttribute('data-head'),
      'bear',
    );
    await openSettingsSection(page, 'Сохранить / загрузить');
    await page.locator('#reset-all').click();
    await settleSettings(page);
    await page.locator('#undo-settings').click();
    await settleSettings(page);
    await page.keyboard.press('Escape');
    await page.reload();
    await openSettingsSection(page, 'Руки и анимация');
    assert.equal(await page.locator('#physics-armLength').inputValue(), '1.3');
    assert.equal(await page.locator('#shot-shared-gravity').count(), 0);
    assert.equal(await page.locator('#preview-armScale').count(), 0);
    assert.equal(await page.locator('#dynamic-moon').count(), 0);
    assert.deepEqual(errors, []);
  },
);
