import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { preparedHands, ballTouchesHands } from '../src/held-contact.js';
import { expressivePose } from '../src/arm-motion.js';
import { ARM_STYLES } from '../src/arms.js';

function scenario(kind, delay = 0.08, extra = {}) {
  const m = new Match({ ...DEFAULTS, [kind + 'ReceiveHoldTime']: delay, ...extra });
  m.reset('test');
  const p = m.active();
  Object.assign(m.ball, { x: p.x + 0.2, y: kind === 'low' ? 1.25 : 2.4, vx: 0, vy: 0 });
  return { m, p, input: { [kind]: true }, control: m.controls[0] };
}

test('lower reception hits immediately on palm contact even with an old saved delay', () => {
  const { m, p, control } = scenario('low', 0.25);
  const a = { kind: 'low', power: 0.5, age: 0.2, playerId: p.id, aim: { axis: 1 } };
  control.charge = a;
  for (let i = 0; i < 5; i++) Object.assign(m.ball, preparedHands(p, m, a)[0]);
  assert.equal(m.tryHeldContact(), true);
  assert.equal(m.contacts, 1);
  assert.equal(a.receiveHold, undefined);
  assert.equal(a.receiveZone, undefined);
});

test('lower reception still requires palm contact rather than merely entering the zone', () => {
  const { m, p, control } = scenario('low', 0);
  control.charge = { kind: 'low', power: 0.5, age: 0.2, playerId: p.id, aim: { axis: 1 } };
  assert.equal(m.canContact(p, 'low'), true);
  assert.equal(m.tryHeldContact(), false);
  assert.equal(m.contacts, 0);
  assert.equal(control.charge.receiveZone, undefined);
});

