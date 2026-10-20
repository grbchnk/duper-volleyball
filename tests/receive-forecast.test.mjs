import test from 'node:test';
import assert from 'node:assert/strict';
import { predictedLowContact } from '../src/receive-forecast.js';
import { localReceiveAim } from '../src/receive-pose.js';
import { contactBounds } from '../src/contact-rules.js';
import { integrateBall } from '../src/physics.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { Match } from '../src/engine.js';

const player = { x: -4, y: 0, z: 4.5, vx: 0, vy: 0, team: 0, facing: 1 };
const incoming = { x: -0.8, y: 5, z: 4.5, vx: -6, vy: -2, vz: 0 };

test('lower hands prepare on the future contact side even when the ball is currently on the other side', () => {
  const target = predictedLowContact(player, incoming, DEFAULTS);
  assert.ok(target && target.time > 0);
  assert.ok(incoming.x > player.x && target.x < player.x);
  const aim = localReceiveAim(player, { kind: 'low' }, incoming, null, DEFAULTS);
  const expected = localReceiveAim(player, { kind: 'low' }, target, null, DEFAULTS);
  assert.ok(Math.abs(aim.x - expected.x) < 1e-10);
  assert.ok(Math.abs(aim.y - expected.y) < 1e-10);
});

test('the predicted meeting stays stable along the real flight and does not mutate either input', () => {
  const ball = { ...incoming },
    before = structuredClone(ball),
    p = structuredClone(player);
  const target = predictedLowContact(player, ball, DEFAULTS);
  assert.deepEqual(ball, before);
  assert.deepEqual(player, p);
  for (let i = 0; i < 12; i++) integrateBall(ball, 1 / 120, DEFAULTS);
  const later = predictedLowContact(player, ball, DEFAULTS);
  assert.ok(Math.abs(later.x - target.x) < 0.02);
  assert.ok(Math.abs(later.y - target.y) < 0.02);
  assert.ok(Math.abs(later.time + 0.1 - target.time) < 0.01);
});

test('flight tempo and running affect when and where the receiving zone meets the ball', () => {
  for (const vx of [-0.3, 0, 0.3]) {
    const p = { ...player, vx };
    const target = predictedLowContact(p, incoming, DEFAULTS);
    assert.ok(target);
    const worldX = target.x - p.x + p.x + vx * target.time;
    const future = { ...p, x: p.x + vx * target.time };
    const bounds = contactBounds(future, 'low', DEFAULTS);
    assert.ok(worldX >= bounds.minX - 0.001 && worldX <= bounds.maxX + 0.001);
  }
  const normal = predictedLowContact(player, incoming, DEFAULTS);
  const slow = predictedLowContact(player, { ...incoming, flightTempo: 0.7 }, DEFAULTS);
  assert.ok(slow.time > normal.time);
  assert.ok(Math.abs(slow.x - normal.x) < 0.03);
});

test('an already reachable ball uses its actual location; impossible future contacts have no invented target', () => {
  const near = { ...incoming, x: -3.8, y: 0.8 };
  assert.deepEqual(predictedLowContact(player, near, DEFAULTS), { ...near, time: 0 });
  assert.equal(predictedLowContact(player, { ...incoming, vx: 10 }, DEFAULTS), null);
});

test('prepared lower hands receive the real incoming flight on either contact side without an early hit', () => {
  for (const vx of [-4.5, -5, -5.5, -6]) {
    const m = new Match();
    m.reset('versus');
    m.phase = 'rally';
    const p = m.players[1];
    p.x = -4;
    m.selected[0] = p.id;
    m.controls[0].manualSerial = m.shotSerial;
    for (const other of m.players) if (other !== p) other.benched = true;
    Object.assign(m.ball, incoming, { vx });
    let step = 0;
    for (; step < 120 && !m.contacts; step++) m.tick(FIXED_DT, step >= 36 ? { low: true } : {}, {});
    assert.equal(m.contacts, 1);
    assert.ok(step * FIXED_DT > 0.55, 'prediction cannot create an early remote contact');
  }
});
