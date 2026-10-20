import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { openSettingsSection, settleSettings } from './settings-helpers.mjs';

test(
  'independent shot profiles, assisted trajectories and block laboratory persist and render',
  { timeout: 60000 },
  async (t) => {
    const server = spawn(process.execPath, ['server.mjs'], {
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
    await page.locator('#shot-kind').selectOption('loft');
    await settleSettings(page);
    await page.locator('#shot-soft').check();
    await settleSettings(page);
    assert.match(await page.locator('#contact-profile-title').innerText(), /L2/);
    await page.locator('#contact-number-SpeedMax').fill('9');
    await settleSettings(page);
    assert.equal(
      await page.evaluate(async () => (await import('/src/main.js')).match.config.loftSoftSpeedMax),
      9,
    );
    await page.locator('#shot-soft').uncheck();
    await settleSettings(page);
    assert.notEqual(await page.locator('#contact-number-SpeedMax').inputValue(), '9');
    await page.locator('#shot-fast').check();
    await settleSettings(page);
    await page.locator('#shot-kind').selectOption('drive');
    await settleSettings(page);
    assert.equal(await page.locator('#contact-number-Dip').isEnabled(), true);
    await page.locator('#contact-number-Dip').fill('18');
    await settleSettings(page);
    assert.equal(
      await page.evaluate(async () => (await import('/src/main.js')).match.config.driveFastDip),
      18,
    );
    await page.locator('#shot-fast').uncheck();
    await page.locator('#shot-kind').selectOption('loft');
    await page.locator('#shot-direction').selectOption('manual');
    await page.locator('#shot-angle').fill('80');
    await page.locator('#shot-assistance').fill('0.5');
    await settleSettings(page);
    assert.match(await page.locator('#shot-stats').innerText(), /помощь 50%.*коррекция/);
    await mkdir('.cache/settings-review', { recursive: true });
    await page.screenshot({ path: '.cache/settings-review/shot-profiles.png' });
    await page.locator('#shot-mode').selectOption('block');
    await settleSettings(page);
    await page.locator('#block-apex').click();
    await settleSettings(page);
    assert.match(await page.locator('#block-result').innerText(), /Закрытый блок/);
    assert.doesNotMatch(await page.locator('#block-result').innerText(), /NaN|undefined/);
    await page.locator('#block-dx').fill('0.9');
    await settleSettings(page);
    assert.match(await page.locator('#block-result').innerText(), /мяч вне зоны/);
    await page.locator('#block-dx').fill('0');
    await settleSettings(page);
    await page.screenshot({ path: '.cache/settings-review/block-lab.png' });
    await openSettingsSection(page, 'Физика и помощь');
    const physics = await page.locator('dialog[open]').innerText();
    assert.doesNotMatch(
      physics,
      /Эксперимент:|Удержание прыжка|Зависание за удержание|Сила контакта/,
    );
    assert.match(physics, /Общий множитель силы мяча/);
    await page.screenshot({ path: '.cache/settings-review/physics.png' });
    await page.reload();
    await page.waitForSelector('#club-sidebar');
    assert.equal(
      await page.evaluate(async () => (await import('/src/main.js')).match.config.loftSoftSpeedMax),
      9,
    );
    assert.deepEqual(errors, []);
  },
);
