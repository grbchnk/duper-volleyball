import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { InputBuffer } from '../src/input.js';
import { Match } from '../src/engine.js';
import { preparedHands } from '../src/held-contact.js';
import { localReceiveAim } from '../src/receive-pose.js';
import { simulateServe } from '../src/serve-lab.js';
import { simulateShot } from '../src/shot-lab.js';
import { nextReceiver } from '../src/receiver-selection.js';

const pad = () => ({
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
});
test('right-stick priority pins type, updates aim, and retains direction on release', () => {
  let now = 0;
  const controller = pad(),
    input = new InputBuffer(
      () => [controller],
      () => now,
    );
  input.rightStickAim = true;
  const m = new Match({ ...DEFAULTS, rightStickAim: true, assist: false });
  m.startDrill('receive');
  Object.assign(m.ball, { x: 6, y: 10 });
  const step = () => {
    input.poll();
    m.tick(FIXED_DT, input.read());
    input.consume();
  };
  controller.axes[3] = 0.7;
  step();
  controller.axes[2] = -0.7;
  controller.axes[3] = 0;
  step();
  assert.equal(m.charge.kind, 'low');
  assert.deepEqual(m.charge.aim.vector, { x: -1, y: -0 });
  controller.axes[2] = 0;
  step();
  now += 48;
  step();
  assert.equal(m.pending.kind, 'low');
  assert.equal(m.pending.aim.vector.x, -1);
});
test('Q/E and R3 produce one dive pulse without switching players', () => {
  const controller = pad(),
    input = new InputBuffer(() => [controller]);
  for (const [key, direction] of [
    ['KeyQ', -1],
    ['KeyE', 1],
  ]) {
    input.down(key);
    assert.equal(input.read().diveAxis, direction);
    assert.equal(input.read().switch, false);
    assert.equal(input.read().select, 0);
    input.consume();
    assert.equal(input.read().dive, false);
    input.up(key);
  }
  controller.axes[0] = -0.8;
  controller.buttons[11].pressed = true;
  input.poll();
  assert.equal(input.read().diveAxis, -1);
  input.consume();
  input.poll();
  assert.equal(input.read().dive, false);
});
test('held palm contacts obey the configured height band', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.active();
  m.charge = { kind: 'loft', playerId: p.id, age: 0.2, power: 0.5, aim: {} };
  Object.assign(m.ball, preparedHands(p, m)[0], { vx: 0, vy: 0 });
  m.updateConfig({ ...DEFAULTS, loftContactMax: 1.7 });
  assert.equal(m.tryHeldContact(), false);
  m.updateConfig(DEFAULTS);
  assert.equal(m.tryHeldContact(), true);
});
test('save arm upper angle limits actual receive target on both sides', () => {
  for (const side of [-1, 1]) {
    const aim = localReceiveAim(
      { x: 0, y: 0, team: 0, facing: 1 },
      { kind: 'back' },
      { x: side, y: 2 },
      null,
      { ...DEFAULTS, backArmMax: 0 },
    );
    assert.equal(aim.y, 0);
  }
});
test('serve records the second press separately from miss completion', () => {
  const ideal = simulateServe(DEFAULTS, { kind: 'loft', power: 0.5 });
  const miss = simulateServe(DEFAULTS, { kind: 'loft', power: 0.5, timingOffset: -0.6 });
  assert.equal(ideal.hit, true);
  assert.ok(Math.abs(ideal.pressTime - ideal.motion.ideal) <= FIXED_DT);
  assert.equal(miss.hit, false);
  assert.ok(miss.pressTime < miss.launchTime);
  assert.equal(miss.frames[miss.pressFrame].action.attempted, true);
});
test('air angle and spin measurably alter the simulated trajectory', () => {
  const base = { ...DEFAULTS, assist: false };
  const shoot = (config, height) => simulateShot(config, { kind: 'loft', power: 1, height });
  const air = { ...base, loftAirAngleMax: 25 };
  assert.equal(shoot(base, 0).impulse.vy, shoot(air, 0).impulse.vy);
  assert.notEqual(shoot(base, 1).impulse.vy, shoot(air, 1).impulse.vy);
  assert.ok(shoot({ ...base, loftSpinMax: 2 }, 0).points[60].y < shoot(base, 0).points[60].y);
});
test('appearance and controls roundtrip through validated JSON', () => {
  const config = sanitizeConfig({
    ...DEFAULTS,
    awaySkin: 'fox',
    homeColor: '#abcdef',
    ballSize: 1.5,
    ballSkin: 'neon',
    rightStickAim: true,
  });
  assert.deepEqual(sanitizeConfig(JSON.parse(JSON.stringify(config))), config);
  assert.equal(sanitizeConfig({ ballSize: 9, homeColor: 'red' }).ballSize, 1.8);
  assert.equal(sanitizeConfig({ homeColor: 'red' }).homeColor, DEFAULTS.homeColor);
});
test('a missed fast ball hands control to the reachable teammate, on either side', () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.reset('versus');
    m.phase = 'rally';
    m.lastTouch = 1 - team;
    m.lastPlayer = (1 - team) * 3;
    const sign = team ? 1 : -1;
    m.selected[team] = team * 3 + 2;
    m.players[team * 3 + 2].x = sign * 0.8;
    m.players[team * 3 + 1].x = sign * 4;
    m.players[team * 3].x = sign * 7;
    Object.assign(m.ball, { x: sign * 3.7, y: 1, vx: sign * 12, vy: -2 });
    assert.equal(nextReceiver(m, team), team * 3 + 1);
    m.tick();
    assert.equal(m.selected[team], team * 3 + 1);
    assert.equal(nextReceiver(m, team), team * 3 + 1, 'no oscillation while still reachable');
  }
});
test('receiver selection excludes the last hitter and unavailable teammates', () => {
  const m = new Match();
  m.phase = 'rally';
  m.selected[0] = 2;
  m.players[2].x = -0.8;
  m.players[1].x = -4;
  m.players[0].x = -7;
  m.lastTouch = 0;
  m.lastPlayer = 1;
  Object.assign(m.ball, { x: -4, y: 1, vx: -18, vy: -1 });
  assert.equal(nextReceiver(m, 0), 0);
  m.players[0].recovery = 1;
  assert.equal(nextReceiver(m, 0), null);
});
test('CPU does not prepare or intercept its own outgoing serve', () => {
  const m = new Match();
  m.reset('demo');
  m.server = 1;
  m.startServe();
  m.beginServe({ kind: 'loft', power: 0.54, aim: {} });
  while (m.phase === 'serve-motion') m.tick();
  let crossed = false;
  for (let i = 0; i < 500 && m.phase === 'rally'; i++) {
    if (m.ball.x < 0) {
      crossed = true;
      break;
    }
    m.tick();
    assert.equal(m.actionFor(1), null);
    assert.equal(m.stats.passes[1], 0);
  }
  assert.ok(crossed);
});
test('CPU preparation is late, bounded, and charges at the human rate', () => {
  const m = new Match();
  m.reset('demo');
  m.phase = 'rally';
  m.lastTouch = 0;
  m.lastPlayer = 0;
  Object.assign(m.ball, { x: -6, y: 4, vx: 6, vy: 8 });
  m.updateCPU();
  assert.equal(m.actionFor(1), null);
  let seen = false;
  for (let i = 0; i < 600 && m.phase === 'rally'; i++) {
    m.tick();
    const a = m.actionFor(1);
    if (!a) continue;
    seen = true;
    assert.ok(a.age <= m.config.maxHold);
    assert.ok(a.power <= 0.08 + a.age / m.config.chargeSeconds + 1e-9);
  }
  assert.ok(seen);
});
test('net clearance applies to ground movement and airborne players', () => {
  const m = new Match();
  m.reset('versus');
  m.phase = 'rally';
  for (const team of [0, 1]) {
    const p = m.active(team);
    p.x = team ? 0.1 : -0.1;
    m.animatePlayers(FIXED_DT);
    assert.ok(Math.abs(p.x) >= 0.65);
  }
});

