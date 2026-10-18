import test from 'node:test';
import assert from 'node:assert/strict';
import { InputBuffer } from '../src/input.js';
import { Match } from '../src/engine.js';
import { FIXED_DT } from '../src/config.js';

function controller() {
  return {
    connected: true,
    mapping: 'standard',
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0],
  };
}

test('right stick selects four shots independently of movement, with analog strength and release', () => {
  const pad = controller(),
    input = new InputBuffer(() => [pad]);
  for (const [x, y, kind] of [
    [0, 0.6, 'low'],
    [0, -0.6, 'loft'],
    [0.6, 0, 'drive'],
    [-0.6, 0, 'back'],
  ]) {
    pad.axes[2] = x;
    pad.axes[3] = y;
    input.poll();
    const state = input.read();
    assert.equal(state.stickShot, kind);
    assert.equal(state[kind], true);
    assert.equal(state.axis, 0);
    assert.ok(state.stickStrength > 0 && state.stickStrength < 1);
    assert.equal(state.shotAxis, Math.sign(x));
    pad.axes[2] = pad.axes[3] = 0;
    input.poll();
    assert.equal(input.read()[kind], false);
  }
});

test('right stick ignores drift and stays blocked after pause until centered', () => {
  const pad = controller(),
    input = new InputBuffer(() => [pad]);
  pad.axes[3] = 0.15;
  input.poll();
  assert.equal(input.read().stickShot, null);
  pad.axes[3] = 1;
  input.poll();
  input.clear();
  input.poll();
  assert.equal(input.read().low, false);
  pad.axes[3] = 0;
  input.poll();
  pad.axes[3] = 1;
  input.poll();
  assert.equal(input.read().low, true);
});

test('right stick switches shot type on rotation and preserves aim through release', () => {
  const pad = controller(),
    input = new InputBuffer(() => [pad]);
  const m = new Match();
  m.startDrill('receive');
  Object.assign(m.ball, { x: 4, y: 15, vx: 0, vy: 0 });
  pad.axes[3] = 0.8;
  input.poll();
  m.tick(FIXED_DT, input.read());
  assert.equal(input.read().stickShot, 'low');
  assert.equal(input.read().shotAxis, 0);
  pad.axes[2] = -0.8;
  pad.axes[3] = -0.5;
  input.poll();
  m.tick(FIXED_DT, input.read());
  assert.equal(input.read().stickShot, 'back');
  assert.equal(input.read().drive, false);
  assert.equal(input.read().loft, false);
  assert.equal(m.charge.aim.axis, 0);
  pad.axes[2] = pad.axes[3] = 0;
  input.poll();
  m.tick(FIXED_DT, input.read());
  assert.equal(m.pending.kind, 'back');
  assert.equal(m.pending.aim.axis, 0);
  pad.axes[3] = -0.9;
  input.poll();
  assert.equal(input.read().stickShot, 'loft');
  assert.equal(input.read().shotAxis, 0);
});

test('left stick jump requires a narrow upward cone, sideways diagonals never jump', () => {
  const pad = controller(),
    input = new InputBuffer(() => [pad]);
  for (const x of [-1, -0.7, 0.7, 1]) {
    pad.axes[0] = x;
    pad.axes[1] = -0.8;
    input.poll();
    assert.equal(input.read().jump, false);
  }
  pad.axes[0] = 0.2;
  pad.axes[1] = -0.9;
  input.poll();
  assert.equal(input.read().jump, true);
});

test('stick deflection and hold duration both increase charge, centering uses release grace', () => {
  function charge(deflection, ticks) {
    const pad = controller(),
      input = new InputBuffer(() => [pad]),
      m = new Match();
    m.startDrill('receive');
    Object.assign(m.ball, { x: 4, y: 15, vx: 0, vy: 0 });
    pad.axes[3] = deflection;
    for (let n = 0; n < ticks; n++) {
      input.poll();
      m.tick(FIXED_DT, input.read());
    }
    const power = m.charge.power;
    pad.axes[3] = 0;
    input.poll();
    m.tick(FIXED_DT, input.read());
    assert.equal(m.charge, null);
    assert.equal(m.pending.kind, 'low');
    assert.equal(m.pending.power, power);
    return power;
  }
  assert.ok(charge(1, 20) > charge(0.5, 20));
  assert.ok(charge(0.7, 25) > charge(0.7, 10));
});

test('right stick attack in assisted jump charges instead of firing on first tilt', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.active();
  m.jump(p);
  const input = { axis: 0, drive: true, stickShot: 'drive', stickStrength: 0.5, shotAxis: -1 };
  m.tick(FIXED_DT, input);
  assert.equal('attackPlan' in m, false);
  assert.equal(m.charge.kind, 'drive');
  assert.equal(m.charge.aim.axis, 0);
  assert.equal(m.contacts, 0);
  assert.ok(p.jumpProfile);
});

test('DualSense face buttons, shoulders, and d-pad map to game actions', () => {
  const pad = controller(),
    input = new InputBuffer(() => [pad]);
  pad.buttons[2].pressed = true;
  pad.buttons[3].pressed = true;
  pad.buttons[1].pressed = true;
  pad.buttons[5].pressed = true;
  pad.buttons[4].pressed = true;
  pad.buttons[12].pressed = true;
  input.poll();
  const state = input.read();
  assert.equal(state.back, true);
  assert.equal(state.loft, true);
  assert.equal(state.drive, true);
  assert.equal(state.block, true);
  assert.equal(state.switch, true);
  assert.equal(state.jump, true);
  pad.buttons[6].value = 0.8;
  input.poll();
  assert.equal(input.read().up, true);
  assert.equal(input.read().jump, false);
});

test('left stick uses a dead zone and analog movement is clamped', () => {
  const pad = controller(),
    input = new InputBuffer(() => [pad]);
  pad.axes[0] = 0.17;
  input.poll();
  assert.equal(input.read().axis, 0);
  pad.axes[0] = 0.59;
  input.poll();
  assert.equal(input.read().axis, 0.5);
  pad.axes[0] = 1;
  input.down('ArrowRight');
  input.poll();
  assert.equal(input.read().axis, 1);
});

test('left stick up jumps without triggering from drift or while the modifier is held', () => {
  const pad = controller(),
    input = new InputBuffer(() => [pad]);
  pad.axes[1] = -0.4;
  input.poll();
  assert.equal(input.read().jump, false);
  pad.axes[1] = -0.9;
  input.poll();
  assert.equal(input.read().jump, true);
  pad.buttons[6].pressed = true;
  input.poll();
  assert.equal(input.read().jump, false);
});

test('Options pauses on a new press and held actions clear until release', () => {
  const pad = controller(),
    input = new InputBuffer(() => [pad]);
  pad.buttons[9].pressed = true;
  pad.buttons[2].pressed = true;
  input.poll();
  assert.equal(input.read().pausePressed, true);
  assert.equal(input.read().back, true);
  input.poll();
  assert.equal(input.read().pausePressed, false);
  input.clear();
  assert.equal(input.read().back, false);
  pad.buttons[2].pressed = false;
  pad.buttons[9].pressed = false;
  input.poll();
  pad.buttons[2].pressed = true;
  input.poll();
  assert.equal(input.read().back, true);
});

test('Cross confirm is reported once for starting from the menu', () => {
  const pad = controller(),
    input = new InputBuffer(() => [pad]);
  pad.buttons[0].pressed = true;
  input.poll();
  assert.equal(input.read().confirmPressed, true);
  input.poll();
  assert.equal(input.read().confirmPressed, false);
});
