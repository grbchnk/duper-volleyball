import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { nextReceiver } from '../src/receiver-selection.js';
import { receptionOpportunities, serveReceiver } from '../src/serve-reception.js';
import { integrateBall, launchOverNet } from '../src/physics.js';
import { FIXED_DT } from '../src/config.js';

function reception(team = 0, mode = 'versus') {
  const m = new Match();
  m.reset(mode);
  m.phase = 'rally';
  m.lastTouch = 1 - team;
  m.lastPlayer = (1 - team) * 3;
  m.incomingShot = 'serve';
  m.selected[team] = team * 3 + 1;
  const side = m.sign(team);
  for (const [i, x] of [7, 3.7, 0.8].entries()) m.players[team * 3 + i].x = side * x;
  Object.assign(m.ball, { x: side, y: 3, vx: side * 9, vy: 0 });
  return m;
}

for (const team of [0, 1]) {
  test(`team ${team}: a comfortable deep underhand reception beats the earlier middle overhead contact`, () => {
    const m = reception(team);
    const opportunities = receptionOpportunities(m, team, m.players);
    const low = opportunities.find((o) => o.id === team * 3 && o.kind === 'low');
    const overhead = opportunities.find((o) => o.id === team * 3 + 1 && o.kind === 'loft');
    assert.ok(low && overhead && overhead.time < low.time);
    assert.equal(nextReceiver(m, team, { keepReachable: true }), team * 3);
  });

  test(`team ${team}: the initial serve selection evaluates the full flight before the net crossing`, () => {
    const m = reception(team);
    const side = m.sign(team);
    Object.assign(m.ball, { x: -side * 8, y: 2.8 });
    assert.ok(launchOverNet(m.ball, { x: side * 7, y: 0.7, z: m.ball.z }, 1.6, m.config));
    m.selectOnOpponentContact(team);
    assert.equal(m.selected[team], team * 3);
    assert.equal(Math.sign(m.ball.x), -side);
  });

  test(`team ${team}: movement and manual selection keep a reachable middle receiver`, () => {
    const m = reception(team);
    assert.equal(nextReceiver(m, team, { preferCurrent: true, keepReachable: true }), team * 3 + 1);
    m.controls[team].manualSerial = m.shotSerial;
    m.tick(FIXED_DT);
    assert.equal(m.selected[team], team * 3 + 1);
  });

  test(`team ${team}: receiver evaluation follows positions rather than player numbers`, () => {
    const m = reception(team);
    const back = m.players[team * 3],
      middle = m.players[team * 3 + 1];
    [back.x, middle.x] = [middle.x, back.x];
    m.selected[team] = back.id;
    assert.equal(nextReceiver(m, team, { keepReachable: true }), middle.id);
  });

  test(`team ${team}: a short serve keeps a nearby receiver rather than forcing the back player`, () => {
    const m = reception(team);
    Object.assign(m.ball, { y: 2.8, vx: m.sign(team) * 3, vy: -2 });
    assert.equal(serveReceiver(m, team, m.players), team * 3 + 1);
  });

  test(`team ${team}: unavailable or excluded deep players cannot acquire control`, () => {
    for (const state of [{ recovery: 0.5 }, { diving: true }, { benched: true }, { block: 0.5 }]) {
      const m = reception(team);
      Object.assign(m.players[team * 3], state);
      assert.notEqual(nextReceiver(m, team), team * 3);
    }
    const m = reception(team);
    assert.notEqual(nextReceiver(m, team, { exclude: [team * 3] }), team * 3);
  });

  test(`team ${team}: ordinary rallies and classic mode retain their own selection policy`, () => {
    const m = reception(team);
    m.incomingShot = 'loft';
    m.ball.vx = m.sign(team) * 2;
    assert.equal(serveReceiver(m, team, m.players), null);
    assert.equal(nextReceiver(m, team, { keepReachable: true }), team * 3 + 1);
    m.incomingShot = 'serve';
    m.config = { ...m.config, dynamic: false };
    assert.equal(serveReceiver(m, team, m.players), null);
  });

  test(`team ${team}: a chosen deep receiver remains stable as the serve approaches`, () => {
    const m = reception(team);
    for (let frame = 0; frame < 55; frame++) {
      const id = nextReceiver(m, team, { keepReachable: true });
      assert.equal(id, team * 3, `frame ${frame}`);
      m.selected[team] = id;
      integrateBall(m.ball, FIXED_DT, m.config);
      m.time += FIXED_DT;
    }
  });
}

for (const rotated of [false, true]) {
  test(`co-op rotation ${rotated}: serve preference respects controller ownership`, () => {
    const m = reception(0, 'coop');
    m.coopRotationCount = rotated ? 1 : 0;
    m.selected[0] = m.coopPrimary = rotated ? 2 : 1;
    m.coopSelected = rotated ? 1 : 2;
    m.updateCoopReceiver();
    assert.equal(m.coopPlayer(m.coopBackSlot), 0);
    assert.equal(m.coopPlayer(m.coopBackSlot === 0 ? 2 : 0), 2);
    m.coopManualSerial[m.coopBackSlot] = m.shotSerial;
    m.assignCoopReceiver(m.coopBackSlot, 1);
    m.updateCoopReceiver();
    assert.equal(m.coopPlayer(m.coopBackSlot), 1);
  });
}

test('a comfortable overhead reception beats an underhand reception requiring a desperate sprint', () => {
  const m = reception();
  m.players[0].x = -10.5;
  assert.equal(serveReceiver(m, 0, m.players), 1);
});

test('contact evaluation penalizes stretched contacts and insufficient approach time', () => {
  const m = reception();
  const path = [{ ...m.ball, x: -7, y: 0.5, vy: -1 }];
  m.players[1].x = -6;
  const options = receptionOpportunities(m, 0, m.players, path);
  assert.equal(
    options.find((o) => o.id === 2),
    undefined,
  );
  assert.ok(options.find((o) => o.id === 0).cost < options.find((o) => o.id === 1).cost);
});
