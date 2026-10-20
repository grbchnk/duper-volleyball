import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS as CURRENT, FIXED_DT, sanitizeConfig } from '../../src/config.js';
import { InputBuffer } from '../../src/input.js';
import { Match } from './legacy-contract.js';
import { preparedHands } from '../../src/held-contact.js';
import { localReceiveAim } from '../../src/receive-pose.js';
import { simulateServe } from '../../src/serve-lab.js';
import { simulateShot } from '../../src/shot-lab.js';
import { nextReceiver } from '../../src/receiver-selection.js';

const pad = () => ({
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
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
  assert.equal(sanitizeConfig({ homeColor: 'red' }).homeColor, CURRENT.homeColor);
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
  m.incomingShot = 'loft';
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
