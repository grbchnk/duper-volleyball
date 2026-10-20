import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { preparedHands } from '../src/held-contact.js';
import { expressivePose } from '../src/arm-motion.js';
import { ARM_STYLES } from '../src/arms.js';
import { importSettings, exportSettings } from '../src/settings-file.js';

function ready(kind, receiveHoldTime = 0.08) {
  const m = new Match({ ...DEFAULTS, [kind + 'ReceiveHoldTime']: receiveHoldTime });
  m.startDrill('receive');
  const p = m.active();
  const a = { kind, power: 0.5, age: 0.2, playerId: p.id, aim: { axis: 1 } };
  m.controls[0].charge = a;
  Object.assign(m.ball, { x: p.x, y: kind === 'low' ? 0.9 : 2.1, vx: 0, vy: -1 });
  for (let i = 0; i < 5; i++) Object.assign(m.ball, preparedHands(p, m, a)[0]);
  assert.equal(m.canContact(p, kind), true);
  return { m, p, a, control: m.controls[0] };
}

for (const kind of ['loft']) {
  test(`${kind}: holding receives genuinely falling balls before they leave the zone`, () => {
    for (const speed of [2, 5, 10, 15])
      for (const ballSpeed of [0.6, 1.2, 1.4])
        for (const delay of [0.08, 0.25]) {
          const m = new Match({ ...DEFAULTS, ballSpeed, [kind + 'ReceiveHoldTime']: delay });
          m.reset('test');
          const p = m.active();
          const input = { [kind]: true };
          Object.assign(m.ball, { x: p.x + 0.2, y: 3.5, vx: 0, vy: 0, attackGravity: 0 });
          for (let i = 0; i < 12; i++) m.tick(FIXED_DT, input);
          Object.assign(m.ball, { y: m.config[kind + 'ContactMax'] + 0.1, vy: -speed });
          for (let i = 0; i < 240 && m.phase === 'rally' && !m.contacts; i++)
            m.tick(FIXED_DT, input);
          const label = JSON.stringify({ kind, speed, ballSpeed, delay, notice: m.notice });
          assert.equal(m.contacts, 1, label);
          assert.ok(p.contact.y >= m.config[kind + 'ContactMin'], label);
          assert.ok(p.contact.y <= m.config[kind + 'ContactMax'], label);
          assert.equal(m.controls[0].charge, null);
        }
  });

  test(`${kind}: a fast ball already outside the zone cannot be rescued by the timeout`, () => {
    const { m, p } = ready(kind, 0.25);
    m.tryHeldContact();
    p.x -= 3;
    m.tick(FIXED_DT, { [kind]: true });
    assert.equal(m.contacts, 0);
    assert.equal(m.controls[0].charge, null);
    assert.equal(m.controls[0].pending, null);
  });

  test(`${kind}: touch starts a delay without changing flight, then timeout hits once`, () => {
    const { m, a } = ready(kind);
    const before = { ...m.ball };
    assert.equal(m.tryHeldContact(), false);
    assert.ok(a.receiveHold);
    assert.deepEqual(m.ball, before);
    m.time += 0.04;
    m.ball.y -= 0.04;
    assert.equal(m.tryHeldContact(), false);
    m.time += 0.041;
    assert.equal(m.tryHeldContact(), true);
    assert.equal(m.contacts, 1);
    assert.equal(m.tryHeldContact(), false);
  });

  test(`${kind}: releasing during accompaniment hits immediately`, () => {
    const { m, control } = ready(kind);
    m.tryHeldContact();
    m.updateCharge(0.01, {}, () => false, control);
    assert.equal(m.contacts, 1);
    assert.equal(control.pending, null);
  });

  for (const release of [false, true]) {
    test(`${kind}: leaving the zone cancels even when ${release ? 'releasing' : 'holding'}`, () => {
      const { m, p, control } = ready(kind);
      m.tryHeldContact();
      m.ball.y = p.y + m.config[kind + 'ContactMin'] - 0.05;
      if (release) m.updateCharge(0.01, {}, () => false, control);
      else m.tryHeldContact();
      assert.equal(m.contacts, 0);
      assert.equal(control.charge, null);
      assert.equal(control.pending, null);
      assert.equal(control.chargeLock, true);
      m.ball.y = kind === 'low' ? 1 : 2;
      assert.equal(m.tryHeldContact(), false);
    });
  }

  test(`${kind}: full charge automatically releases during accompaniment`, () => {
    const { m, a, control } = ready(kind);
    a.power = 1;
    m.updateCharge(0.01, { [kind]: true }, () => false, control);
    assert.equal(control.charge, null);
    assert.equal(m.contacts, 1);
    assert.equal(control.chargeLock, true);
    const instant = ready(kind, 0).m;
    assert.equal(instant.tryHeldContact(), true);
  });

  test(`${kind}: another contact or a different receiver cancels an attached attempt`, () => {
    for (const change of ['serial', 'player']) {
      const { m, a } = ready(kind);
      m.tryHeldContact();
      if (change === 'serial') m.shotSerial++;
      else a.playerId = (a.playerId + 1) % 3;
      assert.equal(m.tryHeldContact(), false);
      assert.equal(m.contacts, 0);
      assert.equal(m.controls[0].charge, null);
    }
  });

  test(`${kind}: accompanied wrists track the moving ball without shoulder drift`, () => {
    const pose = (point) =>
      expressivePose({
        spec: ARM_STYLES.whip,
        config: DEFAULTS,
        kind,
        charge: { age: 0.2, power: 0.5, receiveHold: {} },
        receiveHoldPoint: point,
        shoulderLift: 3,
      });
    const first = pose({ x: 5, y: -30 });
    const second = pose({ x: 8, y: -25 });
    for (let i = 0; i < 2; i++) {
      assert.equal(second.wrists[i].x - first.wrists[i].x, 3);
      assert.equal(second.wrists[i].y - first.wrists[i].y, 5);
    }
    assert.equal(first.wrists[0].y, -30 + (kind === 'low' ? 3 : 2));
  });
}

test('independent receive delays are bounded, migrate old settings and survive export/import', () => {
  for (const kind of ['low', 'loft']) {
    const key = kind + 'ReceiveHoldTime';
    assert.equal(sanitizeConfig({ [key]: -1 })[key], 0);
    assert.equal(sanitizeConfig({ [key]: 3 })[key], 0.25);
  }
  const migrated = sanitizeConfig({ receiveHoldTime: 0.1, lowReceiveHoldTime: 0 });
  assert.equal(migrated.lowReceiveHoldTime, 0);
  assert.equal(migrated.loftReceiveHoldTime, 0.1);
  const saved = importSettings(
    exportSettings({ ...DEFAULTS, lowReceiveHoldTime: 0, loftReceiveHoldTime: 0.12 }),
  );
  assert.equal(saved.lowReceiveHoldTime, 0);
  assert.equal(saved.loftReceiveHoldTime, 0.12);
  assert.equal('receiveHoldTime' in saved, false);
});
