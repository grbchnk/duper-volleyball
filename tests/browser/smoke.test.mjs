import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

test(
  'browser: current game, settings, labs, cup, results, co-op and archived routes',
  { timeout: 60000 },
  async (t) => {
    const server = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('../../', import.meta.url),
      env: { ...process.env, PORT: '0' },
      windowsHide: true,
    });
    t.after(() => server.kill());
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server did not start')), 10000);
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector('#club-lobby-tour');
    assert.equal(await page.title(), 'Duper Volleyball · Клуб');
    await page.locator('#tutorial-start').click();
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => !document.querySelector('#tutorial-next').disabled);
    await page.keyboard.up('ArrowRight');
    await page.locator('#tutorial-next').click();
    assert.match(await page.locator('#tutorial-title').innerText(), /Подготовка/);
    await page.locator('#tutorial-exit').click();
    await page.waitForFunction(() => document.querySelector('#start-overlay').hidden);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('#pause-overlay').hidden);
    await page.locator('#resume').click();
    await page.waitForFunction(() => document.querySelector('#pause-overlay').hidden);

    await page.locator('#graphics-quick').click();
    await page.locator('#ball-fire').uncheck();
    await page.locator('#lively-background').uncheck();
    await page.keyboard.press('Escape');
    await page.reload();
    await page.locator('#graphics-quick').click();
    assert.equal(await page.locator('#ball-fire').isChecked(), false);
    assert.equal(await page.locator('#lively-background').isChecked(), false);
    const fireChangesPixels = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const m = new Match();
      Object.assign(m.ball, { x: 0, y: 3, vx: 20, vy: 0 });
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const renderer = new Renderer(canvas);
      const picture = (enabled) => {
        m.config.ballFire = enabled;
        renderer.ctx.clearRect(0, 0, 960, 540);
        renderer.drawBall(m);
        return renderer.ctx
          .getImageData(380, 290, 100, 70)
          .data.reduce((sum, value) => sum + value, 0);
      };
      return picture(true) !== picture(false);
    });
    assert.equal(fireChangesPixels, true);
    await page.keyboard.press('Escape');

    await page.locator('#physics-quick').click();
    assert.equal(await page.locator('#receive-momentum').isChecked(), false);
    assert.equal(await page.locator('#physics-receiveTransfer').isDisabled(), true);
    await page.locator('#receive-momentum').check();
    assert.equal(await page.locator('#physics-receiveTransfer').isDisabled(), false);
    await page.keyboard.press('Escape');
    await page.reload();
    await page.locator('#physics-quick').click();
    assert.equal(await page.locator('#receive-momentum').isChecked(), true);
    await page.keyboard.press('Escape');

    await page.locator('#shots-quick').click();
    await page.locator('#shot-kind').selectOption('low');
    await page.locator('#shot-incoming-speed').evaluate((input) => {
      input.value = '20';
    });
    await page.locator('#shot-incoming-speed').dispatchEvent('input');
    assert.match(await page.locator('#shot-stats').innerText(), /перенос \+[1-9]/);
    await page.locator('#shot-kind').selectOption('drive');
    await page.locator('#shot-soft').check();
    assert.equal(await page.locator('#shot-number-SpeedMin').isDisabled(), true);
    assert.equal(await page.locator('#shot-automatic-controls').isVisible(), false);
    await page.locator('#shot-mode').selectOption('serve');
    await page.waitForFunction(
      () => document.querySelector('#shot-timing-map').children.length === 71,
    );
    await page.keyboard.press('Escape');

    await page.locator('#test-mode').click();
    await page.waitForFunction(async () => {
      const { match } = await import('/src/main.js');
      return match.mode === 'test' && match.players.filter((p) => !p.benched).length === 1;
    });
    assert.equal(
      await page.evaluate(async () => (await import('/src/main.js')).match.serveAction),
      null,
    );

    await page.locator('#club-tour-mode').click();
    assert.match(await page.locator('#club-hud-title').innerText(), /Гул улиц/);
    await page.evaluate(async () => {
      const { match } = await import('/src/main.js');
      for (let i = 0; i < 7; i++) {
        match.phase = 'rally';
        match.point(0, 'Проверка результата');
        if (match.phase !== 'finished') match.startServe();
      }
    });
    await page.waitForFunction(() => !document.querySelector('#finish-overlay').hidden);
    assert.equal(await page.locator('#winner-label').innerText(), 'ЭТАП ПРОЙДЕН!');
    await page.locator('#club-next').click();
    await page.waitForFunction(
      () => document.querySelector('#club-hud-title').textContent === 'Стена мегаполиса',
    );
    await page.locator('#match-mode').click();
    assert.equal(await page.locator('#club-hud').isVisible(), false);
    await page.locator('#fullscreen').click();
    await page.waitForFunction(
      () =>
        document.fullscreenElement?.id === 'arena' && document.querySelector('#game').width > 960,
    );
    const fullSize = await page.evaluate(() => {
      const c = document.querySelector('#game'),
        box = c.getBoundingClientRect();
      return {
        width: c.width,
        height: c.height,
        cssWidth: box.width,
        cssHeight: box.height,
        dpr: devicePixelRatio,
      };
    });
    assert.ok(Math.abs(fullSize.width - fullSize.cssWidth * fullSize.dpr) < 2);
    assert.ok(Math.abs(fullSize.height - fullSize.cssHeight * fullSize.dpr) < 2);
    await page.locator('#game').screenshot({ path: '.cache/fullscreen-feedback.png' });
    await page.evaluate(() => document.exitFullscreen());
    await page.waitForFunction(() => document.querySelector('#game').width === 960);

    // Simulated hardware uses the same Gamepad API polling as physical controllers.
    await page.evaluate(() => {
      window.testPads = [0, 1].map((index) => ({
        index,
        id: `Standard test pad ${index}`,
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })),
      }));
      navigator.getGamepads = () => window.testPads;
    });
    await page.locator('#coop-mode').click();
    await page.waitForFunction(async () => (await import('/src/main.js')).match.mode === 'coop');
    await page.evaluate(async () => {
      const { match } = await import('/src/main.js');
      match.phase = 'rally';
      Object.assign(match.ball, { x: -4, y: 20, vx: 0, vy: 0 });
      window.testPads[0].buttons[3] = { pressed: true, value: 1 };
      window.testPads[1].buttons[1] = { pressed: true, value: 1 };
    });
    await page.waitForFunction(async () => {
      const { match } = await import('/src/main.js');
      return (
        match.controls[0].charge?.kind === 'loft' && match.controls[2].charge?.kind === 'drive'
      );
    });
    await page.evaluate(() =>
      window.testPads.forEach((p) =>
        p.buttons.forEach((b) => {
          b.pressed = false;
          b.value = 0;
        }),
      ),
    );

    const old = await page.request.get(base + '/versions/dynamic-v3/index.html?view=shots', {
      maxRedirects: 0,
    });
    assert.equal(old.status(), 302);
    assert.equal(old.headers().location, '/index.html?view=shots');
    assert.equal(
      (await page.request.get(base + '/versions/frozen-v2-2026-10-12/index.html')).status(),
      200,
    );
    assert.equal((await page.request.get(base + '/.git/config')).status(), 403);
    assert.deepEqual(errors, []);
  },
);
