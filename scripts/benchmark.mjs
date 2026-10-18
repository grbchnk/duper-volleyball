import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('../', import.meta.url),
  env: { ...process.env, PORT: '0' },
  windowsHide: true,
});
let browser;
try {
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Server timeout')), 10000);
    server.on('error', reject);
    server.stdout.on('data', (data) => {
      const url = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url) {
        clearTimeout(timer);
        resolve(url);
      }
    });
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(base + '/guide.html');
  const results = await page.evaluate(async () => {
    const { Match } = await import('/src/engine.js');
    const { Renderer } = await import('/src/renderer.js');
    const { FIXED_DT, TEAMS } = await import('/src/config.js');
    const { capture, captureScene } = await import('/src/replay.js');
    const percentile = (samples, p) =>
      [...samples].sort((a, b) => a - b)[Math.floor((samples.length - 1) * p)];
    const results = [];
    for (const mode of ['demo', 'coop']) {
      const match = new Match();
      match.reset(mode);
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const renderer = new Renderer(canvas);
      const simulation = [],
        rendering = [];
      for (let frame = 0; frame < 1800; frame++) {
        if (mode === 'coop' && ['point', 'set-end', 'finished'].includes(match.phase)) {
          match.server = 1;
          match.startServe();
        }
        if (mode === 'coop' && match.phase === 'serve' && match.server === 0) {
          match.server = 1;
          match.startServe();
        }
        const a = performance.now();
        match.tick(FIXED_DT);
        match.tick(FIXED_DT);
        for (const event of match.events.splice(0)) renderer.effect(event, match);
        const b = performance.now();
        renderer.draw(match, TEAMS, 1 / 60);
        const c = performance.now();
        if (frame >= 120) {
          simulation.push(b - a);
          rendering.push(c - b);
        }
      }
      results.push({
        mode,
        samples: simulation.length,
        simulationP50Ms: percentile(simulation, 0.5),
        simulationP95Ms: percentile(simulation, 0.95),
        renderP50Ms: percentile(rendering, 0.5),
        renderP95Ms: percentile(rendering, 0.95),
        fullStateBytes: new TextEncoder().encode(JSON.stringify(capture(match))).length,
        sceneBytes: new TextEncoder().encode(JSON.stringify(captureScene(match))).length,
      });
    }
    return results;
  });
  const report = {
    environment: 'Headless Chromium; CPU work per synthetic 60 Hz frame, not screen FPS',
    results,
  };
  await mkdir(new URL('../.cache/', import.meta.url), { recursive: true });
  await writeFile(
    new URL('../.cache/benchmark.json', import.meta.url),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
