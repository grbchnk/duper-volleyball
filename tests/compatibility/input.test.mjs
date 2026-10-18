import test from 'node:test';
import assert from 'node:assert/strict';
import { InputBuffer } from '../../src/input.js';
import { Match } from './legacy-contract.js';
import { FIXED_DT } from '../../src/config.js';

function controller() {
  return {
    connected: true,
    mapping: 'standard',
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0],
  };
}

test('left stick never triggers a jump, even when aimed straight up', () => {
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
  assert.equal(input.read().jump, false);
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
  assert.equal(state.low, true);
  assert.equal(state.loft, true);
  assert.equal(state.drive, true);
  assert.equal(state.block, true);
  assert.equal(state.switch, true);
  assert.equal(state.jump, false);
  pad.buttons[6].value = 0.8;
  input.poll();
  assert.equal(input.read().intent, 'soft');
  assert.equal(input.read().low, true);
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

test('Cross jumps normally with L2 and without stick drift', () => {
  const pad = controller(),
    input = new InputBuffer(() => [pad]);
  pad.axes[1] = -0.4;
  input.poll();
  assert.equal(input.read().jump, false);
  pad.axes[1] = -0.9;
  input.poll();
  assert.equal(input.read().jump, false);
  pad.buttons[0].pressed = true;
  input.poll();
  assert.equal(input.read().jump, true);
  pad.buttons[6].pressed = true;
  input.poll();
  assert.equal(input.read().jump, true);
  assert.equal(input.read().jumpVariant, 'normal');
});

test('Options pauses on a new press and held actions clear until release', () => {
  const pad = controller(),
    input = new InputBuffer(() => [pad]);
  pad.buttons[9].pressed = true;
  pad.buttons[2].pressed = true;
  input.poll();
  assert.equal(input.read().pausePressed, true);
  assert.equal(input.read().low, true);
  input.poll();
  assert.equal(input.read().pausePressed, false);
  input.clear();
  assert.equal(input.read().low, false);
  pad.buttons[2].pressed = false;
  pad.buttons[9].pressed = false;
  input.poll();
  pad.buttons[2].pressed = true;
  input.poll();
  assert.equal(input.read().low, true);
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
