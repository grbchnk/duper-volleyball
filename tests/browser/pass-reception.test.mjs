import { revealSettingsControl } from './settings-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { openBrowserGame, openSettingsSection, settleSettings } from './settings-helpers.mjs';

test(
  'shared pass assistance and touch preview work in the UI; ball depth and serve transition render correctly',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openSettingsSection(page, 'Приёмы и подачи');
    await revealSettingsControl(page, '#shot-kind');
    await page.locator('#shot-kind').selectOption('low');
    await settleSettings(page);
    assert.equal(await page.locator('#shot-assistance').isVisible(), true);
    assert.match(await page.locator('#shot-assistance-label').innerText(), /Помощь направлению/);
    await revealSettingsControl(page, '#shot-touch');
    await page.locator('#shot-touch').selectOption('2');
    await revealSettingsControl(page, '#shot-power');
    await page.locator('#shot-power').fill('100');
    await settleSettings(page);
    assert.match(await page.locator('#shot-stats').innerText(), /Подъём над собой/);
    await revealSettingsControl(page, '#shot-kind');
    await page.locator('#shot-kind').selectOption('loft');
    await settleSettings(page);
    assert.equal(await page.locator('#shot-assistance').isVisible(), true);

    const result = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { configuredTeam } = await import('/src/teams.js');
      const { FIXED_DT } = await import('/src/config.js');
      const { sampleServeMotion } = await import('/src/motion.js');
      document.querySelectorAll('dialog[open]').forEach((d) => d.close());
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const gallery = document.createElement('canvas');
      gallery.width = 1440;
      gallery.height = 900;
      const g = gallery.getContext('2d');
      g.fillStyle = '#edf1df';
      g.fillRect(0, 0, 1440, 900);
      document.body.replaceChildren(gallery);
      const renderer = new Renderer(canvas);
      const m = new Match();
      m.reset('versus');
      const teams = [configuredTeam(m.config, 0), configuredTeam(m.config, 1)];
      const order = [];
      const drawBall = renderer.drawBall.bind(renderer),
        drawNet = renderer.drawNet.bind(renderer);
      renderer.drawBall = (match) => {
        order.push('ball');
        drawBall(match);
      };
      renderer.drawNet = (match) => {
        order.push('net');
        drawNet(match);
      };
      const orders = [];
      for (const x of [0.15, -0.15]) {
        m.phase = 'rally';
        Object.assign(m.ball, { x, y: 1.8 });
        order.length = 0;
        renderer.draw(m, teams);
        orders.push(order.slice());
        g.drawImage(canvas, orders.length === 1 ? 0 : 720, 0, 720, 405);
      }
      const transition = [];
      for (const kind of ['low', 'loft', 'drive']) {
        m.startServe();
        const p = m.serverPlayer();
        p.facing = 1;
        for (let settle = 0; settle < 60; settle++) renderer.draw(m, teams);
        const rig = renderer.armRigs.get(p.id);
        const before = rig.elbows.map((point) => ({ x: point.x, y: point.y }));
        m.beginServe({ kind, power: 0.7, aim: {} });
        m.phaseTime = 0;
        Object.assign(m.ball, sampleServeMotion(p, m.serveAction, 0));
        renderer.draw(m, teams);
        const delta = Math.max(
          ...rig.elbows.map((point, i) => Math.hypot(point.x - before[i].x, point.y - before[i].y)),
        );
        transition.push({ kind, delta });
        for (let frame = 1; frame <= 12; frame++) {
          m.phaseTime = frame * FIXED_DT;
          Object.assign(m.ball, sampleServeMotion(p, m.serveAction, m.phaseTime));
          renderer.draw(m, teams);
        }
        g.drawImage(canvas, ['low', 'loft', 'drive'].indexOf(kind) * 480, 440, 480, 270);
      }
      return { orders, transition };
    });
    assert.deepEqual(result.orders, [
      ['ball', 'net'],
      ['net', 'ball'],
    ]);
    for (const sample of result.transition) assert.ok(sample.delta < 1, JSON.stringify(result));
    assert.deepEqual(errors, []);
    await mkdir('.cache', { recursive: true });
    await page.locator('canvas').screenshot({ path: '.cache/pass-reception-review.png' });
  },
);
