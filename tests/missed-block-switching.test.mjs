import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { FIXED_DT } from '../src/config.js';

function missedBlock(team = 0, target = 1) {
  const m = new Match();
  m.reset('versus');
  m.phase = 'rally';
  m.lastTouch = 1 - team;
  m.lastPlayer = (1 - team) * 3;
  m.incomingShot = 'drive';
  m.teamPhases = ['defense', 'defense'];
  const side = m.sign(team);
  m.players[team * 3].x = side * 7;
  m.selected[team] = team * 3 + 2;
  m.controls[team].manualSerial = m.shotSerial;
  assert.equal(m.requestBlock(team), true);
  Object.assign(m.ball, {
    x: m.players[team * 3 + target].x,
    y: 1.6,
    vx: side * 2,
    vy: -2,
  });
  return m;
}

test('a missed block hands control to the middle or back player before landing on both teams', () => {
  for (const team of [0, 1])
    for (const target of [0, 1])
      for (const held of [false, true]) {
        const m = missedBlock(team, target);
        const blocker = m.players[team * 3 + 2];
        const input = held ? { axis: m.sign(team), block: true, jumpHeld: true } : {};
        m.controls[team].previousInput = { ...input };
        m.tick(FIXED_DT, team === 0 ? input : {}, team === 1 ? input : {});
        assert.equal(m.selected[team], team * 3 + target);
        assert.ok(blocker.jumpProfile, 'the former blocker finishes the same jump');
        assert.ok(blocker.block > 0);
        assert.equal(
          m.controls[team].manualSerial,
          -1,
          'the missed block releases the manual lock',
        );
        m.tick(FIXED_DT, team === 0 ? input : {}, team === 1 ? input : {});
        assert.equal(m.selected[team], team * 3 + target, 'control stays with the receiver');
      }
});

test('the blocker keeps control while the ball approaches, remains within reach or travels back to the net', () => {
  for (const [x, vx] of [
    [0.3, -2],
    [-0.9, -2],
    [-3.7, 2],
  ]) {
    const m = missedBlock();
    Object.assign(m.ball, { x, vx, y: 4 });
    m.tick(FIXED_DT);
    assert.equal(m.selected[0], 2);
  }
});

test('a missed block never interrupts a separately prepared shot', () => {
  for (const kind of ['charge', 'pending']) {
    const m = missedBlock();
    m.controls[0][kind] = {
      kind: 'low',
      playerId: 2,
      age: 0,
      power: 0.4,
      ttl: 1,
      aim: {},
    };
    m.tick(FIXED_DT, kind === 'charge' ? { low: true } : {});
    assert.equal(m.selected[0], 2);
  }
});

test('co-op releases a missed block only within the same controller ownership on either rotation', () => {
  for (const rotated of [false, true])
    for (const front of [false, true]) {
      const m = missedBlock(0, 0);
      m.mode = 'coop';
      m.coopRotationCount = rotated ? 1 : 0;
      const slot = front ? (rotated ? 0 : 2) : rotated ? 2 : 0;
      const current = front ? 2 : 1;
      m.players[2].jumpProfile = null;
      m.players[2].block = 0;
      m.players[2].blockCooldown = 0;
      m.selected[0] = m.coopPrimary = rotated ? 2 : 1;
      m.coopSelected = rotated ? 1 : 2;
      m.controls[slot].manualSerial = m.coopManualSerial[slot] = m.shotSerial;
      assert.equal(m.requestBlock(0, m.controls[slot]), true);
      m.tick(FIXED_DT);
      assert.equal(m.coopPlayer(slot), front ? current : 0);
      if (front) assert.ok(m.coopPlayer(slot === 0 ? 2 : 0) < 2);
      else assert.equal(m.coopPlayer(slot === 0 ? 2 : 0), 2);
      assert.ok(m.players[current].jumpProfile);
    }
});
