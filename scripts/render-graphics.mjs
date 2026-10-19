import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const output = process.argv[2] || '.cache/graphics';
const video = process.argv.includes('--video');
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['server.mjs'], {
  env: { ...process.env, PORT: '0' },
  windowsHide: true,
});
let browser;
try {
  const base = await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.stdout.on('data', (data) => {
      const url = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url) resolve(url);
    });
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    ...(video ? { recordVideo: { dir: output, size: { width: 1280, height: 720 } } } : {}),
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/graphics-preview', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body></body></html>',
    }),
  );
  await page.goto(`${base}/graphics-preview`);
  await page.evaluate(async () => {
    const { Match } = await import('/src/engine.js');
    const { Renderer } = await import('/src/renderer.js');
    const { TEAMS } = await import('/src/config.js');
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;padding:0;display:block;background:#1e2535';
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    canvas.style.cssText = 'display:block;width:1280px;height:720px';
    document.body.append(canvas);
    const match = new Match();
    match.mode = 'demo';
    match.phase = 'rally';
    match.time = 0;
    match.noticeTime = 0;
    match.players.forEach((p, i) => {
      p.x = [-8.6, -5.1, -1.8, 1.8, 5.1, 8.6][i];
      p.y = 0;
      p.vx = 0;
      p.facing = i < 3 ? 1 : -1;
      p.appearance = {
        tone: ['#d79b70', '#f4cfac', '#925b3d', '#f4cfac', '#925b3d', '#f4cfac'][i],
        head: ['fox', 'crop', 'cap', 'cap', 'band', 'bucket'][i],
        hair: '#302b32',
        body: 'classic',
        headShape: 'square',
      };
    });
    Object.assign(match.ball, { x: 5.1, y: 3.15, vx: 0, vy: 0 });
    const renderer = new Renderer(canvas);
    window.graphicsPreview = { match, renderer, teams: [TEAMS[0], TEAMS[1]] };
  });
  for (const pose of ['idle', 'set', 'block', 'dive', 'run', 'attack', 'cheer', 'serve']) {
    const result = await page.evaluate((pose) => {
      const { match: m, renderer: r, teams } = window.graphicsPreview;
      m.phase = 'rally';
      m.charge = null;
      for (const p of m.players) {
        p.block = 0;
        p.diving = false;
        p.y = 0;
        p.armSwing = null;
        p.contact = null;
        p.emotion = null;
        p.jumpProfile = null;
        p.vx = 0;
        p.recovery = 0;
        p.x = [-8.6, -5.1, -1.8, 1.8, 5.1, 8.6][p.id];
      }
      Object.assign(m.ball, { x: 5.1, y: 3.15, vx: 0, vy: 0 });
      const p = m.players[4];
      if (pose === 'set') {
        m.controls[1].charge = {
          playerId: p.id,
          kind: 'loft',
          power: 0.7,
          age: 0.2,
          aim: { axis: -1 },
        };
      } else m.controls[1].charge = null;
      if (pose === 'block') {
        m.players[3].block = 0.2;
        m.players[3].y = 1.1;
      }
      if (pose === 'dive') {
        p.diving = true;
        p.diveVelocity = -5;
        p.pose = 'dive';
        p.diveAge = 0.18;
        p.y = 0.2;
        p.animation = 0.15;
        Object.assign(m.ball, { x: 4.3, y: 0.4 });
      }
      if (pose === 'run') {
        m.players.forEach((p, i) => {
          p.vx = i < 3 ? 4 : -4;
          p.runTime = i * 0.07;
        });
      }
      if (pose === 'attack') {
        const hitter = m.players[1];
        hitter.y = 1.2;
        hitter.contact = { kind: 'drive', life: 0.1 };
        hitter.armSwing = {
          kind: 'drive',
          age: 0.04,
          power: 0.8,
          hit: true,
          at: 0,
          x: hitter.x + 0.5,
          y: 3.4,
          vx: 14,
          vy: -6,
        };
        Object.assign(m.ball, { x: hitter.x + 0.9, y: 3.25 });
      }
      if (pose === 'cheer') {
        m.phase = 'finished';
        m.pointWinner = 0;
        m.time = 0.3;
        for (const p of m.players)
          p.emotion = { kind: p.team ? 'sad' : 'cheer', age: 0.24, duration: 2 };
      }
      if (pose === 'serve') {
        m.startServe();
      }
      r.armRigs.clear();
      for (let i = 0; i < 24; i++) r.draw(m, teams, 1 / 60);
      const start = performance.now();
      for (let i = 0; i < 30; i++) r.draw(m, teams, 1 / 60);
      return { pose, msPerFrame: (performance.now() - start) / 30 };
    }, pose);
    await page.screenshot({ path: `${output}/${pose}.png` });
    console.log(JSON.stringify(result));
  }
  for (let group = 0; group < 2; group++) {
    await page.evaluate((group) => {
      const { match: m, renderer: r, teams } = window.graphicsPreview;
      const c = r.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = '#eadfc9';
      c.fillRect(0, 0, 960, 540);
      r.spriteScale = 9.3;
      m.phase = 'rally';
      m.time = 0;
      m.clearControls();
      const styles = [
        {
          head: 'fox',
          tone: '#b87950',
          title: 'Уличный новичок',
          number: 1,
          color: '#e87865',
          dark: '#b44e49',
          light: '#ffa792',
        },
        {
          head: 'cap',
          tone: '#f4cfac',
          title: 'Дворовой игрок',
          number: 3,
          color: '#429f93',
          dark: '#256b6c',
          light: '#91cbbb',
        },
        {
          head: 'bucket',
          tone: '#f4cfac',
          title: 'Курортный турист',
          number: 5,
          color: '#429f93',
          dark: '#256b6c',
          light: '#91cbbb',
        },
        {
          head: 'band',
          tone: '#925b3d',
          title: 'Городской стиль',
          number: 1,
          color: '#e28198',
          dark: '#b95372',
          light: '#f6a7b7',
        },
      ];
      for (let i = 0; i < 2; i++) {
        const style = styles[group * 2 + i];
        const p = m.players[i];
        Object.assign(p, {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          facing: 1,
          number: style.number,
          diving: false,
          recovery: 0,
          block: 0,
          contact: null,
          armSwing: null,
          jumpProfile: null,
          emotion: null,
          bodyMotion: null,
          appearance: {
            head: style.head,
            tone: style.tone,
            hair: '#302b32',
            body: 'classic',
            headShape: 'square',
          },
        });
        const x = 245 + i * 470;
        r.project = (_, y = 0) => ({ x, y: 423 - y * 42 });
        r.armRigs.clear();
        r.drawPlayer(
          p,
          {
            ...teams[['cap', 'bucket'].includes(style.head) ? 1 : 0],
            color: style.color,
            dark: style.dark,
            light: style.light,
          },
          m,
          0,
        );
        r.rect(x - 128, 451, 256, 4, style.color);
        r.text(style.title, x, 490, 22, '#435c68', 'center');
      }
    }, group);
    await page.screenshot({ path: `${output}/players-${group + 1}.png` });
  }
  await page.evaluate(async () => {
    const { HEAD_STYLES } = await import('/src/appearance.js');
    const { EXTRA_HEAD_STYLES } = await import('/src/head-styles.js');
    const { paintBody, frameOf } = await import('/src/sprites.js');
    const { renderer: r, teams } = window.graphicsPreview;
    const c = r.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#eadfc9';
    c.fillRect(0, 0, 960, 540);
    const labels = {
      cap: 'Кепка',
      fox: 'Лисья шапка',
      band: 'Повязка',
      crop: 'Короткая',
      bald: 'Без волос',
    };
    HEAD_STYLES.forEach((head, i) => {
      const x = (i % 8) * 120,
        y = Math.floor(i / 8) * 135;
      const team = teams[i % 2];
      c.save();
      c.translate(x + 60, y + 133);
      c.scale(2.4, 2.4);
      paintBody(c, frameOf('idle'), 'club', team, 0, 'head', {
        head,
        headShape: 'square',
        body: 'classic',
        tone: ['#f4cfac', '#d79b70', '#925b3d'][i % 3],
        hair: ['#302b32', '#654537', '#a76a3e', '#d7b46a'][i % 4],
      });
      c.restore();
      r.rect(x + 25, y + 99, 70, 2, team.color);
      r.text(
        EXTRA_HEAD_STYLES[head]?.name || labels[head],
        x + 60,
        y + 118,
        8,
        '#435c68',
        'center',
      );
    });
  });
  await page.screenshot({ path: `${output}/head-styles.png` });
  if (video) {
    await page.evaluate(async () => {
      const { match: m, renderer: r, teams } = window.graphicsPreview;
      r.spriteScale = 2.1;
      r.project = (x, y = 0) => ({ x: 480 + x * 40, y: 465 - y * 42 });
      m.reset('demo');
      m.noticeTime = 0;
      for (let i = 0; i < 420; i++) {
        await new Promise(requestAnimationFrame);
        m.tick(1 / 120);
        m.tick(1 / 120);
        for (const e of m.events.splice(0)) r.effect(e, m);
        r.draw(m, teams, 1 / 60);
      }
    });
    const recording = page.video();
    await page.close();
    await recording.saveAs(`${output}/motion.webm`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser?.close();
  server.kill();
}
