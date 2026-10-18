import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { InputBuffer } from '../../src/input.js';
import { Match } from './legacy-contract.js';
import { FIXED_DT } from '../../src/config.js';
import { shotImpulse, SERVES } from '../../src/moves.js';
import { predictAtHeight, traceBall } from '../../src/physics.js';
import { COURT } from '../../src/config.js';
import { expressivePose } from '../../src/arm-motion.js';
import { ARM_STYLES } from '../../src/arms.js';

test('slightly backward overhead stick aim keeps its exact angle from the first tilt', () => {
  const pad = {
    connected: true,
    mapping: 'standard',
    axes: [-0.2, -0.9, 0, 0],
    buttons: [{}, {}, {}, { pressed: true }],
  };
  const input = new InputBuffer(() => [pad]);
  input.poll();
  const state = input.read();
  assert.equal(state.loft, true);
  const m = new Match({ ...DEFAULTS, passAssist: 0 });
  const impulse = shotImpulse(
    m.ball,
    m.active(),
    'loft',
    0.5,
    { vector: state.buttonVector },
    m.players,
    m.config,
  );
  assert.ok(impulse.vx < 0 && impulse.vy > 0);
  assert.ok(Math.abs(impulse.vx / impulse.vy + 2 / 9) < 1e-12);
});

test('Cross jumps, S receives, F blocks', () => {
  const pad = { connected: true, mapping: 'standard', axes: [], buttons: [{ pressed: true }] };
  const input = new InputBuffer(() => [pad]);
  input.poll();
  assert.equal(input.read().low, false);
  assert.equal(input.read().jump, true);
  input.clear();
  input.down('KeyS');
  assert.equal(input.read().low, true);
  assert.equal(input.read().block, false);
  input.clear();
  input.down('KeyF');
  assert.equal(input.read().block, true);
});

test('released contacts accept fresh direction from the original source until impact', () => {
  for (const stickControlled of [false, true]) {
    const m = new Match({ ...DEFAULTS, assist: false });
    m.startDrill('receive');
    const p = m.active();
    Object.assign(m.ball, { x: p.x, y: 2, vx: 0, vy: 0 });
    m.pending = {
      kind: 'loft',
      power: 0.4,
      ttl: 0.2,
      playerId: p.id,
      stickControlled,
      aim: { axis: 1 },
    };
    m.tick(FIXED_DT, {
      axis: 1,
      buttonVector: { x: -0.6, y: 0.8 },
      shotVector: { x: 0.8, y: 0.6 },
      shotAxis: 1,
    });
    assert.equal(m.contacts, 1);
    assert.equal(Math.sign(m.ball.vx), -1);
  }
});

test('explicit pass assistance at 50 percent rotates halfway without changing speed', () => {
  const m = new Match();
  const p = m.active();
  const ball = { ...m.ball, x: p.x, y: 2 };
  const aim = { vector: { x: 0.4, y: Math.sqrt(0.84) } };
  const raw = shotImpulse(ball, p, 'loft', 0.4, aim, [], { ...DEFAULTS, passAssist: 0 });
  const landing = predictAtHeight({ ...ball, ...raw }, 2, DEFAULTS);
  const players = [p, { id: 90, team: p.team, x: landing.x + 0.4, recovery: 0 }];
  const full = shotImpulse(ball, p, 'loft', 0.4, aim, players, DEFAULTS);
  const half = shotImpulse(ball, p, 'loft', 0.4, aim, players, { ...DEFAULTS, passAssist: 0.5 });
  assert.equal(full.assisted, true);
  const angle = (s) => Math.atan2(s.vy, s.vx);
  assert.ok(Math.abs(angle(half) - (angle(raw) + angle(full)) / 2) < 1e-12);
  assert.ok(Math.abs(Math.hypot(half.vx, half.vy) - Math.hypot(raw.vx, raw.vy)) < 1e-12);
});

test('preparing near the apex adds ball hang once', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.active();
  m.jump(p);
  p.jumpTime = p.jumpProfile.windup + p.jumpProfile.rise;
  p.y = p.jumpProfile.height;
  Object.assign(m.ball, { x: p.x, y: p.y + 2.1 });
  m.charge = { playerId: p.id };
  m.animatePlayers(FIXED_DT);
  m.animatePlayers(FIXED_DT);
  assert.equal(p.jumpProfile.hang, m.config.jumpHang + m.config.jumpBallHang);
});

test('A serve has a soft upward trajectory without spin', () => {
  const m = new Match();
  const impulse = shotImpulse(m.ball, m.active(), 'back', 0.5, {}, m.players, m.config, true);
  assert.ok(impulse.vx > 0 && impulse.vy > 0);
  assert.equal(impulse.spin, 0);
});

test('releasing the shot and direction together retains the last charged aim and power', () => {
  for (const stickControlled of [false, true]) {
    const m = new Match({ ...DEFAULTS, assist: false, releaseWindow: 0.3 });
    m.startDrill('receive');
    const p = m.active();
    Object.assign(m.ball, { x: 4, y: 10, vx: 0, vy: 0 });
    const vector = { x: -0.3, y: Math.sqrt(0.91) };
    const input = stickControlled
      ? { loft: true, stickShot: 'loft', stickStrength: 0.5, axis: -1, buttonVector: vector }
      : { loft: true, axis: -1, buttonVector: vector };
    for (let i = 0; i < 10; i++) m.tick(FIXED_DT, input);
    const power = m.charge.power;
    m.tick();
    assert.deepEqual(m.pending.aim.vector, vector);
    assert.equal(m.pending.power, power);
    Object.assign(m.ball, { x: p.x, y: 2, vx: 0, vy: 0 });
    m.tick();
    assert.equal(m.contacts, 1);
    assert.ok(m.ball.vx < 0 && m.ball.vy > 0);
  }
});

test('neutral drive is horizontal only with its assistance disabled', () => {
  const m = new Match();
  const ball = { ...m.ball, x: -4, y: 2 };
  const raw = shotImpulse(ball, m.active(), 'drive', 0.8, {}, [], { ...DEFAULTS, driveAssist: 0 });
  assert.equal(raw.vy, 0);
  assert.equal(raw.assisted, false);
  const full = shotImpulse(ball, m.active(), 'drive', 0.8, {}, [], DEFAULTS);
  assert.ok(full.vy > 0);
  assert.equal(full.assisted, true);
});

test('one-hand save respects facing and only the working hand follows the ball', () => {
  for (const actionDirection of [-1, 1]) {
    const args = { spec: ARM_STYLES.whip, config: DEFAULTS, kind: 'back', actionDirection };
    const ready = expressivePose({ ...args, charge: { age: 0.2, power: 0.5 } });
    const hand = actionDirection < 0 ? 0 : 1;
    assert.equal(Math.sign(ready.wrists[hand].x), actionDirection);
    const localVelocity = { x: actionDirection * 100, y: -150 };
    const sample = (age) =>
      expressivePose({
        ...args,
        localVelocity,
        contactPoint: { x: 0, y: -35 },
        swing: { age, hit: true, power: 0.5, hand },
      });
    const a = sample(0),
      b = sample(0.01);
    assert.deepEqual(a.wrists[1 - hand], b.wrists[1 - hand]);
    for (const i of [hand]) {
      assert.ok(Math.abs(b.wrists[i].x - a.wrists[i].x - localVelocity.x * 0.01) < 1e-12);
      assert.ok(Math.abs(b.wrists[i].y - a.wrists[i].y - localVelocity.y * 0.01) < 1e-12);
    }
  }
});
