import test from 'node:test';
import assert from 'node:assert/strict';
import { netVisual } from '../src/net-visual.js';
import { spectatorPlace, drawArenaBackdrop } from '../src/arenas.js';
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
    assert.ok(Math.abs(state.wave) <= 3.5);
    assert.ok(Number.isFinite(state.wave));
  }
  assert.equal(state.wave, 0);
  state = netVisual(state, { ...hit, serial: 4 }, 3);
  assert.equal(state.impact.at, 3);
});
test('Miami audience seats have a boardwalk and supports beneath every seated spectator', () => {
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
  assert.ok(rects.some((r) => r.join(',') === '0,319,960,54'));
  for (let i = 0; i < 18; i++) {
    const { x, y, groundY } = spectatorPlace(i);
    assert.ok(groundY <= 373);
    assert.ok(rects.some((r) => r.join(',') === [x - 13, y + 12, 28, 4].join(',')));
    assert.ok(rects.some((r) => r.join(',') === [x - 10, y + 15, 3, 11].join(',')));
  }
});
