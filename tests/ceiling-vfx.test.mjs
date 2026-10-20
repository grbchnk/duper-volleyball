import test from 'node:test';
import assert from 'node:assert/strict';
import { CeilingVFX, ballAboveCeiling, ballShadowOpacity, CEILING_Y } from '../src/ceiling-vfx.js';
import { soundCue } from '../src/audio.js';

const height = (screenY) => (465 - screenY) / 42;
const scene = () => ({ ball: { x: -4, y: height(90), vx: 3, vy: 15 }, time: 1, phase: 'rally' });
test('ceiling emits one break per crossing, interpolates position and leaves physics untouched', () => {
  const vfx = new CeilingVFX(),
    m = scene();
  assert.equal(vfx.update(m), null);
  m.time += 1 / 60;
  m.ball.x = -3;
  m.ball.y = height(26);
  const before = structuredClone(m);
  assert.equal(vfx.update(m).entering, false);
  assert.deepEqual(m, before);
  assert.equal(vfx.bursts.length, 1);
  assert.equal(vfx.bursts[0].x, 340);
  assert.equal(vfx.update(m), null);
  m.time += 1 / 60;
  m.ball.y = height(90);
  assert.equal(vfx.update(m).entering, true);
  assert.equal(vfx.bursts.length, 2);
  assert.equal(vfx.update(m), null);
});
test('new balls, resets, pauses and scene changes cannot create phantom ceiling breaks', () => {
  const vfx = new CeilingVFX(),
    m = scene();
  vfx.update(m);
  m.ball = { ...m.ball, y: height(10) };
  assert.equal(vfx.update(m), null);
  m.ball.y = height(100);
  m.time = 0;
  assert.equal(vfx.update(m), null);
  m.phase = 'serve-ready';
  m.ball.y = height(10);
  assert.equal(vfx.update(m), null);
  m.phase = 'rally';
  m.ball.y = height(100);
  assert.equal(vfx.update(m), null);
  assert.equal(vfx.bursts.length, 0);
});
test('shadow fades continuously to zero before ball disappears, then recovers with descent', () => {
  let previous = 1;
  for (let y = 450; y > -100; y -= 1) {
    const ball = { x: 0, y: height(y) };
    const opacity = ballShadowOpacity(ball);
    assert.ok(opacity <= previous);
    assert.ok(previous - opacity < 0.01);
    if (y < CEILING_Y) {
      assert.equal(ballAboveCeiling(ball), true);
      assert.equal(opacity, 0);
    }
    previous = opacity;
  }
  assert.equal(ballShadowOpacity({ x: 0, y: height(450) }), 1);
});
test('ceiling sound includes impact, cracking noise and delayed falling debris', () => {
  const cue = soundCue({ type: 'ceiling-break', speed: 15 });
  assert.ok(cue.some((v) => v.type === 'sine' && v.delay === 0));
  assert.equal(cue.filter((v) => v.type === 'noise').length, 5);
  assert.ok(cue.some((v) => v.delay >= 0.28));
});

test('debris does not consume gameplay randomness', () => {
  const vfx = new CeilingVFX(),
    m = scene();
  vfx.update(m);
  m.ball.y = height(20);
  m.time += 1 / 60;
  const random = Math.random;
  Math.random = () => {
    throw Error('Gameplay RNG consumed');
  };
  try {
    assert.equal(vfx.update(m).type, 'ceiling-break');
  } finally {
    Math.random = random;
  }
});
