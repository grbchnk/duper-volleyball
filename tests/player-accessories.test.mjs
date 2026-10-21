import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAppearance, HEAD_GROUPS, HEAD_STYLES } from '../src/appearance.js';
import { SHOE_STYLES, JERSEY_PRINTS } from '../src/player-accessories.js';
import { SQUARE_HEAD_DESIGNS, paintSpecialHead } from '../src/special-heads.js';
import { Match } from '../src/engine.js';
import { paintBody, frameOf, BODY_CLIPS } from '../src/sprites.js';
import { capture, restore } from '../src/replay.js';
import { exportSettings, importSettings } from '../src/settings-file.js';
import { TEAMS } from '../src/teams.js';

const appearance = sanitizeAppearance({ head: 'crop' });
const team = { color: '#80bda8', dark: '#4f8576', light: '#c9e5cd' };
test('all opponent clubs use varied, curated footwear by default', () => {
  for (const preset of TEAMS) {
    const m = new Match({ awayTeam: preset.id });
    assert.deepEqual(
      m.players.slice(3).map((p) => p.appearance),
      preset.roster,
    );
    assert.ok(new Set(preset.roster.map((p) => p.shoes)).size >= 2);
    for (const p of preset.roster) assert.ok(Object.hasOwn(SHOE_STYLES, p.shoes));
  }
});
test('retired glasses are discarded from old imports and cannot render from replay appearances', () => {
  const old = { ...appearance, eyewear: 'square', eyewearColor: '#364755' };
  const cleaned = sanitizeAppearance(old);
  assert.equal(Object.hasOwn(cleaned, 'eyewear'), false);
  assert.equal(Object.hasOwn(cleaned, 'eyewearColor'), false);
  assert.equal(picture(old, 'head'), picture(cleaned, 'head'));
});
function picture(p, layer = 'all', frame = frameOf('idle')) {
  const pixels = new Map();
  const c = {
    fillRect(x, y, w, h) {
      assert.ok([x, y, w, h].every(Number.isInteger));
      assert.ok(x >= -32 && x + w <= 32 && y >= -54 && y + h <= 10, 'Sprite clipped');
      for (let dx = x; dx < x + w; dx++)
        for (let dy = y; dy < y + h; dy++) pixels.set(`${dx},${dy}`, this.fillStyle);
    },
  };
  paintBody(c, frame, 'club', team, 0, layer, p);
  return JSON.stringify([...pixels].sort());
}
test('accessories are independent per player and survive JSON, points, and replay without changing physics', () => {
  const m = new Match();
  const initial = m.players.map((p) => p.appearance);
  const state = { seed: m.seed, ball: { ...m.ball }, time: m.time, score: [...m.score] };
  const roster = initial.slice(0, 3).map((p) => ({ ...p }));
  Object.assign(roster[1], {
    shoes: 'high',
    shoeColor: '#ee967d',
    jerseyPrint: 'number2',
    printColor: '#fff6e1',
  });
  m.updateConfig({
    ...m.config,
    customTeamAppearance: true,
    randomTeamAppearance: false,
    teamPlayers: roster,
  });
  assert.equal(m.players[1].appearance.jerseyPrint, 'number2');
  assert.equal(m.players[0].appearance.head, initial[0].head);
  assert.equal(m.players[2].appearance.head, initial[2].head);
  assert.deepEqual({ seed: m.seed, ball: m.ball, time: m.time, score: m.score }, state);
  const edited = m.players.map((p) => ({ ...p.appearance }));
  assert.deepEqual(
    new Match(importSettings(exportSettings(m.config))).players.map((p) => p.appearance),
    edited,
  );
  const snapshot = capture(m);
  m.reset();
  restore(m, snapshot);
  assert.deepEqual(
    m.players.map((p) => p.appearance),
    edited,
  );
  m.startServe();
  assert.deepEqual(
    m.players.map((p) => p.appearance),
    edited,
  );
  const bad = sanitizeAppearance({
    shoes: 'invalid',
    jerseyPrint: 'invalid',
    shoeColor: 'red',
    printColor: 'red',
  });
  assert.equal(bad.shoes, 'classic');
  assert.equal(bad.jerseyPrint, 'none');
  assert.equal(bad.shoeColor, '#fff6e1');
});
test('every shoe and print has a distinct rendering on its own layer and fits every animation frame', () => {
  for (const [property, variants, layer] of [
    ['shoes', SHOE_STYLES, 'feet'],
    ['jerseyPrint', JERSEY_PRINTS, 'torso'],
  ]) {
    const images = new Set();
    for (const id of Object.keys(variants)) {
      const p = { ...appearance, [property]: id };
      images.add(picture(p, layer));
      for (const [state, clip] of Object.entries(BODY_CLIPS))
        for (let index = 0; index < clip.frames.length; index++)
          picture(p, layer, { state, index, pose: clip.frames[index] });
      for (const other of ['head', 'feet', 'torso'].filter((l) => l !== layer))
        assert.equal(picture(p, other), picture(appearance, other));
    }
    assert.equal(
      images.size,
      Object.keys(variants).length,
      property + ' must be visually distinct',
    );
  }
});
test('ten new heads and pumpkin have a filled square face with no side bulges', () => {
  assert.equal(Object.keys(SQUARE_HEAD_DESIGNS).length, 10);
  for (const head of [...Object.keys(SQUARE_HEAD_DESIGNS), 'pumpkin']) {
    const pixels = new Set();
    paintSpecialHead(
      (x, y, w, h) => {
        for (let dx = x; dx < x + w; dx++)
          for (let dy = y; dy < y + h; dy++) pixels.add(`${dx},${dy}`);
      },
      head,
      '#654537',
      '#625343',
    );
    for (let y = -36; y <= -22; y++) {
      for (let x = -7; x <= 7; x++)
        assert.ok(pixels.has(`${x},${y}`), `${head}: missing square face pixel`);
      for (const x of [-10, -9, -8, 8, 9, 10])
        assert.equal(pixels.has(`${x},${y}`), false, head + ' bulges');
    }
  }
});
test('head categories partition the catalogue: hairstyles, headwear, square characters', () => {
  assert.deepEqual(
    HEAD_GROUPS.map((g) => g.id),
    ['hair', 'headwear', 'characters'],
  );
  const all = HEAD_GROUPS.flatMap((g) => g.heads);
  assert.equal(new Set(all).size, HEAD_STYLES.length);
  assert.equal(all.length, HEAD_STYLES.length);
  const hats = HEAD_GROUPS.find((g) => g.id === 'headwear').heads;
  for (const id of [
    'bucket',
    'straw',
    'ushanka',
    'pompom',
    'backwardcap',
    'headscarf',
    'durag',
    'crown',
    'spacehelmet',
  ])
    assert.ok(hats.includes(id));
  const hair = HEAD_GROUPS.find((g) => g.id === 'hair').heads;
  for (const id of ['ponytail', 'braids', 'surfer', 'topknot']) assert.ok(hair.includes(id));
  for (const id of Object.keys(SQUARE_HEAD_DESIGNS)) assert.ok(HEAD_GROUPS[2].heads.includes(id));
});
