import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { openBrowserGame } from './settings-helpers.mjs';

test(
  'tutorial: explanation, countdown, two real movement goals, responsive visuals and cosmetics',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mkdir('.cache/tutorial-qa', { recursive: true });
    await page.locator('#tutorial-start').click();
    await page.locator('#tutorial-panel').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#tutorial-next').isVisible(), false);
    assert.match(await page.locator('#tutorial-title').innerText(), /Движение и прыжок/);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(350);
    await page.keyboard.up('ArrowRight');
    assert.equal(await page.locator('#tutorial-goals .done').count(), 0);
    await page
      .locator('#tutorial-panel')
      .screenshot({ path: '.cache/tutorial-qa/explanation.png' });
    await page.locator('#tutorial-begin').click();
    assert.match(await page.locator('#tutorial-result').innerText(), /3/);
    await page.locator('#arena').screenshot({ path: '.cache/tutorial-qa/countdown.png' });
    await page.waitForFunction(
      () => document.querySelector('#tutorial-stage').textContent === 'Твоя очередь',
    );
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(
      () => document.querySelectorAll('#tutorial-goals .done').length === 1,
    );
    await page.keyboard.up('ArrowRight');
    assert.equal(await page.locator('#tutorial-next').isVisible(), false);
    await page.keyboard.down('Space');
    await page.waitForFunction(() => !document.querySelector('#tutorial-next').hidden);
    await page.keyboard.up('Space');
    await page.locator('#tutorial-next').click();
    assert.match(await page.locator('#tutorial-title').innerText(), /Приём/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#tutorial-panel').screenshot({ path: '.cache/tutorial-qa/mobile.png' });
    assert.ok(
      await page.locator('#tutorial-panel').evaluate((el) => el.scrollWidth <= el.clientWidth),
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    // A contact sheet renders the actual new assets, including both ball modes.
    await page.evaluate(async () => {
      const { paintBody, frameOf } = await import('/src/sprites.js');
      const { EXTRA_HEAD_STYLES } = await import('/src/head-styles.js');
      const { drawBallDesign } = await import('/src/display.js');
      const { BALL_DESIGNS } = await import('/src/ball-designs.js');
      const article = document.createElement('article');
      article.id = 'cosmetic-audit';
      article.style =
        'position:relative;background:#fff9eb;padding:24px;width:1080px;z-index:10000;color:#43564a';
      article.innerHTML = '<h2>Новые причёски, головные уборы и мячи</h2>';
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 540;
      const c = canvas.getContext('2d');
      c.font = '14px sans-serif';
      c.textAlign = 'center';
      const heads = Object.keys(EXTRA_HEAD_STYLES).slice(0, 12);
      heads.forEach((head, i) => {
        const x = 90 + (i % 6) * 180,
          y = 120 + Math.floor(i / 6) * 170;
        c.save();
        c.translate(x, y);
        c.scale(2, 2);
        paintBody(
          c,
          frameOf('idle'),
          'club',
          { color: '#80bda8', dark: '#4f8576', light: '#c9e5cd' },
          0,
          'head',
          { head, body: 'classic', tone: '#f4cfac', hair: '#654537' },
        );
        c.restore();
        c.fillStyle = '#43564a';
        c.fillText(EXTRA_HEAD_STYLES[head].name, x, y + 10);
      });
      Object.entries(BALL_DESIGNS)
        .filter(([, d]) => d.colors.length === 3)
        .forEach(([id, d], i) => {
          const x = 67 + i * 135;
          for (const [y, pixel] of [
            [380, false],
            [435, true],
          ]) {
            c.save();
            c.translate(x, y);
            c.scale(2, 2);
            drawBallDesign(c, id, pixel);
            c.restore();
          }
          c.fillStyle = '#43564a';
          c.fillText(d.name.split(' ·')[0], x, 480);
        });
      article.append(canvas);
      document.body.prepend(article);
    });
    await page.locator('#cosmetic-audit').screenshot({ path: '.cache/tutorial-qa/cosmetics.png' });
    assert.deepEqual(errors, []);
  },
);
