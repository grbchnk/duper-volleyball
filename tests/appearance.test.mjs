import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { capture, captureScene, restore } from '../src/replay.js';
import {
  HEAD_STYLES,
  BODY_STYLES,
  SKIN_TONES,
  skinPalette,
  randomAppearance,
} from '../src/appearance.js';
import { paintBody, frameOf, BODY_CLIPS } from '../src/sprites.js';

test('skin outlines are darker than every skin tone and the weighted palette favours lighter tones', () => {
  for (const tone of SKIN_TONES) {
    const outline = skinPalette(tone).outline;
    for (const offset of [1, 3, 5])
      assert.ok(
        parseInt(outline.slice(offset, offset + 2), 16) <
          parseInt(tone.slice(offset, offset + 2), 16),
      );
  }
  const counts = new Map();
  for (let i = 0; i < 100; i++) {
    const tone = randomAppearance(() => (i + 0.5) / 100).tone;
    counts.set(tone, (counts.get(tone) || 0) + 1);
  }
  assert.deepEqual(
    SKIN_TONES.map((tone) => counts.get(tone)),
    [38, 32, 18, 7, 3, 2],
  );
  assert.ok(HEAD_STYLES.includes('cap') && HEAD_STYLES.includes('fox'));
});

test('all heads are square, including old round appearances from replays', () => {
  const team = { color: '#f00', dark: '#900', light: '#faa' };
  const render = (shape, layer) => {
    const pixels = new Set();
    const context = {
      fillRect(x, y, w, h) {
        for (let px = x; px < x + w; px++)
          for (let py = y; py < y + h; py++) pixels.add(`${px},${py}`);
      },
    };
    paintBody(context, frameOf('idle'), 'club', team, 0, layer, {
      head: 'bald',
      body: 'classic',
      tone: '#b87950',
      hair: '#302b32',
      headShape: shape,
    });
    return pixels;
  };
  assert.equal(render('square', 'head').has('-7,-22'), true);
  assert.deepEqual(render('round', 'head'), render('square', 'head'));
  assert.deepEqual(render('square', 'torso'), render('round', 'torso'));
});

test('every hairstyle is distinct, preserves the eyes and fits animated head sprite bounds', () => {
  assert.ok(HEAD_STYLES.length >= 30);
  const team = { color: '#ee967d', dark: '#bc645d', light: '#ffd0a4' };
  const pictures = new Set();
  for (const head of HEAD_STYLES) {
    const appearance = {
      head,
      body: 'classic',
      headShape: 'square',
      tone: '#f4cfac',
      hair: '#302b32',
    };
    const pixels = new Map();
    const c = {
      fillRect(x, y, w, h) {
        assert.ok([x, y, w, h].every(Number.isInteger));
        assert.ok(x >= -32 && x + w <= 32 && y >= -54 && y + h <= 10, `${head} clipped`);
        for (let px = x; px < x + w; px++)
          for (let py = y; py < y + h; py++) pixels.set(`${px},${py}`, this.fillStyle);
      },
    };
    paintBody(c, frameOf('idle'), 'club', team, 0, 'head', appearance);
    const ink = skinPalette(appearance.tone).outline;
    for (const x of [-3, -2, 3, 4])
      for (let y = -29; y < -26; y++) assert.equal(pixels.get(`${x},${y}`), ink);
    pictures.add(JSON.stringify([...pixels].sort()));
    for (const [state, clip] of Object.entries(BODY_CLIPS))
      for (let i = 0; i < clip.frames.length; i++)
        paintBody(
          c,
          { state, index: i, pose: clip.frames[i] },
          'club',
          team,
          0,
          'head',
          appearance,
        );
  }
  assert.equal(pictures.size, HEAD_STYLES.length);
});

test('player appearance survives points, playback and retry without consuming physics randomness', () => {
  const match = new Match();
  const initial = match.players.map((p) => ({ ...p.appearance }));
  for (const p of match.players) assert.equal(p.appearance.headShape, 'square');
  for (const a of initial) {
    assert.ok(HEAD_STYLES.includes(a.head));
    assert.ok(BODY_STYLES.includes(a.body));
    assert.ok(SKIN_TONES.includes(a.tone));
  }
  const snapshot = capture(match);
  assert.deepEqual(
    captureScene(match).players.map((p) => p.appearance),
    initial,
  );
  const seed = match.seed;
  match.reset();
  assert.equal(match.seed, seed);
  assert.notEqual(match.players[0].appearance, snapshot.players[0].appearance);
  restore(match, snapshot);
  assert.deepEqual(
    match.players.map((p) => p.appearance),
    initial,
  );
});
