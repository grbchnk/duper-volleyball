import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from './legacy-contract.js';
import { FIXED_DT, COURT } from '../../src/config.js';
import { localReceiveAim, receiveWrists } from '../../src/receive-pose.js';
import { expressivePose } from '../../src/arm-motion.js';
import { ARM_STYLES } from '../../src/arms.js';
import { serveOrigin } from '../../src/motion.js';

test('TEST replaces floor and out balls in the same tick without entering point phase', () => {
  for (const [x, y] of [
    [-4, COURT.ballRadius],
    [17, 4],
  ]) {
    const m = new Match();
    m.reset('test');
    m.selected[0] = 1;
    m.active().x = -4;
    const count = m.testFeeds;
    Object.assign(m.ball, { x, y, vx: 0, vy: -1 });
    m.tick();
    assert.equal(m.phase, 'rally');
    assert.equal(m.testFeeds, count + 1);
    assert.equal(m.selected[0], 1);
    assert.equal(m.active().x, -4);
    assert.equal(m.pointReason, '');
    assert.deepEqual(m.score, [0, 0]);
    assert.equal(
      m.events.some((e) => ['test-miss', 'point'].includes(e.type)),
      false,
    );
    const origin = serveOrigin(m.players[m.lastPlayer], m.incomingShot, m.config, true);
    assert.equal(m.ball.x, origin.x);
    assert.equal(m.ball.y, origin.y);
  }
});

test('tracking on the same court smoothly strengthens from six metres without distance snaps', () => {
  const p = { x: -8, y: 0, team: 0, facing: 1 };
  for (const kind of ['back', 'low', 'loft']) {
    const sample = (dx) => {
      const aim = localReceiveAim(p, { kind }, { x: p.x + dx, y: 1.3, vx: -2, vy: 0 });
      return { aim, wrists: receiveWrists(kind, aim, 0.5).wrists };
    };
    let weight = -1;
    for (const d of [6.1, 6, 5, 4, 3, 2, 1.4]) {
      const s = sample(d);
      assert.ok(s.aim.weight >= weight);
      weight = s.aim.weight;
    }
    assert.equal(weight, 1);
    assert.ok(sample(5).aim.weight > 0);
    for (const boundary of [6, 4, 3, 1.4]) {
      const a = sample(boundary - 0.0001),
        b = sample(boundary + 0.0001);
      for (let i = 0; i < 2; i++)
        assert.ok(Math.hypot(a.wrists[i].x - b.wrists[i].x, a.wrists[i].y - b.wrists[i].y) < 0.01);
    }
  }
});

test('A has a low toss and low one-hand strike while W stays overhead, on both teams', () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.server = team;
    const p = m.active(team);
    const back = serveOrigin(p, 'back', DEFAULTS),
      loft = serveOrigin(p, 'loft', DEFAULTS);
    assert.equal(back.y, 0.95);
    assert.equal(loft.y, 2.05);
    m.beginServe({ kind: 'back', power: 0.5, aim: { axis: team ? -1 : 1 } });
    const a = m.serveAction;
    assert.ok(a.tossStart + a.tossSpeed ** 2 / 12 < 1.6);
    assert.ok(Math.abs(a.tossStart + a.tossSpeed * a.ideal - 3 * a.ideal ** 2 - back.y) < 1e-9);
    for (const hand of [0, 1]) {
      const pose = (kind) =>
        expressivePose({
          spec: ARM_STYLES.whip,
          config: DEFAULTS,
          kind,
          serve: { kind, hand, power: 0.5, age: 0.6 },
        });
      assert.ok(pose('back').wrists[hand].y > -20);
      assert.ok(pose('loft').wrists[hand].y < -30);
      assert.ok(pose('back').wrists[1 - hand].y > -20);
    }
  }
  const m = new Match();
  m.beginServe({ kind: 'back', power: 0.5, aim: { axis: 1 } });
  const ticks = Math.round(m.serveAction.ideal / FIXED_DT);
  for (let i = 1; i < ticks; i++) m.tick();
  m.tick(FIXED_DT, { back: true });
  assert.equal(m.phase, 'rally');
  assert.equal(m.stats.serves[0], 1);
  assert.ok(m.active(0).armSwing.y < 1.1);
});
