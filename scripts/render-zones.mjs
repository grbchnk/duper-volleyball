import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const output = process.argv[2] || '.cache/zones';
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['server.mjs'], {
  env: { ...process.env, PORT: '0' },
  windowsHide: true,
});
let browser;
try {
  const base = await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.stdout.on('data', (d) => {
      const url = d.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url) resolve(url);
    });
  });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/zone-preview', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body style="margin:0;background:#fffdf5"></body></html>',
    }),
  );
  await page.goto(base + '/zone-preview');
  const ids = await page.evaluate(async () => {
    const { Match } = await import('/src/engine.js');
    const { Renderer } = await import('/src/renderer.js');
    const { ARENAS } = await import('/src/arenas.js');
    const { configuredTeam } = await import('/src/teams.js');
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    canvas.style.cssText = 'display:block;width:1280px;height:720px;image-rendering:pixelated';
    document.body.append(canvas);
    const renderer = new Renderer(canvas);
    window.zonePreview = { renderer, canvas, Match, ARENAS, configuredTeam };
    window.zoneImages = [];
    return Object.keys(ARENAS);
  });
  for (const id of ids) {
    await page.evaluate((id) => {
      const { renderer: r, canvas, Match, configuredTeam } = window.zonePreview;
      const m = new Match({ arenaTheme: id, skin: 'club', pixelGraphics: false });
      m.phase = 'rally';
      m.mode = 'demo';
      m.time = 8;
      m.noticeTime = 0;
      m.score = [3, 2];
      m.players.forEach((p, i) =>
        Object.assign(p, { x: [-8, -5, -2, 2, 5, 8][i], y: 0, vx: 0, facing: i < 3 ? 1 : -1 }),
      );
      Object.assign(m.ball, { x: 3.4, y: 3.1, vx: 0, vy: 0 });
      r.draw(m, [configuredTeam(m.config), configuredTeam(m.config, 1)], 0);
      window.zoneImages.push({ id, data: canvas.toDataURL() });
    }, id);
    await page.screenshot({ path: `${output}/${id}.png` });
  }
  const gallery = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 1440;
    c.height = 1720;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fffdf5';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    for (const [i, item] of window.zoneImages.entries()) {
      const img = new Image();
      img.src = item.data;
      await img.decode();
      const x = (i % 2) * 720,
        y = Math.floor(i / 2) * 430;
      ctx.drawImage(img, x, y, 720, 405);
      ctx.fillStyle = '#43564a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(window.zonePreview.ARENAS[item.id].name, x + 12, y + 423);
    }
    return c.toDataURL().split(',')[1];
  });
  await writeFile(`${output}/gallery.png`, Buffer.from(gallery, 'base64'));
  if (errors.length) throw Error(errors.join('\n'));
  process.stdout.write(JSON.stringify({ zones: ids, output }) + '\n');
} finally {
  await browser?.close();
  server.kill();
}
