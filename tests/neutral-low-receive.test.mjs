import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/config.js';
import { shotImpulse, manualImpulse } from '../src/moves.js';
import { Match } from '../src/engine.js';
import { simulateShot } from '../src/shot-lab.js';

const player = { id: 1, team: 0, x: -4, y: 0, vx: 0, vy: 0, facing: 1 };
const ball = { x: -4, y: 0.9, z: 4.5, vx: -8, vy: -6 };
const receive = (incoming = ball, aim = {}, p = player, config = DEFAULTS) =>
  shotImpulse(incoming, p, 'low', 0.6, { manualControl: true, ...aim }, [p], config);

test('neutral low lifts mostly upwards and preserves the incoming lateral tendency instead of aiming at the net', () => {
  for (const team of [0, 1])
    for (const vx of [-12, 0, 12]) {
      const p = { ...player, team, x: team === 0 ? -4 : 4 };
      const shot = receive({ ...ball, x: p.x, vx }, {}, p);
      assert.equal(Math.sign(shot.vx), Math.sign(vx));
      assert.ok(shot.vy > Math.abs(shot.vx) * 2);
      assert.equal(shot.targetId, null);
      assert.equal(shot.assisted, false);
      assert.equal(shot.neutralReceive, true);
    }
});

test('contact side changes the rebound smoothly and mirrors with the incoming motion', () => {
  const shots = [-0.8, 0, 0.8].map((dx) => receive({ ...ball, x: player.x + dx, vx: 0, vy: -10 }));
  assert.ok(shots[0].vx < 0);
  assert.equal(shots[1].vx, 0);
  assert.ok(shots[2].vx > 0);
  assert.ok(Math.abs(shots[0].vx + shots[2].vx) < 1e-10);
  assert.ok(Math.abs(shots[0].vy - shots[2].vy) < 1e-10);
  const a = receive({ ...ball, x: player.x - 0.001 });
  const b = receive({ ...ball, x: player.x + 0.001 });
  assert.ok(Math.abs(a.vx - b.vx) < 0.02);
});

test('incoming speed cannot add shot energy and zero incoming speed safely produces a vertical lift', () => {
  for (const modifier of [{}, { soft: true }, { fast: true }]) {
    const base = receive(ball, modifier);
    for (const factor of [0, 0.1, 1, 100]) {
      const shot = receive({ ...ball, vx: ball.vx * factor, vy: ball.vy * factor }, modifier);
      assert.ok(Number.isFinite(shot.vx) && Number.isFinite(shot.vy));
      assert.ok(Math.abs(Math.hypot(shot.vx, shot.vy) - Math.hypot(base.vx, base.vy)) < 1e-10);
      if (!factor) assert.equal(shot.vx, 0);
    }
  }
  assert.equal(receive(ball, { vector: { x: 0, y: 0 } }).neutralReceive, true);
});

test('explicit lower aim ignores incoming velocity, contact side, team and assistance amount', () => {
  for (const team of [0, 1])
    for (const aim of [
      { axis: -1 },
      { axis: 1 },
      { up: true },
      { down: true },
      { vector: { x: -0.8, y: 0.4 } },
      { vector: { x: 0.8, y: 0.4 } },
      { vector: { x: 0, y: 1 } },
    ])
      for (const modifier of [{}, { soft: true }, { fast: true }]) {
        const p = { ...player, team, x: team === 0 ? -4 : 4 };
        const command = { ...aim, ...modifier };
        const expected = receive(ball, command, p);
        assert.equal(expected.neutralReceive, undefined);
        for (const vx of [-20, 20])
          for (const dx of [-0.8, 0.8])
            for (const passAssist of [0, 0.5, 1]) {
              const shot = receive({ ...ball, x: p.x + dx, vx, vy: -15 }, command, p, {
                ...DEFAULTS,
                passAssist,
              });
              assert.deepEqual(shot, expected);
            }
      }
});

test('actual released lower contact uses the same rebound as the lab calculation', () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.reset('versus');
    m.phase = 'rally';
    const c = m.controls[team],
      p = m.players[m.controlledPlayer(c)];
    Object.assign(m.ball, { x: p.x, y: 0.9, vx: team ? 8 : -8, vy: -6 });
    const expected = shotImpulse(
      m.ball,
      p,
      'low',
      0.6,
      { manualControl: true },
      m.players,
      m.config,
    );
    m.inputs = [{}, {}, {}];
    c.pending = { playerId: p.id, kind: 'low', power: 0.6, age: 0.1, aim: {}, ttl: 0.2 };
    assert.equal(m.tryPending(m.ball, c), true);
    assert.equal(m.ball.vx, expected.vx);
    assert.equal(m.ball.vy, expected.vy);
    const lab = simulateShot(DEFAULTS, {
      kind: 'low',
      power: 0.6,
      playerId: p.id,
      incomingSpeed: 10,
    });
    assert.equal(lab.impulse.neutralReceive, true);
    assert.equal(lab.impulse.vx, expected.vx);
    assert.equal(lab.impulse.vy, expected.vy);
  }
});

test('legacy lower reception retains its authored angle', () => {
  const config = { ...DEFAULTS, dynamic: false };
  const shot = manualImpulse(ball, player, 'low', 0.6, {}, config);
  assert.equal(shot.neutralReceive, undefined);
  assert.ok(shot.vx > 0);
});
