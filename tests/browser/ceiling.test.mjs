import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

test(
  'browser: ceiling preview exits, stays hidden, reenters and plays both sounds',
  { timeout: 30000 },
  async (t) => {
    const server = spawn(process.execPath, ['server.mjs'], {
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
    const page = await browser.newPage({ viewport: { width: 1000, height: 820 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mkdir('.cache/ceiling', { recursive: true });
    await page.goto(`${base}/ceiling-preview.html`);
    await page.evaluate(async () => {
      const { renderer, sound } = await import('/src/ceiling-preview.js');
      window.breaks = [];
      renderer.onCeilingBreak = (event) => {
        window.breaks.push(event);
        sound.play(event);
      };
    });
    await page.locator('#sound').click();
    await page.waitForFunction(() => window.breaks.length >= 1);
    await page.screenshot({ path: '.cache/ceiling/exit.png' });
    await page.waitForFunction(() =>
      document.querySelector('#status').textContent.includes('положение скрыто'),
    );
    const hidden = await page.evaluate(async () => {
      const { renderer, match } = await import('/src/ceiling-preview.js');
      const before = JSON.stringify(match.ball);
      const ctx = renderer.ctx;
      // All three render paths must return before touching the drawing context.
      renderer.ctx = new Proxy(
        {},
        {
          get() {
            throw Error('Hidden ball drew a position cue');
          },
        },
      );
      try {
        renderer.drawBall(match);
        renderer.drawBallShadow(match);
        renderer.drawBallSmoke(match);
      } finally {
        renderer.ctx = ctx;
      }
      return before === JSON.stringify(match.ball);
    });
    assert.equal(hidden, true);
    await page.screenshot({ path: '.cache/ceiling/hidden.png' });
    await page.waitForFunction(() => window.breaks.length >= 2);
    await page.screenshot({ path: '.cache/ceiling/reentry.png' });
    const result = await page.evaluate(async () => ({
      events: window.breaks,
      ready: (await import('/src/ceiling-preview.js')).sound.ready,
    }));
    assert.deepEqual(
      result.events.slice(0, 2).map((e) => e.entering),
      [false, true],
    );
    assert.equal(result.ready, true);
    assert.deepEqual(errors, []);
    await page.setViewportSize({ width: 390, height: 750 });
    await page.screenshot({ path: '.cache/ceiling/mobile.png' });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
  },
);
