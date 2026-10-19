import test from 'node:test';
import assert from 'node:assert/strict';
import { armContour, blendAngle } from '../src/arm-contour.js';

test('animated arm contours reuse their points without retaining old geometry', () => {
  const shoulder = { x: -6, y: -20 };
  const buffer = armContour(shoulder, { x: -14, y: -13 }, { x: -9, y: -12 }, 3.5);
  const left = [...buffer.left],
    right = [...buffer.right],
    elbow = buffer.elbow;
  for (let frame = 0; frame < 120; frame++) {
    const wrist = { x: Math.sin(frame / 10) * 20, y: -30 + frame / 10 };
    const hint = { x: -12, y: -18 };
    const serveBend = frame / 120;
    const fresh = armContour(shoulder, hint, wrist, 3.5, serveBend);
    assert.equal(armContour(shoulder, hint, wrist, 3.5, serveBend, buffer), buffer);
    assert.deepEqual(buffer, fresh);
    assert.equal(buffer.elbow, elbow);
    for (let i = 0; i < left.length; i++) {
      assert.equal(buffer.left[i], left[i]);
      assert.equal(buffer.right[i], right[i]);
    }
  }
});

test('sprung elbow hints cannot reverse the forearm against the current reach', () => {
  const shoulder = { x: -6, y: -20 };
  for (const wrist of [
    { x: -9, y: -12 },
    { x: 7, y: -40 },
    { x: 20, y: -17 },
    { x: -20, y: -35 },
  ])
    for (const hint of [
      { x: -30, y: 10 },
      { x: 40, y: -60 },
      { x: -12, y: -15 },
    ]) {
      const arm = armContour(shoulder, hint, wrist, 3.5);
      const reach = { x: wrist.x - shoulder.x, y: wrist.y - shoulder.y };
      const forearm = { x: wrist.x - arm.elbow.x, y: wrist.y - arm.elbow.y };
      assert.ok(forearm.x * reach.x + forearm.y * reach.y > 0);
      assert.ok(
        Math.abs(Math.sin(arm.handAngle) - forearm.x / Math.hypot(forearm.x, forearm.y)) < 1e-9,
      );
      assert.ok(
        Math.abs(-Math.cos(arm.handAngle) - forearm.y / Math.hypot(forearm.x, forearm.y)) < 1e-9,
      );
      for (let i = 0; i < arm.left.length; i++)
        assert.ok(
          Math.abs(
            Math.hypot(arm.left[i].x - arm.right[i].x, arm.left[i].y - arm.right[i].y) - 3.5,
          ) < 1e-9,
        );
    }
});

test('turning a player mirrors the elbow and hand together', () => {
  const mirror = (p) => ({ x: -p.x, y: p.y });
  const shoulder = { x: -6, y: -20 },
    hint = { x: -14, y: -13 },
    wrist = { x: -9, y: -12 };
  const a = armContour(shoulder, hint, wrist, 3.5);
  const b = armContour(mirror(shoulder), mirror(hint), mirror(wrist), 3.5);
  assert.ok(Math.abs(a.elbow.x + b.elbow.x) < 1e-9);
  assert.ok(Math.abs(a.elbow.y - b.elbow.y) < 1e-9);
  assert.ok(Math.abs(Math.sin(a.handAngle) + Math.sin(b.handAngle)) < 1e-9);
});

test('hand rotation crosses the angle wrap by the short route', () => {
  const from = (179 * Math.PI) / 180,
    to = (-179 * Math.PI) / 180;
  const middle = blendAngle(from, to, 0.5);
  assert.ok(Math.abs(middle - Math.PI) < 1e-9);
});

test('serve windup keeps the original folded elbow and its hand tangent', () => {
  const shoulder = { x: 6, y: -20 },
    elbow = { x: 14, y: -10 },
    wrist = { x: 10, y: -12 };
  const serve = armContour(shoulder, elbow, wrist, 3.5, 1);
  assert.deepEqual(serve.elbow, elbow);
  assert.equal(serve.handAngle, Math.atan2(-2, -4) + Math.PI / 2);
  const normal = armContour(shoulder, elbow, wrist, 3.5);
  const recovery = armContour(shoulder, elbow, wrist, 3.5, 0.5);
  assert.ok(Math.abs(recovery.elbow.x - (normal.elbow.x + elbow.x) / 2) < 1e-9);
  assert.ok(Math.abs(recovery.elbow.y - (normal.elbow.y + elbow.y) / 2) < 1e-9);
});
