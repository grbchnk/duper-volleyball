import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { shotImpulse } from '../src/moves.js';
import { traceBall } from '../src/physics.js';
import { nextReceiver } from '../src/receiver-selection.js';
import { cpuSkill } from '../src/cpu.js';
import { expressivePose } from '../src/arm-motion.js';
import { ARM_STYLES } from '../src/arms.js';

function setup(team = 0) {
  const m = new Match({ ...DEFAULTS, passAssist: 1 });
  m.reset('versus');
  m.phase = 'rally';
  m.lastTouch = 1 - team;
  m.lastPlayer = (1 - team) * 3;
  m.incomingShot = 'low';
  const forward = team ? -1 : 1;
  m.players.filter((p) => p.team === team).forEach((p, i) => (p.x = -forward * [7, 4, 1][i]));
  const p = m.players[team * 3];
  Object.assign(m.ball, { x: p.x, y: 0.5, vx: -forward * 8, vy: -6 });
  return { m, p, forward };
}
const shot = (m, p, kind, aim = {}, amount = 1) =>
  shotImpulse(
    { ...m.ball, y: kind === 'low' ? 0.5 : 1.9 },
    p,
    kind,
    1,
    { manualControl: true, ...aim },
    m.players,
    { ...m.config, passAssist: amount },
  );
const angle = (s) => Math.atan2(s.vy, s.vx);
const difference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

test('both passes prefer a setter on touch one, a net set on touch two and a legal return on touch three', () => {
  for (const team of [0, 1])
    for (const kind of ['low', 'loft']) {
      const { m, p, forward } = setup(team);
      const receive = shot(m, p, kind, { touchesBefore: 0 });
      assert.equal(receive.targetId, team * 3 + 1);
      assert.ok(receive.vx * forward > 0, 'an incoming attack does not push the receive backwards');
      const set = shot(m, p, kind, { touchesBefore: 1 });
      assert.equal(set.assistIntent, 'Навес у сетки');
      assert.equal(set.targetId, team * 3 + 2);
      const returned = shot(m, p, kind, { touchesBefore: 2 });
      assert.equal(returned.assistIntent, 'Перевод через сетку');
      const end = traceBall(
        { ...m.ball, y: kind === 'low' ? 0.5 : 1.9, ...returned },
        m.config,
        8,
      ).at(-1);
      assert.ok(end.x * forward > 0.6 && end.x * forward < 8.7, JSON.stringify(end));
    }
});

test('0, 50 and 100 percent interpolate the same chosen angle without adding energy for every modifier', () => {
  for (const team of [0, 1])
    for (const kind of ['low', 'loft'])
      for (const modifier of [{}, { soft: true }, { fast: true }])
        for (const touchesBefore of [0, 1, 2]) {
          const { m, p } = setup(team);
          const [raw, half, full] = [0, 0.5, 1].map((amount) =>
            shot(m, p, kind, { ...modifier, touchesBefore }, amount),
          );
          assert.ok(
            Math.abs(
              difference(angle(half), angle(raw)) - difference(angle(full), angle(raw)) / 2,
            ) < 1e-10,
          );
          for (const s of [half, full])
            assert.ok(Math.abs(Math.hypot(s.vx, s.vy) - Math.hypot(raw.vx, raw.vy)) < 1e-10);
        }
});

test('explicit high, flat forward and backward intentions remain distinct, with at most twelve degrees of correction', () => {
  for (const team of [0, 1])
    for (const kind of ['low', 'loft']) {
      const { m, forward } = setup(team);
      const p = m.players[team * 3 + 1];
      m.ball.x = p.x;
      for (const [vector, intent] of [
        [{ x: forward, y: 0 }, /Перевод через сетку/],
        [{ x: forward * 0.3, y: 0.95 }, /Навес|Пас|Свободный пас/],
        [{ x: -forward, y: 0.5 }, /Пас|Свободный пас/],
      ]) {
        const raw = shot(m, p, kind, { vector }, 0);
        const result = shot(m, p, kind, { vector });
        assert.match(result.assistIntent, intent);
        assert.equal(Math.sign(result.vx), Math.sign(vector.x));
        assert.ok(Math.abs(difference(angle(result), angle(raw))) <= (12 * Math.PI) / 180 + 1e-10);
      }
    }
});

