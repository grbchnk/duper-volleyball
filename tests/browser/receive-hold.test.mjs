import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

test(
  'receive hold slider and rendered hands follow a freely falling ball',
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
    await page.goto(base);
    const slider = page.locator('#physics-loftReceiveHoldTime');
    await slider.waitFor({ state: 'attached' });
    assert.equal(await slider.inputValue(), '0.08');
    assert.equal(await slider.getAttribute('max'), '0.25');
    await slider.evaluate((el) => {
      el.value = '0.12';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() =>
      document.getElementById('value-loftReceiveHoldTime').textContent.includes('0.12'),
    );
    assert.match(await page.locator('#value-loftReceiveHoldTime').textContent(), /0.12/);
    assert.equal(await page.locator('#physics-lowReceiveHoldTime').count(), 0);
    const results = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { preparedHands } = await import('/src/held-contact.js');
      const { TEAMS } = await import('/src/config.js');
      const results = [];
      for (const kind of ['loft']) {
        const m = new Match({ lowReceiveHoldTime: 0.08, loftReceiveHoldTime: 0.08 });
        m.startDrill('receive');
        const p = m.active();
        const a = { kind, playerId: p.id, age: 0.2, power: 0.5, aim: { axis: 1 } };
        m.controls[0].charge = a;
        Object.assign(m.ball, { x: p.x, y: kind === 'low' ? 0.9 : 2.1, vx: 0, vy: -1 });
        for (let i = 0; i < 5; i++) Object.assign(m.ball, preparedHands(p, m, a)[0]);
        m.tryHeldContact();
        const canvas = document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 540;
        const r = new Renderer(canvas);
        const positions = [];
        for (let i = 0; i < 3; i++) {
          r.drawPlayer(p, TEAMS[p.team], m, 1 / 60);
          const rig = r.armRigs.get(p.id);
          positions.push({ stage: rig.stage, wrists: rig.wrists.map(({ x, y }) => ({ x, y })) });
          m.ball.y -= 0.025;
        }
        results.push({ kind, positions, contacts: m.contacts });
      }
      return results;
    });
    for (const { positions, contacts } of results) {
      assert.equal(contacts, 0);
      for (const pose of positions) assert.equal(pose.stage, 'Сопровождение мяча');
      for (let hand = 0; hand < 2; hand++) {
        assert.ok(positions[1].wrists[hand].y > positions[0].wrists[hand].y);
        assert.ok(positions[2].wrists[hand].y > positions[1].wrists[hand].y);
      }
    }
    const farAway = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { TEAMS } = await import('/src/config.js');
      const m = new Match();
      m.reset('test');
      const p = m.active();
      m.controls[0].charge = {
        kind: 'loft',
        playerId: p.id,
        age: 1,
        power: 1,
        aim: { axis: 1 },
      };
      Object.assign(m.ball, { x: p.x + 0.5, y: 15, vx: 0, vy: 0 });
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const r = new Renderer(canvas);
      const poses = [];
      for (const max of [2.45, 3]) {
        m.config.loftContactMax = max;
        for (let frame = 0; frame < 180; frame++) r.drawPlayer(p, TEAMS[p.team], m, 1 / 60);
        const rig = r.armRigs.get(p.id);
        poses.push({ stage: rig.stage, wrists: rig.wrists.map(({ x, y }) => ({ x, y })) });
      }
      return poses;
    });
    for (const pose of farAway) {
      assert.equal(pose.stage, 'Подготовка');
      assert.ok(pose.wrists.every((w) => Number.isFinite(w.x) && Number.isFinite(w.y)));
    }
    for (let i = 0; i < 2; i++) {
      assert.ok(Math.abs(farAway[0].wrists[i].x - farAway[1].wrists[i].x) < 0.01);
      assert.ok(Math.abs(farAway[0].wrists[i].y - farAway[1].wrists[i].y) < 0.01);
    }
    const preparation = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { TEAMS, FIXED_DT } = await import('/src/config.js');
      const sheet = document.createElement('canvas');
      sheet.width = 960;
      sheet.height = 400;
      sheet.style.cssText = 'width:960px;height:400px;max-width:none;max-height:none;';
      const gallery = sheet.getContext('2d');
      gallery.fillStyle = '#f4f0e7';
      gallery.fillRect(0, 0, 960, 400);
      const results = [];
      for (const [row, kind] of ['loft'].entries()) {
        const m = new Match({ lowReceiveHoldTime: 0.08, loftReceiveHoldTime: 0.08 });
        m.reset('test');
        const p = m.active();
        Object.assign(m.ball, { x: p.x + 0.2, y: kind === 'low' ? 1.25 : 2.4, vx: 0, vy: 0 });
        const canvas = document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 540;
        const r = new Renderer(canvas);
        const states = [];
        for (let frame = 0; frame < 11; frame++) {
          m.tick(FIXED_DT, { [kind]: true });
          r.draw(m, TEAMS, FIXED_DT);
          if (![0, 4, 10].includes(frame)) continue;
          const rig = r.armRigs.get(p.id);
          states.push({ stage: rig.stage, y: rig.wrists[1].y, contacts: m.contacts });
          const column = states.length - 1;
          gallery.drawImage(canvas, column * 320, row * 200 + 20, 320, 180);
          gallery.fillStyle = '#364846';
          gallery.font = '12px sans-serif';
          gallery.fillText(kind + ' / ' + rig.stage, column * 320 + 8, row * 200 + 15);
        }
        results.push(states);
      }
      document.body.style.margin = '0';
      document.body.replaceChildren(sheet);
      return results;
    });
    for (const states of preparation) {
      assert.equal(states[0].stage, 'Подготовка');
      assert.equal(states[1].stage, 'Подготовка');
      assert.equal(states[2].stage, 'Сопровождение мяча');
      assert.ok(states.every((state) => state.contacts === 0));
      assert.ok(states[0].y > states[1].y);
      assert.ok(states[1].y > states[2].y);
    }
    await page.screenshot({ path: '.cache/receive-zone-preview.png' });
  },
);
