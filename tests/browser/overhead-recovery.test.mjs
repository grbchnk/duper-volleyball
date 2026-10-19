import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

test(
  'upper reception returns promptly without a second spring delay at 30/60/120 FPS',
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
    await page.route('**/overhead-check', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html></html>' }),
    );
    await page.goto(`${base}/overhead-check`);
    const results = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { FIXED_DT, TEAMS } = await import('/src/config.js');
      const sheet = document.createElement('canvas');
      sheet.width = 1200;
      sheet.height = 1200;
      const gallery = sheet.getContext('2d');
      gallery.fillStyle = '#e4e1d7';
      gallery.fillRect(0, 0, sheet.width, sheet.height);
      gallery.imageSmoothingEnabled = false;
      const results = [];
      for (const team of [0, 1])
        for (const facing of [-1, 1])
          for (const soft of [false, true]) {
            let baseline;
            for (const fps of [30, 60, 120]) {
              const canvas = document.createElement('canvas');
              canvas.width = 960;
              canvas.height = 540;
              const r = new Renderer(canvas),
                m = new Match();
              m.reset('versus');
              m.phase = 'rally';
              m.lastTouch = 1 - team;
              m.lastPlayer = (1 - team) * 3;
              const p = m.players[team * 3];
              p.x = m.sign(team) * 5;
              p.facing = facing;
              Object.assign(m.ball, { x: p.x + facing * 0.5, y: 3, vx: 0, vy: 0 });
              const tick = (input = {}) =>
                m.tick(FIXED_DT, team === 0 ? input : {}, team === 1 ? input : {});
              const draw = (dt) => {
                r.ctx.fillStyle = '#d4c3ad';
                r.ctx.fillRect(0, 0, 960, 540);
                r.drawPlayer(p, TEAMS[team], m, dt);
              };
              for (let i = 0; i < 24; i++) {
                Object.assign(m.ball, { y: 3, vy: 0 });
                tick({ loft: true, l2: soft });
                draw(FIXED_DT);
              }
              Object.assign(m.ball, { x: p.x + facing * 0.5, y: 2.1, vy: 0 });
              tick();
              const hit = m.contacts === 1 && p.armSwing?.kind === 'loft';
              const hands = soft ? [1] : [0, 1];
              const peak = [Infinity, Infinity];
              let prompt = true,
                settled = true,
                lateStep = 0,
                previous = null;
              let column = 0;
              const sampleTimes = [0, 0.05, 0.1, 0.16, 0.25, 0.4];
              for (let i = 0; i <= 72; i++) {
                if (i) tick();
                if (i % (120 / fps)) continue;
                draw(1 / fps);
                const rig = r.armRigs.get(p.id),
                  age = p.armSwing?.age ?? 1;
                for (const hand of hands) {
                  if (age <= 0.04) peak[hand] = Math.min(peak[hand], rig.wrists[hand].y);
                  if (age >= 0.1 && age < 0.1 + 1 / fps)
                    prompt &&= rig.wrists[hand].y > peak[hand] + 3;
                  if (age >= 0.3) settled &&= Math.abs(rig.wrists[hand].y + 12) < 2.5;
                  if (age >= 0.32 && previous)
                    lateStep = Math.max(
                      lateStep,
                      Math.hypot(
                        rig.wrists[hand].x - previous[hand].x,
                        rig.wrists[hand].y - previous[hand].y,
                      ),
                    );
                }
                previous = rig.wrists.map((w) => ({ x: w.x, y: w.y }));
                if (
                  team === 0 &&
                  fps === 60 &&
                  column < sampleTimes.length &&
                  age >= sampleTimes[column] - 1e-8
                ) {
                  const row = (facing === -1 ? 0 : 2) + Number(soft),
                    point = r.project(p.x, p.y);
                  gallery.fillStyle = '#36434a';
                  gallery.font = '15px sans-serif';
                  gallery.fillText(
                    `${soft ? 'L2' : 'normal'} / ${age.toFixed(3)}s`,
                    column * 200 + 6,
                    row * 300 + 22,
                  );
                  gallery.drawImage(
                    canvas,
                    point.x - 45,
                    point.y - 125,
                    90,
                    140,
                    column * 200 + 10,
                    row * 300 + 25,
                    170,
                    265,
                  );
                  column++;
                }
              }
              const flight = [m.ball.x, m.ball.y, m.ball.vx, m.ball.vy];
              const unchanged = !baseline || flight.every((value, i) => value === baseline[i]);
              baseline = flight;
              results.push({
                team,
                facing,
                soft,
                fps,
                hit,
                prompt,
                settled,
                unchanged,
                contacts: m.contacts,
                lateStep,
              });
            }
          }
      document.body.style.margin = '0';
      document.body.replaceChildren(sheet);
      return results;
    });
    for (const result of results) {
      for (const key of ['hit', 'prompt', 'settled', 'unchanged'])
        assert.equal(result[key], true, JSON.stringify(result));
      assert.equal(result.contacts, 1, JSON.stringify(result));
      assert.ok(result.lateStep < 6, JSON.stringify(result));
    }
    await page.locator('canvas').screenshot({ path: '.cache/overhead-recovery-review.png' });
  },
);
