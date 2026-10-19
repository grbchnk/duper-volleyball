import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from './legacy-contract.js';
import { FIXED_DT, COURT } from '../../src/config.js';
import { preparedHands } from '../../src/held-contact.js';
import { shotImpulse } from '../../src/moves.js';
import { expressivePose } from '../../src/arm-motion.js';
import { ARM_STYLES } from '../../src/arms.js';
import { HOMES } from '../../src/formation.js';

test('both teams walk back after either winner, landing and recovering before moving', () => {
  for (const winner of [0, 1]) {
    const m = new Match();
    m.startDrill('receive');
    for (const p of m.players) p.x = m.sign(p.team) * 5;
    m.jump(m.players[0]);
    m.dive(m.players[1], 1);
    const original = m.players.map((p) => p.x);
    m.point(winner, 'TEST');
    m.tick();
    assert.equal(m.players[0].x, original[0]);
    let walked = false;
    for (let i = 0; i < 800 && m.phase === 'point'; i++) {
      const before = m.players.map((p) => p.x);
      const diving = m.players.map((p) => p.diving);
      m.tick();
      if (m.phase === 'point') {
        for (const p of m.players.filter((p) => !p.diving && !diving[p.id]))
          assert.ok(Math.abs(p.x - before[p.id]) <= m.config.playerSpeed * FIXED_DT + 1e-8);
        walked ||= m.players.some((p) => p.pose === 'run');
      }
    }
    assert.ok(walked);
    assert.equal(m.phase, 'serve');
    for (const p of m.players) {
      const home = p.id === m.server * 3 ? COURT.halfLength + 0.15 : HOMES[p.id % 3];
      assert.equal(p.x, m.sign(p.team) * home);
      assert.equal(p.y, 0);
    }
  }
});

test('D receives on either prepared palm for both facing and aim directions', () => {
  for (const facing of [-1, 1])
    for (const axis of [-1, 1])
      for (const hand of [0, 1]) {
        const m = new Match();
        m.startDrill('receive');
        const p = m.active();
        p.facing = facing;
        m.charge = { kind: 'drive', power: 0.5, age: 0.2, playerId: p.id, aim: { axis } };
        Object.assign(m.ball, preparedHands(p, m)[hand]);
        assert.equal(m.tryHeldContact(), true);
        assert.equal(m.contacts, 1);
        assert.equal(m.tryHeldContact(), false);
      }
});

test('low reception hands sit nearer the torso and its free flight has a higher arc', () => {
  const m = new Match({ ...DEFAULTS, assist: false });
  m.startDrill('receive');
  const p = m.active();
  m.charge = { kind: 'low', power: 0.5, age: 0.2, playerId: p.id };
  const hands = preparedHands(p, m);
  assert.ok(hands.every((h) => Math.abs(h.x - p.x) < 0.5));
  const impulse = shotImpulse(m.ball, p, 'low', 0.5, { axis: 1 }, m.players, m.config);
  const speed = (5 + 11.7) / 2;
  assert.ok(impulse.vy > speed * Math.sin((55 * Math.PI) / 180));
  assert.ok(impulse.vx < speed * Math.cos((55 * Math.PI) / 180));
});

test('an off-time nearby serve is weak and a miss has a bounded one-hand stroke', () => {
  const speeds = [];
  for (const offset of [0, -0.125]) {
    const m = new Match();
    m.beginServe({ kind: 'loft', power: 1, aim: { axis: 1 } });
    const count = Math.round((m.serveAction.ideal + offset) / FIXED_DT);
    for (let i = 0; i < count - 1; i++) m.tick();
    m.tick(FIXED_DT, { loft: true });
    assert.equal(m.phase, 'rally');
    speeds.push(Math.hypot(m.ball.vx, m.ball.vy));
  }
  assert.ok(speeds[1] < speeds[0] * 0.4);
  for (const hand of [0, 1])
    for (const age of [0, 0.05, 0.1, 0.3, 0.6]) {
      const pose = expressivePose({
        spec: ARM_STYLES.whip,
        config: DEFAULTS,
        kind: 'drive',
        swing: { hit: false, serve: true, hand, age, power: 1 },
        contactPoint: { x: 300, y: -300 },
      });
      assert.ok(pose.wrists.every((w) => Math.abs(w.x) < 20 && Math.abs(w.y) < 45));
    }
});
