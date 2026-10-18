import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { FIXED_DT } from '../src/config.js';

function pass(team = 0, kind = 'low') {
  const m = new Match();
  m.reset('versus');
  m.phase = 'rally';
  const side = m.sign(team),
    p = m.players[team * 3],
    receiver = m.players[team * 3 + 1];
  m.selected[team] = p.id;
  p.x = side * 2;
  receiver.x = side * 4;
  m.lastTouch = 1 - team;
  Object.assign(m.ball, { x: p.x, y: 2.1 });
  assert.equal(
    m.makeContact(p, kind, 0.5, { vx: side * 2, vy: 7, vz: 0, targetId: receiver.id }),
    true,
  );
  assert.equal(m.selected[team], receiver.id);
  return { m, p };
}

test('a passer does not sprint home on the next frame after control switches on either team', () => {
  for (const team of [0, 1])
    for (const kind of ['low', 'loft']) {
      const { m, p } = pass(team, kind),
        x = p.x;
      for (let i = 0; i < 24; i++) {
        m.animatePlayers(FIXED_DT);
        m.movePlayers(FIXED_DT, {});
      }
      assert.equal(p.x, x);
      assert.equal(p.vx, 0);
      assert.ok(p.returnDelay > 0);
      let firstSpeed = null;
      for (let i = 0; i < 80; i++) {
        m.animatePlayers(FIXED_DT);
        m.movePlayers(FIXED_DT, {});
        if (Math.abs(p.vx) > 0 && firstSpeed === null) firstSpeed = Math.abs(p.vx);
        assert.ok(Math.abs(p.vx) <= m.config.playerSpeed * 0.75 + 1e-8);
      }
      assert.ok(firstSpeed > 0 && firstSpeed < m.config.playerSpeed * 0.2);
      assert.ok(
        Math.abs(p.x - x) > 0.1,
        'the player still returns to formation once the follow-through is over',
      );
    }
});

test('manual control cancels a return immediately without resurrecting old stick velocity', () => {
  const { m, p } = pass();
  p.moveVx = m.config.playerSpeed;
  m.movePlayers(FIXED_DT, {});
  assert.equal(p.moveVx, 0);
  m.selected[0] = p.id;
  const x = p.x;
  m.movePlayers(FIXED_DT, {});
  assert.equal(p.returnHome, false);
  assert.equal(p.x, x);
  m.movePlayers(FIXED_DT, { axis: 1 });
  assert.ok(p.x > x, 'manual input needs no return delay');
});

test('landing does not restore horizontal speed saved before the jump', () => {
  const m = new Match();
  m.phase = 'rally';
  const p = m.active();
  p.moveVx = m.config.playerSpeed;
  p.wasControlled = true;
  m.jump(p);
  p.jumpTime = p.jumpProfile.windup + 0.01;
  p.y = 0.5;
  m.movePlayer(p, FIXED_DT, {});
  assert.equal(p.moveVx, 0);
  p.jumpProfile = null;
  p.y = p.vy = 0;
  const x = p.x;
  m.movePlayer(p, FIXED_DT, {});
  assert.equal(p.x, x);
});

test('a new rally forgets which previous contact scheduled a return', () => {
  const m = new Match();
  m.players[0].clearedSerial = 3;
  m.startServe();
  assert.equal(m.players[0].clearedSerial, -1);
});
