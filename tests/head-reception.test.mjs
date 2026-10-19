import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { FIXED_DT } from '../src/config.js';

function headImpact(mode = 'versus', team = 0, slot = team) {
  const m = new Match();
  m.reset(mode);
  m.phase = 'rally';
  const p = m.players[m.controlledPlayer(m.controls[slot])];
  m.lastTouch = 1 - team;
  m.headHitEligible = m.headFlyEligible = true;
  m.incomingShot = 'drive';
  m.inputs = [{}, {}, {}];
  const previous = { ...m.ball, x: p.x, y: 2.6 };
  Object.assign(m.ball, { x: p.x, y: 1.9, vx: -m.sign(team) * 18, vy: -10 });
  return { m, p, previous };
}

test('every reception button protects its player from a head impact from the first press', () => {
  for (const [mode, team, slot] of [
    ['versus', 0, 0],
    ['versus', 1, 1],
    ['coop', 0, 0],
    ['coop', 0, 2],
  ])
    for (const kind of ['low', 'loft', 'drive', 'back']) {
      const { m, p, previous } = headImpact(mode, team, slot);
      m.inputs[slot] = { [kind]: true };
      const ball = { ...m.ball };
      assert.equal(m.tryHeadHit(previous), false, `${mode}/${slot}/${kind}`);
      assert.equal(p.stunned, 0);
      assert.equal(p.recovery, 0);
      assert.equal(p.headDetached, false);
      assert.deepEqual(m.ball, ball, 'protection does not invent a successful reception');
      m.inputs[slot] = {};
      assert.equal(m.tryHeadHit(previous), true, 'an unprepared player can still be knocked down');
    }
});

test('charged and released receptions protect the prepared player until the action expires', () => {
  for (const [mode, team, slot] of [
    ['versus', 0, 0],
    ['versus', 1, 1],
    ['coop', 0, 0],
    ['coop', 0, 2],
  ])
    for (const state of ['charge', 'pending'])
      for (const kind of ['low', 'loft', 'drive', 'back']) {
        const { m, p, previous } = headImpact(mode, team, slot);
        m.controls[slot][state] = { kind, playerId: p.id, age: 0, power: 0.4, ttl: 0.2, aim: {} };
        assert.equal(m.tryHeadHit(previous), false, `${mode}/${slot}/${state}/${kind}`);
        assert.equal(p.stunned, 0);
        m.controls[slot][state] = null;
        assert.equal(m.tryHeadHit(previous), true);
      }
});

test('a reception button protects only its controller player, including co-op', () => {
  for (const slot of [0, 2]) {
    const { m, p, previous } = headImpact('coop', 0, slot);
    m.inputs[slot === 0 ? 2 : 0] = { loft: true };
    assert.equal(m.tryHeadHit(previous), true);
    assert.ok(p.stunned > 0);
  }
});

test('real simulation keeps a player preparing upper reception standing through a head-height impact', () => {
  for (const [mode, team, slot] of [
    ['versus', 0, 0],
    ['versus', 1, 1],
    ['coop', 0, 0],
    ['coop', 0, 2],
  ]) {
    const { m, p } = headImpact(mode, team, slot);
    const control = m.controls[slot];
    control.manualSerial = m.shotSerial;
    if (mode === 'coop') m.coopManualSerial[slot] = m.shotSerial;
    Object.assign(m.ball, { x: p.x, y: 2.25, vx: 0, vy: -18 });
    for (let frame = 0; frame < 12; frame++) {
      m.tick(FIXED_DT, slot === 0 ? { loft: true } : {}, slot !== 0 ? { loft: true } : {});
      assert.equal(p.stunned, 0, mode + '/' + slot + '/' + frame);
      assert.equal(p.headDetached, false);
    }
  }
});
