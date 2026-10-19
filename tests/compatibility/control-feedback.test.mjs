import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { InputBuffer } from '../../src/input.js';
import { Match } from './legacy-contract.js';
import { FIXED_DT } from '../../src/config.js';
import { shotImpulse } from '../../src/moves.js';
import { traceBall } from '../../src/physics.js';
import { preparedHands } from '../../src/held-contact.js';

function controller() {
  const pad = {
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
  };
  const input = new InputBuffer(() => [pad]);
  const step = (m) => {
    input.poll();
    m.tick(FIXED_DT, input.read(m.phase));
    input.consume();
  };
  return { pad, input, step };
}

test('L2 plus square aims a lower pass with the left stick and retains direction after centering', () => {
  for (const direction of [-1, 1]) {
    const m = new Match({ ...DEFAULTS, assist: false });
    m.startDrill('receive');
    const { pad, step } = controller();
    Object.assign(m.ball, { x: 4, y: 12, vx: 0, vy: 0 });
    pad.buttons[2].pressed = true;
    pad.buttons[6].pressed = true;
    pad.axes = [direction * 0.6, -0.8, 0, 0];
    for (let i = 0; i < 12; i++) step(m);
    assert.equal(m.charge.kind, 'low');
    assert.equal(Math.sign(m.charge.aim.vector.x), direction);
    pad.axes = [0, 0, 0, 0];
    step(m);
    Object.assign(m.ball, preparedHands(m.active(), m)[0], { vx: 0, vy: 0 });
    pad.buttons[2].pressed = false;
    step(m);
    assert.equal(m.contacts, 1);
    assert.equal(Math.sign(m.ball.vx), direction);
    assert.ok(m.ball.vy > 0);
  }
});

test('L2 plus square serves through gamepad input at partial and full charge', () => {
  for (const full of [false, true]) {
    const m = new Match();
    const { pad, step } = controller();
    pad.buttons[2].pressed = true;
    pad.buttons[6].pressed = true;
    for (let i = 0; i < (full ? 200 : 35) && m.phase === 'serve'; i++) step(m);
    pad.buttons[2].pressed = false;
    step(m);
    assert.equal(m.phase, 'serve-motion');
    assert.equal(m.serveAction.kind, 'back');
    while (m.phaseTime < m.serveAction.ideal - FIXED_DT) step(m);
    pad.buttons[2].pressed = true;
    pad.buttons[6].pressed = true;
    step(m);
    assert.equal(m.stats.serves[0], 1);
    assert.ok(m.ball.vx > 0 && m.ball.vy > 0);
  }
});

test('upward D is forward and upward with assistance on or off; full power can go out', () => {
  for (const team of [0, 1])
    for (const assist of [true, false]) {
      const m = new Match({ ...DEFAULTS, assist });
      const p = m.players[team * 3];
      p.x = team ? 3 : -3;
      const ball = { ...m.ball, x: p.x, y: 2 };
      const shots = [0.08, 1].map((power) =>
        shotImpulse(ball, p, 'drive', power, { vector: { x: 0, y: 1 } }, m.players, m.config),
      );
      assert.ok(shots[0].vx * (team ? -1 : 1) > 0);
      assert.ok(shots[0].vy > 0);
      assert.ok(Math.abs(shots[1].vx) > Math.abs(shots[0].vx));
      assert.ok(Math.abs(traceBall({ ...ball, ...shots[1] }, m.config, 12).at(-1).x) > 9);
    }
});

test('stick jitter after selection never jumps; fresh Cross does', () => {
  const m = new Match();
  m.startDrill('receive');
  const { pad, step } = controller();
  Object.assign(m.ball, { x: 4, y: 12, vx: 0, vy: 0 });
  pad.buttons[3].pressed = true;
  pad.axes[1] = -1;
  step(m);
  const passer = m.active();
  m.charge = null;
  m.autoSelect(0, 1);
  const receiver = m.active();
  pad.buttons[3].pressed = false;
  for (const y of [-1, -0.6, -1, -0.3, -1]) {
    pad.axes[1] = y;
    step(m);
  }
  assert.equal(passer.jumpProfile, null);
  assert.equal(receiver.jumpProfile, null);
  pad.axes[1] = 0;
  step(m);
  pad.axes[1] = -1;
  step(m);
  assert.equal(receiver.jumpProfile, null);
  pad.buttons[0].pressed = true;
  step(m);
  assert.ok(receiver.jumpProfile);
});

