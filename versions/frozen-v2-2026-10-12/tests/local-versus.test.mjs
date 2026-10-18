import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { InputBuffer } from '../src/input.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { shotImpulse } from '../src/moves.js';
import { preparedHands } from '../src/held-contact.js';
import { localReceiveAim, receiveWrists } from '../src/receive-pose.js';

const pad = () => ({
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
});
function rally() {
  const m = new Match({ ...DEFAULTS, assist: false });
  m.reset('versus');
  m.phase = 'rally';
  m.players[0].x = -6;
  m.players[3].x = 6;
  Object.assign(m.ball, { x: 0, y: 12, vx: 0, vy: 0 });
  return m;
}
test('two gamepads remain independent through sparse slots, disconnect and reconnect', () => {
  const pads = [null, pad(), null, pad()];
  const a = new InputBuffer(() => pads),
    b = new InputBuffer(() => pads, undefined, 1);
  pads[1].axes[0] = 1;
  pads[3].axes[0] = -1;
  pads[3].buttons[2].pressed = true;
  a.poll();
  b.poll();
  assert.equal(a.read().axis, 1);
  assert.equal(b.read().axis, -1);
  assert.equal(a.read().back, false);
  assert.equal(b.read().back, true);
  pads[1].connected = false;
  a.poll();
  b.poll();
  assert.equal(a.gamepad, null);
  assert.equal(b.read().back, true);
  pads[1].connected = true;
  a.poll();
  assert.equal(a.gamepad, pads[1]);
});
test('both teams move and charge independently; releasing one does not release the other', () => {
  const m = rally();
  m.tick(FIXED_DT, { axis: 1, back: true }, { axis: -1, loft: true });
  assert.ok(m.players[0].x > -6);
  assert.ok(m.players[3].x < 6);
  assert.equal(m.controls[0].charge.kind, 'back');
  assert.equal(m.controls[1].charge.kind, 'loft');
  m.tick(FIXED_DT, {}, { loft: true });
  assert.equal(m.controls[0].pending.kind, 'back');
  assert.equal(m.controls[1].charge.kind, 'loft');
  m.point(0, 'test');
  for (const state of m.controls) assert.equal(state.charge || state.pending, null);
});
test('right controller switches only its team and can jump without moving the left player', () => {
  const m = rally();
  m.tick(FIXED_DT, {}, { switch: true });
  assert.deepEqual(m.selected, [0, 4]);
  m.tick(FIXED_DT, {}, { jump: true });
  assert.ok(m.players[4].jumpProfile);
  assert.equal(m.players[0].jumpProfile, null);
});
test('right team serves using only the second controller, including timed second press', () => {
  const m = rally();
  m.server = 1;
  m.startServe();
  m.tick(FIXED_DT, { drive: true }, { low: true });
  assert.equal(m.controls[0].charge, null);
  assert.equal(m.controls[1].charge.kind, 'low');
  m.tick(FIXED_DT);
  assert.equal(m.phase, 'serve-motion');
  m.phaseTime = m.serveAction.ideal - FIXED_DT;
  m.tick(FIXED_DT, {}, { low: true });
  assert.equal(m.phase, 'rally');
  assert.equal(m.lastTouch, 1);
  assert.equal(m.stats.serves[1], 1);
  assert.ok(m.ball.vx < 0);
});
test('right team held save contacts its own hand and consumes only its own charge', () => {
  const m = rally(),
    p = m.active(1);
  m.tick(FIXED_DT, { loft: true }, { back: true });
  const a = m.controls[1].charge;
  a.age = 0.3;
  Object.assign(m.ball, { x: p.x + 0.8, y: 0.9 });
  Object.assign(m.ball, preparedHands(p, m)[0]);
  assert.equal(
    m.withControl(1, () => m.tryHeldContact()),
    true,
  );
  assert.equal(m.lastTouch, 1);
  assert.equal(m.controls[1].charge, null);
  assert.equal(m.controls[0].charge.kind, 'loft');
  assert.equal(p.releaseSlow, 0);
});
test('save preserves full running speed through charging and release on both sides', () => {
  const m = rally();
  const step = DEFAULTS.playerSpeed * FIXED_DT;
  m.tick(FIXED_DT, { axis: 1, back: true }, { axis: -1, back: true });
  assert.ok(Math.abs(m.players[0].x + 6 - step) < 1e-9);
  assert.ok(Math.abs(m.players[3].x - 6 + step) < 1e-9);
  m.tick(FIXED_DT, { axis: 1 }, { axis: -1 });
  assert.ok(Math.abs(m.players[0].x + 6 - 2 * step) < 1e-9);
  assert.ok(Math.abs(m.players[3].x - 6 + 2 * step) < 1e-9);
});
test('stick recenter and opposite snapback retain deliberate aim; a new tilt changes it', () => {
  const p = pad();
  let now = 1000;
  const input = new InputBuffer(
    () => [p],
    () => now,
  );
  const m = rally();
  p.buttons[1].pressed = true;
  const sample = (x, y, advance = 16) => {
    now += advance;
    p.axes[0] = x;
    p.axes[1] = y;
    input.poll();
    m.tick(FIXED_DT, input.read());
  };
  sample(0.8, -0.6);
  const aim = { ...m.charge.aim.vector };
  sample(0.4, -0.3);
  sample(0.07, 0.25);
  sample(0, 0);
  sample(0, 0.6);
  sample(0, 0);
  assert.deepEqual(m.charge.aim.vector, aim);
  sample(0, 0.8, 150);
  assert.deepEqual(m.charge.aim.vector, { x: 0, y: -1 });
});
test('neutral drive is horizontal and unassisted on either team; save power is reduced', () => {
  const m = rally();
  for (const team of [0, 1]) {
    const p = m.active(team);
    const hit = shotImpulse(m.ball, p, 'drive', 1, {}, m.players, DEFAULTS);
    assert.equal(hit.vy, 0);
    assert.equal(hit.assisted, false);
    assert.equal(Math.sign(hit.vx), team ? -1 : 1);
    const save = shotImpulse(m.ball, p, 'back', 1, {}, m.players, DEFAULTS);
    assert.ok(Math.hypot(save.vx, save.vy) <= 5.8 + 1e-9);
  }
});
test('save fully extends before arrival and puts the palm just beneath a reachable ball', () => {
  const p = { x: 0, y: 0, team: 0, facing: 1 };
  const far = localReceiveAim(p, { kind: 'back' }, { x: -2.5, y: 1 }, null, DEFAULTS);
  assert.equal(far.weight, 1);
  const near = localReceiveAim(p, { kind: 'back' }, { x: -0.6, y: 0.7 }, null, DEFAULTS);
  const pose = receiveWrists('back', near, 0.6);
  const hand = pose.wrists[pose.hands[0]];
  const height = (-hand.y * 2.1) / 42;
  assert.ok(height < 0.7 && height > 0.5);
});
