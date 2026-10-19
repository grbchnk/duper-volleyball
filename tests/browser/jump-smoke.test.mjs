import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

test(
  'jump and smoke sliders work; smoke stays anchored after the receiver takes the ball',
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
    const page = await browser.newPage({ viewport: { width: 1000, height: 1120 } });
    await page.goto(base);
    for (const [key, value] of Object.entries({
      jumpHoldThreshold: '0.02',
      jumpHoldHang: '0.09',
      smokeTrailOpacity: '0.16',
      smokeTrailLife: '1.2',
    })) {
      const slider = page.locator('#physics-' + key);
      await slider.waitFor({ state: 'attached' });
      assert.equal(await slider.inputValue(), value);
      await slider.evaluate((el) => {
        el.value = el.max;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      assert.equal(await slider.inputValue(), await slider.getAttribute('max'));
    }
    const result = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { integrateBall } = await import('/src/physics.js');
      const { ageBallSmoke, sampleBallSmoke } = await import('/src/ball-smoke.js');
      const { TEAMS, FIXED_DT } = await import('/src/config.js');
      const m = new Match();
      m.reset('versus');
      m.phase = 'rally';
      m.noticeTime = 0;
      Object.assign(m.ball, { x: -5.5, y: 4, vx: 0, vy: 0 });
      m.makeContact(m.players[0], 'drive', 0.9, { vx: 18, vy: 2, spin: 0 });
      for (let i = 0; i < 65; i++) {
        ageBallSmoke(m, FIXED_DT);
        integrateBall(m.ball, FIXED_DT, m.config);
        sampleBallSmoke(m);
        m.time += FIXED_DT;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const r = new Renderer(canvas);
      const sheet = document.createElement('canvas');
      sheet.width = 960;
      sheet.height = 1080;
      const gallery = sheet.getContext('2d');
      r.draw(m, TEAMS, 0);
      gallery.drawImage(canvas, 0, 0);
      const ellipses = [];
      const ellipse = r.ctx.ellipse.bind(r.ctx);
      r.ctx.ellipse = (...args) => {
        ellipses.push({ x: args[0], y: args[1], alpha: r.ctx.globalAlpha });
        ellipse(...args);
      };
      r.drawBallSmoke(m);
      const before = ellipses.splice(0);
      m.makeContact(m.players[3], 'low', 0.5, { vx: -3, vy: 7, spin: 0 });
      const count = m.smokeTrail.length;
      m.ball.x -= 2;
      ageBallSmoke(m, 0.2);
      sampleBallSmoke(m);
      r.drawBallSmoke(m);
      const after = ellipses.splice(0);
      r.ctx.ellipse = ellipse;
      r.draw(m, TEAMS, 0);
      gallery.drawImage(canvas, 0, 540);
      gallery.font = '18px sans-serif';
      gallery.fillStyle = '#263c3e';
      gallery.fillText('Strong attack: smoke remains on the flight path', 24, 34);
      gallery.fillText('After reception: old path fades; no smoke follows the pass', 24, 574);
      document.body.style.margin = '0';
      sheet.style.cssText =
        'width:960px;height:1080px;max-width:none;max-height:none;display:block;image-rendering:auto;';
      document.body.replaceChildren(sheet);
      return { before, after, count, finalCount: m.smokeTrail.length };
    });
    assert.ok(result.before.length > 30);
    assert.equal(result.finalCount, result.count);
    assert.equal(result.before.length, result.after.length);
    for (let i = 0; i < result.before.length; i++) {
      assert.equal(result.before[i].x, result.after[i].x);
      assert.equal(result.before[i].y, result.after[i].y);
      assert.ok(result.after[i].alpha < result.before[i].alpha);
      assert.ok(result.before[i].alpha <= 0.16);
    }
    await page.screenshot({ path: '.cache/jump-smoke-review.png', fullPage: true });
  },
);
