import { openSettingsSection, settleSettings } from './settings-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

test(
  'zones: seven choices, saved selection, fresh layers, shared court, frozen scenery and live details',
  { timeout: 60000 },
  async (t) => {
    const server = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('../../', import.meta.url),
      env: { ...process.env, PORT: '0' },
      windowsHide: true,
    });
    t.after(() => server.kill());
    const base = await new Promise((r, j) => {
      server.on('error', j);
      server.stdout.on('data', (d) => {
        const u = d.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
        if (u) r(u);
      });
    });
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await openSettingsSection(page, 'Арены');
    assert.equal(await page.locator('[data-arena]').count(), 7);
    for (const id of ['miami', 'beach', 'gym', 'farm', 'alpine', 'sky', 'championship']) {
      await page.locator(`[data-arena="${id}"]`).click();
      await settleSettings(page);
      assert.equal(await page.locator(`[data-arena="${id}"]`).getAttribute('aria-pressed'), 'true');
    }
    await page.keyboard.press('Escape');
    await page.reload();
    await openSettingsSection(page, 'Арены');
    assert.equal(
      await page.locator('[data-arena="championship"]').getAttribute('aria-pressed'),
      'true',
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.locator('#ambience-dialog').evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
    );
    await page.locator('[data-arena="sky"]').click();
    await settleSettings(page);
    const results = await page.evaluate(async () => {
      const { Renderer } = await import('/src/renderer.js');
      const { drawZoneSpectator, CROWD_WARDROBES } = await import('/src/zone-crowd.js');
      const { Match } = await import('/src/engine.js');
      const { ARENAS } = await import('/src/arenas.js');
      const { drawZoneLife, ZONES, drawZoneSky } = await import('/src/zone-scene.js');
      const { configuredTeam } = await import('/src/teams.js');
      const { courtLineBounds } = await import('/src/court-visual.js');
      const canvas = () => {
        const c = document.createElement('canvas');
        c.width = 960;
        c.height = 540;
        return c;
      };
      const output = canvas();
      const reused = new Renderer(output),
        buffers = [reused.background, reused.frontLayer, reused.cityLayer];
      const hash = (c) => {
        let v = 2166136261;
        for (const p of c.getContext('2d').getImageData(0, 0, 960, 540).data)
          v = Math.imul(v ^ p, 16777619);
        return v >>> 0;
      };
      const frames = [],
        bounds = [],
        live = [],
        frozen = [];
      for (const id of Object.keys(ARENAS)) {
        const m = new Match({ arenaTheme: id, livelyBackground: false, pixelGraphics: false });
        m.time = 5;
        m.phase = 'rally';
        m.noticeTime = 0;
        const teams = [configuredTeam(m.config), configuredTeam(m.config, 1)];
        reused.draw(m, teams, 0);
        const a = hash(output);
        const fresh = canvas();
        new Renderer(fresh).draw(m, teams, 0);
        frames.push([id, a, hash(fresh)]);
        bounds.push(courtLineBounds(m.config));
        if (Object.hasOwn(ZONES, id)) {
          const x = canvas(),
            y = canvas();
          const a = x.getContext('2d'),
            b = y.getContext('2d');
          drawZoneSky(a, id, 0);
          drawZoneSky(b, id, 0);
          drawZoneLife(a, id, 0, true);
          drawZoneLife(b, id, 9, true);
          live.push([id, hash(x) !== hash(y)]);
          a.clearRect(0, 0, 960, 540);
          b.clearRect(0, 0, 960, 540);
          drawZoneSky(a, id, 0);
          drawZoneSky(b, id, 0);
          drawZoneLife(a, id, 0, false);
          drawZoneLife(b, id, 9, false);
          frozen.push([id, hash(x) === hash(y)]);
        }
      }
      const crowds = [];
      for (const id of Object.keys(CROWD_WARDROBES)) {
        const a = canvas(),
          b = canvas();
        drawZoneSpectator(a.getContext('2d'), id, 0, 100, 100, { live: false, time: 0 });
        drawZoneSpectator(b.getContext('2d'), id, 0, 100, 100, { live: false, time: 30 });
        crowds.push([id, hash(a), hash(b)]);
      }
      const winter = canvas(),
        winterCtx = winter.getContext('2d');
      drawZoneSpectator(winterCtx, 'alpine', 0, 100, 100, { live: false });
      const winterLeg = Array.from(winterCtx.getImageData(94, 114, 1, 1).data);
      return {
        crowds,
        winterLeg,
        frames,
        bounds,
        live,
        frozen,
        sameBuffers: buffers.every(
          (b, i) => b === [reused.background, reused.frontLayer, reused.cityLayer][i],
        ),
      };
    });
    for (const [id, reused, fresh] of results.frames)
      assert.equal(reused, fresh, id + ' retains pixels from previous zone');
    assert.equal(new Set(results.frames.map((x) => x[1])).size, 7);
    for (const b of results.bounds) assert.deepEqual(b, results.bounds[0]);
    for (const [id, changed] of results.live) assert.ok(changed, id + ' live detail');
    for (const [id, same] of results.frozen) assert.ok(same, id + ' frozen detail');
    assert.ok(results.sameBuffers);
    assert.equal(
      new Set(results.crowds.map((x) => x[1])).size,
      6,
      'each venue has its own spectator wardrobe',
    );
    for (const [id, a, b] of results.crowds) assert.equal(a, b, id + ' frozen spectator');
    assert.deepEqual(results.winterLeg, [70, 91, 121, 255], 'winter legs are covered by trousers');
    assert.deepEqual(errors, []);
  },
);
