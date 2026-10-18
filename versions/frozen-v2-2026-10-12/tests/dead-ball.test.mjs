import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { COURT, FIXED_DT } from '../src/config.js';

for (const x of [-5, 12]) {
  test(`landing at x=${x} scores once and keeps bouncing`, () => {
    const m = new Match();
    m.phase = 'rally';
    Object.assign(m.ball, { x, y: COURT.ballRadius + 0.01, vx: 2, vy: -7, vz: 0 });
    m.tick();
    assert.equal(m.phase, 'point');
    assert.ok(m.ball.vy > 0);
    const score = [...m.score];
    const rallies = m.rallies;
    const startX = m.ball.x;
    for (let n = 0; n < 30; n++) m.tick();
    assert.ok(m.ball.y > COURT.ballRadius);
    assert.ok(m.ball.x > startX);
    assert.deepEqual(m.score, score);
    assert.equal(m.rallies, rallies);
  });
}

test('airborne dead ball falls, bounces, and settles after the match', () => {
  const m = new Match();
  m.phase = 'rally';
  Object.assign(m.ball, { x: 12, y: 3, vx: 1, vy: -2, vz: 0, spin: 0 });
  m.point(1, 'АУТ');
  assert.equal(m.ball.vy, -2);
  m.phase = 'finished';
  let bounced = false;
  for (let n = 0; n < 1200; n++) {
    m.tick(FIXED_DT);
    if (m.ball.vy > 0) bounced = true;
    assert.ok(m.ball.y >= COURT.ballRadius);
  }
  assert.ok(bounced);
  assert.equal(m.ball.y, COURT.ballRadius);
  assert.equal(m.ball.vy, 0);
  assert.equal(m.ball.vx, 0);
});
