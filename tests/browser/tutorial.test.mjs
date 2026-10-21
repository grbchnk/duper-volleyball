import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { openBrowserGame, settleSettings } from './settings-helpers.mjs';

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
  'in-game coach preserves the court, teaches animated gamepad controls, and advances without Continue',
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
    await mkdir('.cache/tutorial-overlay-qa', { recursive: true });
    const before = await page.locator('#arena').boundingBox();
    await page.locator('#tutorial-start').click();
    await settleSettings(page);
    const panel = page.locator('#tutorial-panel'),
      after = await page.locator('#arena').boundingBox();
    assert.equal(await panel.evaluate((p) => p.parentElement.id), 'arena');
    assert.equal(await panel.evaluate((p) => getComputedStyle(p).position), 'absolute');
    assert.ok(after.height >= before.height - 1, 'Training must not steal court height');
    assert.ok(after.width >= before.width - 1, 'Training must not steal court width');
    assert.ok(after.height > 500, 'The playable court stays large at 720p');
    assert.equal(await panel.locator('kbd').count(), 0);
    assert.doesNotMatch(await panel.innerText(), /Space|Shift|Tab|Клавиатура|Xbox|Enter/);
    assert.equal(await panel.locator('.coach-controller').count(), 1);
    assert.equal(
      await panel.locator('.stick-thumb').evaluate((e) => getComputedStyle(e).animationName),
      'coach-stick-walk',
    );
    await page
      .locator('#arena')
      .screenshot({ path: '.cache/tutorial-overlay-qa/01-movement-demo.png' });
    // No acknowledgement is needed: the explanation starts practice automatically.
    await page.waitForFunction(
      () => document.querySelector('#tutorial-panel').dataset.phase === 'practice',
    );
    await pad(page, [1, 0]);
    await page.waitForFunction(
      () => document.querySelectorAll('#tutorial-goals .done').length === 1,
    );
    await pad(page);
    assert.match(await page.locator('#tutorial-objective').innerText(), /✕.*прыгнуть/);
    assert.equal(
      await panel
        .locator('[data-control="cross"]')
        .evaluate((e) => e.classList.contains('is-taught')),
      true,
    );
    await page
      .locator('#arena')
      .screenshot({ path: '.cache/tutorial-overlay-qa/02-jump-practice.png' });
    await pad(page, [0, 0], [0]);
    await page.waitForFunction(
      () => document.querySelector('#tutorial-panel').dataset.phase === 'success',
    );
    await pad(page);
    await page.waitForFunction(() =>
      document.querySelector('#tutorial-title').textContent.includes('Приём'),
    );
    assert.equal(
      await panel.locator('[data-control="l2"]').evaluate((e) => e.classList.contains('is-taught')),
      true,
    );
    await page
      .locator('#arena')
      .screenshot({ path: '.cache/tutorial-overlay-qa/03-receive-demo.png' });
    // Options freezes the lesson; stick navigation and Circle work without a mouse.
    await pad(page, [0, 0], [9]);
    await page.locator('#tutorial-menu').waitFor({ state: 'visible' });
    await pad(page);
    const time = await page.evaluate(async () => (await import('/src/main.js')).match.time);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(async () => (await import('/src/main.js')).match.time), time);
    await pad(page, [0, 1]);
    await page.waitForFunction(() =>
      document.querySelector('#tutorial-repeat').classList.contains('is-focused'),
    );
    await pad(page);
    await page
      .locator('#arena')
      .screenshot({ path: '.cache/tutorial-overlay-qa/04-course-menu.png' });
    await pad(page, [0, 0], [1]);
    await page.locator('#tutorial-menu').waitFor({ state: 'hidden' });
    await pad(page);
    assert.deepEqual(errors, []);
  },
);

test(
  'every chapter has a compact controller-only visual, fits the game, and supports fullscreen',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t, { width: 1440, height: 900 });
    await page.locator('#tutorial-start').click();
    await mkdir('.cache/tutorial-overlay-qa', { recursive: true });
    for (let index = 0; index < 11; index++) {
      await page.locator('#tutorial-menu-toggle').click();
      await page.locator(`#tutorial-chapters [data-lesson="${index}"]`).click();
      await settleSettings(page);
      const bounds = await page.locator('#tutorial-panel').boundingBox(),
        card = await page.locator('.tutorial-coach').boundingBox();
      assert.ok(
        card.x >= bounds.x &&
          card.y >= bounds.y &&
          card.x + card.width <= bounds.x + bounds.width + 1 &&
          card.y + card.height <= bounds.y + bounds.height + 1,
        `Chapter ${index + 1} overflows the court`,
      );
      assert.doesNotMatch(
        await page.locator('#tutorial-panel').innerText(),
        /Space|Shift|Tab|Клавиатура|Xbox|Enter/,
      );
      if ([3, 4, 6, 7, 9].includes(index))
        await page
          .locator('#arena')
          .screenshot({ path: `.cache/tutorial-overlay-qa/chapter-${index + 1}.png` });
    }
    for (const viewport of [
      { width: 1024, height: 600 },
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await settleSettings(page);
      await page.locator('#tutorial-menu-toggle').click();
      await page.locator('#tutorial-chapters [data-lesson="0"]').click();
      await settleSettings(page);
      const bounds = await page.locator('#tutorial-panel').boundingBox(),
        card = await page.locator('.tutorial-coach').boundingBox();
      await page.locator('#arena').screenshot({
        path: `.cache/tutorial-overlay-qa/${viewport.width}x${viewport.height}.png`,
      });
      assert.ok(
        card.y + card.height <= bounds.y + bounds.height + 2,
        'Responsive coach must stay inside game',
      );
      assert.ok(await page.locator('#arena').evaluate((e) => e.scrollHeight <= e.clientHeight + 2));
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => document.fullscreenElement?.id === 'arena');
    const fullscreen = await page.locator('#tutorial-panel').boundingBox();
    assert.ok(fullscreen.height > 600);
    await page.locator('#arena').screenshot({ path: '.cache/tutorial-overlay-qa/fullscreen.png' });
    await page.evaluate(() => document.exitFullscreen());
  },
);
