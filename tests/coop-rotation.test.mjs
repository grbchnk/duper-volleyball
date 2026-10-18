import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { FIXED_DT } from '../src/config.js';
import { capture, restore } from '../src/replay.js';
import { heldServeBall } from '../src/serve-support.js';

function rotate(m, winner = 0) {
  m.phase = 'rally';
  m.point(winner, 'ПРОВЕРКА');
  m.startServe();
}
test('roles alternate only after our wins and stay fixed after opponent points', () => {
  const m = new Match();
  m.reset('coop');
  for (const winner of [0, 1, 1, 0, 1, 0]) {
    const beforeRotation = m.coopRotationCount;
    const back = beforeRotation % 2 === 0 ? 0 : 2;
    assert.equal(m.coopBackSlot, back);
    assert.ok(m.coopOwns(back, 0) && m.coopOwns(back, 1));
    assert.equal(m.coopPlayer(back === 0 ? 2 : 0), 2);
    m.phase = 'rally';
    m.switchPlayer(m.controls[back]);
    assert.equal(m.coopPlayer(back), 1);
    m.switchPlayer(m.controls[back === 0 ? 2 : 0]);
    assert.equal(m.coopPlayer(back === 0 ? 2 : 0), 2);
    const completed = m.rallies;
    m.point(winner, 'ПРОВЕРКА');
    m.point(winner, 'ПОВТОР');
    assert.equal(m.rallies, completed + 1, 'the same point cannot rotate twice');
    assert.equal(m.coopRotationCount, beforeRotation + (winner === 0 ? 1 : 0));
    m.startServe();
    assert.equal(m.coopBackSlot, winner === 0 ? (back === 0 ? 2 : 0) : back);
  }
  m.reset('coop');
  assert.equal(m.coopBackSlot, 0);
  assert.equal(m.coopRotationCount, 0);
  assert.equal(m.selected[0], 0);
  assert.equal(m.coopSelected, 2);
});
test('P2 can charge, toss and strike the serve after the first point, while P1 cannot', () => {
  const m = new Match();
  m.reset('coop');
  rotate(m);
  assert.equal(m.server, 0);
  assert.equal(m.serverSlot(), 2);
  assert.equal(m.serverPlayer().id, 0);
  assert.equal(m.ball.x, heldServeBall(m.players[0]).x);
  assert.equal(m.players[2].x, -0.8);
  m.tick(FIXED_DT, { drive: true });
  assert.equal(m.controls[0].charge, null);
  m.tick(FIXED_DT, {}, { low: true });
  assert.equal(m.controls[2].charge.playerId, 0);
  m.tick(FIXED_DT, {}, {});
  assert.equal(m.phase, 'serve-motion');
  while (m.phaseTime < m.serveAction.ideal - FIXED_DT) m.tick(FIXED_DT);
  m.tick(FIXED_DT, {}, { low: true, axis: 1 });
  assert.equal(m.phase, 'rally');
  assert.equal(m.lastPlayer, 0);
  assert.equal(m.stats.serves[0], 1);
  assert.equal(m.selected[0], 2);
  assert.ok(m.ball.vx > 0);
});
test('rotated ownership survives replay restore and rejects direct selection across roles', () => {
  const m = new Match();
  m.reset('coop');
  rotate(m, 0);
  const state = capture(m);
  m.reset('coop');
  restore(m, state);
  assert.equal(m.coopBackSlot, 2);
  m.phase = 'rally';
  Object.assign(m.ball, { x: 2, y: 20, vx: 0, vy: 0 });
  m.tick(FIXED_DT, { select: 1 }, { select: 3 });
  assert.equal(m.selected[0], 2);
  assert.equal(m.coopSelected, 0);
  m.tick(FIXED_DT, {}, {});
  m.tick(FIXED_DT, {}, { select: 2 });
  assert.equal(m.coopSelected, 1);
  assert.equal(m.humanSlot(m.players[1]), 2);
  assert.equal(m.humanSlot(m.players[2]), 0);
});
test('the rotated back controller automatically receives passes without taking the front player', () => {
  const m = new Match();
  m.reset('coop');
  rotate(m);
  m.phase = 'rally';
  m.lastTouch = 0;
  m.lastPlayer = 0;
  Object.assign(m.ball, { x: -3.7, y: 2, vx: 0, vy: 0 });
  m.controls[2].charge = { kind: 'loft', power: 0.4, playerId: 0 };
  m.autoCoopReceiver(1);
  assert.equal(m.coopSelected, 1);
  assert.equal(m.controls[2].charge.playerId, 1);
  assert.equal(m.selected[0], 2);
  assert.equal(m.assignCoopReceiver(0, 0), false);
  assert.equal(m.assignCoopReceiver(2, 2), false);
});
