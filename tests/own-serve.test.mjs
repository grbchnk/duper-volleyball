import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { nextReceiver } from '../src/receiver-selection.js';

test('a net rebound from a serve cannot be received by any serving teammate', () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.reset('versus');
    m.phase = 'rally';
    m.server = m.lastTouch = team;
    m.lastPlayer = team * 3;
    m.incomingShot = 'serve';
    m.cooldown = 0;
    for (const p of m.players.filter((p) => p.team === team)) {
      Object.assign(m.ball, { x: p.x, y: 1, vx: m.sign(team) * 3, vy: -1 });
      assert.equal(m.canContact(p, 'low'), false);
      assert.equal(nextReceiver(m, team), null);
    }
    const p = m.players[team * 3 + 1];
    assert.equal(m.makeContact(p, 'low', 0.5, { vx: 5, vy: 5, vz: 0 }), false);
    assert.equal(m.phase, 'point');
    assert.equal(m.pointWinner, 1 - team);
    assert.equal(m.pointReason, 'КАСАНИЕ СВОЕЙ ПОДАЧИ');
    assert.equal(m.contacts, 0);
  }
});

test('opponents may receive a serve and the serving team may receive their return', () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.reset('versus');
    m.phase = 'rally';
    m.server = m.lastTouch = team;
    m.lastPlayer = team * 3;
    m.incomingShot = 'serve';
    for (const receivingTeam of [1 - team, team]) {
      const p = m.players[receivingTeam * 3 + 1];
      m.cooldown = 0;
      Object.assign(m.ball, {
        x: p.x,
        y: (m.config.lowContactMin + m.config.lowContactMax) / 2,
        vx: 0,
        vy: -1,
      });
      assert.equal(m.canContact(p, 'low'), true);
      assert.equal(
        m.makeContact(p, 'low', 0.5, { vx: -m.sign(receivingTeam) * 10, vy: 6, vz: 0 }),
        true,
      );
      assert.equal(m.phase, 'rally');
    }
  }
});
