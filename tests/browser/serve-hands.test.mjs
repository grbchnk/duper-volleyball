import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

test(
  'serve hands retain authored forearm orientation through toss, swing and follow-through',
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
    await page.route('**/serve-check', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html></html>' }),
    );
    await page.goto(`${base}/serve-check`);
    const result = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { TEAMS, FIXED_DT } = await import('/src/config.js');
      const { serveSupport } = await import('/src/serve-support.js');
      const { blendAngle } = await import('/src/arm-contour.js');
      const sheet = document.createElement('canvas');
      sheet.width = 1280;
      sheet.height = 1280;
      document.body.style.margin = '0';
      document.body.replaceChildren(sheet);
      const gallery = sheet.getContext('2d');
      gallery.fillStyle = '#eadfc9';
      gallery.fillRect(0, 0, 1280, 1280);
      gallery.imageSmoothingEnabled = false;
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const r = new Renderer(canvas);
      const rotate = r.actorContext.rotate.bind(r.actorContext);
      let angles = [];
      r.actorContext.rotate = (angle) => {
        angles.push(angle);
        rotate(angle);
      };
      let checked = 0,
        hits = 0;
      let maxError = 0,
        maxFrameTurn = 0;
      let maxUpperExtension = 0;
      for (const team of [0, 1])
        for (const hand of [0, 1])
          for (const facing of [-1, 1])
            for (const kind of ['low', 'back', 'loft', 'drive']) {
              const m = new Match();
              m.mode = 'versus';
              m.server = team;
              m.startServe();
              const p = m.serverPlayer();
              for (const other of m.players) other.benched = other !== p;
              p.serveHand = hand;
              p.facing = facing;
              r.armRigs.clear();
              m.beginServe({ kind, power: 0.65, aim: {} });
              const pressAt = m.serveAction.ideal;
              const sampleTimes = [
                0,
                m.serveAction.tossDelay + 0.08,
                pressAt - 0.07,
                pressAt + 0.04,
              ];
              const sampled = new Set();
              let pressed = false,
                previousAngles = null;
              for (let i = 0; i < Math.ceil((pressAt + 0.22) / FIXED_DT); i++) {
                const hit = !pressed && i * FIXED_DT >= pressAt;
                if (hit) pressed = true;
                const input = hit ? { [kind]: true } : {};
                m.tick(FIXED_DT, team === 0 ? input : {}, team === 1 ? input : {});
                p.facing = facing;
                if (m.phase !== 'serve-motion' && !p.armSwing?.serve) break;
                angles = [];
                r.drawPlayer(p, TEAMS[team], m, FIXED_DT);
                if (facing === (team === 0 ? 1 : -1)) {
                  const row = team * 4 + ['low', 'back', 'loft', 'drive'].indexOf(kind);
                  for (let sample = 0; sample < sampleTimes.length; sample++) {
                    if (sampled.has(sample) || i * FIXED_DT < sampleTimes[sample]) continue;
                    sampled.add(sample);
                    const x = hand * 640 + sample * 160;
                    gallery.drawImage(r.actor, 30, 50, 120, 145, x + 20, row * 160 + 10, 120, 145);
                    gallery.fillStyle = '#435c68';
                    gallery.font = '11px monospace';
                    gallery.fillText(
                      `${team ? 'R' : 'L'} ${kind} H${hand} ${sample}`,
                      x + 10,
                      row * 160 + 12,
                    );
                  }
                }
                if (angles.length !== 2)
                  throw new Error(`Unexpected hand transforms: ${angles.length}`);
                const support = serveSupport(m, p);
                const rig = r.armRigs.get(p.id);
                if (p.armSwing?.serve && p.armSwing.hit && ['loft', 'drive'].includes(kind)) {
                  const shoulder = { x: hand ? 6 : -6, y: -20 };
                  const reach = (point) => Math.hypot(point.x - shoulder.x, point.y - shoulder.y);
                  maxUpperExtension = Math.max(
                    maxUpperExtension,
                    reach(rig.wrists[hand]) - reach(rig.contactPoint),
                  );
                }
                for (let arm = 0; arm < 2; arm++) {
                  const wrist = rig.wrists[arm],
                    elbow = rig.elbows[arm];
                  const raw = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x) + Math.PI / 2;
                  const expected = blendAngle(raw, 0, support?.hand === arm ? support.weight : 0);
                  maxError = Math.max(
                    maxError,
                    Math.abs(
                      Math.atan2(
                        Math.sin(angles[arm] - expected),
                        Math.cos(angles[arm] - expected),
                      ),
                    ),
                  );
                  if (previousAngles)
                    maxFrameTurn = Math.max(
                      maxFrameTurn,
                      Math.abs(
                        Math.atan2(
                          Math.sin(angles[arm] - previousAngles[arm]),
                          Math.cos(angles[arm] - previousAngles[arm]),
                        ),
                      ),
                    );
                }
                previousAngles = angles.slice();
                checked++;
              }
              if (m.stats.serves[team] > 0) hits++;
            }
      return { checked, hits, maxError, maxFrameTurn, maxUpperExtension };
    });
    assert.ok(result.checked > 1000);
    assert.equal(result.hits, 32);
    assert.ok(result.maxError < 1e-8, JSON.stringify(result));
    assert.ok(Number.isFinite(result.maxFrameTurn));
    assert.ok(result.maxUpperExtension <= 1.45, JSON.stringify(result));
    await page.locator('canvas').screenshot({ path: '.cache/serve-hands-review.png' });
  },
);
