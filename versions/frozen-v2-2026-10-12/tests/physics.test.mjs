import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, COURT, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { integrateBall, launchTo, collideNet, isInside } from '../src/physics.js';
const ball = (more = {}) => ({ x: -4, y: 3, z: 4.5, vx: 2, vy: 5, vz: 0, spin: 0, ...more });
test('free flight matches an analytic parabola without drag', () => {
  const b = ball(),
    c = { ...DEFAULTS, drag: 0 };
  for (let i = 0; i < 120; i++) integrateBall(b, FIXED_DT, c);
  assert.ok(Math.abs(b.x - -2) < 1e-10);
  assert.ok(Math.abs(b.y - (3 + 5 - 9.81 / 2)) < 1e-10);
});
test('quadratic drag dissipates horizontal speed', () => {
  const a = ball(),
    b = ball();
  for (let i = 0; i < 60; i++) {
    integrateBall(a, FIXED_DT, { ...DEFAULTS, drag: 0 });
    integrateBall(b, FIXED_DT, DEFAULTS);
  }
  assert.ok(b.vx < a.vx);
});
test('swept net collision catches a fast spike; above tape passes', () => {
  const previous = ball({ x: -0.4, y: 2, vx: 90 });
  const b = { ...previous, x: 0.35 };
  assert.equal(collideNet(b, previous), true);
  assert.ok(b.vx < 0);
  assert.equal(b.x, -COURT.ballRadius);
  const high = ball({ x: 0.35, y: 3, vx: 90 });
  assert.equal(collideNet(high, { ...high, x: -0.4 }), false);
});
test('touching boundary is in, fully outside is out', () => {
  assert.equal(isInside(ball({ x: 9.1 })), true);
  assert.equal(isInside(ball({ x: 9.2 })), false);
  assert.equal(isInside(ball({ z: -0.2 })), false);
});
test('trajectory solver lands at its target with drag and spin', () => {
  const b = ball({ x: -3, y: 3.4 });
  const target = { x: 7, y: 0.15, z: 4.5 };
  launchTo(b, target, 1.3, DEFAULTS, 0.5);
  for (let i = 0; i < 156; i++) integrateBall(b, FIXED_DT, DEFAULTS);
  assert.ok(Math.abs(b.x - target.x) < 0.03);
  assert.ok(Math.abs(b.y - target.y) < 0.03);
});
test('untrusted configuration is bounded and rejects non-objects', () => {
  const c = sanitizeConfig({
    gravity: -100,
    gameSpeed: Infinity,
    hitPower: 99,
    scoring: 'bogus',
    assist: 'false',
  });
  assert.equal(c.gravity, 5);
  assert.equal(c.hitPower, 1.4);
  assert.equal(c.gameSpeed, DEFAULTS.gameSpeed);
  assert.equal(c.scoring, 'sideout');
  assert.equal(c.assist, true);
  assert.throws(() => sanitizeConfig(null));
  assert.throws(() => sanitizeConfig([]));
});

test('net tape grazing hops forward while lower mesh contacts rebound, on either side', () => {
  for (const sign of [-1, 1])
    for (const size of [0.7, 1.2, 1.8]) {
      const config = { ...DEFAULTS, ballSize: size };
      const previous = ball({
        x: sign,
        y: COURT.netHeight + 0.295 * size * 0.7,
        vx: -sign * 8,
        vy: -1,
      });
      const b = { ...previous, x: 0 };
      assert.equal(collideNet(b, previous, config.restitution, config), true);
      assert.equal(Math.sign(b.vx), -sign);
      assert.ok(Math.abs(b.vx) < 8 && b.vy > 0);
      assert.ok(b.y > COURT.netHeight + 0.295 * size);
      assert.equal(b.netImpact.direction, -sign);
      const lower = { ...previous, y: 1.5 };
      const hit = { ...lower, x: 0 };
      assert.equal(collideNet(hit, lower, config.restitution, config), true);
      assert.equal(Math.sign(hit.vx), sign);
      assert.ok(Math.abs(hit.x) >= 0.295 * size - 1e-9, 'visible ball stays outside the mesh');
    }
});
