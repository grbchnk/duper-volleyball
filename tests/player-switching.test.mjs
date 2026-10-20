import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { FIXED_DT } from '../src/config.js';
import { preparedHands } from '../src/held-contact.js';

test('cycling or selecting a teammate returns the former player home through normal movement', () => {
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
      assert.equal(p.returnHome, false, 'selection does not immediately reset movement state');
      assert.equal(p.moveVx, 4);
      assert.equal(receiver.returnHome, false);
      assert.equal(m.controls[team].manualSerial, m.shotSerial);
      for (let i = 0; i < 360; i++) m.movePlayers(FIXED_DT, {});
      assert.ok(Math.abs(p.x - side * 8) < 0.01);
      assert.equal(p.returnHome, false);
      assert.equal(receiver.x, side * 3.7, 'the selected player never walks home without input');
    }
});

test('a simultaneous switch and shot input switches before charge begins', () => {
  const m = new Match();
  m.phase = 'rally';
  m.lastTouch = 1;
  m.lastPlayer = 3;
  const heldInput = { switch: true, low: true };
  m.handleControl(FIXED_DT, heldInput, 0);
  assert.equal(m.selected[0], 1, 'the switch is applied before the shot charge starts');
  assert.equal(m.controls[0].charge.playerId, 1);

  m.inputs = [{ drive: true }, {}];
  m.autoSelect(0, 1);
  assert.equal(m.selected[0], 1, 'manual selection remains locked during the current attack');
});

test('automatic selection can replace the player while the user is moving', () => {
  const m = new Match();
  m.phase = 'rally';
  m.inputs = [{ axis: 1 }, {}];
  m.autoSelect(0, 1);
  assert.equal(m.selected[0], 1);

  m.inputs[0].axis = 0;
  m.autoSelect(0, 1);
  assert.equal(m.selected[0], 1);
});

function incomingBall(mode = 'match', team = 0) {
  const m = new Match();
  m.reset(mode);
  m.phase = 'rally';
  m.lastTouch = 1 - team;
  m.lastPlayer = (1 - team) * 3;
  m.inputs = [{}, {}, {}];
  Object.assign(m.ball, { x: m.players[team * 3 + 1].x, y: 0.8, vx: 0, vy: -2 });
  return m;
}

test('a completed held or released pass immediately hands control to its receiver despite movement', () => {
  for (const team of [0, 1])
    for (const held of [false, true]) {
      const m = incomingBall('versus', team);
      const p = m.players[team * 3];
      const control = m.controls[team];
      p.x = m.sign(team) * 7;
      const input = { axis: -m.sign(team), low: held };
      m.inputs[team] = input;
      const action = {
        kind: 'low',
        playerId: p.id,
        age: 0.2,
        power: 0.3,
        aim: { manualControl: true, axis: input.axis },
        ttl: 0.2,
      };
      if (held) {
        control.charge = action;
        Object.assign(m.ball, preparedHands(p, m, action)[0], { vx: 0, vy: 0 });
        assert.equal(m.tryHeldContact(m.ball, control), true);
      } else {
        control.pending = action;
        Object.assign(m.ball, { x: p.x, y: 0.8, vx: 0, vy: 0 });
        assert.equal(m.tryPending(m.ball, control), true);
      }
      assert.equal(m.teamPhases[team], 'attack', 'the pass stays on our side');
      const receiverId = m.selected[team];
      assert.notEqual(receiverId, p.id, `${team}/${held}`);
      assert.equal(m.players[receiverId].team, team);
      assert.equal(control.charge, null);
      assert.equal(control.pending, null);
      assert.equal(m.contacts, 1);
      assert.equal(p.returnHome, true);
      m.tick(FIXED_DT, team === 0 ? input : {}, team === 1 ? input : {});
      assert.equal(m.selected[team], receiverId, 'the next frame retains the receiver');
      assert.equal(m.contacts, 1, 'the handoff never repeats the pass');
    }
});

test('a completed pass in a jump hands control over before the passer lands', () => {
  const m = incomingBall();
  const p = m.players[0];
  m.jump(p);
  assert.equal(
    m.makeContact(p, 'loft', 0.4, {
      vx: 2,
      vy: 5,
      vz: 0,
      targetId: 1,
    }),
    true,
  );
  assert.equal(m.selected[0], 1);
  assert.ok(p.jumpProfile);
});

test('frame-by-frame reception preserves held and released shots on both controllers', () => {
  for (const [mode, team, slot] of [
    ['match', 0, 0],
    ['versus', 1, 1],
    ['coop', 0, 0],
    ['coop', 0, 2],
  ])
    for (const kind of ['charge', 'pending']) {
      const m = incomingBall(mode, team);
      if (slot === 2) {
        m.coopRotationCount = 1;
        m.selected[0] = m.coopPrimary = 2;
        m.coopSelected = 0;
      }
      const id = m.controlledPlayer(m.controls[slot]);
      m.controls[slot][kind] = {
        kind: 'drive',
        playerId: id,
        age: 0,
        ttl: 1,
        power: 0.5,
        aim: {},
      };
      const held = kind === 'charge' ? { drive: true } : {};
      m.tick(FIXED_DT, slot === 0 ? held : {}, slot !== 0 ? held : {});
      assert.equal(
        m.controls[slot][kind]?.playerId,
        m.controlledPlayer(m.controls[slot]),
        `${mode}/${slot}/${kind}`,
      );
    }
});

