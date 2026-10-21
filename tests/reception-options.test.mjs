import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { shotImpulse } from '../src/moves.js';
import {
  reflectedReception,
  applyReceptionError,
  receptionErrorSeed,
} from '../src/neutral-reception.js';
import { captureScene } from '../src/replay.js';

const speed = (v) => Math.hypot(v.vx, v.vy);
const angle = (v) => Math.atan2(v.vy, v.vx);
const delta = (a, b) => Math.atan2(Math.sin(angle(a) - angle(b)), Math.cos(angle(a) - angle(b)));
function scene(config = {}) {
  const m = new Match({ ...DEFAULTS, ...config });
  m.reset('versus');
  m.phase = 'rally';
  m.lastTouch = 1;
  m.lastPlayer = 3;
  m.incomingShot = 'drive';
  m.selected[0] = 2;
  m.players[0].x = -7;
  m.players[1].x = -3.7;
  m.players[2].x = -0.8;
  Object.assign(m.ball, { x: -5.9, y: 3.2, vx: -2.6, vy: 0 });
  return m;
}
for (const transfer of [true, false])
  for (const type of ['charge', 'pending'])
    test(`missed airborne attack: ${type} transfer ${transfer}`, () => {
      const m = scene({ transferShotOnSwitch: transfer });
      m.jump(m.players[2]);
      const c = m.controls[0];
      c[type] = { kind: 'drive', playerId: 2, age: 0.1, power: 0.5, ttl: 0.2, aim: {} };
      m.players[2].armSwing = { kind: 'drive', age: 0.1, hit: false };
      c.previousInput = { drive: true };
      m.tick(FIXED_DT, { drive: true });
      assert.equal(m.selected[0], 0);
      assert.ok(m.players[2].jumpProfile, 'jump is not cancelled');
      if (transfer) {
        assert.equal(c[type].playerId, 0);
        assert.ok(c[type].power >= 0.5);
      } else {
        assert.equal(c.charge, null);
        assert.equal(c.pending, null);
        assert.equal(c.chargeLock, true);
        assert.equal(m.players[0].armSwing, null);
        m.tick(FIXED_DT, { drive: true });
        assert.equal(c.charge, null);
        m.tick(FIXED_DT, {});
        m.tick(FIXED_DT, { drive: true });
        assert.equal(c.charge.playerId, 0);
      }
    });
