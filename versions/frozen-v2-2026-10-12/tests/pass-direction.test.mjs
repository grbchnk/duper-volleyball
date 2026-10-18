import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { InputBuffer } from '../src/input.js';
import { shotImpulse } from '../src/moves.js';
import { reachesNet, traceBall, predictAtHeight } from '../src/physics.js';

test('underhand backward reception stays high and gains height and distance with power', () => {
  for (const team of [0, 1]) {
    const m = new Match({ ...DEFAULTS, assist: false });
    const p = m.players[team * 3];
    const forward = team ? -1 : 1;
    const ball = { ...m.ball, x: -forward * 2, y: 0.8 };
    const aim = { vector: { x: -forward, y: 0 } };
    const shots = [0.2, 0.8].map((power) =>
      shotImpulse(ball, p, 'low', power, aim, m.players, m.config),
    );
    for (const shot of shots) {
      assert.equal(Math.sign(shot.vx), -forward);
      assert.ok(shot.vy > Math.abs(shot.vx) * 3);
    }
    const paths = shots.map((shot) => traceBall({ ...ball, ...shot }, m.config));
    assert.ok(Math.max(...paths[1].map((b) => b.y)) > Math.max(...paths[0].map((b) => b.y)));
    assert.ok(Math.abs(paths[1].at(-1).x - ball.x) > Math.abs(paths[0].at(-1).x - ball.x));
    const downward = shotImpulse(ball, p, 'low', 0.5, { vector: { x: 0, y: -1 } }, [], m.config);
    assert.ok(downward.vy > 0, 'down selects forearms; it must not punch into the floor');
  }
});

test('overhead manual direction is flat sideways and vertical upward', () => {
  const m = new Match({ ...DEFAULTS, assist: false });
  for (const vector of [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ]) {
    const shot = shotImpulse(m.ball, m.active(), 'loft', 0.6, { vector }, m.players, m.config);
    const speed = Math.hypot(shot.vx, shot.vy);
    assert.ok(Math.abs(shot.vx / speed - vector.x) < 1e-12);
    assert.ok(Math.abs(shot.vy / speed - vector.y) < 1e-12);
  }
});

test('aimed passes reaching the net never get redirected to teammates, including net-bound shots', () => {
  for (const team of [0, 1])
    for (const kind of ['low', 'loft', 'back'])
      for (const height of [2, 3.5]) {
        const m = new Match();
        const forward = team ? -1 : 1;
        const p = m.players[team * 3];
        const ball = { ...m.ball, x: -forward * 0.8, y: height };
        const aim = { vector: { x: forward, y: 0 }, axis: forward };
        const players = [p, { id: 99, team, x: -forward * 0.2, recovery: 0 }];
        const free = shotImpulse(ball, p, kind, 0.6, aim, players, { ...DEFAULTS, assist: false });
        assert.equal(reachesNet({ ...ball, ...free }, DEFAULTS), true);
        for (const passAssist of [0.5, 1]) {
          const helped = shotImpulse(ball, p, kind, 0.6, aim, players, { ...DEFAULTS, passAssist });
          assert.equal(Math.sign(helped.vx), forward);
          assert.equal(helped.targetId, null);
          assert.ok(
            Math.abs(Math.hypot(helped.vx, helped.vy) - Math.hypot(free.vx, free.vy)) < 1e-10,
          );
        }
      }
});

test('an aimed underhand pass still assists an available teammate behind the player', () => {
  const m = new Match();
  const p = m.active();
  const ball = { ...m.ball, x: -2, y: 1 };
  const aim = { vector: { x: -0.2, y: Math.sqrt(0.96) } };
  const free = shotImpulse(ball, p, 'low', 0.5, aim, [], { ...DEFAULTS, assist: false });
  const landing = predictAtHeight({ ...ball, ...free }, 1.4, DEFAULTS);
  p.x = ball.x;
  const target = { id: 99, team: 0, x: landing.x - 0.3, recovery: 0 };
  const full = shotImpulse(ball, p, 'low', 0.5, aim, [p, target], DEFAULTS);
  assert.equal(full.targetId, target.id);
  assert.ok(full.vx < 0 && full.vy > Math.abs(full.vx) * 2);
  target.diving = true;
  assert.equal(shotImpulse(ball, p, 'low', 0.5, aim, [p, target], DEFAULTS).assisted, false);
});

test('gradual analog release preserves accumulated charge and the last direction', () => {
  const pad = { connected: true, mapping: 'standard', axes: [0, -0.5, 0, -0.8], buttons: [] };
  const input = new InputBuffer(() => [pad]);
  const m = new Match();
  m.startDrill('receive');
  Object.assign(m.ball, { x: 4, y: 15, vx: 0, vy: 0 });
  for (let i = 0; i < 20; i++) {
    input.poll();
    m.tick(FIXED_DT, input.read());
  }
  const power = m.charge.power;
  pad.axes[1] = 0;
  for (const magnitude of [0.4, 0.3, 0.2, 0]) {
    pad.axes[3] = -magnitude;
    input.poll();
    m.tick(FIXED_DT, input.read());
  }
  assert.ok(m.pending.power >= power);
  assert.equal(m.pending.aim.vector.y, 1);
});
