import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { jumpDuration } from '../src/motion.js';
import {
  beginBallSmoke,
  sampleBallSmoke,
  ageBallSmoke,
  MAX_SMOKE_POINTS,
} from '../src/ball-smoke.js';
import { captureScene } from '../src/replay.js';
import { challengeProfileKey } from '../src/records.js';

function jumping(extra = {}) {
  const m = new Match({ ...DEFAULTS, assist: false, jumpBallHang: 0, ...extra });
  m.reset('test');
  Object.assign(m.ball, { x: 5, y: 20, vx: 0, vy: 0 });
  return m;
}

test('a quick tap starts immediately and matches the existing jump on every frame', () => {
  const tap = jumping(),
    base = jumping({ jumpHoldHang: 0 });
  for (let i = 0; i < 150; i++) {
    const input = i === 0 ? { jump: true } : {};
    tap.tick(FIXED_DT, input);
    base.tick(FIXED_DT, input);
    if (i === 0) assert.ok(tap.active().jumpProfile, 'takeoff starts on the press');
    assert.equal(tap.active().y, base.active().y);
    assert.equal(tap.active().vy, base.active().vy);
  }
});

test('holding, tapping and repressing all use the same fixed jump without a charge state', () => {
  for (const frames of [1, 6, 16, 32, 55]) {
    const held = jumping({ jumpHoldHang: 0.25, variableJump: true }),
      tap = jumping();
    for (let i = 0; i < 110; i++) {
      held.tick(FIXED_DT, i < frames ? { jump: true } : {});
      tap.tick(FIXED_DT, i === 0 ? { jump: true } : {});
      assert.equal(held.active().y, tap.active().y);
      assert.equal(held.active().vy, tap.active().vy);
      assert.equal(held.active().jumpButtonHold, null);
    }
  }
});
test('strong attacks sample a stationary smoke path that survives reception and fades', () => {
  const m = jumping();
  const p = m.active();
  Object.assign(m.ball, { x: p.x, y: 3 });
  assert.equal(m.makeContact(p, 'drive', 0.9, { vx: 15, vy: 2, spin: 0 }), true);
  assert.equal(m.smokeTrail.length, 1);
  const startX = m.ball.x;
  m.tick(FIXED_DT);
  m.tick(FIXED_DT);
  assert.ok(m.ball.x > startX);
  assert.ok(m.smokeTrail.length > 1);
  const coordinates = m.smokeTrail.map(({ x, y }) => ({ x, y }));
  m.shotSerial++;
  m.ball.x += 1;
  sampleBallSmoke(m);
  ageBallSmoke(m, 0.2);
  assert.deepEqual(
    m.smokeTrail.map(({ x, y }) => ({ x, y })),
    coordinates,
  );
  assert.ok(m.smokeTrail.every((point) => point.life < point.duration));
  const frame = captureScene(m);
  assert.deepEqual(frame.smokeTrail, m.smokeTrail);
  ageBallSmoke(m, 3);
  assert.equal(m.smokeTrail.length, 0);
});

test('smoke is limited, optional, and only begins on a strong fast attack', () => {
  const m = jumping();
  Object.assign(m.ball, { x: -5, y: 3, vx: 15, vy: 2 });
  for (const [kind, power] of [
    ['low', 1],
    ['loft', 1],
    ['drive', 0.79],
  ]) {
    beginBallSmoke(m, kind, power);
    assert.equal(m.smokeShot, null);
  }
  m.ball.vx = 5;
  beginBallSmoke(m, 'drive', 1);
  assert.equal(m.smokeShot, null);
  m.ball.vx = 15;
  beginBallSmoke(m, 'drive', 1);
  for (let i = 0; i < 100; i++) {
    m.ball.x += 0.5;
    sampleBallSmoke(m);
  }
  assert.equal(m.smokeTrail.length, MAX_SMOKE_POINTS);
  m.config.smokeTrailOpacity = 0;
  ageBallSmoke(m, FIXED_DT);
  assert.equal(m.smokeShot, null);
  assert.equal(m.smokeTrail.length, 0);
  assert.equal(
    challengeProfileKey({ ...DEFAULTS, smokeTrailOpacity: 0, smokeTrailLife: 2 }),
    challengeProfileKey(DEFAULTS),
  );
});

test('new jump and smoke settings have bounded values', () => {
  const config = sanitizeConfig({
    jumpHoldThreshold: -1,
    jumpHoldHang: 9,
    smokeTrailOpacity: 1,
    smokeTrailLife: 9,
  });
  assert.equal(config.jumpHoldThreshold, 0.01);
  assert.equal(config.jumpHoldHang, 0);
  assert.equal(config.smokeTrailOpacity, 0.35);
  assert.equal(config.smokeTrailLife, 2);
});
