import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { openBrowserGame, settleSettings } from './settings-helpers.mjs';
import { LESSONS } from '../../src/tutorial.js';
async function pad(page, axes = [0, 0], buttons = []) {
  await page.evaluate(
    ({ axes, buttons }) => {
      window.trainingPad.axes = [...axes, 0, 0];
      window.trainingPad.buttons.forEach((b, i) => {
        b.pressed = buttons.includes(i);
        b.value = Number(b.pressed);
      });
    },
    { axes, buttons },
  );
}
test(
  'continuous gamepad training keeps the court large and rewards movement through landing',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t, { width: 1280, height: 720 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluate(() => {
      window.trainingPad = {
        index: 0,
        id: 'Training gamepad',
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })),
      };
      navigator.getGamepads = () => [window.trainingPad];
    });
    const before = await page.locator('#arena').boundingBox();
    await page.locator('#tutorial-start').click();
    await settleSettings(page);
    const overlay = page.locator('#tutorial-panel'),
      after = await page.locator('#arena').boundingBox();
    assert.equal(await overlay.evaluate((p) => p.parentElement.id), 'arena');
    assert.ok(after.height >= before.height - 1);
    assert.equal(await overlay.getAttribute('data-phase'), 'practice');
    assert.equal(await page.locator('.tutorial-coach').count(), 0);
    assert.equal(await overlay.locator('.control-icon').count(), 2);
    assert.equal(await page.locator('#tutorial-hint').innerText(), '');
    assert.doesNotMatch(await overlay.innerText(), /Space|Shift|Клавиатура|Enter|Длительность/);
    const waitDone = (n) =>
      page.waitForFunction(
        (n) => document.querySelectorAll('#tutorial-goals .done').length === n,
        n,
      );
    await pad(page, [-1, 0]);
    await waitDone(1);
    await pad(page, [0, 0], [0]);
    await waitDone(2);
    await pad(page);
    await page.waitForTimeout(1300);
    await pad(page, [1, 0]);
    await waitDone(3);
    await pad(page, [0, 0], [0]);
    await waitDone(4);
    await pad(page);
    assert.equal(await overlay.getAttribute('data-phase'), 'success');
    await page.waitForTimeout(600);
    assert.equal(await overlay.getAttribute('data-lesson'), 'move');
    await page.waitForFunction(
      () => document.querySelector('#tutorial-panel').dataset.lesson === 'receive',
    );
    assert.equal(await overlay.getAttribute('data-phase'), 'practice');
    assert.equal(await overlay.locator('.control-check').count(), 3);
    assert.equal(await overlay.locator('.control-glyph rect').count(), 1);
    assert.equal(await overlay.locator('.control-glyph circle').count(), 1);
    await pad(page, [0, 0], [9]);
    await page.waitForFunction(() => !document.querySelector('#tutorial-menu').hidden);
    await pad(page);
    await pad(page, [0, 0], [1]);
    await page.waitForFunction(() => document.querySelector('#tutorial-menu').hidden);
    await pad(page);
    assert.deepEqual(errors, []);
  },
);
test(
  'all live lessons fit desktop, small landscape, portrait and fullscreen',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t, { width: 1280, height: 720 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mkdir('.cache/continuous-qa', { recursive: true });
    await page.locator('#tutorial-start').click();
    for (let i = 0; i < LESSONS.length; i++) {
      await page.locator('#tutorial-menu-toggle').click();
      await page.locator(`[data-lesson="${i}"]`).click();
      await settleSettings(page);
      assert.equal(
        await page.locator('#tutorial-panel').getAttribute('data-lesson'),
        LESSONS[i].id,
      );
      assert.equal(await page.locator('#tutorial-panel').getAttribute('data-phase'), 'practice');
      assert.ok((await page.locator('.control-icon').count()) > 0);
      if (['move', 'receive', 'block', 'power'].includes(LESSONS[i].id))
        await page
          .locator('#arena')
          .screenshot({ path: `.cache/continuous-qa/${LESSONS[i].id}.png` });
    }
    for (const viewport of [
      { width: 1024, height: 600 },
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await settleSettings(page);
      const arena = await page.locator('#tutorial-panel').boundingBox(),
        cues = await page.locator('.training-cues').boundingBox();
      assert.ok(cues.x >= arena.x - 1 && cues.x + cues.width <= arena.x + arena.width + 1);
      assert.ok(cues.y + cues.height < arena.y + arena.height * 0.55);
      await page
        .locator('#arena')
        .screenshot({ path: `.cache/continuous-qa/${viewport.width}.png` });
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator('#fullscreen').click();
    await settleSettings(page);
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), true);
    assert.deepEqual(errors, []);
  },
);
