import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { openBrowserGame } from './settings-helpers.mjs';

test(
  'new arm poses, sleeveless kits and diamond net render with finite joints',
  { timeout: 60000 },
  async (t) => {
    const { page } = await openBrowserGame(t, { width: 1440, height: 1000 });
    const result = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { configuredTeam } = await import('/src/teams.js');
      const { serveMotion, sampleServeMotion } = await import('/src/motion.js');
      document.body.replaceChildren();
      document.body.style.cssText = 'margin:0;background:#edf1df';
      const sheet = document.createElement('canvas');
      sheet.width = 1440;
      sheet.height = 850;
      document.body.append(sheet);
      const output = sheet.getContext('2d');
      output.fillStyle = '#edf1df';
      output.fillRect(0, 0, sheet.width, sheet.height);
      let finite = true;
      const cases = [
        ['Атака · обычно', 'drive', {}, false],
        ['Атака · R2', 'drive', { fast: true }, false],
        ['Верхний пас · обычно', 'loft', {}, false],
        ['Верхний пас · L2 · две руки', 'loft', { soft: true }, false],
        ['Нижняя подача · без рукавов', 'low', {}, true],
        ['Нижняя подача · рукава', 'low', {}, true],
      ];
      for (let index = 0; index < cases.length; index++) {
        const [label, kind, aim, serve] = cases[index];
        const canvas = document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 540;
        const renderer = new Renderer(canvas, { scene: false });
        renderer.spriteScale = 6;
        renderer.project = (x, y = 0) => ({ x: 480 + x * 120, y: 445 - y * 120 });
        const m = new Match();
        m.reset('versus');
        m.phase = 'rally';
        const p = m.players[0];
        p.x = -1;
        p.facing = 1;
        p.appearance = { ...p.appearance, body: index === 4 ? 'sleeveless' : 'classic' };
        Object.assign(m.ball, { x: p.x + 0.1, y: 2.4, vx: 0, vy: 0 });
        if (serve) {
          m.phase = 'serve-motion';
          m.server = 0;
          m.serveAction = { ...serveMotion(p, { kind, power: 0.8, aim }, m.config), hand: 1 };
          m.phaseTime = 0.4;
          Object.assign(m.ball, sampleServeMotion(p, m.serveAction, m.phaseTime));
        } else m.controls[0].charge = { kind, power: 0.85, age: 0.2, playerId: p.id, aim };
        renderer.ctx.fillStyle = '#edf1df';
        renderer.ctx.fillRect(0, 0, 960, 540);
        for (let frame = 0; frame < 30; frame++)
          renderer.drawPlayer(p, configuredTeam(m.config, 0), m, 1 / 60);
        const rig = renderer.armRigs.get(p.id);
        finite &&= rig.wrists.every(
          (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
        );
        const x = (index % 3) * 480,
          y = Math.floor(index / 3) * 360;
        output.drawImage(canvas, 240, 90, 480, 450, x, y + 40, 480, 320);
        output.fillStyle = '#304e44';
        output.font = '18px sans-serif';
        output.fillText(label, x + 20, y + 30);
      }
      const netCanvas = document.createElement('canvas');
      netCanvas.width = 960;
      netCanvas.height = 540;
      const net = new Renderer(netCanvas, { scene: false });
      const m = new Match();
      net.drawNet(m);
      output.drawImage(netCanvas, 445, 290, 70, 140, 1100, 500, 210, 350);
      return finite;
    });
    assert.equal(result, true);
    await mkdir('.cache/settings-review', { recursive: true });
    await page.screenshot({ path: '.cache/settings-review/action-visuals.png', fullPage: true });
  },
);
