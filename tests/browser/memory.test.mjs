import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

test(
  'rendering: sprite caches stay bounded through gameplay and cosmetic changes',
  { timeout: 60000 },
  async (t) => {
    const server = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('../../', import.meta.url),
      env: { ...process.env, PORT: '0' },
      windowsHide: true,
    });
    t.after(() => server.kill());
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server timeout')), 10000);
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
    const page = await browser.newPage();
    await page.route('**/memory-test', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }),
    );
    await page.goto(base + '/memory-test');
    const result = await page.evaluate(async () => {
      const { Renderer } = await import('/src/renderer.js');
      const { Match } = await import('/src/engine.js');
      const { TEAMS, FIXED_DT } = await import('/src/config.js');
      const { frameOf } = await import('/src/sprites.js');
      const makeCanvas = (w, h) => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        return canvas;
      };
      const canvas = makeCanvas(960, 540);
      const r = new Renderer(canvas);
      const m = new Match();
      m.reset('demo');
      m.config.pixelGraphics = true;
      r.draw(m, TEAMS);
      // Two minutes of simulation; render samples to keep the test fast.
      for (let tick = 0; tick < 14400; tick++) {
        if (m.phase === 'finished') m.reset('demo');
        m.tick(FIXED_DT);
        for (const event of m.events.splice(0)) r.effect(event, m);
        if (tick % 120 === 0) r.draw(m, TEAMS, 1);
      }
      // Exercise more cosmetic combinations than fit in the cache, as new games do.
      const frame = frameOf('idle');
      const appearance = { ...m.players[0].appearance };
      const get = (hair) =>
        r.bodySprites.get(frame, 'club', TEAMS[0], 0, 'head', { ...appearance, hair });
      const first = get('#000000');
      for (let i = 1; i <= 1100; i++) get('#' + i.toString(16).padStart(6, '0'));
      const recent = get('#00044c');
      get('#ffffff');
      const recentSurvives = get('#00044c') === recent;
      const oldEvicted = get('#000000') !== first;
      r.text('frequent', 0, 20);
      const frequentKey = 'frequent|12|#454b47';
      const frequent = r.textSprites.get(frequentKey);
      for (let i = 0; i < 500; i++) {
        r.text(`changing ${i}`, 0, 20);
        r.text('frequent', 0, 20);
      }
      return {
        bodyEntries: r.bodySprites.cache.size,
        textEntries: r.textSprites.size,
        frequentSurvives: r.textSprites.get(frequentKey) === frequent,
        recentSurvives,
        oldEvicted,
        replayFrames: m.replay.frames.length,
        lastReplayFrames: m.replay.last.length,
      };
    });
    assert.equal(result.bodyEntries, 1024);
    assert.equal(result.textEntries, 400);
    assert.ok(result.frequentSurvives && result.recentSurvives && result.oldEvicted);
    assert.ok(result.replayFrames <= 300 && result.lastReplayFrames <= 300);
  },
);
