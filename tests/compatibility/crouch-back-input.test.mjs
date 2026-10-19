import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { InputBuffer } from '../../src/input.js';
import { Match } from './legacy-contract.js';
import { FIXED_DT } from '../../src/config.js';
import { SHOTS, shotImpulse } from '../../src/moves.js';
import { playerFrame, BODY_CLIPS } from '../../src/sprites.js';
import { expressivePose } from '../../src/arm-motion.js';
import { ARM_STYLES } from '../../src/arms.js';
import { preparedHands } from '../../src/held-contact.js';

test('down crouches without a shot or dive; X receives and retired A is inert', () => {
  const input = new InputBuffer(() => []);
  input.down('ArrowDown');
  assert.equal(input.read().crouch, true);
  assert.equal(input.read().low, false);
  assert.equal(input.read().dive, false);
  input.down('KeyX');
  assert.equal(input.read().low, true);
  input.clear();
  input.down('KeyA');
  assert.equal(input.read().back, false);
  assert.equal(input.read().low, false);
});

test('triple taps dive once in the tapped direction; holds, repeats, mixed and slow taps do not', () => {
  let now = 0;
  const input = new InputBuffer(
    () => [],
    () => now,
  );
  const tap = (code) => {
    input.down(code);
    input.up(code);
    input.consume();
  };
  tap('ArrowRight');
  now = 60;
  tap('ArrowRight');
  assert.equal(input.read().dive, false);
  now = 120;
  input.down('ArrowRight');
  assert.equal(input.read().dive, true);
  assert.equal(input.read().diveAxis, 1);
  input.consume();
  input.down('ArrowRight', true);
  assert.equal(input.read().dive, false);
  input.clear();
  tap('ArrowLeft');
  now += 60;
  tap('ArrowLeft');
  now += 60;
  input.down('ArrowLeft');
  assert.equal(input.read().diveAxis, -1);
  input.clear();
  tap('ArrowLeft');
  now += 100;
  tap('ArrowRight');
  assert.equal(input.read().dive, false);
  now += 400;
  input.down('ArrowRight');
  assert.equal(input.read().dive, false);
});

test('left stick down crouches and three sideways flicks dive, with a neutral reset', () => {
  let now = 0;
  const pad = { connected: true, mapping: 'standard', axes: [0, 0.9, 0, 0], buttons: [] };
  const input = new InputBuffer(
    () => [pad],
    () => now,
  );
  input.poll();
  assert.equal(input.read().crouch, true);
  assert.equal(input.read().low, false);
  pad.axes[1] = 0;
  pad.axes[0] = -0.9;
  input.poll();
  assert.equal(input.read().dive, false);
  pad.axes[0] = -0.5;
  input.poll();
  pad.axes[0] = -0.9;
  input.poll();
  assert.equal(input.read().dive, false);
  pad.axes[0] = 0;
  input.poll();
  now = 150;
  pad.axes[0] = -0.9;
  input.poll();
  assert.equal(input.read().dive, false);
  pad.axes[0] = 0;
  input.poll();
  now += 100;
  pad.axes[0] = -0.9;
  input.poll();
  assert.equal(input.read().diveAxis, -1);
  input.consume();
  input.poll();
  assert.equal(input.read().dive, false);
});

test('crouch animates down and up, and every shot remains usable at the lowered height', () => {
  for (const kind of Object.keys(SHOTS)) {
    const m = new Match();
    m.startDrill('receive');
    const p = m.active();
    Object.assign(m.ball, { x: 4, y: 15, vx: 0, vy: 0 });
    for (let n = 0; n < 20; n++) m.tick(FIXED_DT, { crouch: true });
    assert.equal(p.crouchAmount, 1);
    assert.equal(playerFrame(p, m).state, 'squat');
    assert.equal(m.charge, null);
    assert.equal(p.diving, false);
    m.tick(FIXED_DT, { crouch: true, [kind]: true });
    Object.assign(m.ball, { x: p.x, y: kind === 'low' ? 0.5 : 1.7, vx: 0, vy: 0 });
    if (kind === 'back') Object.assign(m.ball, preparedHands(p, m, { ...m.charge, age: 0.2 })[0]);
    m.tick(FIXED_DT, { crouch: true });
    assert.equal(m.contacts, 1, kind);
    assert.equal(p.armSwing.kind, kind);
    for (let n = 0; n < 20; n++) m.tick();
    assert.equal(p.crouchAmount, 0);
  }
  assert.ok(BODY_CLIPS.squat.frames.at(-1).y > BODY_CLIPS.squat.frames[0].y);
});

test('one-hand save defaults behind the player with a soft impulse and distinct windup', () => {
  for (const team of [0, 1]) {
    const m = new Match(),
      p = m.player(team, 'open');
    const b = { ...m.ball, x: p.x, y: 1.8 };
    const impulse = shotImpulse(b, p, 'back', 0.6, { axis: 0 }, m.players, m.config);
    assert.ok(Math.hypot(impulse.vx, impulse.vy) <= 7.2);
    assert.equal(Math.sign(impulse.vx), m.sign(team));
    assert.ok(impulse.vy > 0);
  }
  const args = { spec: ARM_STYLES.whip, config: DEFAULTS, charge: { age: 0.2, power: 0.7 } };
  const back = expressivePose({ ...args, kind: 'back' }),
    front = expressivePose({ ...args, kind: 'loft' });
  assert.ok(back.wrists[0].x < -15);
  assert.ok(back.wrists[1].y > -20);
  assert.notDeepEqual(back.wrists, front.wrists);
  const idle = expressivePose({ ...args, kind: null, charge: null });
  const recovered = expressivePose({
    ...args,
    kind: 'back',
    charge: null,
    swing: { hit: false, age: 0.7, power: 0.7 },
  });
  assert.deepEqual(recovered.wrists, idle.wrists);
});