test('automatic reception does not pause after movement input ends', () => {
  const m = incomingBall();
  m.handleControl(FIXED_DT, { axis: 1 }, 0);
  m.inputs[0] = {};
  m.time += 0.2;
  m.autoSelect(0, 1);
  assert.equal(m.selected[0], 1);
});

test('incoming reception hands a passed ball to the deeper receiver instead of requiring a chase', () => {
  const m = incomingBall();
  m.players[0].x = -7;
  m.selected[0] = 1;
  Object.assign(m.ball, { x: -5.9, y: 3.2, vx: -2.6, vy: 0 });
  m.tick(FIXED_DT);
  assert.equal(m.selected[0], 0);
});

test('opponent contact can preselect a receiver across the net', () => {
  const m = incomingBall();
  Object.assign(m.ball, { x: 5, y: 4, vx: -5, vy: 3 });
  m.autoSelect(0, 1);
  assert.equal(m.selected[0], 1);
});

test('automatic selection can replace a jumping player and diving switches immediately', () => {
  for (const action of ['jump', 'dive']) {
    const m = incomingBall();
    m.handleControl(FIXED_DT, { [action]: true }, 0);
    if (action === 'dive') assert.equal(m.selected[0], 1);
    else assert.equal(m.selected[0], 0);
    m.time += 0.4;
    m.inputs[0] = {};
    m.autoSelect(0, 1);
    assert.equal(m.selected[0], 1, action);
  }
});

test('a manual receiver choice remains locked when that player dives', () => {
  const m = incomingBall();
  m.handleControl(FIXED_DT, { select: 3 }, 0);
  const selected = m.selected[0];
  m.handleControl(FIXED_DT, { dive: true }, 0);
  assert.equal(m.players[selected].diving, true);
  assert.equal(m.selected[0], selected);
  m.autoSelect(0, 1);
  assert.equal(m.selected[0], selected);
});

test('a shot that crosses the net keeps the hitter selected even when it has a target player', () => {
  const m = new Match();
  m.phase = 'rally';
  m.lastTouch = 1;
  m.lastPlayer = 3;
  const hitter = m.players[0];
  Object.assign(m.ball, { x: -8, y: 1, vx: 0, vy: 0 });
  m.makeContact(hitter, 'low', 0.5, {
    vx: 20,
    vy: 7,
    vz: 0,
    targetId: 1,
    targetX: -4,
    arrival: 1,
  });
  assert.equal(m.teamPhases[0], 'defense');
  assert.equal(m.selected[0], hitter.id);
});

test('outgoing shots retain control on subsequent frames until crossing the net', () => {
  for (const [mode, team, slot] of [
    ['versus', 0, 0],
    ['versus', 1, 1],
    ['coop', 0, 0],
    ['coop', 0, 2],
  ]) {
    const m = incomingBall(mode, team);
    const side = m.sign(team);
    const hitter = m.players[m.controlledPlayer(m.controls[slot])];
    hitter.x = side * 8;
    Object.assign(m.ball, { x: hitter.x, y: 1, vx: 0, vy: 0 });
    assert.equal(m.makeContact(hitter, 'low', 0.5, { vx: -side * 20, vy: 7, vz: 0 }), true);
    assert.equal(m.teamPhases[team], 'defense');
    const selected = [...m.selected];
    const coopSelected = m.coopSelected;
    let frames = 0;
    while (m.ball.x * side > 0 && frames++ < 120) {
      m.tick(FIXED_DT);
      assert.equal(m.controlledPlayer(m.controls[slot]), hitter.id, `${mode}/${slot}/${frames}`);
      assert.deepEqual(m.selected, selected);
      assert.equal(m.coopSelected, coopSelected);
    }
    assert.ok(frames > 1);
    assert.ok(m.ball.x * side <= 0, 'the ball crosses the net');
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

test('a manual receiver choice lasts until a new contact', () => {
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
  m.time += 0.31;
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
  m.movePlayers(FIXED_DT, {});
  assert.equal(m.players[0].returnHome, true);
});

test('early opponent selection still allows the current reception forecast to find a better player', () => {
  for (const [mode, team, slot] of [
    ['versus', 0, 0],
    ['versus', 1, 1],
    ['coop', 0, 0],
    ['coop', 0, 2],
  ]) {
    const m = incomingBall(mode, team);
    if (slot === 2) {
      m.coopRotationCount = 1;
      m.selected[0] = m.coopPrimary = 2;
      m.coopSelected = 0;
    }
    const control = m.controls[slot];
    const side = m.sign(team);
    m.players[team * 3].x = side * 7;
    Object.assign(m.ball, { x: -side * 1, y: 3, vx: side * 10, vy: 2 });
    m.selectOnOpponentContact(team);
    assert.equal(m.controlledPlayer(control), team * 3);
    Object.assign(m.ball, { x: side * 3.7, y: 0.8, vx: 0, vy: -2 });
    m.tick(FIXED_DT);
    assert.equal(m.controlledPlayer(control), team * 3 + 1);
    if (mode === 'coop') assert.equal(m.coopPlayer(slot === 0 ? 2 : 0), 2);
  }
});
