import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { CPU_STYLES } from '../../src/cpu-styles.js';
import { openSettingsSection, settleSettings } from './settings-helpers.mjs';

test(
  'all seven CPU styles are selectable, described, saved and independent of the skill slider',
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
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base);
    await page.waitForSelector('#club-sidebar');
    await openSettingsSection(page, 'Матч и управление');
    assert.equal(await page.locator('#dynamic-opponent option').count(), 7);
    for (const [id, style] of Object.entries(CPU_STYLES)) {
      await page.locator('#dynamic-opponent').selectOption(id);
      for (const value of [0, 100]) {
        await page.locator('#difficulty').evaluate((el, level) => {
          el.value = String(level);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);
        await settleSettings(page);
        assert.equal(await page.locator('#dynamic-opponent').inputValue(), id);
        assert.equal(await page.locator('#dynamic-style-hint').textContent(), style.description);
        const actual = await page.evaluate(async () => {
          const m = (await import('/src/main.js')).match;
          return { style: m.config.cpuStyle, skill: m.config.cpuSkill };
        });
        assert.deepEqual(actual, { style: id, skill: value });
      }
    }
    await page.reload();
    await page.waitForSelector('#club-sidebar');
    assert.equal(await page.locator('#dynamic-opponent').inputValue(), 'adaptive');
    assert.deepEqual(errors, []);
  },
);
