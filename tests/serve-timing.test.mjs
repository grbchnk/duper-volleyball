import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { serveSettings, serveContactQuality } from '../src/serve-settings.js';
import { simulateServe } from '../src/serve-lab.js';
import { sampleServeMotion } from '../src/motion.js';
import { shotImpulse } from '../src/moves.js';

test('ideal serves are unchanged and timing quality fades continuously to a complete miss', () => {
  const settings = serveSettings(DEFAULTS, 'loft');
  assert.equal(serveContactQuality(settings, 0, 0), 1);
  assert.equal(serveContactQuality(settings, settings.PerfectWindow, 0), 1);
  let previous = 1;
  for (let i = 0; i <= 100; i++) {
    const offset =
      settings.PerfectWindow + ((settings.HitWindow - settings.PerfectWindow) * i) / 100;
    const quality = serveContactQuality(settings, offset, 0);
    assert.ok(quality <= previous + 1e-12);
    assert.ok(previous - quality < 0.04, 'there is no jump to a fixed weak shot');
    assert.equal(serveContactQuality(settings, -offset, 0), quality);
    previous = quality;
  }
  assert.equal(previous, 0);
  assert.equal(serveContactQuality(settings, settings.HitWindow + FIXED_DT, 0), 0);
});

test('the hand reach boundary also fades to zero instead of cutting off a full-strength hit', () => {
  const settings = serveSettings(DEFAULTS, 'low');
  const near = serveContactQuality(settings, 0, settings.ContactReach * 0.99);
  assert.ok(near > 0 && near < 0.005);
  assert.equal(serveContactQuality(settings, 0, settings.ContactReach), 0);
});

test('all four actual serve simulations have several distinct imperfect outcomes on both teams', () => {
  for (const kind of ['low', 'back', 'loft', 'drive'])
    for (const playerId of [0, 3]) {
      const values = [];
      for (const timingOffset of [0, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.26]) {
        const sample = simulateServe(DEFAULTS, { kind, power: 0.6, playerId, timingOffset });
        assert.ok(sample.quality >= 0 && sample.quality <= 1);
        values.push(sample.quality);
      }
      assert.equal(values[0], 1, kind);
      assert.equal(values.at(-1), 0, kind);
      assert.ok(new Set(values.filter((q) => q > 0 && q < 1)).size >= 2, kind + '/' + playerId);
    }
});

test('a grazing serve blends the intended impulse with the real toss exactly once', () => {
  const config = sanitizeConfig({
    ...DEFAULTS,
    serveLoftContactReach: 1.2,
    serveLoftSpinMin: 1,
    serveLoftSpinMax: 1,
  });
  const data = simulateServe(config, { kind: 'loft', power: 0.6, timingOffset: 0.18 });
  assert.equal(data.hit, true);
  assert.ok(data.quality > 0 && data.quality < 1);
  const player = structuredClone(data.player);
  const toss = { ...data.ball, ...sampleServeMotion(player, data.motion, data.launchTime), vx: 0 };
  const intended = shotImpulse(
    toss,
    player,
    'loft',
    0.6,
    data.motion.aim,
    data.match.players,
    config,
    true,
  );
  for (const axis of ['vx', 'vy']) {
    const expected = intended[axis] + (toss[axis] - intended[axis]) * (1 - data.quality);
    assert.ok(Math.abs(data.impulse[axis] - expected) < 1e-8, axis);
  }
  assert.ok(Math.abs(data.impulse.spin - intended.spin * data.quality) < 1e-8);
});

test('all timing controls used by the laboratory change actual serve quality', () => {
  const run = (extra) =>
    simulateServe(sanitizeConfig({ ...DEFAULTS, serveLoftContactReach: 1.2, ...extra }), {
      kind: 'loft',
      power: 0.6,
      timingOffset: 0.18,
    });
  const ordinary = run({});
  assert.ok(run({ serveLoftPerfectWindow: 0.2 }).quality > ordinary.quality);
  assert.ok(run({ serveLoftHitWindow: 0.4 }).quality > ordinary.quality);
  assert.ok(run({ serveLoftMistimePower: 0.9 }).quality > ordinary.quality);
  assert.equal(run({ serveLoftContactReach: 0.1 }).hit, false);
  assert.equal(run({ serveLoftHitWindow: 0.15 }).hit, false);
});