test('the previous passer remains eligible for A to B to A, but unavailable receivers are excluded', () => {
  const { m } = setup();
  const p = m.players[1];
  m.ball.x = p.x;
  m.players[2].recovery = 1;
  const result = shot(m, p, 'loft', {
    previousPlayerId: 0,
    touchesBefore: 1,
    vector: { x: -0.2, y: 0.98 },
  });
  assert.equal(result.targetId, 0);
  m.players[0].recovery = 1;
  assert.equal(shot(m, p, 'loft', { touchesBefore: 1 }).targetId, null);
});

test('a low own-team ball near the net selects a reachable front receiver on both sides', () => {
  for (const team of [0, 1]) {
    const { m, p, forward } = setup(team);
    m.lastTouch = team;
    m.lastPlayer = p.id;
    m.touches[team] = 2;
    m.teamPhases[team] = 'defense';
    m.selected[team] = p.id;
    Object.assign(m.ball, { x: -forward * 2.5, y: 1.1, vx: forward * 3, vy: -0.2 });
    assert.equal(nextReceiver(m, team), team * 3 + 2);
    m.touches[team] = 3;
    assert.equal(nextReceiver(m, team), null);
    m.touches[team] = 2;
    m.ball.x = forward * 0.2;
    assert.equal(nextReceiver(m, team), null);
  }
});

test('the actual released third contact passes touch context into the shared assist', () => {
  const { m, p } = setup();
  m.lastTouch = p.team;
  m.lastPlayer = 1;
  m.touches[0] = 2;
  m.inputs = [{}, {}, {}];
  m.controls[0].pending = { playerId: p.id, kind: 'low', power: 1, age: 0.1, aim: {}, ttl: 0.2 };
  const expected = shot(m, p, 'low', { touchesBefore: 2 });
  assert.equal(m.tryPending(m.ball, m.controls[0]), true);
  assert.equal(m.touches[0], 3);
  assert.equal(m.ball.vx, expected.vx);
  assert.equal(m.ball.vy, expected.vy);
});

test('CPU has a skill-dependent pause after an expired attempt and cannot strike during it', () => {
  const waits = [];
  for (const cpuSkillValue of [0, 50, 100]) {
    const { m } = setup();
    m.config = { ...m.config, cpuSkill: cpuSkillValue };
    m.mode = 'match';
    m.time = 1;
    const p = m.players[3];
    p.x = 4;
    Object.assign(m.ball, { x: 4, y: 1.9, vx: 0, vy: -1 });
    m.possession = 1;
    m.cpuPlans[1] = {
      playerId: p.id,
      serial: m.shotSerial,
      at: m.time,
      reactionAt: 0,
      targetX: p.x,
      height: 1.9,
      contactAt: m.time,
      count: 0,
      preparation: { kind: 'loft', power: 0.5, start: m.time - m.config.maxHold - FIXED_DT },
    };
    m.updateCPU();
    const retry = m.cpuRetry[1];
    assert.ok(retry && retry.at > m.time);
    waits.push(retry.at - m.time);
    assert.equal(m.cpuPlans[1].preparation, null);
    const serial = m.shotSerial;
    m.time = retry.at - FIXED_DT;
    m.updateCPU();
    m.tryCPUContact(1);
    assert.equal(m.cpuPlans[1].preparation, null);
    assert.equal(m.shotSerial, serial);
  }
  assert.ok(waits[0] > waits[1] && waits[1] > waits[2]);
  assert.equal(cpuSkill({ cpuSkill: 100 }).retryDelay, 0.06);
});

test('lower contact visually cushions then pushes without changing the preparation or its logical palms', () => {
  const pose = (age) =>
    expressivePose({
      spec: ARM_STYLES.whip,
      config: DEFAULTS,
      kind: 'low',
      swing: { hit: true, age, power: 0.7 },
      contactPoint: { x: 10, y: -12 },
      localVelocity: { x: 100, y: -150 },
      localIncomingVelocity: { x: -120, y: 100 },
    });
  const contact = pose(0),
    cushioned = pose(0.025),
    pushed = pose(0.085);
  assert.ok(cushioned.wrists[1].x < contact.wrists[1].x);
  assert.ok(cushioned.wrists[1].y > contact.wrists[1].y);
  assert.ok(pushed.wrists[1].x > contact.wrists[1].x);
  assert.ok(pushed.wrists[1].y < contact.wrists[1].y);
});
