import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { jumpProfile, sampleJump } from '../src/motion.js';
import { shotImpulse } from '../src/moves.js';
import { traceBall } from '../src/physics.js';
import { serveOrigin } from '../src/motion.js';

test('restored jump rises quickly, holds briefly and accelerates down', () => {
  const j = jumpProfile(DEFAULTS);
  const early = sampleJump(j, j.windup + j.rise * 0.2);
  const late = sampleJump(j, j.windup + j.rise * 0.8);
  assert.ok(early.vy > late.vy && late.vy > 0);
  assert.equal(sampleJump(j, j.windup + j.rise + j.hang / 2).y, j.height);
  assert.equal(sampleJump(j, j.windup + j.rise + j.hang / 2).vy, 0);
  const down = j.windup + j.rise + j.hang;
  assert.ok(sampleJump(j, down + j.fall * 0.8).vy < sampleJump(j, down + j.fall * 0.2).vy);
  assert.equal(sanitizeConfig({ variableHang: true }).variableHang, undefined);
});

test('air speed controls horizontal travel independently of jump height and stays within court', () => {
  for (const airMoveSpeed of [0, 0.8, 2.4]) {
    const m = new Match({ ...DEFAULTS, assist: false, airMoveSpeed });
    m.startDrill('receive');
    const p = m.active();
    m.jump(p);
    p.jumpTime = p.jumpProfile.windup + 0.05;
    p.y = 0.5;
    const x = p.x;
    for (let i = 0; i < 12; i++) m.movePlayers(FIXED_DT, { axis: 0.5 });
    assert.ok(Math.abs(p.x - x - airMoveSpeed * 0.05) < 1e-10);
    p.x = -0.33;
    for (let i = 0; i < 120; i++) m.movePlayers(FIXED_DT, { axis: 1 });
    assert.ok(p.x <= -0.32);
    p.block = 1;
    const blockedX = p.x;
    m.movePlayers(FIXED_DT, { axis: -1 });
    assert.equal(p.x, blockedX);
  }
  assert.equal(sanitizeConfig({ airMoveSpeed: 99 }).airMoveSpeed, 3);
  assert.equal(sanitizeConfig(JSON.parse(JSON.stringify({ airMoveSpeed: 1.8 }))).airMoveSpeed, 1.8);
});

test('every serve accepts explicit backward aim; neutral soft serve keeps its target profile', () => {
  for (const team of [0, 1])
    for (const kind of ['low', 'back', 'loft', 'drive']) {
      const m = new Match();
      const p = m.players[team * 3],
        forward = team ? -1 : 1;
      p.x = -forward * 9.4;
      const ball = { ...m.ball, ...serveOrigin(p, kind, m.config, true) };
      const impulse = shotImpulse(
        ball,
        p,
        kind,
        0.5,
        { axis: -forward, vector: { x: -forward, y: 0 } },
        m.players,
        m.config,
        true,
      );
      assert.ok(impulse.vx * forward < 0, kind);
      if (kind === 'back') {
        const neutral = shotImpulse(ball, p, kind, 0.5, {}, m.players, m.config, true);
        const landing = traceBall({ ...ball, ...neutral }, m.config, 8).at(-1);
        assert.ok(landing.x * forward > 1 && landing.x * forward < 4, String(landing.x));
        const strong = shotImpulse(ball, p, kind, 1, {}, m.players, m.config, true);
        assert.ok(traceBall({ ...ball, ...strong }, m.config, 8).at(-1).x * forward > 9.105);
      }
    }
});

test('full power never hits for the human server without a new press', () => {
  for (const kind of ['low', 'back', 'loft', 'drive']) {
    const m = new Match();
    for (let i = 0; i < 300 && !['point', 'set-end'].includes(m.phase); i++)
      m.tick(FIXED_DT, { [kind]: true });
    assert.equal(m.stats.serves[0], 0);
    assert.equal(m.pointReason, 'ПОДАЧА: МЯЧ НЕ УДАРЕН');
  }
});
