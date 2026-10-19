import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { openSettingsSection, settleSettings } from './settings-helpers.mjs';

test(
  'both feint variants persist in the live UI and render a real fake followed by a real attack',
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base);
    await openSettingsSection(page, 'Матч и управление');
    const selector = page.locator('#dynamic-feint');
    assert.equal(await selector.inputValue(), 'manual');
    await selector.selectOption('queued');
    await settleSettings(page);
    await page.reload();
    await openSettingsSection(page, 'Матч и управление');
    assert.equal(await selector.inputValue(), 'queued');
    await selector.selectOption('manual');
    await settleSettings(page);
    await page.screenshot({ path: '.cache/feint-options-review.png', fullPage: true });
    assert.deepEqual(errors, []);

    const galleryPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await galleryPage.route('**/feint-review', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html></html>' }),
    );
    await galleryPage.goto(`${base}/feint-review`);
    const results = await galleryPage.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { shotImpulse } = await import('/src/moves.js');
      const { aimOf } = await import('/src/controllers.js');
      const { DEFAULTS, FIXED_DT, TEAMS } = await import('/src/config.js');
      const { jumpProfile } = await import('/src/motion.js');
      const sheet = document.createElement('canvas');
      sheet.width = 1920;
      sheet.height = 1080;
      const gallery = sheet.getContext('2d');
      const results = [];
      for (const [column, mode] of ['manual', 'queued'].entries()) {
        const m = new Match({ ...DEFAULTS, feintMode: mode, assist: false, approachAssist: false });
        m.reset('versus');
        m.phase = 'rally';
        m.noticeTime = 0;
        m.lastTouch = 1;
        m.lastPlayer = 3;
        m.selected[0] = 1;
        m.players[0].x = -6;
        const passer = m.players[1];
        Object.assign(m.ball, { x: passer.x, y: 2.1, vx: 0, vy: 0 });
        const aim = aimOf({ l2: true, r2: true });
        aim.controlledIds = [1];
        const impulse = shotImpulse(m.ball, passer, 'loft', 0.9, aim, m.players, m.config);
        m.makeContact(passer, 'loft', 0.9, impulse);
        const run = m.teamRuns[0];
        const attacker = m.players[run.playerId];
        const decoy = m.players[run.decoyId];
        const j = jumpProfile(m.config);
        const jumpAt = run.at - j.windup - j.rise;
        const canvas = document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 540;
        const renderer = new Renderer(canvas);
        let captured = false,
          manualJump = false;
        for (let frame = 0; frame < 240 && m.contacts === 1 && m.phase === 'rally'; frame++) {
          const input = {};
          if (mode === 'queued') {
            if (frame < 18) Object.assign(input, { drive: true, buttonVector: { x: 1, y: 0.25 } });
          } else {
            if (!manualJump && Math.abs(attacker.x - run.x) > 0.08)
              input.axis = Math.sign(run.x - attacker.x);
            if (!manualJump && m.time >= jumpAt) {
              input.jump = true;
              manualJump = true;
            }
            if (m.time >= run.at - 0.3 && m.time < run.at - 0.15)
              Object.assign(input, { drive: true, buttonVector: { x: 1, y: 0.25 } });
          }
          m.tick(FIXED_DT, input);
          if (!captured && decoy.y > 1.2) {
            renderer.draw(m, TEAMS, FIXED_DT);
            gallery.drawImage(canvas, column * 960, 0);
            captured = true;
          }
        }
        renderer.draw(m, TEAMS, FIXED_DT);
        gallery.drawImage(canvas, column * 960, 540);
        results.push({
          mode,
          captured,
          contacts: m.contacts,
          hitter: m.lastPlayer,
          target: run.playerId,
          fakeJump: run.decoyJumped,
          automaticJump: !!run.attackJumped,
        });
      }
      document.body.style.margin = '0';
      document.body.replaceChildren(sheet);
      return results;
    });
    for (const result of results) {
      assert.equal(result.captured, true);
      assert.equal(result.contacts, 2, result.mode);
      assert.equal(result.hitter, result.target);
      assert.equal(result.fakeJump, true);
      assert.equal(result.automaticJump, result.mode === 'queued');
    }
    await galleryPage.screenshot({ path: '.cache/feint-variants-review.png', fullPage: true });
  },
);
