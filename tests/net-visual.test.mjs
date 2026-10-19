import test from 'node:test';
import assert from 'node:assert/strict';
import { netVisual } from '../src/net-visual.js';
import { drawArenaBackdrop } from '../src/arenas.js';
import { STREET_SEATS } from '../src/street-scene.js';
test('net ripple resets safely when the match clock rewinds or a new rally removes the impact', () => {
  const hit = { serial: 1, speed: 20, direction: 1 };
  let state = netVisual(null, hit, 100);
  state = netVisual(state, hit, 100.1);
  assert.ok(Math.abs(state.wave) > 0);
  state = netVisual(state, undefined, 0);
  assert.equal(state.wave, 0);
  assert.equal(state.impact, null);
  state = netVisual(state, hit, 0.1);
  assert.equal(state.wave, 0);
  state = netVisual(state, hit, 0);
  assert.equal(state.wave, 0);
  assert.ok(Number.isFinite(state.wave));
});
test('copied replay impacts do not restart the net ripple and the motion stays bounded', () => {
  let state = null;
  const hit = { serial: 3, speed: 100, direction: -1 };
  for (let i = 0; i < 180; i++) {
    state = netVisual(state, { ...hit }, i / 60);
    assert.equal(state.impact.at, 0);
    assert.ok(Math.abs(state.wave) <= 13);
    assert.ok(Number.isFinite(state.wave));
  }
  assert.equal(state.wave, 0);
  state = netVisual(state, { ...hit, serial: 4 }, 3);
  assert.equal(state.impact.at, 3);
});
test('street audience seats have concrete terraces or balconies beneath every spectator', () => {
  const rects = [];
  const c = {
    fillRect: (...args) => rects.push(args),
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    arc() {},
    fill() {},
    fillText() {},
  };
  drawArenaBackdrop(c, 'miami');
  for (const [x, y] of STREET_SEATS) {
    const foot = y + 23;
    assert.ok(
      rects.some(
        ([rx, ry, w, h]) => rx <= x - 5 && rx + w >= x + 5 && ry <= foot + 2 && ry + h >= foot,
      ),
      `seat ${x},${y} needs a supporting ledge`,
    );
  }
});
