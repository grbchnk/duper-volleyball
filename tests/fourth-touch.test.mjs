import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { FIXED_DT } from '../src/config.js';
import { shotSettings } from '../src/shot-settings.js';

function fourthBall(team) {
  const m = new Match();
  m.reset('versus');
  m.phase = 'rally';
  m.lastTouch = team;
  m.lastPlayer = team * 3 + 1;
  m.touches[team] = 3;
  const p = m.players[team * 3];
  Object.assign(m.ball, { x: p.x, y: 1.8, vx: 0, vy: -2 });
  return { m, p };
}

test('a fourth contact hits the ball and immediately awards the rally with the fault banner', () => {
  for (const team of [0, 1])
    for (const kind of ['low', 'loft', 'drive']) {
      const { m, p } = fourthBall(team);
      const impulse = { vx: -m.sign(team) * 7, vy: 5, vz: 0 };
      assert.equal(m.makeContact(p, kind, 0.6, impulse), true);
      assert.equal(m.touches[team], 4);
      assert.equal(m.contacts, 1);
      assert.equal(m.lastPlayer, p.id);
      assert.equal(m.ball.vx, impulse.vx);
      assert.equal(m.ball.vy, impulse.vy);
      assert.equal(p.armSwing.kind, kind);
      assert.equal(p.armSwing.hit, true);
      assert.ok(p.contact);
      assert.ok(p.animation > 0);
      assert.ok(p.emotion.age < 0, 'the reaction does not hide the contact animation');
      assert.equal(m.phase, 'point');
      assert.equal(m.pointWinner, 1 - team);
      assert.equal(m.pointReason, 'ЧЕТВЁРТОЕ КАСАНИЕ');
      assert.deepEqual(
        m.events.slice(-2).map((e) => e.type),
        ['hit', 'point'],
      );
      const x = m.ball.x;
      m.tick(FIXED_DT);
      assert.notEqual(m.ball.x, x, 'the struck ball continues flying after the whistle');
      assert.equal(m.rallies, 1);
    }
});

test('a released fourth shot is consumed as a real hit and clears the controls', () => {
  for (const team of [0, 1]) {
    const { m, p } = fourthBall(team);
    const settings = shotSettings(m.config, 'drive');
    m.ball.y = (settings.ContactMin + settings.ContactMax) / 2;
    const control = m.controls[team];
    control.pending = { kind: 'drive', playerId: p.id, power: 0.6, age: 0.2, ttl: 0.2, aim: {} };
    assert.equal(m.tryPending(m.ball, control), true);
    assert.equal(m.phase, 'point');
    assert.equal(m.pointReason, 'ЧЕТВЁРТОЕ КАСАНИЕ');
    assert.equal(m.contacts, 1);
    assert.equal(control.pending, null);
    assert.equal(control.charge, null);
    assert.equal(p.armSwing.hit, true);
  }
});
