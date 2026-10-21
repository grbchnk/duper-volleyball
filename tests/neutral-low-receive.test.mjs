import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/config.js';
import { shotImpulse, manualImpulse } from '../src/moves.js';
import { Match } from '../src/engine.js';
import { simulateShot } from '../src/shot-lab.js';

const player = { id: 1, team: 0, x: -4, y: 0, vx: 0, vy: 0, facing: 1 };
const ball = { x: -4, y: 0.5, z: 4.5, vx: -8, vy: -6 };
const receive = (incoming = ball, aim = {}, p = player, config = DEFAULTS) =>
  shotImpulse(incoming, p, 'low', 0.6, { manualControl: true, ...aim }, [p], config);

test('a centred vertical incoming ball is lifted vertically on either side', () => {
  for (const team of [0, 1])
    for (const facing of [-1, 1]) {
      const p = { ...player, team, facing, x: team ? 4 : -4 };
      const shot = receive({ ...ball, x: p.x, vx: 0, vy: -10 }, {}, p);
      assert.ok(Math.abs(shot.vx) < 1e-8);
      assert.ok(shot.vy > 0);
      assert.equal(shot.targetId, null);
    }
});
test('off-centre hands deflect a vertical ball towards the side of contact', () => {
  const left = receive({ ...ball, x: player.x - 0.6, vx: 0, vy: -10 });
  const right = receive({ ...ball, x: player.x + 0.6, vx: 0, vy: -10 });
  assert.ok(left.vx < 0);
  assert.ok(right.vx > 0);
});
test('incoming speed cannot add shot energy and a stationary centred ball is lifted nearly vertically', () => {
  for (const modifier of [{}, { soft: true }, { fast: true }]) {
    const base = receive(ball, modifier);
    for (const factor of [0, 0.1, 1, 100]) {
      const shot = receive({ ...ball, vx: ball.vx * factor, vy: ball.vy * factor }, modifier);
      assert.ok(Number.isFinite(shot.vx) && Number.isFinite(shot.vy));
      assert.ok(Math.abs(Math.hypot(shot.vx, shot.vy) - Math.hypot(base.vx, base.vy)) < 1e-10);
      assert.ok(shot.vy > 0);
      if (!factor) assert.ok(Math.abs(shot.vx) < Math.hypot(shot.vx, shot.vy) * 0.03);
    }
  }
  assert.equal(receive(ball, { vector: { x: 0, y: 0 } }).neutralReceive, true);
});

test('hands and incoming motion mirror continuously on the two court sides', () => {
  const m = new Match();
  for (const kind of ['low', 'loft'])
    for (const dx of [-0.7, 0, 0.7])
      for (const vx of [-16, 0, 16]) {
        const shots = [0, 1].map((team) => {
          const p = m.players[team * 3],
            side = team ? -1 : 1;
          const b = {
            ...ball,
            x: p.x + side * dx,
            y: kind === 'low' ? 0.5 : 1.9,
            vx: side * vx,
            vy: -8,
          };
          return shotImpulse(b, p, kind, 0.6, { manualControl: true }, m.players, m.config);
        });
        assert.ok(Math.abs(shots[0].vx + shots[1].vx) < 1e-8);
        assert.ok(Math.abs(shots[0].vy - shots[1].vy) < 1e-8);
      }
});

test('neutral lift has no random seed or teammate targeting, and cosmetic arms cannot change it', () => {
  const m = new Match(),
    p = m.players[1];
  const b = { ...ball, x: p.x + 0.45, y: 0.5, vx: -12, vy: -8 };
  const base = shotImpulse(b, p, 'low', 0.6, { manualControl: true }, m.players, m.config);
  const altered = shotImpulse(
    b,
    p,
    'low',
    0.6,
    { manualControl: true, neutralErrorSeed: 123456 },
    [p],
    {
      ...m.config,
      neutralPassError: 1,
      neutralPassSpeedError: 1,
      armScale: 2,
      armLength: 2,
      armPowerMotion: 0.2,
    },
  );
  assert.deepEqual(altered, base);
  assert.equal(base.arrival, undefined);
  assert.equal(base.targetId, null);
});

test('soft reception damps lateral carry and contact offset changes direction smoothly', () => {
  const m = new Match(),
    p = m.players[0],
    c = { ...m.config, passAssist: 0 };
  const b = { ...ball, x: p.x, y: 0.5, vx: 12, vy: -8 };
  const normal = shotImpulse(b, p, 'low', 0.6, { manualControl: true }, m.players, c);
  const soft = shotImpulse(b, p, 'low', 0.6, { manualControl: true, soft: true }, m.players, c);
  assert.ok(Math.abs(soft.vx) < Math.abs(normal.vx));
  let previous;
  for (let dx = -0.6; dx <= 0.6; dx += 0.01) {
    const s = shotImpulse(
      { ...b, x: p.x + dx, vx: 0 },
      p,
      'low',
      0.6,
      { manualControl: true },
      m.players,
      c,
    );
    if (previous !== undefined) assert.ok(Math.abs(s.vx - previous) < 0.25);
    previous = s.vx;
  }
});

test('unassisted explicit lower aim ignores incoming velocity and contact side', () => {
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
        const expected = receive(ball, command, p, { ...DEFAULTS, passAssist: 0 });
        assert.equal(expected.neutralReceive, undefined);
        for (const vx of [-20, 20])
          for (const dx of [-0.8, 0.8])
            for (const passAssist of [0]) {
              const shot = receive({ ...ball, x: p.x + dx, vx, vy: -15 }, command, p, {
                ...DEFAULTS,
                passAssist,
              });
              assert.deepEqual(shot, expected);
            }
      }
});

test('actual released lower contact uses the same shared pass model as the lab calculation', () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.reset('versus');
    m.phase = 'rally';
    const c = m.controls[team],
      p = m.players[m.controlledPlayer(c)];
    Object.assign(m.ball, { x: p.x, y: 0.5, vx: team ? 8 : -8, vy: -6 });
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
      contactHeight: 0.5,
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
