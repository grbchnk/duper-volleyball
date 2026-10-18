import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { shotImpulse } from '../src/moves.js';

test('all four serves lock first-press direction for either human team, including soft serve', () => {
  for (const kind of ['low', 'back', 'loft', 'drive'])
    for (const team of [0, 1])
      for (const direction of [-1, 1]) {
        const m = new Match(DEFAULTS);
        m.mode = 'versus';
        m.server = team;
        m.startServe();
        const tick = (input = {}) => m.tick(FIXED_DT, team ? {} : input, team ? input : {});
        const vector = { x: direction * 0.6, y: 0.8 };
        for (let i = 0; i < 20; i++) tick({ [kind]: true, buttonVector: vector });
        tick();
        assert.equal(m.phase, 'serve-motion');
        assert.deepEqual(m.serveAction.aim.vector, vector);
        while (m.phaseTime < m.serveAction.ideal - FIXED_DT)
          tick({ buttonVector: { x: -direction, y: 0 } });
        tick({ [kind]: true, buttonVector: { x: -direction, y: 0 } });
        assert.equal(m.phase, 'rally', `${kind}/${team}/${direction}`);
        assert.equal(Math.sign(m.ball.vx), direction);
      }
});

test('manual soft serve bypasses target solver and honors profile angle and speed', () => {
  const m = new Match();
  for (const direction of [-1, 1]) {
    const config = { ...DEFAULTS, serveBackSpeedMin: 8, serveBackSpeedMax: 8 };
    const aim = { vector: { x: direction * 0.6, y: 0.8 } };
    const hit = shotImpulse(m.ball, m.active(), 'back', 0.5, aim, m.players, config, true);
    const plain = shotImpulse(
      m.ball,
      m.active(),
      'back',
      0.5,
      aim,
      m.players,
      { ...config, serveBackTargeted: 0 },
      true,
    );
    assert.deepEqual(hit, plain);
    assert.ok(Math.abs(Math.hypot(hit.vx, hit.vy) - 8) < 1e-10);
    assert.ok(Math.abs(hit.vx / hit.vy - direction * 0.75) < 1e-10);
  }
});