test('priority aim ignores return drift and recoil after a minimal upward flick', () => {
  let now = 0;
  const controller = pad(),
    input = new InputBuffer(
      () => [controller],
      () => now,
    );
  input.rightStickAim = true;
  for (const [time, y] of [
    [0, -0.7],
    [8, -0.3],
    [16, 0],
    [24, 0.32],
    [48, 0.1],
  ]) {
    now = time;
    controller.axes[3] = y;
    input.poll();
    assert.equal(input.shotStick, 'loft');
    assert.equal(input.shotVector.y, 1);
  }
  now = 64;
  controller.axes[3] = 0;
  input.poll();
  assert.equal(input.shotStick, null);
  now = 72;
  controller.axes[3] = 0.3;
  input.poll();
  assert.equal(input.shotStick, null, 'spring recoil must not start a second shot');
});

test('deliberate reversal through neutral aims save forward and drive backward', () => {
  for (const initial of [-1, 1]) {
    let now = 0;
    const controller = pad(),
      input = new InputBuffer(
        () => [controller],
        () => now,
      );
    input.rightStickAim = true;
    controller.axes[2] = initial * 0.9;
    input.poll();
    now = 16;
    controller.axes[2] = 0;
    input.poll();
    now = 32;
    controller.axes[2] = -initial * 0.9;
    input.poll();
    assert.equal(input.shotStick, initial < 0 ? 'back' : 'drive');
    assert.equal(input.shotVector.x, -initial);
    now = 48;
    controller.axes[2] = 0;
    input.poll();
    assert.equal(input.shotVector.x, -initial);
    now = 96;
    input.poll();
    assert.equal(input.shotStick, null);
    now = 170;
    controller.axes[3] = -0.8;
    input.poll();
    assert.equal(input.shotStick, 'loft', 'a separate gesture can select another type');
  }
});
