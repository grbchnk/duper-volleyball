import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

test(
  'rescue, burning wrists, R2 slash and scoring dust render and expire without camera shake',
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 880 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/vfx-check', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html></html>' }),
    );
    await page.goto(`${base}/vfx-check`);
    const result = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { TEAMS } = await import('/src/config.js');
      const { shotImpulse } = await import('/src/moves.js');
      const sheet = document.createElement('canvas');
      sheet.width = 1440;
      sheet.height = 860;
      const gallery = sheet.getContext('2d');
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const r = new Renderer(canvas);
      const m = new Match();
      m.reset('versus');
      m.phase = 'rally';
      m.mode = 'demo';
      m.noticeTime = 0;
      m.config.trajectory = false;
      m.config.pixelGraphics = true;
      const p = m.players[1];
      p.x = -3;
      p.y = 0;
      m.lastTouch = 1;
      m.lastPlayer = 4;
      Object.assign(m.ball, { x: p.x + 0.35, y: 1.1, vx: -20, vy: -8 });
      const impulse = shotImpulse(
        m.ball,
        p,
        'low',
        0.65,
        { manualControl: true, axis: 1 },
        m.players,
        m.config,
      );
      m.makeContact(p, 'low', 0.65, impulse);
      const hit = m.events.findLast((e) => e.type === 'hit');
      r.effect(hit, m);
      const rescue = r.contactAccents[0]?.kind === 'rescue';
      const grab = (index, title) => {
        const x = (index % 2) * 720,
          y = Math.floor(index / 2) * 430;
        gallery.drawImage(canvas, x, y + 25, 720, 405);
        gallery.fillStyle = '#f5ead7';
        gallery.fillRect(x, y, 720, 25);
        gallery.fillStyle = '#354d49';
        gallery.font = 'bold 16px sans-serif';
        gallery.fillText(title, x + 14, y + 18);
      };
      r.draw(m, TEAMS, 0.07);
      r.draw(m, TEAMS, 0);
      grab(0, 'Спасение: волна от кистей и огонь на руках');
      const handBefore = r.armRigs.get(p.id).wrists.map((w) => ({ x: w.x, y: w.y }));
      // Render later in recovery after moving: flames remain attached to the rig.
      m.time += 0.45;
      p.x -= 0.8;
      p.armSwing.age = 0.45;
      r.draw(m, TEAMS, 0.45);
      grab(1, 'Огонь остаётся на движущихся кистях и затухает');
      const handsMove = r.armRigs
        .get(p.id)
        .wrists.some((w, i) => w.x !== handBefore[i].x || w.y !== handBefore[i].y);
      r.contactAccents = [];
      p.handEmbers = null;
      p.y = 1.4;
      Object.assign(m.ball, { x: p.x + 0.5, y: 3.3, vx: 24, vy: 3 });
      m.recordContact(p, 'drive', 1);
      p.armSwing.aim = { fast: true };
      r.effect(
        {
          type: 'hit',
          kind: 'drive',
          power: 1,
          modifier: 'fast',
          outgoingVelocity: { x: 24, y: 3 },
          x: m.ball.x,
          y: m.ball.y,
        },
        m,
      );
      const slash = r.contactAccents[0]?.kind === 'slash';
      r.draw(m, TEAMS, 0.03);
      grab(2, 'Сильный R2: росчерк и обновлённый огонь мяча');
      r.contactAccents = [];
      r.impacts = [];
      r.effect({ type: 'floor-touch', x: 5, speed: 18 }, m);
      const ordinaryBounce = r.particles.filter((p) => p.dust).length === 0;
      r.effect({ type: 'point', groundX: 5, out: false }, m);
      const winning =
        r.floorRipples.length === 1 &&
        r.floorRipples[0].winning &&
        r.particles.filter((p) => p.dust).length === 6;
      p.y = 0;
      Object.assign(m.ball, { x: 5, y: 0.105, vx: 0, vy: 0 });
      r.draw(m, TEAMS, 0.08);
      r.draw(m, TEAMS, 0);
      grab(3, 'Выигранный мяч: кольцо и лёгкая пыль в точке падения');
      r.draw(m, TEAMS, 1.5);
      r.draw(m, TEAMS, 0);
      const expired = !r.contactAccents.length && !r.particles.length && !r.floorRipples.length;
      const noShake = r.shake === 0;
      document.body.style.margin = '0';
      document.body.replaceChildren(sheet);
      return { rescue, slash, handsMove, winning, ordinaryBounce, expired, noShake };
    });
    for (const [name, value] of Object.entries(result)) assert.equal(value, true, name);
    assert.deepEqual(errors, []);
    await mkdir('.cache', { recursive: true });
    await page.locator('canvas').screenshot({ path: '.cache/contact-vfx-review.png' });
  },
);
