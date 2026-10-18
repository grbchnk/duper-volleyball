import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from './legacy-contract.js';
import { sanitizeConfig } from '../../src/config.js';
import { shotImpulse } from '../../src/moves.js';
import { predictAtHeight } from '../../src/physics.js';
import { cpuSkill, planReception, chooseCPUShot } from '../../src/cpu.js';

test('neutral save finds a teammate behind or ahead on either team without adding power', () => {
  for (const team of [0, 1])
    for (const targetX of [-6, -2]) {
      const m = new Match();
      const forward = team ? -1 : 1;
      const p = m.players[team * 3 + 1];
      p.x = -4 * forward;
      p.facing = forward;
      const ball = { ...m.ball, x: -4.5 * forward, y: 1 };
      const target = { id: 99, team, x: targetX * forward, recovery: 0 };
      const hit = shotImpulse(ball, p, 'back', 0.5, {}, [p, target], m.config);
      const raw = shotImpulse(ball, p, 'back', 0.5, {}, [p, target], {
        ...m.config,
        assist: false,
      });
      assert.equal(hit.targetId, target.id);
      assert.equal(Math.sign(hit.vx), Math.sign(target.x - ball.x));
      assert.ok(Math.abs(Math.hypot(hit.vx, hit.vy) - Math.hypot(raw.vx, raw.vy)) < 1e-10);
      const at = predictAtHeight({ ...ball, ...hit }, 1.1, m.config);
      assert.ok(Math.abs(at.x - target.x) < 0.7);
    }
});

test('smart pass respects insufficient power and does not select unavailable recipients', () => {
  const m = new Match();
  const p = m.players[1];
  p.x = -4;
  const ball = { ...m.ball, x: -4.5, y: 1 };
  const target = { id: 99, team: 0, x: -1, recovery: 0 };
  const shoot = (power) => shotImpulse(ball, p, 'back', power, {}, [p, target], m.config);
  assert.equal(shoot(0.1).targetId, null);
  assert.equal(shoot(1).targetId, 99);
  target.recovery = 1;
  assert.equal(shoot(1).targetId, null);
  target.recovery = 0;
  target.diving = true;
  assert.equal(shoot(1).targetId, null);
});

test('difficulty controls response and precision; replanning does not restart reaction', () => {
  const easy = cpuSkill({ cpuSkill: 0 }),
    hard = cpuSkill({ cpuSkill: 100 });
  assert.ok(easy.reaction > hard.reaction && easy.error > hard.error && easy.speed < hard.speed);
  assert.equal(sanitizeConfig({ cpuSkill: 130 }).cpuSkill, 100);
  assert.equal(sanitizeConfig({ difficulty: 'hard' }).cpuSkill, 90);
  const m = new Match();
  Object.assign(m.ball, { x: 5, y: 4, vx: -1, vy: -2 });
  const a = planReception(m, 1);
  m.time += 0.1;
  const b = planReception(m, 1, a);
  assert.equal(a.reactionAt, b.reactionAt);
  assert.equal(a.error, b.error);
  assert.equal(a.allowDive, b.allowDive);
});

test('bot varies useful shot choices reproducibly and honors configured shot speed', () => {
  const run = (seed) => {
    const m = new Match({ ...DEFAULTS, loftSpeedMin: 8, loftSpeedMax: 8 }, seed);
    const p = m.players[4];
    Object.assign(m.ball, { x: p.x, y: 2, vx: 0, vy: -1 });
    m.lastTouch = 1;
    m.touches[1] = 1;
    const shot = chooseCPUShot(m, p, ['loft']);
    assert.ok(Math.abs(Math.hypot(shot.impulse.vx, shot.impulse.vy) - 8) < 1e-10);
    return [shot.power, shot.impulse.vx, shot.impulse.vy];
  };
  assert.deepEqual(run(9), run(9));
  assert.ok(new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(run(i * 12345)))).size > 1);
});
