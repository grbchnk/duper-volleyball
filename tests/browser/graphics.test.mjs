import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

test(
  'graphics: live scenery, stationary layers, sprite shadows and full-resolution players',
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
      const { collideNet } = await import('/src/physics.js');
      const { DEFAULTS } = await import('/src/config.js');
      const { courtLineBounds, COURT_VIEW } = await import('/src/court-visual.js');
      const { armContour, drawOpenArm } = await import('/src/arm-contour.js');
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const r = new Renderer(canvas),
        m = new Match({ ...DEFAULTS, arenaTheme: 'miami' });
      const armCanvas = document.createElement('canvas');
      armCanvas.width = armCanvas.height = 80;
      const armContext = armCanvas.getContext('2d');
      const straightArm = armContour({ x: 40, y: 15 }, { x: 40, y: 35 }, { x: 40, y: 60 }, 12);
      drawOpenArm(armContext, straightArm, 12, '#ffbb88', '#111111', '#227766');
      const sampleArm = (x, y) => Array.from(armContext.getImageData(x, y, 1, 1).data);
      const openShoulder = sampleArm(40, 15).slice(0, 3).join() === '34,119,102';
      const noShoulderDisc = sampleArm(40, 13)[3] === 0;
      const sleeveFollowsArm =
        sampleArm(40, 24).slice(0, 3).join() === '34,119,102' &&
        sampleArm(40, 56).slice(0, 3).join() === '255,187,136';
      const edge = sampleArm(34, 24);
      const outlinedSides = Math.max(...edge.slice(0, 3)) < 45 && edge[3] > 240;
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
      const fixedFront = equal(frontBefore, pixels(r.ctx, 780, 510, 99, 29));
      const fixedCity = equal(farBefore, pixels(r.ctx, 530, 180, 70, 60));
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
      // Verify actual net pixels, not only the ripple state: the one-metre mesh
      // hangs above the floor and a real swept collision visibly deforms it.
      const destination = r.ctx;
      r.ctx = r.foregroundContext;
      r.ctx.clearRect(0, 0, 960, 540);
      m.time = 0;
      m.ball.netImpact = null;
      r.drawNet(m);
      const meshBefore = pixels(r.ctx, 470, 360, 24, 50);
      const gap = pixels(r.ctx, 478, 416, 4, 28);
      const clearUnderNet = gap.every((v, i) => i % 4 !== 3 || v === 0);
      const meshAboveTape = pixels(r.ctx, 480, 349, 1, 6);
      const alignedTape = meshAboveTape.every((v, i) => i % 4 !== 3 || v === 0);
      const previousBall = { x: -1, y: 1.9, z: 4.5, vx: 90, vy: -2, spin: 0 };
      const hitBall = { ...previousBall, x: 1 };
      const sweptCollision = collideNet(hitBall, previousBall, DEFAULTS.restitution, DEFAULTS);
      m.ball.netImpact = hitBall.netImpact;
      r.drawNet(m);
      m.time = 0.06;
      r.ctx.clearRect(0, 0, 960, 540);
      r.drawNet(m);
      const visibleImpact = !equal(meshBefore, pixels(r.ctx, 470, 360, 24, 50));
      r.ctx = destination;
      const boundaryPixel = pixels(
        r.background.getContext('2d'),
        Math.round(r.project(courtLineBounds(m.config).right).x),
        COURT_VIEW.floor,
        1,
        1,
      );
      const alignedEndLine =
        boundaryPixel[0] === 243 && boundaryPixel[1] === 220 && boundaryPixel[2] === 192;
      // Sprites and the rig use the same logical contact coordinates at full screen.
      canvas.width = 1920;
      canvas.height = 1080;
      render();
      const nativePlayerResolution = r.actor.width === 360 && r.actor.height === 400;
      const nativeShadowResolution = r.shadow.width === 360 && r.shadow.height === 400;
      const crispCompositing = !r.foregroundContext.imageSmoothingEnabled;
      canvas.width = 2560;
      canvas.height = 1440;
      render();
      const fractionalResolution = r.actor.width === 480 && r.actor.height === 534;
      const support = { finite: true };
      for (const rig of r.armRigs.values())
        for (const w of rig.wrists) support.finite &&= Number.isFinite(w.x) && Number.isFinite(w.y);
      const depthCanvas = document.createElement('canvas');
      depthCanvas.width = 960;
      depthCanvas.height = 540;
      const depthRenderer = new Renderer(depthCanvas);
      const depthMatch = new Match();
      depthMatch.phase = 'rally';
      depthMatch.mode = 'demo';
      depthMatch.noticeTime = 0;
      depthMatch.config.pixelGraphics = false;
      for (const player of depthMatch.players) player.benched = true;
      const leftPlayer = depthMatch.players[0],
        rightPlayer = depthMatch.players[3];
      Object.assign(leftPlayer, { x: -1, benched: false });
      Object.assign(rightPlayer, { x: 1, benched: false });
      const originalPlayerDraw = depthRenderer.drawPlayer;
      depthRenderer.drawPlayer = function (player) {
        this.ctx.fillStyle = player.x < 0 ? '#ff00ff' : '#00ffff';
        this.ctx.fillRect(460, 300, 40, 200);
      };
      depthRenderer.drawBall = () => {};
      depthRenderer.draw(depthMatch, teams);
      const frontPixel = pixels(depthRenderer.ctx, 480, 363, 1, 1);
      const leftInFront = frontPixel[0] === 255 && frontPixel[1] === 0 && frontPixel[2] === 255;
      leftPlayer.benched = true;
      depthRenderer.draw(depthMatch, teams);
      const backPixel = pixels(depthRenderer.ctx, 480, 363, 1, 1);
      const rightBehind = backPixel[0] !== 0 || backPixel[1] !== 255 || backPixel[2] !== 255;
      depthRenderer.drawPlayer = originalPlayerDraw;
      rightPlayer.number = 1;
      depthRenderer.armRigs.clear();
      depthRenderer.draw(depthMatch, teams);
      const firstNumber = pixels(depthRenderer.actorContext, 0, 0, 180, 200);
      rightPlayer.number = 8;
      depthRenderer.armRigs.clear();
      depthRenderer.draw(depthMatch, teams);
      const noChestNumber = equal(firstNumber, pixels(depthRenderer.actorContext, 0, 0, 180, 200));
      rightPlayer.appearance.headShape = 'round';
      depthRenderer.armRigs.clear();
      depthRenderer.draw(depthMatch, teams);
      const oldRoundIsSquare = equal(
        firstNumber,
        pixels(depthRenderer.actorContext, 0, 0, 180, 200),
      );
      depthMatch.updateConfig({ ...depthMatch.config, randomArms: true });
      const profile = (rightPlayer.armProfile = { armBend: 1.5, elbowHeight: -12 });
      profile.armBend = 1.5;
      profile.elbowHeight = -12;
      depthRenderer.armRigs.clear();
      depthRenderer.draw(depthMatch, teams);
      const lowElbows = pixels(depthRenderer.actorContext, 0, 0, 180, 200);
      profile.elbowHeight = 12;
      depthRenderer.armRigs.clear();
      depthRenderer.draw(depthMatch, teams);
      const individualArmsIgnored = equal(
        lowElbows,
        pixels(depthRenderer.actorContext, 0, 0, 180, 200),
      );
      const stableProfile = JSON.stringify(profile);
      for (let frame = 0; frame < 10; frame++) depthRenderer.draw(depthMatch, teams);
      const individualArmsStable = JSON.stringify(rightPlayer.armProfile) === stableProfile;
      return {
        individualArmsIgnored,
        individualArmsStable,
        leftInFront,
        rightBehind,
        noChestNumber,
        oldRoundIsSquare,
        openShoulder,
        noShoulderDisc,
        sleeveFollowsArm,
        outlinedSides,
        followsBall: !equal(left, right),
        celebrates: !equal(right, goal),
        distinctTeams: !equal(goal, otherGoal),
        freezes: equal(frozen, stillFrozen),
        fixedCourt,
        fixedBuilding,
        fixedFront,
        fixedCity,
        clearUnderNet,
        alignedTape,
        sweptCollision,
        visibleImpact,
        alignedEndLine,
        nativePlayerResolution,
        nativeShadowResolution,
        crispCompositing,
        fractionalResolution,
        armsChangeShadow: !equal(idleShadow, setShadow),
        exactSilhouette,
        separatedJump,
        finiteRig: support.finite,
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
