import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { nextReceiver } from '../src/receiver-selection.js';
import { FIXED_DT } from '../src/config.js';

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

function deepAttack(mode = 'versus', team = 0, rotated = false) {
  const m = new Match();
  m.reset(mode);
  m.phase = 'rally';
  m.lastTouch = 1 - team;
  m.lastPlayer = (1 - team) * 3;
  m.incomingShot = 'drive';
  const slot = mode === 'coop' && rotated ? 2 : team;
  if (mode === 'coop' && rotated) {
    m.coopRotationCount = 1;
    m.selected[0] = m.coopPrimary = 2;
    m.coopSelected = 1;
  } else m.selected[team] = team * 3 + 1;
  const sign = m.sign(team);
  Object.assign(m.ball, { x: sign * 2, y: 5.2, vx: sign * 9, vy: -3 });
  return { m, slot, team, sign };
}

test('a deep attack prefers the back receiver when idle and keeps a reachable moving receiver', () => {
  for (const [mode, team, rotated] of [
    ['versus', 0, false],
    ['versus', 1, false],
    ['coop', 0, false],
    ['coop', 0, true],
  ])
    for (const moving of [false, true]) {
      const { m, slot, sign } = deepAttack(mode, team, rotated);
      const input = moving ? { axis: sign } : {};
      m.tick(FIXED_DT, slot === 0 ? input : {}, slot !== 0 ? input : {});
      const expected = team * 3 + (moving ? 1 : 0);
      assert.equal(m.controlledPlayer(m.controls[slot]), expected, `${mode}/${slot}/${moving}`);
      for (let i = 0; i < 8; i++) {
        m.tick(FIXED_DT, slot === 0 ? input : {}, slot !== 0 ? input : {});
        assert.equal(
          m.controlledPlayer(m.controls[slot]),
          expected,
          'the choice does not oscillate',
        );
      }
      if (mode === 'coop') assert.equal(m.coopPlayer(slot === 0 ? 2 : 0), 2);
    }
});

test('a deep attack transfers prepared shots but respects an explicit manual selection', () => {
  for (const lock of ['charge', 'pending', 'manual']) {
    const { m, slot } = deepAttack();
    const current = m.controlledPlayer(m.controls[slot]);
    if (lock === 'manual') m.controls[slot].manualSerial = m.shotSerial;
    else
      m.controls[slot][lock] = {
        kind: 'drive',
        playerId: current,
        power: 0.4,
        age: 0.1,
        ttl: 0.2,
        aim: {},
      };
    m.tick(FIXED_DT, { drive: lock === 'charge' });
    if (lock === 'manual') {
      assert.equal(m.controlledPlayer(m.controls[slot]), current, lock);
    } else {
      const selected = m.controlledPlayer(m.controls[slot]);
      assert.notEqual(selected, current, lock);
      assert.equal(m.controls[slot][lock]?.playerId, selected, `${lock} follows the new player`);
    }
  }
});

test('a moving receiver stays selected when already near the incoming reception point', () => {
  const { m, sign } = deepAttack();
  Object.assign(m.ball, { x: sign, y: 2.5, vx: sign * 6, vy: -2 });
  m.tick(FIXED_DT, { axis: sign });
  assert.equal(m.selected[0], 1);
});

test('a deep attack never selects an unavailable back player', () => {
  for (const state of ['benched', 'recovery', 'diving']) {
    const { m, sign } = deepAttack();
    m.players[0][state] = state === 'recovery' ? 1 : true;
    m.tick(FIXED_DT, { axis: sign });
    assert.notEqual(m.selected[0], 0, state);
  }
});
test('a prepared shot follows automatic selection within the rotated back pair', () => {
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
  m.controls[2].pending = null;
  m.updateCoopReceiver();
  assert.equal(m.coopSelected, 0);
});

function chasingReceiver(mode, team, rotated) {
  const m = new Match();
  m.reset(mode);
  m.phase = 'rally';
  m.lastTouch = 1 - team;
  m.lastPlayer = (1 - team) * 3;
  m.incomingShot = 'serve';
  const slot = mode === 'coop' && rotated ? 2 : team;
  if (mode === 'coop' && rotated) {
    m.coopRotationCount = 1;
    m.selected[0] = m.coopPrimary = 2;
    m.coopSelected = 1;
  } else m.selected[team] = team * 3 + 1;
  const side = m.sign(team);
  for (const [i, x] of [7, 3.7, 0.8].entries()) m.players[team * 3 + i].x = side * x;
  Object.assign(m.ball, { x: side * 5.9, y: 3.2, vx: side * 2.6, vy: 0 });
  return { m, slot, side };
}

for (const [mode, team, rotated] of [
  ['versus', 0, false],
  ['versus', 1, false],
  ['coop', 0, false],
  ['coop', 0, true],
]) {
  const label = mode + '/' + team + '/' + rotated;
  test(
    label + ': running central receiver keeps a reachable serve despite a nearer back player',
    () => {
      const { m, slot, side } = chasingReceiver(mode, team, rotated);
      assert.equal(
        nextReceiver(m, team, { currentId: team * 3 + 1 }),
        team * 3,
        'the idle forecast would prefer the back player',
      );
      for (let frame = 0; frame < 12; frame++) {
        m.tick(FIXED_DT, slot === 0 ? { axis: side } : {}, slot !== 0 ? { axis: side } : {});
        assert.equal(m.controlledPlayer(m.controls[slot]), team * 3 + 1);
      }
      if (mode === 'coop') assert.equal(m.coopPlayer(slot === 0 ? 2 : 0), 2);
      m.tick(FIXED_DT);
      assert.equal(
        m.controlledPlayer(m.controls[slot]),
        team * 3,
        'releasing movement restores normal receiver preference without a delay',
      );
    },
  );

  test(
    label + ': movement still allows a reachable teammate to rescue an impossible reception',
    () => {
      const { m, slot, side } = chasingReceiver(mode, team, rotated);
      Object.assign(m.ball, { x: side * 7, y: 0.8, vx: 0, vy: -2 });
      m.tick(FIXED_DT, slot === 0 ? { axis: side } : {}, slot !== 0 ? { axis: side } : {});
      assert.equal(m.controlledPlayer(m.controls[slot]), team * 3);
      if (mode === 'coop') assert.equal(m.coopPlayer(slot === 0 ? 2 : 0), 2);
    },
  );
}
