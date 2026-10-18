import test from 'node:test';
import assert from 'node:assert/strict';
import { InputBuffer } from '../src/input.js';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { shotImpulse } from '../src/moves.js';
import { preparedHands } from '../src/held-contact.js';

const player = { id: 2, team: 0, x: -2, y: 1, facing: 1 };
const ball = { x: -2, y: 3, vx: 0, vy: -2, z: 4.5 };
const impulse = (kind, power, vector, extra = {}, p = player) =>
  shotImpulse(ball, p, kind, power, { manualControl: true, vector, ...extra }, [p], DEFAULTS);
const speed = (v) => Math.hypot(v.vx, v.vy);

test('all three contacts preserve forward/back intent and respond to charge on both teams', () => {
  for (const team of [0, 1])
    for (const kind of ['low', 'loft', 'drive'])
      for (const modifiers of [{}, { soft: true }, { fast: true }])
        for (const x of [-1, 1]) {
          const weak = impulse(kind, 0.1, { x, y: 0.4 }, modifiers, { ...player, team });
          const strong = impulse(kind, 0.9, { x, y: 0.4 }, modifiers, { ...player, team });
          assert.equal(Math.sign(strong.vx), x);
          assert.ok(speed(strong) > speed(weak) * 1.3);
          assert.equal(strong.targetId, null);
        }
});
test('Square is always a lob; Triangle can deliberately send a two-hand ball down', () => {
  for (const modifiers of [{}, { fast: true }, { soft: true }]) {
    assert.ok(impulse('low', 0.6, { x: 1, y: -1 }, modifiers).vy > 0);
    assert.ok(impulse('loft', 0.6, { x: 1, y: -1 }, modifiers).vy < 0);
    assert.ok(impulse('loft', 0.6, { x: 1, y: 1 }, modifiers).vy > 0);
  }
});
test('R2 accelerates and flattens each shot; L2 stays soft even at full windup', () => {
  for (const kind of ['low', 'loft', 'drive']) {
    const normal = impulse(kind, 1, { x: 1, y: 0.6 });
    const fast = impulse(kind, 1, { x: 1, y: 0.6 }, { fast: true });
    const soft = impulse(kind, 1, { x: 1, y: 0.6 }, { soft: true });
    assert.ok(speed(fast) > speed(normal));
    assert.ok(Math.abs(fast.vy / fast.vx) < Math.abs(normal.vy / normal.vx));
    assert.ok(speed(soft) < speed(normal));
    assert.deepEqual(impulse(kind, 1, { x: 1, y: 0.6 }, { soft: true, fast: true }), soft);
  }
});
test('right stick and click stay inert even with old saved right-stick mode enabled', () => {
  const pad = {
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
  };
  const i = new InputBuffer(() => [pad]);
  i.rightStickAim = true;
  for (const [x, y] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.7, 0.7],
  ]) {
    pad.axes[2] = x;
    pad.axes[3] = y;
    pad.buttons[11].pressed = true;
    i.poll();
    const s = i.read();
    for (const key of ['low', 'loft', 'drive', 'back', 'dive', 'jump']) assert.equal(s[key], false);
    assert.equal(s.stickShot, null);
    assert.equal(s.buttonVector, null);
  }
  for (const [key, axis] of [
    ['KeyQ', -1],
    ['KeyE', 1],
  ]) {
    i.down(key);
    assert.equal(i.read().diveAxis, axis);
    i.consume();
    i.up(key);
    assert.equal(i.read().dive, false);
  }
});
test('soft modifier survives release while direction follows the current input', () => {
  const m = new Match();
  m.reset('versus');
  m.phase = 'rally';
  m.ball.x = -4;
  m.ball.y = 12;
  m.ball.vy = 0;
  for (let n = 0; n < 12; n++)
    m.tick(FIXED_DT, { drive: true, buttonVector: { x: -0.8, y: 0.6 }, l2: true, intent: 'soft' });
  assert.ok(m.controls[0].charge.power > 0.08 && m.controls[0].charge.power < 1);
  m.tick(FIXED_DT, {});
  assert.equal(m.controls[0].pending.aim.soft, true);
  assert.equal(m.controls[0].pending.aim.vector, undefined);
  m.tick(FIXED_DT, { buttonVector: { x: 1, y: 0 } });
  assert.deepEqual(m.controls[0].pending.aim.vector, { x: 1, y: 0 });
});
test('L2 prepares only one contact hand at both lower and upper heights', () => {
  const m = new Match();
  m.reset('versus');
  m.phase = 'rally';
  const p = m.active();
  for (const kind of ['low', 'loft']) {
    const a = {
      kind,
      playerId: p.id,
      power: 0.6,
      age: 0.4,
      aim: { manualControl: true, soft: true },
    };
    assert.equal(preparedHands(p, m, a).length, 1);
    assert.equal(preparedHands(p, m, { ...a, aim: {} }).length, 2);
  }
});
test('partners fill free space and wait before the human instead of crossing their body', () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.reset('versus');
    m.phase = 'rally';
    const sign = team === 0 ? -1 : 1;
    m.selected[team] = team * 3 + 2;
    const human = m.active(team);
    human.x = sign * 7;
    for (let n = 0; n < 240; n++) m.movePlayers(FIXED_DT, {});
    assert.equal(human.x, sign * 7);
    const bots = m.players.filter((p) => p.team === team && p.id !== human.id);
    assert.ok(bots.some((p) => Math.abs(p.x - sign * 0.8) < 0.1));
    assert.ok(bots.some((p) => Math.abs(p.x - sign * (team === 0 ? 8.25 : 3.7)) < 0.1));
    assert.ok(bots.every((p) => Math.abs(p.x - human.x) >= 1.24));
    const homes = bots.map((p) => p.homeX);
    for (let n = 0; n < 120; n++) {
      human.x = sign * (7 + Math.sin(n) * 0.1);
      m.movePlayers(FIXED_DT, {});
    }
    assert.deepEqual(
      bots.map((p) => p.homeX),
      homes,
    );
    assert.ok(bots.every((p) => Math.abs(p.vx) < 0.01));
  }
});

test('full charge releases every shot once and requires a fresh button press', () => {
  for (const kind of ['low', 'loft', 'drive'])
    for (const modifier of [{}, { l2: true }, { r2: true }]) {
      const m = new Match();
      m.reset('versus');
      m.phase = 'rally';
      Object.assign(m.ball, { x: -4, y: 12, vx: 0, vy: 0 });
      const input = { [kind]: true, ...modifier, buttonVector: { x: -0.8, y: 0.6 } };
      m.tick(FIXED_DT, input);
      for (let n = 0; n < 150 && m.controls[0].charge; n++) m.tick(FIXED_DT, input);
      assert.equal(m.controls[0].charge, null);
      assert.equal(m.controls[0].pending?.power, 1);
      assert.deepEqual(m.controls[0].pending.aim.vector, { x: -0.8, y: 0.6 });
      assert.equal(m.controls[0].pending.aim.soft, !!modifier.l2);
      assert.equal(m.controls[0].pending.aim.fast, !!modifier.r2);
      for (let n = 0; n < 50; n++) m.tick(FIXED_DT, input);
      assert.equal(m.controls[0].charge, null);
      assert.equal(m.controls[0].pending, null);
      m.tick(FIXED_DT, {});
      m.tick(FIXED_DT, input);
      assert.equal(m.controls[0].charge?.kind, kind);
      assert.ok(m.controls[0].charge.power < 1);
    }
});
