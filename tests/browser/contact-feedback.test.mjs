import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

test(
  'contacts use a single small ring without flash or sparks; landing rings show in and out',
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
    await page.route('**/feedback-check', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html></html>' }),
    );
    await page.goto(`${base}/feedback-check`);
    const result = await page.evaluate(async () => {
      const { Match } = await import('/src/engine.js');
      const { Renderer } = await import('/src/renderer.js');
      const { TEAMS } = await import('/src/config.js');
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const r = new Renderer(canvas),
        m = new Match();
      m.phase = 'rally';
      m.mode = 'demo';
      m.noticeTime = 0;
      m.config.ballFire = false;
      m.config.trajectory = false;
      for (const p of m.players) p.benched = true;
      Object.assign(m.ball, { x: 1, y: 2, vx: 2, vy: 0 });
      const whites = () => {
        const data = r.ctx.getImageData(510, 370, 20, 20).data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4)
          if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) count++;
        return count;
      };
      r.draw(m, TEAMS, 0);
      const before = whites();
      r.effect({ type: 'hit', kind: 'low', comboStage: 1, x: 0, y: 2 }, m);
      r.draw(m, TEAMS, 0);
      const flashed = whites();
      r.draw(m, TEAMS, 0.2);
      r.draw(m, TEAMS, 0);
      const expired = whites();
      const stageCounts = [],
        colors = new Set();
      for (const [stage, kind] of ['low', 'loft', 'drive'].entries()) {
        r.particles = [];
        r.impacts = [];
        r.effect({ type: 'hit', kind, comboStage: stage + 1, x: 0, y: 2 }, m);
        stageCounts.push(r.particles.length);
        colors.add(r.impacts[0].color);
      }
      const floorCanvas = document.createElement('canvas');
      floorCanvas.width = 200;
      floorCanvas.height = 100;
      const floor = floorCanvas.getContext('2d');
      const ellipses = [];
      const ellipse = floor.ellipse.bind(floor);
      floor.ellipse = (...args) => {
        ellipses.push(args);
        ellipse(...args);
      };
      const originalProject = r.project;
      r.ctx = floor;
      r.project = (x, y = 0) => ({ x: 100 + x, y: 70 - y });
      r.effect({ type: 'floor-touch', x: 0, speed: 7 }, m);
      r.drawFloorRipples(0.15);
      const firstRadius = ellipses[0][2];
      r.effect({ type: 'feed' }, m);
      const survivesFeed = r.floorRipples.length === 1;
      m.ball.x = 1000;
      ellipses.length = 0;
      floor.clearRect(0, 0, 200, 100);
      r.drawFloorRipples(0);
      const grows = ellipses[0][2] > firstRadius;
      const anchored = ellipses.every((args) => args[0] === 100 && args[1] === 70);
      r.drawFloorRipples(1);
      floor.clearRect(0, 0, 200, 100);
      r.drawFloorRipples(0);
      const floorExpires = floor.getImageData(0, 0, 200, 100).data.every((v) => v === 0);
      r.impacts = [];
      r.particles = [];
      const arcs = [];
      const arc = floor.arc.bind(floor);
      floor.arc = (...args) => {
        arcs.push(args);
        arc(...args);
      };
      r.effect({ type: 'hit', kind: 'low', x: 0, y: 2 }, m);
      r.drawParticles(0.04);
      r.drawParticles(0.04);
      const smallRing = arcs.length === 2 && arcs[1][2] > arcs[0][2] && arcs[1][2] < 25;
      r.drawParticles(0.2);
      r.drawParticles(0);
      const quickExpiry = r.impacts.length === 0;
      r.floorRipples = [];
      r.effect({ type: 'floor-touch', x: 0, speed: 7, out: true }, m);
      floor.clearRect(0, 0, 200, 100);
      r.drawFloorRipples(0);
      const red = floor.getImageData(106, 70, 1, 1).data;
      const redOut = red[0] > red[1] * 1.5 && red[0] > red[2] * 1.5;
      r.floorRipples = [];
      r.effect({ type: 'floor-touch', x: 0, speed: 7, out: false }, m);
      floor.clearRect(0, 0, 200, 100);
      r.drawFloorRipples(0);
      const white = floor.getImageData(106, 70, 1, 1).data;
      const whiteGoal = white[0] === 255 && white[1] === 255 && white[2] === 255;
      r.ctx = canvas.getContext('2d');
      r.project = originalProject;
      const sheet = document.createElement('canvas');
      sheet.width = 1440;
      sheet.height = 810;
      const gallery = sheet.getContext('2d');
      gallery.imageSmoothingEnabled = false;
      for (let i = 0; i < 4; i++) {
        r.impacts = [];
        r.particles = [];
        r.floorRipples = [];
        for (const p of m.players) p.benched = false;
        Object.assign(m.ball, {
          x: i === 3 ? 4 : -4 + i * 4,
          y: i === 3 ? 0.105 : 2.3,
          vx: 2,
          vy: 0,
        });
        const kind = ['low', 'loft', 'drive'][i];
        r.effect(
          i === 3
            ? { type: 'floor-touch', x: 4, speed: 8 }
            : { type: 'hit', kind, comboStage: i + 1, x: m.ball.x, y: m.ball.y },
          m,
        );
        for (let frame = 0; frame < (i === 3 ? 10 : 3); frame++)
          r.draw(m, [TEAMS[0], TEAMS[1]], 1 / 60);
        gallery.drawImage(canvas, (i % 2) * 720, Math.floor(i / 2) * 405, 720, 405);
      }
      document.body.style.margin = '0';
      document.body.replaceChildren(sheet);
      return {
        noFlash: flashed === before && expired === before,
        grows,
        anchored,
        floorExpires,
        survivesFeed,
        noSparks: stageCounts.every((count) => count === 0),
        smallRing,
        quickExpiry,
        redOut,
        whiteGoal,
        distinct: colors.size === 3,
      };
    });
    for (const [key, value] of Object.entries(result)) assert.equal(value, true, key);
    await page.locator('canvas').screenshot({ path: '.cache/contact-feedback-review.png' });
  },
);
