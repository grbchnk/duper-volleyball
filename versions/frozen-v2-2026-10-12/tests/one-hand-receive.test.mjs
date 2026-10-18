import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { InputBuffer } from '../src/input.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { preparedHands } from '../src/held-contact.js';
import { expressivePose } from '../src/arm-motion.js';
import { ARM_STYLES } from '../src/arms.js';
import { shotImpulse } from '../src/moves.js';

const pose = (kind, x, y) =>
  expressivePose({
    spec: ARM_STYLES.whip,
    config: DEFAULTS,
    kind,
    charge: { age: 0.3, power: 0.7 },
    receiveAim: { x, y },
  });

test('upper and lower reception follow direction while preserving their height bands', () => {
  for (const kind of ['loft', 'low']) {
    const left = pose(kind, -1, 0),
      right = pose(kind, 1, 0),
      up = pose(kind, 0, 1);
    for (const i of [0, 1]) {
      assert.ok(left.wrists[i].x < up.wrists[i].x);
      assert.ok(up.wrists[i].x < right.wrists[i].x);
      for (const p of [left, right, up])
        assert.ok(kind === 'loft' ? p.wrists[i].y < -35 : p.wrists[i].y > -18);
    }
  }
});

test('one hand reaches all eight directions and the other stays at rest', () => {
  for (let i = 0; i < 8; i++) {
    const x = Math.cos((i * Math.PI) / 4),
      y = Math.sin((i * Math.PI) / 4);
    const p = pose('back', x, y),
      hand = x < 0 ? 0 : 1;
    assert.deepEqual(p.activeHands, [hand]);
    assert.equal(p.wrists[1 - hand].y, -12);
    assert.ok(Math.abs(p.wrists[hand].x - (hand ? 6 : -6) - 19 * x) < 1e-9);
    assert.ok(Math.abs(p.wrists[hand].y + 20 + 19 * y) < 1e-9);
  }
});

test('save reaches the ball independently of outgoing aim, mirrored, held and released', () => {
  for (const team of [0, 1])
    for (const direction of [-1, 1])
      for (const released of [false, true]) {
        const m = new Match();
        m.startDrill('receive');
        m.lastTouch = 1 - team;
        m.lastPlayer = (1 - team) * 3;
        const p = m.players[team * 3];
        p.x = team ? 4 : -4;
        p.facing = team ? -1 : 1;
        const a = {
          kind: 'back',
          age: 0.3,
          power: 0.5,
          playerId: p.id,
          aim: { vector: { x: direction, y: 0 } },
        };
        m.charge = a;
        Object.assign(m.ball, { x: p.x - direction * 0.9, y: 1, vx: 0, vy: 0 });
        const hands = preparedHands(p, m);
        assert.equal(hands.length, 1);
        Object.assign(m.ball, { x: p.x - direction * 3, y: hands[0].y, vx: 0, vy: 0 });
        if (released) {
          m.charge = null;
          m.pending = { ...a, ttl: 0.2 };
        }
        const hit = () => (released ? m.tryPending() : m.tryHeldContact());
        assert.equal(hit(), false);
        Object.assign(m.ball, hands[0]);
        assert.equal(hit(), true);
        assert.equal(m.contacts, 1);
        assert.ok(Math.hypot(m.ball.vx, m.ball.vy) <= 7.2);
        assert.equal(m.tryHeldContact(), false);
      }
});

test('full-power save stays weaker than regular receptions with and without assistance', () => {
  const m = new Match();
  for (const assist of [false, true])
    for (const x of [-1, 0, 1]) {
      const shoot = (kind) =>
        shotImpulse(m.ball, m.active(), kind, 1, { vector: { x, y: x ? 0 : 1 } }, m.players, {
          ...DEFAULTS,
          assist,
        });
      const speed = (kind) => Math.hypot(shoot(kind).vx, shoot(kind).vy);
      assert.ok(speed('back') <= 7.2 + 1e-9);
      assert.ok(speed('back') < speed('low') * 0.65);
      assert.ok(speed('back') < speed('loft') * 0.65);
    }
});

