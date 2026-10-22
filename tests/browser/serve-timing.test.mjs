import { revealSettingsControl } from './settings-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { openSettingsSection, settleSettings } from './settings-helpers.mjs';

test(
  'serve laboratory displays continuous quality and applies every timing control to gameplay',
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
    await openSettingsSection(page, 'Приёмы и подачи');
    await revealSettingsControl(page, '#shot-mode');
    await page.locator('#shot-mode').selectOption('serve');
    await revealSettingsControl(page, '#shot-kind');
    await page.locator('#shot-kind').selectOption('loft');
    await revealSettingsControl(page, '#contact-number-ContactReach');
    await page.locator('#contact-number-ContactReach').fill('1.2');
    await page.locator('#shot-timing').evaluate((el) => {
      el.value = '0.18';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settleSettings(page);
    const quality = async () => {
      await revealSettingsControl(page, '#shot-timing-info');
      return Number(
        (await page.locator('#shot-timing-info').innerText()).match(/качество касания (\d+)%/)[1],
      );
    };
    const ordinary = await quality();
    assert.ok(ordinary > 0 && ordinary < 100);
    const colors = await page
      .locator('#shot-timing-map button')
      .evaluateAll((buttons) => buttons.map((b) => b.style.backgroundColor));
    assert.ok(
      new Set(colors).size > 6,
      'the lab map is a gradient rather than three binary colors',
    );
    for (const [field, value] of [
      ['MistimePower', '0.9'],
      ['HitWindow', '0.4'],
      ['PerfectWindow', '0.2'],
    ]) {
      await revealSettingsControl(page, '#contact-number-' + field);
      await page.locator('#contact-number-' + field).fill(value);
      await settleSettings(page);
      assert.ok((await quality()) > ordinary, field);
      assert.equal(
        await page.evaluate(
          async (key) => (await import('/src/main.js')).match.config['serveLoft' + key],
          field,
        ),
        Number(value),
      );
    }
    await revealSettingsControl(page, '#contact-number-ContactReach');
    await page.locator('#contact-number-ContactReach').fill('0.1');
    await settleSettings(page);
    assert.equal(await quality(), 0);
    await revealSettingsControl(page, '#shot-ideal');
    await page.locator('#shot-ideal').click();
    await settleSettings(page);
    assert.equal(await quality(), 100);
    assert.deepEqual(errors, []);
    await revealSettingsControl(page, '#contact-reset');
    await page.locator('#contact-reset').click();
    await page.locator('#shot-timing').evaluate((el) => {
      el.value = '0.08';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settleSettings(page);
    await page.screenshot({ path: '.cache/serve-timing-review.png', fullPage: true });
  },
);
