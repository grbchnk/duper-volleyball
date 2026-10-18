import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { serveMotion, serveOrigin, sampleServeMotion } from '../src/motion.js';
import { heldServeBall, serveSupport } from '../src/serve-support.js';
import { expressivePose } from '../src/arm-motion.js';
import { ARM_STYLES } from '../src/arms.js';
import { simulateServe } from '../src/serve-lab.js';

test('both teams wait with a ball supported below the face, using the same hand through the toss', () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.server = team;
    m.startServe();
    const p = m.serverPlayer();
    const held = heldServeBall(p);
    assert.equal(m.ball.y, 0.85);
    assert.equal(m.ball.x, held.x);
    const hand = serveSupport(m, p).hand;
    m.beginServe({ kind: 'loft', power: 0.5, aim: {} });
    assert.equal(serveSupport(m, p).hand, hand);
    assert.equal(hand, 1 - m.serveAction.hand);
    assert.equal(m.ball.y, held.y);
    assert.equal(m.ball.x, held.x);
    assert.equal(m.events.filter((e) => e.type === 'toss').length, 0);
    for (let i = 0; i < 24; i++) m.tick(FIXED_DT);
    assert.equal(m.events.filter((e) => e.type === 'toss').length, 1);
  }
});

test('the held lift joins the free toss continuously and keeps every ideal strike time reachable', () => {
  for (const team of [0, 1])
    for (const kind of ['low', 'back', 'loft', 'drive'])
      for (const power of [0, 0.5, 1]) {
        const p = { team, x: team ? 9.4 : -9.4, y: 0, z: 4.5 };
        const action = serveMotion(p, { kind, power }, DEFAULTS);
        const delay = action.tossDelay,
          h = 1e-5;
        assert.ok(delay > 0 && delay < action.ideal);
        const sample = (t) => sampleServeMotion({ ...p }, action, t);
        const before = sample(delay - h),
          at = sample(delay),
          after = sample(delay + h);
        assert.ok(Math.abs(before.y - at.y) < 0.001);
        assert.ok(Math.abs(after.y - at.y) < 0.001);
        assert.ok(Math.abs((at.y - before.y) / h - (after.y - at.y) / h) < 0.01);
        const actual = sample(action.ideal),
          target = serveOrigin(p, kind, DEFAULTS, true);
        assert.ok(Math.abs(actual.y - target.y) < 1e-8);
        const played = simulateServe(DEFAULTS, { kind, power, playerId: team * 3 });
        assert.equal(played.hit, true);
        assert.equal(played.frames[0].ball.y, 0.85);
      }
});

test('the support palm reaches its exact target independently of arm shape, then releases', () => {
  const target = { x: 10.5, y: -9.2 };
  const pose = expressivePose({
    spec: ARM_STYLES.whip,
    config: DEFAULTS,
    kind: 'loft',
    serveSupport: { hand: 0, point: target, weight: 1, attached: true },
    shoulderLift: 3,
  });
  assert.deepEqual(pose.wrists[0], target);
  assert.equal(pose.stage, 'Мяч на ладони');
  const m = new Match();
  const p = m.serverPlayer();
  m.beginServe({ kind: 'low', power: 0.5, aim: {} });
  m.phaseTime = m.serveAction.tossDelay;
  assert.equal(serveSupport(m, p).weight, 1);
  m.phaseTime += 0.09;
  assert.ok(Math.abs(serveSupport(m, p).weight - 0.5) < 1e-8);
  m.phaseTime += 0.1;
  assert.equal(serveSupport(m, p), null);
});
