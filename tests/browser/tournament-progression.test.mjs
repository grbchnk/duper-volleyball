import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { TOUR } from '../../src/club.js';
import { openSettingsSection, settleSettings } from './settings-helpers.mjs';

test(
  'tournament UI advances through seven backgrounds and difficulties despite mid-round overrides',
  { timeout: 60000 },
  async (t) => {
    const server = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('../../', import.meta.url),
      env: { ...process.env, PORT: '0' },
      windowsHide: true,
    });
    t.after(() => server.kill());
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server did not start')), 10000);
      server.on('error', reject);
      server.stdout.on('data', (data) => {
        const url = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
        if (url) {
          clearTimeout(timer);
          resolve(url);
        }
      });
    });
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.locator('#club-lobby-tour').click();
    for (let i = 0; i < TOUR.length; i++) {
      await page.waitForFunction(
        (name) => document.querySelector('#club-hud-title').textContent === name,
        TOUR[i].name,
      );
      const config = await page.evaluate(async () => {
        const { match } = await import('/src/main.js');
        return { arena: match.config.arenaTheme, skill: match.config.cpuSkill };
      });
      assert.deepEqual(config, { arena: TOUR[i].arena, skill: TOUR[i].skill });
      if (i === 0) {
        await openSettingsSection(page, 'Матч и управление');
        await page.locator('#difficulty').fill('99');
        await settleSettings(page);
        await openSettingsSection(page, 'Арены');
        await page.locator('[data-arena="sky"]').click();
        await settleSettings(page);
        await page.keyboard.press('Escape');
      }
      await page.evaluate(async () => {
        const { match } = await import('/src/main.js');
        for (let n = 0; n < match.config.targetScore; n++) {
          match.phase = 'rally';
          match.point(0, 'Проверка этапа');
          if (match.phase !== 'finished') match.startServe();
        }
      });
      await page.waitForFunction(() => !document.querySelector('#finish-overlay').hidden);
      if (i < TOUR.length - 1) await page.locator('#club-next').click();
    }
    assert.equal(await page.locator('#winner-label').innerText(), 'КУБОК ТВОЙ!');
    assert.deepEqual(errors, []);
  },
);
