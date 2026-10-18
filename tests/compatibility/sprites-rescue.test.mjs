import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKINS, BODY_CLIPS, frameOf, playerFrame, paintBody } from '../../src/sprites.js';
import { TEAMS, FIXED_DT, sanitizeConfig } from '../../src/config.js';
import { Match } from './legacy-contract.js';
const ticks = (m, n, input = {}) => {
  for (let i = 0; i < n; i++) m.tick(FIXED_DT, input);
};
function setup() {
  const m = new Match();
  m.startDrill('receive');
  m.players[0].x = -5;
  m.ball = { ...m.ball, x: 5, y: 12, vx: 0, vy: 0 };
  return m;
}
function bodyPixels(skin, frame = frameOf('idle')) {
  const pixels = new Map(),
    c = {
      fillStyle: '',
      fillRect(x, y, w, h) {
        assert.ok([x, y, w, h].every(Number.isInteger));
        for (let a = x; a < x + w; a++)
          for (let b = y; b < y + h; b++) pixels.set(`${a},${b}`, this.fillStyle);
      },
    };
  paintBody(c, frame, skin, TEAMS[0]);
  return pixels;
}
test('three distinct pixel skins, default without ears, exactly one with ears; saves retain choices', () => {
  assert.equal(Object.keys(SKINS).length, 3);
  assert.equal(SKINS[DEFAULTS.skin].ears, false);
  assert.deepEqual(
    Object.keys(SKINS).filter((k) => SKINS[k].ears),
    ['fox'],
  );
  const signatures = new Set();
  for (const skin of Object.keys(SKINS)) {
    signatures.add(JSON.stringify([...bodyPixels(skin)]));
    assert.equal(sanitizeConfig(JSON.parse(JSON.stringify({ ...DEFAULTS, skin }))).skin, skin);
  }
  assert.equal(signatures.size, 3);
  assert.equal(sanitizeConfig({ skin: 'missing' }).skin, 'club');
  const upper = (skin) =>
    Math.min(...[...bodyPixels(skin).keys()].map((k) => Number(k.split(',')[1])));
  assert.ok(upper('fox') < upper('club'));
  assert.ok(upper('fox') < upper('street'));
});
test('body has explicit pixel frames with stable holds, real pose changes and looping run cycle', () => {
  assert.ok(Object.keys(BODY_CLIPS).length >= 14);
  for (const [state, clip] of Object.entries(BODY_CLIPS)) {
    assert.ok(clip.frames.length >= 2);
    const hashes = clip.frames.map((_, i) =>
      JSON.stringify([...bodyPixels('club', frameOf(state, (i + 0.1) / clip.fps))]),
    );
    assert.ok(new Set(hashes).size > 1, state);
    assert.deepEqual(frameOf(state, 0.001), frameOf(state, 0.01));
  }
  assert.equal(frameOf('run', 6 / 12).index, 0);
  assert.equal(frameOf('land', 99).index, 3);
  const m = setup(),
    p = m.active();
  m.jump(p);
  assert.equal(playerFrame(p, m).state, 'crouch');
  ticks(m, 18);
  assert.equal(playerFrame(p, m).state, 'jump');
});
test('both directional dives include one forearm reception without A/W/D, then disarm', () => {
  for (const direction of [-1, 1]) {
    const m = setup(),
      p = m.active();
    m.tick(FIXED_DT, { dive: true, axis: direction });
    ticks(m, 8, { axis: -direction });
    assert.equal(p.diving, true);
    assert.equal(p.diveArmed, true);
    assert.equal(Math.sign(p.diveVelocity), direction);
    Object.assign(m.ball, { x: p.x + direction * 1.8, y: 0.7, vx: 0, vy: 0 });
    m.tick();
    assert.equal(m.contacts, 1);
    assert.equal(p.contact.kind, 'low');
    assert.equal(p.diveArmed, false);
    assert.ok(m.ball.vy > 0);
    m.cooldown = 0;
    m.lastTouch = 1;
    m.lastPlayer = 3;
    Object.assign(m.ball, { x: p.x + direction * 1.8, y: 0.7, vx: 0, vy: 0 });
    m.tick();
    assert.equal(m.contacts, 1);
  }
});
test('rescue requires timing and a low ball ahead of the hands, never behind or on the other court', () => {
  for (const direction of [-1, 1]) {
    const m = setup(),
      p = m.active();
    m.dive(p, direction);
    Object.assign(m.ball, { x: p.x + direction * 1.8, y: 0.7 });
    assert.equal(m.tryDiveContacts(), false);
    p.diveAge = 0.1;
    Object.assign(m.ball, { x: p.x - direction, y: 0.7 });
    assert.equal(m.tryDiveContacts(), false);
    Object.assign(m.ball, { x: p.x + direction * 1.8, y: 2 });
    assert.equal(m.tryDiveContacts(), false);
    p.x = -0.32;
    Object.assign(m.ball, { x: 0.1, y: 0.7 });
    assert.equal(m.tryDiveContacts(), false);
  }
});
test('dive commits direction, cannot be steered or spammed and clears on landing and restart', () => {
  const m = setup(),
    p = m.active();
  m.tick(FIXED_DT, { dive: true, axis: -1 });
  const start = p.x;
  ticks(m, 15, { dive: true, axis: 1 });
  assert.ok(p.x < start);
  assert.equal(p.diveVelocity, -DEFAULTS.diveSpeed);
  assert.equal(m.dive(p, 1), false);
  ticks(m, 50, { dive: true, axis: 1 });
  assert.equal(p.diving, false);
  assert.equal(p.diveArmed, false);
  assert.ok(p.recovery > 0);
  const x = p.x;
  assert.equal(m.dive(p, 1), false);
  ticks(m, 10, { axis: 1 });
  assert.equal(p.x, x);
  m.startServe();
  assert.equal(p.diveArmed, false);
  assert.equal(p.diveAge, 0);
});
test('dive cancels the old charge and transfers fresh shot input to the teammate', () => {
  const m = setup(),
    p = m.active();
  m.tick(FIXED_DT, { low: true });
  assert.ok(m.charge);
  m.tick(FIXED_DT, { low: true, dive: true, axis: 1 });
  assert.equal(m.charge, null);
  assert.equal(m.pending, null);
  m.tick();
  m.tick(FIXED_DT, { drive: true });
  assert.notEqual(m.active().id, p.id);
  assert.equal(m.charge.playerId, m.active().id);
  assert.equal(p.diveArmed, true);
});
test('forward/back drills are playable, and skin choice leaves their physics identical', () => {
  for (const drill of ['dive-forward', 'dive-back']) {
    let baseline;
    for (const skin of Object.keys(SKINS)) {
      const m = new Match({ ...DEFAULTS, skin });
      m.reset('practice');
      m.startDrill(drill);
      ticks(m, 12);
      m.tick(FIXED_DT, { dive: true, axis: drill === 'dive-forward' ? 1 : -1 });
      ticks(m, 80);
      assert.equal(m.contacts, 1);
      const result = [m.ball.x, m.ball.y, m.ball.vx, m.ball.vy];
      if (baseline) assert.deepEqual(result, baseline);
      else baseline = result;
    }
  }
});

