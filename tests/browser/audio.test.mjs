import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

test(
  'browser: real Web Audio renders gentle themes and distinct contacts without clipping',
  { timeout: 60000 },
  async (t) => {
    const server = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('../../', import.meta.url),
      env: { ...process.env, PORT: '0' },
      windowsHide: true,
    });
    t.after(() => server.kill());
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server did not start')), 10000);
      server.on('error', reject);
      server.stdout.on('data', (data) => {
        const url = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
        if (url) {
          clearTimeout(timer);
          resolve(url);
        }
      });
    });
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const NativeAudioContext = window.AudioContext;
      window.testAudioContexts = [];
      window.AudioContext = class extends NativeAudioContext {
        constructor(...args) {
          super(...args);
          window.testAudioContexts.push(this);
        }
      };
    });
    await page.goto(base);
    await page.waitForSelector('#club-sidebar');
    assert.equal(await page.locator('#sound-unlock').count(), 0);
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
    await page.locator('#start').click();
    await page.waitForFunction(() =>
      window.testAudioContexts.some((ctx) => ctx.state === 'running'),
    );
    await page.locator('#sound').click();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
    await page.reload();
    await page.waitForSelector('#club-sidebar');
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
    await page.locator('#sound').click();
    await page.waitForFunction(() =>
      window.testAudioContexts.some((ctx) => ctx.state === 'running'),
    );
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
    const results = await page.evaluate(async () => {
      const { Music, MUSIC_TRACKS, musicBar } = await import('/src/music.js');
      const { Sound } = await import('/src/audio.js');
      const measure = async (ctx) => {
        const buffer = await ctx.startRendering();
        let peak = 0,
          energy = 0;
        for (const sample of buffer.getChannelData(0)) {
          if (!Number.isFinite(sample)) throw Error('Invalid PCM');
          peak = Math.max(peak, Math.abs(sample));
          energy += sample * sample;
        }
        return { peak, energy };
      };
      const results = {};
      for (const [id, track] of Object.entries(MUSIC_TRACKS)) {
        const beat = 60 / track.bpm;
        const ctx = new OfflineAudioContext(1, Math.ceil((64 * beat + 1) * 22050), 22050);
        const music = new Music(ctx, ctx.destination);
        music.output.gain.value = 0.5;
        for (let bar = 0; bar < 16; bar++)
          for (const event of musicBar(id, bar)) music.note(event, bar * 4 * beat, beat);
        results[id] = await measure(ctx);
      }
      for (const [id, event] of [
        ['soft', { type: 'hit', kind: 'low', incomingSpeed: 3, power: 0.5 }],
        ['hard', { type: 'hit', kind: 'low', incomingSpeed: 19, power: 0.5 }],
        ['combo', { type: 'combination-preview' }],
        ['floor', { type: 'floor-touch', speed: 18 }],
      ]) {
        const ctx = new OfflineAudioContext(1, 44100, 22050);
        const sound = new Sound();
        sound.context = ctx;
        sound.master = ctx.destination;
        Object.defineProperty(sound, 'ready', { value: true });
        sound.play(event);
        results[id] = await measure(ctx);
      }
      return results;
    });
    for (const [id, result] of Object.entries(results)) {
      assert.ok(result.peak > 0.001 && result.peak < 0.35, `${id}: audible, with headroom`);
      assert.ok(result.energy > 0);
    }
    assert.ok(results.hard.energy > results.soft.energy * 1.5);
    assert.equal(
      await page
        .getByRole('button', { name: 'Приём → навес → удар', exact: true, includeHidden: true })
        .count(),
      1,
    );
  },
);
