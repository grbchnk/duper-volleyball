import test from 'node:test';
import assert from 'node:assert/strict';
import { expressivePose } from '../src/arm-motion.js';
import { challengeProfileKey } from '../src/records.js';
import { ARM_STYLES } from '../src/arms.js';
import { DEFAULTS, sanitizeConfig } from '../src/config.js';
import { exportSettings, importSettings } from '../src/settings-file.js';

test('follow-through tuning preserves contact, controls travel and returns to rest', () => {
  const pose = (reach, age) =>
    expressivePose({
      spec: ARM_STYLES.whip,
      config: { ...DEFAULTS, armFollowThrough: reach },
      kind: 'drive',
      swing: { hit: true, age, power: 1 },
      contactPoint: { x: 15, y: -40 },
      localVelocity: { x: 200, y: 0 },
    });
  for (const reach of [0, 5, 12]) {
    assert.deepEqual(pose(reach, 0).wrists[1], { x: 15, y: -40 });
    assert.equal(pose(reach, 0.07).wrists[1].x, 15 + reach);
    assert.deepEqual(pose(reach, 1).wrists, pose(5, 1).wrists);
  }
  assert.equal(
    challengeProfileKey({ ...DEFAULTS, armFollowThrough: 12 }),
    challengeProfileKey(DEFAULTS),
  );
  assert.equal(sanitizeConfig({ armFollowThrough: 100 }).armFollowThrough, 15);
  assert.equal(
    importSettings(exportSettings({ ...DEFAULTS, armFollowThrough: 12 })).armFollowThrough,
    12,
  );
});

test('current settings retire cartoon flight while legacy profiles remain readable', () => {
  assert.equal(sanitizeConfig({ ...DEFAULTS, cartoonFlight: 1 }).cartoonFlight, undefined);
  assert.equal(
    importSettings(JSON.stringify({ version: 3, config: { cartoonFlight: 1 } })).cartoonFlight,
    undefined,
  );
  assert.equal(sanitizeConfig({ ...DEFAULTS, dynamic: false, cartoonFlight: 1 }).cartoonFlight, 1);
});

test('R2 reuses the ordinary drive with the other striking hand and the same compact travel', () => {
  const pose = (aim, phase) =>
    expressivePose({
      spec: ARM_STYLES.whip,
      config: DEFAULTS,
      kind: 'drive',
      ...phase(aim),
      contactPoint: { x: 15, y: -40 },
      localVelocity: { x: 200, y: 0 },
    });
  for (const phase of [
    (aim) => ({ charge: { age: 1, power: 1, aim } }),
    (aim) => ({ swing: { age: 0, power: 1, hit: true, aim } }),
    (aim) => ({ swing: { age: 0.02, power: 1, hit: true, aim } }),
    (aim) => ({ swing: { age: 0.07, power: 1, hit: false, aim } }),
  ]) {
    const normal = pose({}, phase),
      fast = pose({ fast: true }, phase);
    assert.deepEqual(fast.wrists, [...normal.wrists].reverse());
    assert.deepEqual(pose({ fast: true, soft: true }, phase), pose({ soft: true }, phase));
    for (const point of fast.elbows)
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  }
  const recovered = (aim) => ({ swing: { age: 1, power: 1, hit: true, aim } });
  assert.deepEqual(pose({ fast: true }, recovered).wrists, pose({}, recovered).wrists);
});
