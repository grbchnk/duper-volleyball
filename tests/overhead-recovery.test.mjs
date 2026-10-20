import test from 'node:test';
import assert from 'node:assert/strict';
import { expressivePose } from '../src/arm-motion.js';
import { ARM_STYLES } from '../src/arms.js';
import { DEFAULTS } from '../src/config.js';

const sample = (age, extra = {}) =>
  expressivePose({
    spec: ARM_STYLES.whip,
    config: DEFAULTS,
    kind: 'loft',
    swing: { hit: true, power: 0.6, age },
    contactPoint: { x: 0, y: -42 },
    localVelocity: { x: 100, y: -160 },
    ...extra,
  });

test('upper reception lowers its hands promptly after the follow-through instead of holding above the head', () => {
  const peak = sample(0.04),
    returning = sample(0.12),
    rest = sample(0.7);
  for (let i = 0; i < 2; i++) {
    assert.ok(returning.wrists[i].y > peak.wrists[i].y + 3);
    assert.ok(
      Math.hypot(
        sample(0.28).wrists[i].x - rest.wrists[i].x,
        sample(0.28).wrists[i].y - rest.wrists[i].y,
      ) < 0.01,
    );
  }
});

test('upper reception returns both palms outside the face rather than through its centre', () => {
  for (const armScale of [0.65, 1, 1.3])
    for (const x of [-18, 0, 18])
      for (let age = 0.03; age < 0.3; age += 1 / 120) {
        const pose = sample(age, {
          config: { ...DEFAULTS, armScale },
          contactPoint: { x, y: -42 },
        });
        for (let i = 0; i < 2; i++) {
          const wrist = pose.wrists[i];
          if (wrist.y > -34 && wrist.y < -20) {
            assert.ok((i ? 1 : -1) * wrist.x >= 10, JSON.stringify({ age, i, wrist }));
          }
        }
      }
});
