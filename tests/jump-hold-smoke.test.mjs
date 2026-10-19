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

test('holding through ascent charges the configured maximum, preserving height and flight slopes', () => {
  const held = jumping(),
    base = jumping({ jumpHoldHang: 0 });
  let original, heldLand, baseLand;
  for (let i = 0; i < 150; i++) {
    const input = i < 55 ? { jump: true } : {};
    held.tick(FIXED_DT, input);
    base.tick(FIXED_DT, input);
    const p = held.active(),
      q = base.active();
    if (i === 0) original = { ...q.jumpProfile };
    if ((i + 1) * FIXED_DT < original.windup + original.rise) {
      assert.equal(p.y, q.y);
      assert.equal(p.vy, q.vy);
    }
    if (p.jumpProfile && i > 4) {
      assert.ok(
        Math.abs(p.jumpProfile.hang - original.hang - (p.jumpButtonHold.bonus || 0)) < 1e-9,
      );
      for (const key of ['height', 'rise', 'fall', 'windup'])
        assert.equal(p.jumpProfile[key], original[key]);
    }
    if (i > 0 && !p.jumpProfile) heldLand ??= (i + 1) * FIXED_DT;
    if (i > 0 && !q.jumpProfile) baseLand ??= (i + 1) * FIXED_DT;
  }
  assert.equal(held.active().jumpButtonHold.power, 1);
  assert.equal(held.active().jumpButtonHold.bonus, held.config.jumpHoldHang);
  assert.ok(Math.abs(heldLand - baseLand - held.config.jumpHoldHang) <= FIXED_DT);
});

test('a release before the threshold cannot qualify later, even after repressing in flight', () => {
  const m = jumping({ jumpHoldThreshold: 0.08, jumpHoldHang: 0.15 });
  m.tick(FIXED_DT, { jump: true });
  const duration = jumpDuration(m.active().jumpProfile);
  for (let i = 0; i < 3; i++) m.tick(FIXED_DT, { jump: true });
  m.tick(FIXED_DT, {});
  for (let i = 0; i < 20; i++) m.tick(FIXED_DT, { jump: true });
  assert.equal(jumpDuration(m.active().jumpProfile), duration);
  assert.equal(m.active().jumpButtonHold.applied, false);
});

test('co-op second controller owns its own hold bonus; CPU and block jumps stay unchanged', () => {
  const m = jumping();
  m.reset('coop');
  m.phase = 'rally';
  Object.assign(m.ball, { x: 5, y: 20, vx: 0, vy: 0 });
  const p = m.players[m.coopPlayer(2)];
  for (let i = 0; i < 5; i++) m.tick(FIXED_DT, {}, { jump: true });
  assert.equal(p.jumpButtonHold?.slot, 2);
  assert.equal(p.jumpButtonHold?.applied, true);
  for (const block of [false, true]) {
    const other = jumping();
    const q = other.active();
    other.jump(q, block);
    const duration = jumpDuration(q.jumpProfile);
    for (let i = 0; i < 10; i++) other.animatePlayers(FIXED_DT);
    assert.equal(jumpDuration(q.jumpProfile), duration);
    assert.equal(q.jumpButtonHold, null);
  }
});

test('longer jump holds produce increasing real hang bonuses and release freezes each charge', () => {
  let previousBonus = -1;
  for (const frames of [1, 6, 16, 25, 32]) {
    const m = jumping();
    const baseHang = m.config.jumpHang;
    for (let frame = 0; frame < frames; frame++) m.tick(FIXED_DT, { jump: true });
    m.tick(FIXED_DT);
    const p = m.active();
    const bonus = p.jumpButtonHold.bonus || 0;
    const hang = p.jumpProfile.hang;
    assert.ok(bonus > previousBonus, frames + ': hold duration must matter');
    assert.ok(Math.abs(hang - baseHang - bonus) < 1e-9, 'bonus changes actual jump duration');
    assert.ok(bonus <= m.config.jumpHoldHang);
    for (let frame = 0; frame < 8; frame++) m.tick(FIXED_DT, { jump: true });
    assert.equal(p.jumpButtonHold.bonus || 0, bonus, 'repressing cannot restart the charge');
    if (p.jumpProfile) assert.equal(p.jumpProfile.hang, hang);
    previousBonus = bonus;
  }
});

test('full jump charge takes two thirds of ascent and adds ninety milliseconds at the apex', () => {
  const m = jumping();
  m.tick(FIXED_DT, { jump: true });
  const p = m.active();
  const profile = { ...p.jumpProfile };
  const ascent = profile.windup + profile.rise;
  let previousTime = p.jumpTime;
  for (let frame = 0; frame < 120 && p.jumpButtonHold.power !== 1; frame++) {
    previousTime = p.jumpTime;
    m.tick(FIXED_DT, { jump: true });
  }
  assert.equal(p.jumpButtonHold.power, 1);
  assert.ok(previousTime < ascent / 1.5);
  assert.ok(Math.abs(p.jumpTime - ascent / 1.5) <= FIXED_DT);
  assert.ok(p.jumpTime < ascent, 'full charge is available before the apex');
  assert.equal(p.jumpButtonHold.bonus, 0.09);
  assert.ok(Math.abs(p.jumpProfile.hang - profile.hang - 0.09) < 1e-9);
  for (const key of ['height', 'rise', 'fall', 'windup'])
    assert.equal(p.jumpProfile[key], profile[key]);
});

test('a long configured hold threshold cannot prevent full charge at the shorter deadline', () => {
  const m = jumping({ jumpHoldThreshold: 0.3 });
  for (let frame = 0; frame < 40; frame++) m.tick(FIXED_DT, { jump: true });
  assert.equal(m.active().jumpButtonHold.power, 1);
  assert.equal(m.active().jumpButtonHold.bonus, m.config.jumpHoldHang);
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
  assert.equal(config.jumpHoldHang, 0.25);
  assert.equal(config.smokeTrailOpacity, 0.35);
  assert.equal(config.smokeTrailLife, 2);
});
