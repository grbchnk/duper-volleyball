import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { nextReceiver } from '../src/receiver-selection.js';

function critical(mode = 'coop') {
  const m = new Match();
  m.reset(mode);
  m.phase = 'rally';
  m.lastTouch = 1;
  m.lastPlayer = 3;
  m.selected[0] = m.coopPrimary = 1;
  m.players[0].x = -7;
  m.players[1].x = -3.7;
  m.players[2].x = -0.8;
  Object.assign(m.ball, { x: -5.9, y: 3.2, vx: -2.6, vy: 0 });
  return m;
}
test('a ball past the near player goes to the deeper receiver even when a theoretical sprint is possible', () => {
  const m = critical('match');
  m.config = { ...m.config, dynamic: false };
  assert.equal(nextReceiver(m, 0), 1);
  m.config = { ...m.config, dynamic: true };
  assert.equal(nextReceiver(m, 0), 0);
});
test('co-op preserves a manual receiver choice until the next contact', () => {
  const m = critical();
  m.coopManualSerial[0] = m.shotSerial;
  m.controls[0].charge = { kind: 'loft', age: 0.2, power: 0.63, playerId: 1 };
  m.updateCoopReceiver();
  assert.equal(m.selected[0], 1);
  assert.equal(m.coopSelected, 2);
  assert.equal(m.controls[0].charge.playerId, 1);
  assert.equal(m.controls[0].charge.power, 0.63);
  for (let i = 0; i < 10; i++) m.updateCoopReceiver();
  assert.equal(m.selected[0], 1, 'manual control is not overridden by the forecast');
});
test('a missed scripted run cannot lock out the only deep receiver', () => {
  const m = critical('match');
  m.teamRuns[0] = { playerId: 1, cancelled: false, serial: m.shotSerial, at: m.time + 1 };
  assert.equal(nextReceiver(m, 0), 0);
});
test('a deep receiver recovering from a dive is never selected', () => {
  const m = critical();
  m.players[0].recovery = 0.4;
  assert.notEqual(nextReceiver(m, 0, { exclude: [2] }), 0);
});
test('an unreachable ball hands off within the rotated back pair', () => {
  const m = critical();
  m.rallies = 3;
  m.coopRotationCount = 1;
  m.selected[0] = m.coopPrimary = 2;
  m.coopSelected = 1;
  m.controls[2].pending = { kind: 'loft', power: 0.4, ttl: 0.1, playerId: 1 };
  Object.assign(m.ball, { x: -7, y: 0.8, vx: 0, vy: -2 });
  m.updateCoopReceiver();
  assert.equal(m.selected[0], 2);
  assert.equal(m.coopSelected, 0);
  assert.equal(m.controls[2].pending.playerId, 0);
});
