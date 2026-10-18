import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_DT, sanitizeConfig } from '../../src/config.js';
import { simulateShot } from '../../src/shot-lab.js';
import { integrateBall, collideNet } from '../../src/physics.js';

test('one-hand save remains soft and lifts horizontal aim on both teams', () => {
  for (const playerId of [1, 4])
    for (const angle of [0, 180]) {
      const paths = [0.2, 0.8].map((power) =>
        simulateShot({ ...DEFAULTS, assist: false }, { kind: 'back', playerId, angle, power }),
      );
      for (const { impulse } of paths) {
        assert.equal(Math.sign(impulse.vx), angle === 0 ? 1 : -1);
        assert.ok(impulse.vy > 0);
        assert.ok(Math.hypot(impulse.vx, impulse.vy) <= 7.2);
      }
      assert.ok(
        Math.hypot(paths[1].impulse.vx, paths[1].impulse.vy) >
          Math.hypot(paths[0].impulse.vx, paths[0].impulse.vy),
      );
    }
});

test('lab paths match live fixed-step physics including drag, cartoon clock and net rebounds', () => {
  for (const kind of ['low', 'back', 'loft', 'drive'])
    for (const assist of [false, true]) {
      const config = { ...DEFAULTS, assist, cartoonFlight: 1 };
      const sample = simulateShot(config, { kind, power: 0.65, playerId: 2, angle: 0 });
      const ball = { ...sample.ball, ...sample.impulse };
      for (const point of sample.points.slice(1, -1)) {
        const previous = { ...ball };
        integrateBall(ball, FIXED_DT, config);
        collideNet(ball, previous, config.restitution, config);
        assert.deepEqual(ball, point);
      }
    }
});

test('shot tuning survives JSON, is bounded and changes only the selected shot', () => {
  const config = sanitizeConfig(
    JSON.parse(
      JSON.stringify({
        ...DEFAULTS,
        backSpeedMin: 5,
        backSpeedMax: 7,
        backAngleMin: 62,
        backAngleMax: 62,
      }),
    ),
  );
  assert.equal(config.backSpeedMin, 5);
  assert.equal(config.backSpeedMax, 7);
  assert.equal(config.backAngleMin, 62);
  assert.equal(sanitizeConfig({ backSpeedMax: 100 }).backSpeedMax, 30);
  const b = simulateShot({ ...config, assist: false }, { kind: 'back', power: 0.5 });
  assert.ok(Math.abs(Math.hypot(b.impulse.vx, b.impulse.vy) - 6) < 1e-12);
  assert.ok(Math.abs((Math.atan2(b.impulse.vy, -b.impulse.vx) * 180) / Math.PI - 62) < 1e-12);
  assert.deepEqual(
    simulateShot(config, { kind: 'low', power: 0.5 }).impulse,
    simulateShot(DEFAULTS, { kind: 'low', power: 0.5 }).impulse,
  );
});