test('release keeps the prepared body until contact, including the former 0.65-second gap', () => {
  for (const kind of ['low', 'loft', 'drive']) {
    const m = setup(),
      p = m.active();
    m.charge = { playerId: p.id, kind, age: 0.52 };
    const before = playerFrame(p, m);
    m.charge = null;
    m.pending = { playerId: p.id, kind };
    for (const age of [0, 0.01, 0.059]) {
      p.armSwing = { kind, age, hit: false };
      assert.deepEqual(playerFrame(p, m), before);
    }
    m.pending = null;
    p.armSwing.age = 0.08;
    assert.deepEqual(playerFrame(p, m), before);
  }
});

test('run legs sweep backward under a forward-facing torso; getup finishes in neutral stance', () => {
  const run = BODY_CLIPS.run.frames;
  assert.ok(run[0].l > run[1].l && run[1].l > run[2].l);
  assert.deepEqual(BODY_CLIPS.getup.frames.at(-1), BODY_CLIPS.idle.frames[0]);
  const m = setup(),
    p = m.active();
  p.recoveryTotal = 0.92;
  p.recovery = 0.501;
  assert.equal(playerFrame(p, m).state, 'belly');
  p.recovery = 0.499;
  assert.equal(playerFrame(p, m).index, 0);
  p.recovery = 0.001;
  assert.equal(playerFrame(p, m).index, 5);
});
