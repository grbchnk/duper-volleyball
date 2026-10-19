import { openSettingsSection, settleSettings } from './settings-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

test(
  'labs: shared tuning, navigation, contact heights, bounded input and live arm preview',
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
      server.stdout.on('data', (data) => {
        const url = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
        if (url) resolve(url);
      });
    });
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base);
    await page.waitForSelector('#club-sidebar');
    await openSettingsSection(page, 'Приёмы и подачи');
    await page.waitForFunction(() => document.querySelector('#shot-stats').textContent.length > 0);
    assert.equal(await page.locator('#contact-settings-dialog').count(), 0);
    assert.equal(await page.locator('#shots-dialog #contact-fields').count(), 1);
    const initialStats = await page.locator('#shot-stats').innerText();
    await page.locator('#contact-number-SpeedMax').fill('20');
    await settleSettings(page);
    assert.notEqual(await page.locator('#shot-stats').innerText(), initialStats);
    assert.equal(
      await page.evaluate(async () => (await import('/src/main.js')).match.config.lowSpeedMax),
      20,
    );
    const previewBounds = await page.locator('#shot-canvas').boundingBox();
    await page.locator('#contact-range-Reach').scrollIntoViewIfNeeded();
    assert.deepEqual(await page.locator('#shot-canvas').boundingBox(), previewBounds);
    await page.locator('#contact-reset').click();
    await settleSettings(page);
    for (const kind of ['loft', 'drive', 'low']) {
      await page.locator('#shot-kind').selectOption(kind);
      await settleSettings(page);
      assert.equal(
        await page.locator('#shot-contact-height').inputValue(),
        kind === 'low' ? '0.85' : kind === 'back' ? '1' : '2.05',
      );
      for (const player of ['1', '4']) {
        await page.locator('#shot-player').selectOption(player);
        await settleSettings(page);
        await page.locator('#shot-direction').selectOption('manual');
        await settleSettings(page);
        await page.locator('#shot-angle').fill(player === '1' ? '0' : '180');
        await settleSettings(page);
        await page.locator('#shot-max').click();
        await settleSettings(page);
        assert.doesNotMatch(await page.locator('#shot-stats').innerText(), /NaN|Infinity/);
      }
    }
    await openSettingsSection(page, 'Приёмы и подачи');
    await page.locator('#contact-number-SpeedMin').fill('100');
    await settleSettings(page);
    assert.equal(await page.locator('#contact-number-SpeedMin').inputValue(), '30');
    assert.equal(await page.locator('#contact-number-SpeedMax').inputValue(), '30');
    await openSettingsSection(page, 'Физика и помощь');
    await page.locator('#receive-momentum').check();
    await settleSettings(page);
    assert.equal(await page.locator('#physics-receiveTransfer').isEnabled(), true);
    await page.locator('#physics-gravity').fill('12');
    await settleSettings(page);
    assert.equal(await page.locator('#physics-gravity').inputValue(), '12');
    assert.equal(await page.locator('dialog[open]').count(), 1);
    await openSettingsSection(page, 'Приёмы и подачи');
    await page.locator('#shot-mode').selectOption('serve');
    await settleSettings(page);
    for (const kind of ['low', 'back', 'loft', 'drive']) {
      await page.locator('#shot-kind').selectOption(kind);
      await settleSettings(page);
      for (const player of ['0', '3']) {
        await page.locator('#shot-player').selectOption(player);
        await settleSettings(page);
        await page.locator('#shot-ideal').click();
        await settleSettings(page);
        assert.doesNotMatch(await page.locator('#shot-stats').innerText(), /NaN|Infinity/);
        await page.locator('#shot-contact-frame').click();
        await settleSettings(page);
      }
    }
    await page.locator('#shot-mode').selectOption('rally');
    await settleSettings(page);
    assert.equal(await page.locator('#shot-contact-height').inputValue(), '2.05');
    await mkdir('.cache/labs', { recursive: true });
    assert.equal(await page.locator('#shot-shared-gravity').count(), 0);
    await page.locator('.shot-controls').evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({ path: '.cache/labs/shots-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.locator('#shots-dialog').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
    await page.locator('#contact-number-SpeedMax').scrollIntoViewIfNeeded();
    const mobileCanvas = await page.locator('#shot-canvas').boundingBox();
    const mobileControl = await page.locator('#contact-number-SpeedMax').boundingBox();
    assert.ok(mobileCanvas.y >= 0 && mobileCanvas.y + mobileCanvas.height <= mobileControl.y);
    assert.ok(mobileControl.y + mobileControl.height <= 844);
    await page.screenshot({ path: '.cache/labs/shots-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openSettingsSection(page, 'Руки и анимация');
    await page.locator('#graphics-arm-preview summary').click();
    await settleSettings(page);
    await page.locator('#graphics-arm-freeze').check();
    await settleSettings(page);
    await page.locator('#graphics-arm-frame').fill('0.4');
    await settleSettings(page);
    const canvas = page.locator('#graphics-arm-cards canvas');
    await page.waitForTimeout(100);
    const before = await canvas.evaluate((c) => c.toDataURL());
    await page.locator('#physics-elbowHeight').fill('10');
    await settleSettings(page);
    await page.waitForTimeout(100);
    assert.notEqual(await canvas.evaluate((c) => c.toDataURL()), before);
    await page.locator('#physics-armFollowThrough').fill('12');
    await settleSettings(page);
    assert.equal(await page.locator('#value-armFollowThrough').innerText(), '12.00 px');
    await page.locator('#graphics-arm-preview summary').click();
    await settleSettings(page);
    await mkdir('.cache/labs', { recursive: true });
    await page.screenshot({ path: '.cache/labs/graphics-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#physics-armLength').scrollIntoViewIfNeeded();
    const bounds = await page.locator('#physics-armLength').boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 844);
    assert.ok(
      await page.locator('#appearance-dialog').evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
    );
    await page.screenshot({ path: '.cache/labs/graphics-mobile.png' });
    await page.keyboard.press('Escape');
    await page.reload();
    await openSettingsSection(page, 'Руки и анимация');
    assert.equal(await page.locator('#physics-armFollowThrough').inputValue(), '12');
    assert.equal(await page.locator('#flight-style').count(), 0);
    assert.deepEqual(errors, []);
  },
);