test('co-op cancels or transfers preparation only within the switched controller', () => {
  for (const transfer of [true, false]) {
    const m = scene({ transferShotOnSwitch: transfer });
    m.mode = 'coop';
    m.selected[0] = m.coopPrimary = 0;
    m.coopSelected = 2;
    const a = { kind: 'loft', playerId: 0, power: 0.4, ttl: 0.15, aim: {} };
    m.controls[0].pending = a;
    m.controls[2].charge = { kind: 'drive', playerId: 2, power: 0.3, aim: {} };
    assert.equal(m.assignCoopReceiver(0, 1), true);
    assert.equal(m.controls[2].charge.playerId, 2);
    assert.equal(m.controls[0].pending, transfer ? a : null);
    if (transfer) assert.equal(a.playerId, 1);
  }
});
test('neutral reception reflects the incoming vector, preserving chosen speed and the lower-pass minimum', () => {
  const m = scene({ passAssist: 0, neutralPassError: 0 }),
    p = m.players[0];
  for (const vx of [-8, 8])
    for (const kind of ['low', 'loft']) {
      const ball = { ...m.ball, x: p.x, y: kind === 'low' ? 0.5 : 1.9, vx, vy: -6 };
      const r = shotImpulse(ball, p, kind, 0.6, { manualControl: true }, m.players, m.config);
      assert.equal(Math.sign(r.vx), -Math.sign(vx));
      assert.equal(r.targetId, null);
      const expected = kind === 'low' ? 38 : (Math.atan2(6, 8) * 180) / Math.PI;
      assert.ok(Math.abs((Math.atan2(r.vy, Math.abs(r.vx)) * 180) / Math.PI - expected) < 1e-9);
      const raw = shotImpulse(
        ball,
        p,
        kind,
        0.6,
        { manualControl: true, tutorialAutoPass: true },
        m.players,
        m.config,
      );
      assert.ok(Math.abs(speed(r) - speed(raw)) < 1e-10);
    }
});
test('neutral correction uses the same bounded assist; explicit directions ignore both error sliders', () => {
  const m = scene({ neutralPassError: 0 }),
    p = m.players[1];
  const ball = { ...m.ball, x: p.x, y: 1.9, vx: 6, vy: -10 };
  const aim = { manualControl: true };
  const results = [0, 0.5, 1].map((passAssist) =>
    shotImpulse(ball, p, 'loft', 0.8, aim, m.players, { ...m.config, passAssist }),
  );
  assert.ok(Math.abs(delta(results[2], results[0])) <= (12 * Math.PI) / 180 + 1e-10);
  assert.ok(Math.abs(delta(results[1], results[0]) - delta(results[2], results[0]) / 2) < 1e-10);
  const explicit = { manualControl: true, vector: { x: -0.5, y: 0.86 } };
  const a = shotImpulse(ball, p, 'loft', 0.8, explicit, m.players, {
    ...m.config,
    neutralPassError: 0,
  });
  const b = shotImpulse(ball, p, 'loft', 0.8, explicit, m.players, {
    ...m.config,
    neutralPassError: 1,
    neutralPassSpeedError: 1,
  });
  assert.deepEqual(a, b);
});
test('error is reproducible, scales with incoming speed, and never changes impulse energy', () => {
  const r = { vx: 5, vy: 8, spin: 0 },
    aim = { neutralErrorSeed: receptionErrorSeed(2026, 7, 1) };
  const a = applyReceptionError({ vx: -4, vy: -3 }, 'loft', r, aim, {
    neutralPassError: 0.5,
    neutralPassSpeedError: 1,
  });
  const b = applyReceptionError({ vx: -16, vy: -12 }, 'loft', r, aim, {
    neutralPassError: 0.5,
    neutralPassSpeedError: 1,
  });
  assert.deepEqual(
    a,
    applyReceptionError({ vx: -4, vy: -3 }, 'loft', r, aim, {
      neutralPassError: 0.5,
      neutralPassSpeedError: 1,
    }),
  );
  assert.ok(Math.abs(b.neutralErrorDegrees) > Math.abs(a.neutralErrorDegrees));
  assert.ok(Math.abs(speed(a) - speed(r)) < 1e-10);
  assert.ok(Math.abs(speed(b) - speed(r)) < 1e-10);
  const zero = applyReceptionError({ vx: -16, vy: -12 }, 'loft', r, aim, { neutralPassError: 0 });
  assert.ok(Math.abs(delta(zero, r)) < 1e-10);
});
test('normal human receiver never follows a scripted run or jumps; training keeps that assistance', () => {
  const m = scene();
  m.selected[0] = 0;
  m.players[0].returnHome = false;
  m.teamRuns[0] = { playerId: 0, serial: m.shotSerial, x: -4, at: m.time + 0.5 };
  for (let i = 0; i < 40; i++) m.movePlayers(FIXED_DT, {});
  assert.equal(m.players[0].x, -7);
  assert.equal(m.players[0].jumpProfile, null);
  m.training = {};
  m.movePlayers(FIXED_DT, {});
  assert.ok(m.players[0].x > -7);
});
test('last-pass arrows survive switching, elapsed time, and a serve; the next pass replaces them', () => {
  const m = scene({ neutralPassError: 0 }),
    p = m.players[0];
  Object.assign(m.ball, { x: p.x, y: 0.5, vx: -4, vy: -3 });
  const impulse = shotImpulse(
    m.ball,
    p,
    'low',
    0.5,
    { manualControl: true, vector: { x: 1, y: 1 } },
    m.players,
    m.config,
  );
  m.makeContact(p, 'low', 0.5, impulse);
  const record = m.passDirections;
  assert.deepEqual(record.requested, impulse.requestedDirection);
  assert.deepEqual(record.corrected, { vx: impulse.vx, vy: impulse.vy });
  m.selectControlledPlayer(m.controls[0], 1);
  m.time += 20;
  m.startServe();
  assert.equal(m.passDirections, record);
  assert.deepEqual(captureScene(m).passDirections, record);
  m.phase = 'rally';
  m.lastTouch = 1;
  m.lastPlayer = 3;
  m.cooldown = 0;
  Object.assign(m.ball, { x: p.x, y: 0.5 });
  m.makeContact(p, 'low', 0.5, impulse);
  assert.notEqual(m.passDirections, record);
});
test('new controls are bounded and preserved in settings', () => {
  const c = sanitizeConfig({
    transferShotOnSwitch: false,
    passDirectionPreview: true,
    neutralPassError: 10,
    neutralPassSpeedError: -2,
  });
  assert.equal(c.transferShotOnSwitch, false);
  assert.equal(c.passDirectionPreview, true);
  assert.equal(c.neutralPassError, 1);
  assert.equal(c.neutralPassSpeedError, 0);
});
test('a custom zero-speed reception does not recurse or add energy', () => {
  const m = scene(),
    p = m.players[0];
  const config = { ...m.config, loftSpeedMin: 0, loftSpeedMax: 0 };
  const result = shotImpulse(m.ball, p, 'loft', 0.5, { manualControl: true }, m.players, config);
  assert.equal(result.vx, 0);
  assert.equal(result.vy, 0);
});
