import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

test(
  'jump indicator follows real tap, hold, co-op, replay and landing states',
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
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.route('**/jump-charge-check', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<html></html>',
      }),
    );
    await page.goto(`${base}/jump-charge-check`);
    const result = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { DEFAULTS, FIXED_DT, TEAMS } = await import('/src/config.js');
      const { captureScene } = await import('/src/replay.js');
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const r = new Renderer(canvas);
      const sheet = document.createElement('canvas');
      sheet.width = 1920;
      sheet.height = 1080;
      const gallery = sheet.getContext('2d');
      const results = [];
      let bars = [];
      let drawingMeter = false;
      const meterRects = [];
      const rect = r.rect.bind(r);
      r.rect = (...args) => {
        if (drawingMeter) meterRects.push(args);
        return rect(...args);
      };
      const drawJumpCharge = r.drawJumpCharge.bind(r);
      r.drawJumpCharge = (p, m, pos = r.project(p.x, p.y)) => {
        meterRects.length = 0;
        drawingMeter = true;
        drawJumpCharge(p, m, pos);
        drawingMeter = false;
        if (meterRects.length) bars.push({ id: p.id, rects: [...meterRects], feet: pos.y });
      };
      for (const [i, mode, frames, release] of [
        [0, 'test', 1, true],
        [1, 'test', 16, true],
        [2, 'test', 55, false],
        [3, 'coop', 32, false],
      ]) {
        const m = new Match({ ...DEFAULTS, assist: false, jumpBallHang: 0 });
        m.reset(mode);
        m.phase = 'rally';
        m.noticeTime = 0;
        m.players[0].x = -5.5;
        Object.assign(m.ball, { x: 5, y: 20, vx: 0, vy: 0 });
        for (let frame = 0; frame < frames; frame++)
          m.tick(FIXED_DT, { jump: true }, mode === 'coop' ? { jump: frame < 8, drive: true } : {});
        if (release) m.tick(FIXED_DT);
        bars = [];
        r.draw(m, TEAMS, FIXED_DT);
        results.push({ bars, bonus: m.players[0].jumpButtonHold.bonus || 0 });
        gallery.drawImage(canvas, (i % 2) * 960, Math.floor(i / 2) * 540);
        if (i === 2) {
          m.config.jumpHoldHang = 0.2;
          bars = [];
          r.drawJumpCharge(m.players[0], m);
          results.push({ afterTuning: bars });
          const scene = captureScene(m);
          bars = [];
          r.drawJumpCharge(scene.players[0], Object.assign(Object.create(m), scene));
          results.push({ replay: bars });
        }
        for (let frame = 0; frame < 240; frame++) m.tick(FIXED_DT);
        bars = [];
        r.drawJumpCharge(m.players[0], m);
        results.push({ landed: bars });
      }
      document.body.style.margin = '0';
      document.body.replaceChildren(sheet);
      return results;
    });
    const states = result.filter((state) => state.bars);
    const width = (bar) => bar.rects[1][2];
    assert.equal(width(states[0].bars[0]), 0, 'tap has no bonus');
    assert.ok(
      width(states[1].bars[0]) > 0 && width(states[1].bars[0]) < 42,
      'short hold stays partial',
    );
    assert.equal(width(states[2].bars[0]), 42, 'holding to the apex fills the bar');
    assert.equal(states[2].bonus, 0.09);
    assert.ok(states[1].bonus > 0 && states[1].bonus < states[2].bonus);
    assert.equal(states[3].bars.length, 2);
    assert.ok(
      width(states[3].bars[0]) > width(states[3].bars[1]),
      'co-op owners charge independently',
    );
    for (const state of states)
      for (const bar of state.bars) {
        const background = bar.rects[0];
        assert.equal(background[2], 44);
        assert.equal(background[3], 4);
        assert.ok(background[1] > bar.feet, 'jump charge sits below the feet');
      }
    assert.equal(width(result.find((state) => state.afterTuning).afterTuning[0]), 42);
    assert.deepEqual(
      result.find((state) => state.replay).replay,
      result.find((state) => state.afterTuning).afterTuning,
    );
    for (const state of result.filter((state) => state.landed)) assert.deepEqual(state.landed, []);
    await page.screenshot({ path: '.cache/jump-charge-review.png', fullPage: true });
  },
);
