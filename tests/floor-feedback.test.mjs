import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { COURT } from '../src/config.js';

test('first floor contact emits its actual position once, including out and optional bounce', () => {
  for (const x of [5, 12])
    for (const floorBounce of [false, true]) {
      const m = new Match({ floorBounce });
      for (const p of m.players) p.benched = true;
      m.phase = 'rally';
      m.events = [];
      Object.assign(m.ball, { x, y: COURT.ballRadius + 0.001, vx: 2, vy: -6, vz: 0 });
      m.tick();
      const touches = m.events.filter((e) => e.type === 'floor-touch');
      assert.equal(touches.length, 1);
      assert.equal(touches[0].x, m.ball.x);
      assert.equal(touches[0].y, 0);
      assert.equal(touches[0].out, x === 12);
      assert.ok(touches[0].speed > 0);
      const score = [...m.score];
      for (let i = 0; i < 10; i++) m.tick();
      assert.equal(m.events.filter((e) => e.type === 'floor-touch').length, 1);
      assert.deepEqual(m.score, score);
      for (let i = 0; i < 300; i++) m.stepDeadBall(1 / 120);
      assert.equal(m.events.filter((e) => e.type === 'floor-touch').length, 1);
    }
});

test('an airborne dead ball gets one landing ring, with no rings on later bounces', () => {
  const m = new Match();
  m.phase = 'finished';
  m.events = [];
  Object.assign(m.ball, { x: 4, y: COURT.ballRadius + 0.001, vx: 0, vy: -2, vz: 0 });
  m.tick();
  assert.equal(m.events.filter((e) => e.type === 'floor-touch').length, 1);
  assert.deepEqual(m.score, [0, 0]);
  for (let i = 0; i < 300; i++) m.stepDeadBall(1 / 120);
  assert.equal(m.events.filter((e) => e.type === 'floor-touch').length, 1);
});
