import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { FIXED_DT } from '../src/config.js';

test('cycling or selecting a teammate sends the former player home on either team', () => {
  for (const team of [0, 1])
    for (const direct of [false, true]) {
      const m = new Match();
      m.reset('versus');
      m.phase = 'rally';
      const p = m.players[team * 3],
        receiver = m.players[team * 3 + 1];
      const side = m.sign(team);
      p.x = side * 5;
      p.moveVx = 4;
      m.handleControl(FIXED_DT, direct ? { select: 2 } : { switch: true }, team);
      assert.equal(m.active(team).id, receiver.id);
      assert.equal(p.returnHome, true);
      assert.equal(p.moveVx, 0);
      assert.equal(receiver.returnHome, false);
      assert.equal(m.controls[team].manualSerial, m.shotSerial);
      for (let i = 0; i < 360; i++) m.movePlayers(FIXED_DT, {});
      assert.ok(Math.abs(p.x - side * 7) < 0.01);
      assert.equal(receiver.x, side * 3.7, 'the selected player never walks home without input');
    }
});

test('an occupied home becomes a reachable free position without crossing the controlled teammate', () => {
  const m = new Match();
  m.phase = 'rally';
  const old = m.players[0],
    controlled = m.players[1];
  old.x = -3.7;
  controlled.x = -4.5;
  m.handleControl(FIXED_DT, { select: 2 }, 0);
  const start = old.x;
  for (let i = 0; i < 360; i++) {
    m.movePlayers(FIXED_DT, {});
    assert.ok(old.x > controlled.x, 'returning never crosses the player receiving manual control');
  }
  assert.ok(old.x > start, 'a crowded player moves away instead of remaining stuck');
  assert.ok(Math.abs(old.x - controlled.x) >= 1.24);
  assert.ok(Math.abs(old.x - m.players[2].x) >= 0.84);
});

test('a manual receiver choice lasts until a new contact, then automatic reception resumes', () => {
  const m = new Match();
  m.phase = 'rally';
  m.lastTouch = 1;
  Object.assign(m.ball, { x: -7, y: 1, vx: 0, vy: -1 });
  m.handleControl(FIXED_DT, { select: 3 }, 0);
  m.tick(FIXED_DT);
  assert.equal(m.selected[0], 2);
  m.autoSelect(0, 0);
  assert.equal(m.selected[0], 2);
  m.shotSerial++;
  m.tick(FIXED_DT);
  assert.equal(m.selected[0], 0);
});

test('selection rejects unavailable players and cannot take the second co-op controller player', () => {
  const m = new Match();
  m.phase = 'rally';
  for (const unavailable of ['benched', 'diving', 'recovery']) {
    m.players[1][unavailable] = unavailable === 'recovery' ? 0.5 : true;
    assert.equal(m.selectControlledPlayer(m.controls[0], 1), false);
    assert.equal(m.selected[0], 0);
    m.players[1][unavailable] = unavailable === 'recovery' ? 0 : false;
  }
  m.reset('coop');
  m.phase = 'rally';
  assert.equal(m.selectControlledPlayer(m.controls[0], m.coopSelected), false);
  assert.equal(m.coopSelected, 2);
  m.switchPlayer(m.controls[0]);
  assert.equal(m.selected[0], 1);
  assert.equal(m.coopSelected, 2);
  assert.equal(m.players[0].returnHome, true);
});