test('fresh jump after switching with a neutral stick is accepted immediately', () => {
  const m = new Match();
  m.startDrill('receive');
  Object.assign(m.ball, { x: 4, y: 12, vx: 0, vy: 0 });
  m.tick(FIXED_DT, { switch: true });
  const p = m.active();
  m.tick(FIXED_DT, { jump: true });
  assert.ok(p.jumpProfile);
});

test('released charge recovers movement gradually through the complete release window', () => {
  const m = new Match({ ...DEFAULTS, releaseWindow: 0.3, chargeMove: 0.3 });
  m.startDrill('receive');
  Object.assign(m.ball, { x: 4, y: 12, vx: 0, vy: 0 });
  const p = m.active();
  m.tick(FIXED_DT, { drive: true, axis: 1 });
  const slow = p.vx;
  m.tick(FIXED_DT, { axis: 1 });
  assert.ok(Math.abs(p.vx - slow) < 1e-8);
  for (let i = 0; i < 16; i++) m.tick(FIXED_DT, { axis: 1 });
  assert.ok(p.vx > slow && p.vx < m.config.playerSpeed);
  for (let i = 0; i < 25; i++) m.tick(FIXED_DT, { axis: 1 });
  assert.ok(Math.abs(p.vx - m.config.playerSpeed) < 1e-8);
});

test('a strong jumping spike knocks down on top-of-head impact and recovers after five seconds', () => {
  for (const power of [0.4, 1])
    for (const airborne of [false, true])
      for (const offset of [0, 0.7]) {
        const m = new Match();
        m.startDrill('receive');
        const attacker = m.players[3],
          target = m.players[0];
        m.lastTouch = 0;
        m.lastPlayer = target.id;
        attacker.y = airborne ? 1 : 0;
        m.makeContact(attacker, 'drive', power, { vx: -8, vy: -10, vz: 0 });
        const previous = { ...m.ball, x: target.x + offset, y: 2.5 };
        Object.assign(m.ball, { x: previous.x, y: 1.9, vx: -8, vy: -10 });
        const expected = power === 1 && airborne && offset === 0;
        assert.equal(m.tryHeadHit(previous), expected);
        if (!expected) continue;
        assert.equal(target.recovery, 5.35);
        assert.notEqual(m.active().id, target.id);
        assert.equal(m.jump(target), false);
        assert.equal(m.canContact(target, 'loft'), false);
        m.animatePlayers(4.9);
        assert.ok(target.stunned > 0 && target.recovery > 0);
        m.animatePlayers(0.5);
        assert.equal(target.stunned, 0);
        assert.equal(m.jump(target), true);
      }
});

test('passer waits before seeking space and manual movement interrupts the delay', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.players[0];
  p.x = -5;
  m.players[1].x = -7;
  m.players[2].x = -6.5;
  Object.assign(m.ball, { x: p.x, y: 1 });
  m.makeContact(p, 'back', 0.5, { vx: -2, vy: 6, vz: 0 });
  assert.equal(p.homeX, -8, 'clearing must not overwrite the formation');
  assert.ok(p.clearLane);
  assert.ok(Math.abs(p.clearLane.targetX - m.players[1].x) > 1);
  const delay = p.returnDelay;
  for (let i = 0; i < Math.floor(delay / FIXED_DT) - 1; i++) m.movePlayers(FIXED_DT, { axis: 0 });
  assert.equal(p.x, -5);
  m.selected[0] = p.id;
  m.movePlayers(FIXED_DT, { axis: 1 });
  assert.ok(p.x > -5);
  assert.equal(p.returnHome, false);
});
