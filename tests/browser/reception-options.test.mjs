import { revealSettingsControl } from './settings-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { openBrowserGame, openSettingsSection, settleSettings } from './settings-helpers.mjs';

test(
  'reception settings persist and two last-pass direction arrows render until the next pass',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t, { width: 1280, height: 800 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openSettingsSection(page, 'Матч и управление');
    await revealSettingsControl(page, '#transferShotOnSwitch');
    await page.locator('#transferShotOnSwitch').uncheck();
    await openSettingsSection(page, 'Физика и помощь');
    assert.equal(await page.locator('#physics-neutralPassError').count(), 0);
    assert.equal(await page.locator('#physics-neutralPassSpeedError').count(), 0);
    await openSettingsSection(page, 'Мяч и графика');
    await revealSettingsControl(page, '#passDirectionPreview');
    await page.locator('#passDirectionPreview').check();
    await revealSettingsControl(page, 'dialog[open] .close');
    await page.locator('dialog[open] .close').click();
    await settleSettings(page);
    await page.reload();
    await page.waitForSelector('#club-sidebar');
    const saved = await page.evaluate(async () => {
      const c = (await import('/src/main.js')).match.config;
      return [
        c.transferShotOnSwitch,
        c.neutralPassError,
        c.neutralPassSpeedError,
        c.passDirectionPreview,
      ];
    });
    assert.deepEqual(saved, [false, 0, 0, true]);
    await revealSettingsControl(page, '#start');
    await page.locator('#start').click();
    await page.evaluate(async () => {
      const { match: m } = await import('/src/main.js');
      const { shotImpulse } = await import('/src/moves.js');
      m.reset('match');
      m.phase = 'rally';
      m.lastTouch = 1;
      m.lastPlayer = 3;
      m.selected[0] = 1;
      const p = m.players[1];
      Object.assign(m.ball, { x: p.x, y: 1.9, vx: -5, vy: -6 });
      const aim = { manualControl: true, vector: { x: 0.35, y: 0.94 } };
      m.makeContact(p, 'loft', 0.8, shotImpulse(m.ball, p, 'loft', 0.8, aim, m.players, m.config));
      window.directionRecord = structuredClone(m.passDirections);
    });
    await settleSettings(page);
    assert.equal(await page.locator('#pause-overlay').isVisible(), false);
    await mkdir('.cache/reception-options-qa', { recursive: true });
    await page.locator('#arena').screenshot({ path: '.cache/reception-options-qa/directions.png' });
    const colors = await page.locator('#game').evaluate((canvas) => {
      const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let blue = 0,
        green = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === 52 && d[i + 1] === 120 && d[i + 2] === 201) blue++;
        if (d[i] === 35 && d[i + 1] === 150 && d[i + 2] === 96) green++;
      }
      return { blue, green };
    });
    assert.ok(colors.blue > 10 && colors.green > 10, JSON.stringify(colors));
    await page.waitForTimeout(1200);
    assert.equal(
      await page.evaluate(
        async () =>
          JSON.stringify((await import('/src/main.js')).match.passDirections) ===
          JSON.stringify(window.directionRecord),
      ),
      true,
    );
    await page.evaluate(async () => {
      const { match: m } = await import('/src/main.js');
      const { shotImpulse } = await import('/src/moves.js');
      m.phase = 'rally';
      m.lastTouch = 1;
      m.lastPlayer = 3;
      m.cooldown = 0;
      const p = m.players[0];
      Object.assign(m.ball, { x: p.x, y: 0.5, vx: -9, vy: -6 });
      m.makeContact(
        p,
        'low',
        0.5,
        shotImpulse(m.ball, p, 'low', 0.5, { manualControl: true }, m.players, m.config),
      );
    });
    assert.equal(
      await page.evaluate(
        async () =>
          JSON.stringify((await import('/src/main.js')).match.passDirections) !==
          JSON.stringify(window.directionRecord),
      ),
      true,
    );
    await settleSettings(page);
    await page
      .locator('#arena')
      .screenshot({ path: '.cache/reception-options-qa/neutral-lift.png' });
    assert.deepEqual(errors, []);
  },
);