for (const kind of ['loft']) {
  test(`${kind}: automatic release uses the configured release window, not an unlimited hold`, () => {
    for (const releaseWindow of [0.05, 0.2, 0.35])
      for (const arrivesInTime of [true, false]) {
        const { m, p, input, control } = scenario(kind, 0.25, { releaseWindow });
        m.ball.y = 8;
        control.charge = { kind, power: 1, age: 0.3, playerId: p.id, aim: { axis: 1 } };
        m.updateCharge(FIXED_DT, input, () => false, control);
        assert.equal(control.charge, null);
        assert.equal(control.pending.ttl, releaseWindow);
        const frames = arrivesInTime
          ? Math.max(0, Math.floor(releaseWindow / FIXED_DT) - 2)
          : Math.ceil(releaseWindow / FIXED_DT) + 2;
        for (let i = 0; i < frames; i++) {
          Object.assign(m.ball, { y: 8, vy: 0 });
          m.tick(FIXED_DT, input);
        }
        Object.assign(m.ball, { y: 2.2, vy: 0 });
        m.tick(FIXED_DT, input);
        assert.equal(m.contacts, arrivesInTime ? 1 : 0, `${releaseWindow}/${arrivesInTime}`);
        assert.equal(control.charge, null);
      }
  });

  test(`${kind}: the configured zone triggers reception even away from logical palms`, () => {
    const { m, p, control } = scenario(kind, 0);
    const a = { kind, power: 0.5, age: 0.2, playerId: p.id, aim: { axis: 1 } };
    control.charge = a;
    assert.equal(ballTouchesHands(m.ball, m.ball, preparedHands(p, m, a), 0.235), false);
    assert.equal(m.tryHeldContact(), true);
    assert.equal(m.contacts, 1);
  });

  test(`${kind}: pressing inside the zone preserves preparation, then starts the delay`, () => {
    const { m, input, control } = scenario(kind);
    m.tick(FIXED_DT, input);
    const readyAt = control.charge.receiveReadyAt;
    assert.equal(m.contacts, 0);
    assert.ok(control.charge.receiveZone);
    assert.equal(control.charge.receiveHold, undefined);
    while (m.time + FIXED_DT < readyAt - 1e-9) {
      m.tick(FIXED_DT, input);
      assert.equal(m.contacts, 0);
      assert.equal(control.charge.receiveHold, undefined);
    }
    for (let i = 0; i < 3 && !control.charge?.receiveHold; i++) m.tick(FIXED_DT, input);
    assert.ok(control.charge.receiveHold);
    assert.ok(control.charge.receiveHold.at >= readyAt - 1e-9);
    for (let i = 0; i < 50 && !m.contacts; i++) m.tick(FIXED_DT, input);
    assert.equal(m.contacts, 1);
  });

  test(`${kind}: release during preparation waits for the hands instead of hitting early`, () => {
    const { m, input, control } = scenario(kind, 0);
    m.tick(FIXED_DT, input);
    const readyAt = control.charge.receiveReadyAt;
    m.tick(FIXED_DT, {});
    assert.equal(m.contacts, 0);
    assert.ok(control.pending);
    while (m.time + FIXED_DT < readyAt - 1e-9) {
      m.tick(FIXED_DT, {});
      assert.equal(m.contacts, 0);
    }
    for (let i = 0; i < 3 && !m.contacts; i++) m.tick(FIXED_DT, {});
    assert.equal(m.contacts, 1);
    assert.equal(control.pending, null);
  });

  test(`${kind}: leaving before preparation finishes is a miss and consumes that press`, () => {
    const { m, p, input, control } = scenario(kind, 0.08, {
      [kind + 'ContactMin']: 1.98,
      [kind + 'ContactMax']: 2.02,
    });
    Object.assign(m.ball, { x: p.x + 0.2, y: 2.01, vy: -2 });
    m.tick(FIXED_DT, input);
    for (let i = 0; i < 10; i++) m.tick(FIXED_DT, input);
    assert.equal(m.contacts, 0);
    assert.equal(control.charge, null);
    assert.equal(control.pending, null);
    assert.equal(control.chargeLock, true);
  });

  test(`${kind}: a prepared hold catches an entire tiny zone crossed in one step`, () => {
    for (const min of [0.12, 2]) {
      const { m, p, input } = scenario(kind, 0.25, {
        [kind + 'ContactMin']: min,
        [kind + 'ContactMax']: min + 0.01,
      });
      m.ball.y = 4;
      for (let i = 0; i < 12; i++) m.tick(FIXED_DT, input);
      Object.assign(m.ball, { x: p.x + 0.2, y: min + 0.03, vy: -12 });
      m.tick(FIXED_DT, input);
      assert.equal(m.contacts, 1, `zone starts at ${min}`);
      assert.ok(p.contact.y >= min && p.contact.y <= min + 0.01);
      assert.equal(m.phase, 'rally', 'contact is resolved before floor scoring');
    }
  });

  test(`${kind}: a fresh late press cannot retroactively receive a swept ball`, () => {
    const { m, input } = scenario(kind, 0, {
      [kind + 'ContactMin']: 2,
      [kind + 'ContactMax']: 2.01,
    });
    Object.assign(m.ball, { y: 2.03, vy: -12 });
    m.tick(FIXED_DT, input);
    assert.equal(m.contacts, 0);
    assert.equal(m.controls[0].charge, null);
  });

  test(`${kind}: full power releases and expires even while the button stays held`, () => {
    const { m, input, control } = scenario(kind, 0);
    for (let i = 0; i < 100; i++) {
      Object.assign(m.ball, { y: 8, vy: 0 });
      m.tick(FIXED_DT, input);
    }
    assert.equal(control.charge, null);
    assert.equal(control.pending, null);
    assert.equal(control.chargeLock, true);
    assert.equal(m.contacts, 0);
    Object.assign(m.ball, { y: kind === 'low' ? 1.25 : 2.4, vy: 0 });
    m.tick(FIXED_DT, input);
    assert.equal(m.contacts, 0);
  });

  test(`${kind}: visual preparation stays bounded instead of reaching an unattached ball`, () => {
    const pose = (age) =>
      expressivePose({
        spec: ARM_STYLES.whip,
        config: DEFAULTS,
        kind,
        charge: { age, power: 0.5, zonePreparation: true },
        receiveHoldPoint: { x: 10000, y: -10000 },
      });
    const start = pose(0),
      halfway = pose(DEFAULTS.armWindup / 2),
      end = pose(DEFAULTS.armWindup);
    for (let i = 0; i < 2; i++) {
      assert.notEqual(start.wrists[i].y, end.wrists[i].y);
      assert.equal(halfway.wrists[i].y, (start.wrists[i].y + end.wrists[i].y) / 2);
      assert.ok(Math.abs(end.wrists[i].x) < 30);
      assert.ok(Math.abs(end.wrists[i].y) < 50);
    }
  });
}
