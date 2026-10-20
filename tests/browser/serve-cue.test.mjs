import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { openBrowserGame } from './settings-helpers.mjs';

test(
  'the only serve indicator is a shrinking yellow-to-green ball ring and a press hits immediately',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mkdir('.cache', { recursive: true });
    await page.evaluate(async () => {
      const { match } = await import('/src/main.js');
      const { Renderer } = await import('/src/renderer.js');
      const { TEAMS, FIXED_DT } = await import('/src/config.js');
      const { serveCue } = await import('/src/serve-cue.js');
      const canvas = document.createElement('canvas');
      canvas.id = 'serve-cue-review';
      canvas.width = 960;
      canvas.height = 540;
      canvas.style.cssText = 'display:block;width:960px;height:540px;max-width:none';
      document.body.append(canvas);
      const renderer = new Renderer(canvas);
      match.reset('versus');
      match.beginServe({ kind: 'low', power: 0.6, aim: {} });
      window.serveReview = { match, renderer, TEAMS, FIXED_DT, serveCue };
      renderer.draw(match, TEAMS, 0);
    });
    await page.waitForFunction(
      () => document.querySelector('#action-title').textContent === 'Следи за кругом у мяча',
    );
    await page.locator('#serve-cue-review').screenshot({ path: '.cache/serve-ring-start.png' });
    const samples = [];
    for (const progress of [0.5, 0.8, 0.94, 1]) {
      samples.push(
        await page.evaluate((progress) => {
          const { match, renderer, TEAMS, FIXED_DT, serveCue } = window.serveReview;
          const target = match.serveAction.contactTiming.start * progress;
          while (match.phaseTime < target - 1e-9) match.tick(FIXED_DT);
          const cue = serveCue(match);
          renderer.draw(match, TEAMS, 0);
          // Inspect the actual ring strokes, without the rest of the scene.
          const rings = [],
            texts = [],
            rects = [];
          const c = renderer.ctx;
          const stroke = c.stroke.bind(c),
            arc = c.arc.bind(c),
            beginPath = c.beginPath.bind(c);
          const text = renderer.text.bind(renderer),
            rect = renderer.rect.bind(renderer);
          let circle;
          c.beginPath = () => {
            circle = null;
            beginPath();
          };
          c.arc = (...args) => {
            circle = args;
            arc(...args);
          };
          c.stroke = () => {
            if (circle)
              rings.push({
                circle,
                color: c.strokeStyle,
                width: c.lineWidth,
                alpha: c.globalAlpha,
              });
            stroke();
          };
          renderer.text = (...args) => {
            texts.push(args);
            text(...args);
          };
          renderer.rect = (...args) => {
            rects.push(args);
            rect(...args);
          };
          renderer.drawBall(match);
          c.stroke = stroke;
          c.arc = arc;
          c.beginPath = beginPath;
          renderer.text = text;
          renderer.rect = rect;
          return {
            cue,
            rings,
            texts,
            rects,
            ball: renderer.project(match.ball.x, match.ball.y),
            hasMeter: typeof renderer.drawServeCue === 'function',
          };
        }, progress),
      );
      await page
        .locator('#serve-cue-review')
        .screenshot({ path: `.cache/serve-ring-${progress}.png` });
    }
    assert.ok(samples[0].cue.radius > samples[1].cue.radius);
    assert.ok(samples[1].cue.radius > samples[2].cue.radius);
    assert.ok(samples[2].cue.radius > samples[3].cue.radius);
    for (const sample of samples) {
      assert.equal(sample.hasMeter, false);
      assert.deepEqual(sample.texts, []);
      assert.deepEqual(sample.rects, []);
      assert.equal(sample.rings.length, 1);
      const mainRing = sample.rings.at(-1);
      assert.equal(mainRing.alpha, 1);
      assert.ok(Math.abs(mainRing.width - sample.cue.width) < 1e-6);
      assert.ok(mainRing.width <= 1.6);
      const [x, y, radius] = mainRing.circle;
      assert.ok(Math.abs(x - sample.ball.x) < 1e-9);
      assert.ok(Math.abs(y - Math.max(84, sample.ball.y)) < 1e-9);
      assert.equal(radius, sample.cue.radius);
    }
    assert.equal(samples.at(-1).cue.color, 'rgb(131, 230, 165)');
    await page.waitForFunction(
      () => document.querySelector('#action-title').textContent === 'НАЖМИ ЕЩЁ РАЗ!',
    );
    const result = await page.evaluate(() => {
      const { match, FIXED_DT } = window.serveReview;
      match.tick(FIXED_DT, { low: true });
      return {
        phase: match.phase,
        serves: match.stats.serves[0],
        quality: match.lastContact.serveQuality,
      };
    });
    assert.deepEqual(result, { phase: 'rally', serves: 1, quality: 1 });
    assert.deepEqual(errors, []);
  },
);
