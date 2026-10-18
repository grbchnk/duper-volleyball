import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

test(
  'graphics: live scenery, fixed court, parallax, sprite shadows and contact rigs',
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
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/graphics-preview', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<html><body></body></html>',
      }),
    );
    await page.goto(`${base}/graphics-preview`);
    const results = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { TEAMS } = await import('/src/config.js');
      const { STREET_SEATS } = await import('/src/street-scene.js');
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const r = new Renderer(canvas),
        m = new Match();
      m.phase = 'rally';
      m.mode = 'demo';
      m.noticeTime = 0;
      const teams = [TEAMS[0], TEAMS[1]];
      const pixels = (c, x, y, w, h) => Array.from(c.getImageData(x, y, w, h).data);
      const equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
      const render = () => r.draw(m, teams, 1 / 60);
      const crowd = () => {
        r.ctx.clearRect(0, 0, 960, 540);
        r.drawStreetCrowd(m, teams);
        return pixels(r.ctx, 250, 280, 545, 100);
      };
      Object.assign(m.ball, { x: -8, y: 1 });
      const left = crowd();
      Object.assign(m.ball, { x: 8, y: 5 });
      const right = crowd();
      m.phase = 'point';
      m.pointWinner = 0;
      m.time = 0.3;
      const goal = crowd();
      m.pointWinner = 1;
      const otherGoal = crowd();
      m.config.livelyBackground = false;
      const frozen = crowd();
      Object.assign(m.ball, { x: -8, y: 1 });
      m.time = 9;
      const stillFrozen = crowd();
      m.config.livelyBackground = true;
      m.phase = 'rally';
      m.time = 0;
      for (let i = 0; i < 120; i++) render();
      const courtBefore = pixels(r.ctx, 302, 408, 35, 60);
      const buildingBefore = pixels(r.ctx, 109, 246, 48, 50);
      const frontBefore = pixels(r.ctx, 780, 510, 99, 29);
      const farBefore = pixels(r.ctx, 530, 180, 70, 60);
      Object.assign(m.ball, { x: 8, y: 6 });
      for (let i = 0; i < 120; i++) render();
      const fixedCourt = equal(courtBefore, pixels(r.ctx, 302, 408, 35, 60));
      const fixedBuilding = equal(buildingBefore, pixels(r.ctx, 109, 246, 48, 50));
      const movedFront = !equal(frontBefore, pixels(r.ctx, 780, 510, 99, 29));
      const movedCity = !equal(farBefore, pixels(r.ctx, 530, 180, 70, 60));
      const bounded = Math.abs(r.cameraOffset.x) <= 3.6 && Math.abs(r.cameraOffset.y) <= 1.8;
      const p = m.players[4];
      for (const player of m.players) player.benched = player !== p;
      p.x = 4;
      p.y = 0;
      p.vx = 0;
      m.controls[1].charge = null;
      r.armRigs.clear();
      render();
      const idleShadow = pixels(r.shadowContext, 0, 0, 180, 200);
      m.controls[1].charge = {
        playerId: p.id,
        kind: 'loft',
        power: 0.8,
        age: 0.2,
        aim: { axis: -1 },
      };
      r.armRigs.clear();
      render();
      const setShadow = pixels(r.shadowContext, 0, 0, 180, 200);
      const actor = pixels(r.actorContext, 0, 0, 180, 200);
      const exactSilhouette = setShadow.every(
        (value, index) => index % 4 !== 3 || value === actor[index],
      );
      const grounded = pixels(r.ctx, 540, 463, 160, 55);
      p.y = 1.5;
      render();
      const separatedJump = !equal(grounded, pixels(r.ctx, 540, 463, 160, 55));
      // Sprites and the rig use the same logical contact coordinates at full screen.
      canvas.width = 1920;
      canvas.height = 1080;
      render();
      const support = { finite: true };
      for (const rig of r.armRigs.values())
        for (const w of rig.wrists) support.finite &&= Number.isFinite(w.x) && Number.isFinite(w.y);
      // Cover the far arm with an opaque body, then paint the near arm. Verify
      // real pixels in both facing directions, including the mirrored pose.
      r.ctx.setTransform(1, 0, 0, 1, 0, 0);
      const occlusion = [-1, 1].every((dir) => {
        m.controls[1].charge = null;
        p.x = 0;
        p.y = 0;
        r.ctx.clearRect(0, 0, 960, 540);
        r.ctx.save();
        r.ctx.translate(480, 250);
        r.ctx.scale(dir * 3, 3);
        r.armRigs.clear();
        r.drawArms(p, m, 0, 0, null, () => {
          r.ctx.fillStyle = '#ff00ff';
          r.ctx.fillRect(-25, -60, 50, 60);
        });
        r.ctx.restore();
        const hands = r.armRigs.get(p.id).wrists;
        const near = pixels(
          r.ctx,
          Math.round(480 + dir * 3 * (hands[0].x - 2)),
          Math.round(250 + 3 * (hands[0].y - 1)),
          1,
          1,
        );
        const far = pixels(
          r.ctx,
          Math.round(480 + dir * 3 * (hands[1].x + 2)),
          Math.round(250 + 3 * (hands[1].y - 1)),
          1,
          1,
        );
        return (
          far[0] === 255 &&
          far[1] === 0 &&
          far[2] === 255 &&
          (near[0] !== 255 || near[1] !== 0 || near[2] !== 255)
        );
      });
      return {
        followsBall: !equal(left, right),
        celebrates: !equal(right, goal),
        distinctTeams: !equal(goal, otherGoal),
        freezes: equal(frozen, stillFrozen),
        fixedCourt,
        fixedBuilding,
        movedFront,
        movedCity,
        bounded,
        armsChangeShadow: !equal(idleShadow, setShadow),
        exactSilhouette,
        separatedJump,
        finiteRig: support.finite,
        farArmBehindBody: occlusion,
        seats: STREET_SEATS.length,
      };
    });
    for (const [name, value] of Object.entries(results)) {
      if (name === 'seats') assert.ok(value >= 12);
      else assert.equal(value, true, name);
    }
    assert.deepEqual(errors, []);
  },
);