test('stick sectors switch immediately, diagonal jitter does not, buttons pin the type', () => {
  const pad = {
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, -0.9],
    buttons: Array.from({ length: 4 }, () => ({ pressed: false })),
  };
  const input = new InputBuffer(() => [pad]);
  const m = new Match();
  m.startDrill('receive');
  Object.assign(m.ball, { x: 4, y: 15 });
  const step = () => {
    input.poll();
    m.tick(FIXED_DT, input.read());
  };
  step();
  assert.equal(m.charge.kind, 'loft');
  for (const x of [0.7, 0.72, 0.69]) {
    pad.axes[2] = x;
    pad.axes[3] = -0.7;
    step();
    assert.equal(m.charge.kind, 'loft');
  }
  for (const [x, y, kind] of [
    [0, 1, 'low'],
    [-1, 0, 'back'],
    [1, 0, 'drive'],
  ]) {
    pad.axes[2] = x;
    pad.axes[3] = y;
    step();
    assert.equal(m.charge.kind, kind);
    assert.equal(m.pending, null);
    assert.equal(m.contacts, 0);
  }
  pad.buttons[2].pressed = true;
  pad.axes[0] = 1;
  step();
  assert.equal(m.charge.kind, 'back');
  assert.equal(m.charge.aim.vector.x, 1);
  pad.axes[2] = 0;
  pad.axes[3] = -1;
  step();
  assert.equal(m.charge.kind, 'back');
  assert.equal(m.charge.aim.vector.x, 1);
  assert.equal(m.charge.aim.vector.y, 0);
});

test('temporary clearance expires and returns to the original formation position', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.players[0];
  p.x = -5;
  const home = p.homeX;
  m.selected[0] = 1;
  m.lastPlayer = p.id;
  Object.assign(m.ball, { x: -5, y: 2, vx: 3, vy: 6 });
  m.clearPasser(p);
  assert.ok(p.clearLane);
  assert.equal(p.homeX, home);
  for (let i = 0; i < 750; i++) {
    m.time += FIXED_DT;
    m.movePlayers(FIXED_DT, { axis: 0 });
  }
  assert.equal(p.clearLane, null);
  assert.equal(p.x, home);
  assert.equal(p.returnHome, false);
});

test('same-kind handoff from stick to button unlocks aiming without losing charge', () => {
  const pad = {
    connected: true,
    mapping: 'standard',
    axes: [0, 0, -1, 0],
    buttons: Array.from({ length: 4 }, () => ({ pressed: false })),
  };
  const input = new InputBuffer(() => [pad]);
  const m = new Match();
  m.startDrill('receive');
  Object.assign(m.ball, { x: 4, y: 15 });
  const step = () => {
    input.poll();
    m.tick(FIXED_DT, input.read());
  };
  for (let i = 0; i < 10; i++) step();
  const power = m.charge.power;
  pad.buttons[2].pressed = true;
  step();
  pad.axes[2] = 1;
  pad.axes[0] = 1;
  step();
  assert.equal(m.charge.kind, 'back');
  assert.equal(m.charge.stickControlled, false);
  assert.equal(m.charge.aim.vector.x, 1);
  assert.ok(m.charge.power >= power);
});

test('changing stick sector while preparing a serve selects a type without tossing', () => {
  const m = new Match();
  m.tick(FIXED_DT, { low: true, stickShot: 'low', stickStrength: 0.5 });
  m.tick(FIXED_DT, { loft: true, stickShot: 'loft', stickStrength: 0.5 });
  assert.equal(m.phase, 'serve');
  assert.equal(m.charge.kind, 'loft');
  m.tick();
  assert.equal(m.phase, 'serve-motion');
  assert.equal(m.serveAction.kind, 'loft');
});

test('return chooses a free slot when the selected player occupies the old one', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.players[0],
    other = m.players[1];
  m.selected[0] = other.id;
  p.x = -4;
  other.x = -5.5;
  for (let i = 0; i < 180; i++) m.movePlayers(FIXED_DT, { axis: 0 });
  assert.ok(p.x - other.x >= 1.25 - 1e-9);
  assert.equal(p.returnHome, false);
  assert.equal(p.x, p.homeX);
  other.x = -2.5;
  for (let i = 0; i < 180; i++) m.movePlayers(FIXED_DT, { axis: 0 });
  assert.equal(p.x, p.homeX);
  p.x = -4;
  m.selected[0] = p.id;
  for (let i = 0; i < 180; i++) m.movePlayers(FIXED_DT, { axis: 0 });
  assert.equal(p.x, -4);
  assert.equal(p.returnHome, false);
});

test('return waits for landing and recovery', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.players[0];
  m.selected[0] = 1;
  p.x = -5;
  m.jump(p);
  m.movePlayers(FIXED_DT, { axis: 0 });
  assert.equal(p.x, -5);
  p.jumpProfile = null;
  p.y = p.vy = 0;
  p.recovery = 0.5;
  m.movePlayers(FIXED_DT, { axis: 0 });
  assert.equal(p.x, -5);
  p.recovery = 0;
  m.movePlayers(FIXED_DT, { axis: 0 });
  assert.ok(p.x < -5);
});
