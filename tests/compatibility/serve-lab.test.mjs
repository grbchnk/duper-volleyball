import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_DT, sanitizeConfig } from '../../src/config.js';
import { SERVE_FIELDS, serveKey, serveSettings } from '../../src/serve-settings.js';
import { simulateServe } from '../../src/serve-lab.js';
import { Match } from './legacy-contract.js';
import { shotImpulse } from '../../src/moves.js';
import { serveMotion, serveOrigin, sampleServeMotion } from '../../src/motion.js';
import { integrateBall, collideNet } from '../../src/physics.js';

const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const tune = (kind, fields) =>
  sanitizeConfig({
    ...DEFAULTS,
    ...Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [serveKey(kind, key), value]),
    ),
  });

test('serve profiles survive JSON, are bounded, and remain independent from rally profiles', () => {
  const config = tune('loft', { SpeedMax: 23, AngleMin: 20, IdealMax: 2.4, TossGravity: 9 });
  assert.deepEqual(sanitizeConfig(JSON.parse(JSON.stringify(config))), config);
  assert.equal(config.loftSpeedMax, DEFAULTS.loftSpeedMax);
  assert.equal(config.serveLowSpeedMax, DEFAULTS.serveLowSpeedMax);
  const bounded = tune('low', {
    SpeedMax: 999,
    IdealMin: -2,
    PerfectWindow: 0.4,
    HitWindow: 0.02,
    ElevationMin: 40,
    ElevationMax: 10,
  });
  assert.equal(bounded.serveLowSpeedMax, 30);
  assert.equal(bounded.serveLowIdealMin, 0.3);
  assert.equal(bounded.serveLowHitWindow, 0.4);
  assert.equal(bounded.serveLowElevationMax, 40);
  for (const field of Object.keys(SERVE_FIELDS))
    assert.ok(Number.isFinite(serveSettings({}, 'drive')[field]));
});
test('each serve uses its speed, angle, spin and nonlinear power profile on both sides', () => {
  for (const kind of ['low', 'back', 'loft', 'drive'])
    for (const team of [0, 1]) {
      const config = tune(kind, {
        Targeted: 0,
        SpeedMin: 5,
        SpeedMax: 21,
        AngleMin: 10,
        AngleMax: 70,
        SpinMin: -1,
        SpinMax: 1,
        PowerCurve: 2,
      });
      const m = new Match(config),
        p = m.players[team * 3];
      for (const power of [0, 0.5, 1]) {
        const impulse = shotImpulse(m.ball, p, kind, power, {}, m.players, config, true);
        near(Math.hypot(impulse.vx, impulse.vy), 5 + 16 * power ** 2);
        near((Math.atan2(impulse.vy, Math.abs(impulse.vx)) * 180) / Math.PI, 10 + 60 * power ** 2);
        near(impulse.spin, -1 + 2 * power ** 2);
        assert.equal(Math.sign(impulse.vx), team ? -1 : 1);
      }
      assert.deepEqual(
        shotImpulse(m.ball, p, kind, 0.5, {}, m.players, config),
        shotImpulse(m.ball, p, kind, 0.5, {}, m.players, DEFAULTS),
      );
    }
});
test('manual serve direction blends and clamps in the explicitly chosen direction', () => {
  const config = tune('low', { AngleMin: 40, AngleMax: 40, AimBlend: 0.5, ElevationMax: 45 });
  const m = new Match(config);
  for (const x of [-1, 1]) {
    const hit = shotImpulse(
      m.ball,
      m.active(),
      'low',
      0.5,
      { vector: { x, y: 0 } },
      m.players,
      config,
      true,
    );
    near((Math.atan2(hit.vy, hit.vx) * 180) / Math.PI, x < 0 ? 160 : 20);
  }
});
test('all four preview serves use the real timed contact and fixed-step flight on either team', () => {
  for (const kind of ['low', 'back', 'loft', 'drive'])
    for (const playerId of [0, 3]) {
      const data = simulateServe(DEFAULTS, { kind, power: 0.6, playerId });
      assert.equal(data.hit, true, `${kind} ${playerId}`);
      assert.equal(data.result, 'Идеально');
      assert.equal(data.match.stats.serves[playerId / 3], 1);
      const ball = { ...data.ball };
      for (const point of data.points.slice(1, -1)) {
        const previous = { ...ball };
        integrateBall(ball, FIXED_DT, DEFAULTS);
        collideNet(ball, previous, DEFAULTS.restitution, DEFAULTS);
        assert.deepEqual(ball, point);
      }
    }
});
test('ideal time depends on strength; toss always meets configured hand height at that time', () => {
  for (const kind of ['low', 'back', 'loft', 'drive']) {
    const config = tune(kind, {
      IdealMin: 0.8,
      IdealMax: 2,
      TossHeight: 0.5,
      TossGravity: 8,
      ContactHeight: 1.1,
      Runup: 1.7,
    });
    const m = new Match(config);
    for (const power of [0, 0.5, 1]) {
      const p = { ...m.active() };
      const motion = serveMotion(p, { kind, power }, config);
      near(motion.ideal, 0.8 + 1.2 * power);
      const ball = sampleServeMotion(p, motion, motion.ideal);
      near(ball.y, serveOrigin(p, kind, config).y);
      const data = simulateServe(config, { kind, power });
      assert.equal(data.hit, true);
      near(data.launchTime, motion.ideal, FIXED_DT + 1e-8);
    }
  }
});
test('too-early jump serve timing is adjusted to the reachable apex', () => {
  const config = tune('drive', { IdealMin: 0.3, IdealMax: 0.3 });
  const data = simulateServe(config, { kind: 'drive', power: 0.5 });
  assert.ok(data.motion.ideal > 0.3);
  assert.equal(data.hit, true);
});
test('mistiming applies the configured speed penalty once and early attempts really miss', () => {
  const config = tune('loft', {
    PerfectWindow: 0.01,
    HitWindow: 0.2,
    ContactReach: 1.2,
    MistimePower: 0.4,
  });
  const perfect = simulateServe(config, { kind: 'loft', power: 0.5 });
  const late = simulateServe(config, { kind: 'loft', power: 0.5, timingOffset: 0.05 });
  assert.equal(perfect.result, 'Идеально');
  assert.equal(late.result, 'Неточно');
  near(
    Math.hypot(late.impulse.vx, late.impulse.vy) /
      Math.hypot(perfect.impulse.vx, perfect.impulse.vy),
    0.4,
  );
  const miss = simulateServe(config, { kind: 'loft', power: 0.5, timingOffset: -0.6 });
  assert.equal(miss.hit, false);
  assert.equal(miss.result, 'Промах');
  assert.equal(miss.match.stats.serves[0], 0);
});
test('target mode changes landing from strength and may be disabled for a freely aimed soft serve', () => {
  const config = tune('back', {
    Targeted: 1,
    NetAssist: 0,
    TargetMin: 2,
    TargetMax: 6,
    TargetCurve: 1,
    FlightTimeMin: 2.6,
    FlightTimeMax: 2.6,
  });
  const low = simulateServe(config, { kind: 'back', power: 0 });
  const high = simulateServe(config, { kind: 'back', power: 1 });
  near(low.points.at(-1).x, 2, 0.2);
  near(high.points.at(-1).x, 6, 0.2);
  const direct = simulateServe(
    { ...config, serveBackTargeted: 0 },
    { kind: 'back', power: 1, angle: 0 },
  );
  near(direct.impulse.vy, 0);
  near(direct.impulse.vx, config.serveBackSpeedMax);
});
test('serve-specific charge duration changes charging but leaves rally charge duration intact', () => {
  const fast = new Match(tune('low', { ChargeSeconds: 0.2 }));
  const slow = new Match(tune('low', { ChargeSeconds: 1.2 }));
  for (let n = 0; n < 12; n++) {
    fast.tick(FIXED_DT, { low: true });
    slow.tick(FIXED_DT, { low: true });
  }
  assert.ok(fast.charge.power > slow.charge.power * 2);
  assert.equal(fast.config.chargeSeconds, slow.config.chargeSeconds);
});
