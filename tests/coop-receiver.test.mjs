import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { FIXED_DT } from '../src/config.js';
import { nextReceiver } from '../src/receiver-selection.js';

function rally() {
  const m = new Match();
  m.reset('coop');
  m.phase = 'rally';
  m.players[0].x = -7;
  m.players[1].x = -3.7;
  m.players[2].x = -0.8;
  m.lastTouch = 1;
  m.lastPlayer = 3;
  m.events = [];
  return m;
}
function pass(m, slot) {
  const id = m.coopPlayer(slot),
    p = m.players[id];
  Object.assign(m.ball, { x: p.x, y: 2, vx: 0, vy: 0 });
  return m.makeContact(p, 'loft', 0.4, {
    vx: slot === 0 ? 2.5 : -2.5,
    vy: 5,
    vz: 0,
    spin: 0,
    targetId: null,
  });
}
test('a pass between the two back players switches their controller and transfers preparation', () => {
  const m = rally();
  m.controls[0].charge = { kind: 'drive', age: 0.1, power: 0.35, playerId: 0, aim: {} };
  assert.ok(pass(m, 0));
  assert.equal(m.selected[0], 1);
  assert.equal(m.coopSelected, 2, 'the front player stays with the front controller');
  assert.equal(m.controls[0].charge.playerId, 1);
  assert.equal(m.controls[0].charge.power, 0.35);
  assert.equal(m.contacts, 1, 'switching does not automatically hit the pass');
});
test('P2 loft automatically changes P1 receiver and survives the second-controller context', () => {
  const m = rally();
  m.controls[0].pending = { kind: 'loft', ttl: 0.1, playerId: 0, aim: {}, power: 0.25 };
  assert.ok(pass(m, 2));
  assert.equal(m.coopSelected, 2, 'P2 retains the passer');
  assert.equal(m.selected[0], 1);
  assert.equal(m.coopPrimary, 1);
  assert.equal(m.controls[0].pending.playerId, 1);
  assert.equal(Object.hasOwn(m, 'controlSlot'), false);
});
test('manual L1 remains available and overrides automatic selection for the current ball', () => {
  const m = rally();
  pass(m, 0);
  assert.equal(m.selected[0], 1);
  m.tick(FIXED_DT, { switch: true });
  assert.equal(m.selected[0], 0);
  for (let i = 0; i < 5; i++) m.updateCoopReceiver();
  assert.equal(m.selected[0], 0);
  m.shotSerial++;
  m.autoCoopReceiver();
  assert.equal(m.selected[0], 1, 'the next new pass can select a receiver again');
});
test('an incoming ball switches to the reachable free player without stealing either partner', () => {
  const m = rally();
  Object.assign(m.ball, { x: -3.7, y: 0.8, vx: 0, vy: -2 });
  m.updateCoopReceiver();
  assert.ok([m.selected[0], m.coopSelected].includes(1));
  assert.notEqual(m.selected[0], m.coopSelected);
  for (let i = 0; i < 10; i++) m.updateCoopReceiver();
  assert.notEqual(m.selected[0], m.coopSelected);
});
test('a pass already aimed at the controlled partner leaves ownership unchanged', () => {
  const m = rally();
  m.lastTouch = 0;
  m.lastPlayer = 0;
  Object.assign(m.ball, { x: -0.8, y: 4, vx: 0, vy: 0 });
  m.autoCoopReceiver();
  assert.equal(m.selected[0], 0);
  assert.equal(m.coopSelected, 2);
});
test('receiver forecasting excludes the teammate owned by the other controller', () => {
  const m = rally();
  Object.assign(m.ball, { x: -0.8, y: 0.8, vx: 0, vy: -2 });
  const next = nextReceiver(m, 0, { currentId: 0, exclude: [2] });
  assert.notEqual(next, 2);
});

test('opponent serve toss and flight never preselect another co-op receiver on either role rotation', () => {
  for (const rallies of [0, 1, 2, 3]) {
    const m = new Match();
    m.reset('coop');
    m.rallies = rallies * 2 + 1;
    m.coopRotationCount = rallies;
    m.server = 1;
    m.startServe();
    const before = [m.coopPlayer(0), m.coopPlayer(2)];
    m.beginServe({ kind: 'loft', power: 0.54, aim: { axis: -1 } });
    let flightFrames = 0;
    for (let i = 0; i < 600; i++) {
      m.tick(FIXED_DT);
      if (m.phase === 'rally' && m.ball.x < 0) break;
      if (m.phase === 'rally') flightFrames++;
      assert.deepEqual(
        [m.coopPlayer(0), m.coopPlayer(2)],
        before,
        'no forecast switch during the opponent serve',
      );
      assert.ok(m.coopOwns(0, m.coopPlayer(0)));
      assert.ok(m.coopOwns(2, m.coopPlayer(2)));
    }
    assert.ok(flightFrames > 0);
  }
});
test('a reachable co-op receiver keeps control even if the forecast favours a closer player', () => {
  const m = rally();
  m.incomingShot = 'serve';
  Object.assign(m.ball, { x: -3.7, y: 3.2, vx: 0, vy: 0 });
  m.autoCoopReceiver(1);
  assert.equal(m.coopPlayer(0), 0, 'opponent serve cannot preselect the closer teammate');
  m.updateCoopReceiver();
  assert.equal(m.coopPlayer(0), 0, 'a reachable selected receiver is retained');
  assert.equal(m.coopPlayer(2), 2, 'front player stays with its controller');
  Object.assign(m.ball, { x: -3.7, y: 0.8, vx: 0, vy: -2 });
  m.updateCoopReceiver();
  assert.equal(
    m.coopPlayer(0),
    1,
    'an unreachable ball still changes to the available back receiver',
  );
  assert.equal(m.coopPlayer(2), 2);
});
