import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { FIXED_DT, DEFAULTS, sanitizeConfig } from '../src/config.js';
import { variantKey } from '../src/shot-settings.js';
import { contactWaitTime } from '../src/contact-wait.js';
import { shotImpulse } from '../src/moves.js';
import { exportSettings, importSettings } from '../src/settings-file.js';

function waiting(kind, variant = 'soft', delay = 0.12) {
  const key = variantKey(kind, variant, 'ReceiveHoldTime');
  const m = new Match({ [key]: delay, lowContactMin: 0.16, lowContactMax: 1.35 });
  m.reset('test');
  const p = m.active(),
    control = m.controls[0];
  const input = { [kind]: true, l2: variant === 'soft', r2: variant === 'fast' };
  m.inputs = [input, {}, {}];
  Object.assign(m.ball, {
    x: p.x,
    y: (m.config[kind + 'ContactMin'] + m.config[kind + 'ContactMax']) / 2,
    vx: 0,
    vy: 0,
  });
  control.charge = {
    kind,
    power: 0.6,
    age: 0.2,
    playerId: p.id,
    aim: { soft: input.l2, fast: input.r2 },
  };
  return { m, p, control, input };
}
for (const kind of ['low', 'loft', 'drive']) {
  for (const variant of ['normal', 'soft', 'fast']) {
    test(`${kind}/${variant}: waiting changes neither flight nor velocity, and expires once`, () => {
      const { m, control } = waiting(kind, variant);
      const before = { ...m.ball };
      assert.equal(m.tryHeldContact(), false);
      assert.ok(control.charge.receiveHold);
      assert.deepEqual(m.ball, before);
      m.time += 0.05;
      assert.equal(m.tryHeldContact(), false);
      m.time += 0.08;
      assert.equal(m.tryHeldContact(), true);
      assert.equal(m.contacts, 1);
      assert.equal(m.tryHeldContact(), false);
    });
  }
  test(`${kind}: L2 release strikes before timeout`, () => {
    const { m, control } = waiting(kind);
    assert.equal(m.tryHeldContact(), false);
    m.updateCharge(FIXED_DT, {}, () => false, control);
    assert.equal(m.contacts, 1);
    assert.equal(control.pending, null);
  });
  test(`${kind}: a ready shot fires before the ball leaves its zone`, () => {
    const { m } = waiting(kind, 'soft', 0.5);
    assert.equal(m.tryHeldContact(), false);
    Object.assign(m.ball, { y: m.config[kind + 'ContactMin'] + 0.01, vy: -12 });
    assert.equal(m.tryHeldContact(), true);
    assert.equal(m.contacts, 1);
  });
  test(`${kind}: full charge outside the zone keeps waiting for entry`, () => {
    const { m, control, input } = waiting(kind);
    m.ball.y = 8;
    control.charge.power = 1;
    m.updateCharge(FIXED_DT, input, () => false, control);
    assert.ok(control.charge);
    assert.equal(control.pending, null);
    assert.equal(m.contacts, 0);
  });
  test(`${kind}: a thin zone swept in one step still catches a prepared L2 shot`, () => {
    const { m, p } = waiting(kind);
    const previous = { ...m.ball, y: m.config[kind + 'ContactMax'] + 0.2 };
    m.ball.y = m.config[kind + 'ContactMin'] - 0.1;
    m.ball.vy = -30;
    assert.equal(m.tryHeldContact(previous), true);
    assert.equal(m.contacts, 1);
    assert.ok(p.contact.y >= m.config[kind + 'ContactMin']);
  });
}
test('L2 waiting is independent per shot and survives settings roundtrip', () => {
  const config = sanitizeConfig({
    lowSoftReceiveHoldTime: 0.3,
    loftSoftReceiveHoldTime: 0,
    driveSoftReceiveHoldTime: 0.45,
  });
  const saved = importSettings(exportSettings(config));
  assert.equal(contactWaitTime(saved, 'low', { soft: true }), 0.3);
  assert.equal(contactWaitTime(saved, 'loft', { soft: true }), 0);
  assert.equal(contactWaitTime(saved, 'drive', { soft: true }), 0.45);
  assert.equal(contactWaitTime({ ...saved, dynamic: false }, 'low', { soft: true }), 0);
});
for (const kind of ['low', 'loft', 'drive'])
  for (const team of [0, 1]) {
    test(`${kind}/${team}: final angle limits bound assistance and preserve speed and horizontal intent`, () => {
      const m = new Match(),
        p = m.players[team * 3];
      const aim = { manualControl: true, soft: true, vector: { x: team === 0 ? -1 : 1, y: 0.1 } };
      const original = shotImpulse(m.ball, p, kind, 0.7, aim, m.players, DEFAULTS);
      const config = sanitizeConfig({
        ...DEFAULTS,
        [variantKey(kind, 'soft', 'ElevationMin')]: 70,
        [variantKey(kind, 'soft', 'ElevationMax')]: 75,
      });
      const bounded = shotImpulse(m.ball, p, kind, 0.7, aim, m.players, config);
      const degrees = (Math.atan2(bounded.vy, Math.abs(bounded.vx)) * 180) / Math.PI;
      assert.ok(degrees >= 70 - 1e-8 && degrees <= 75 + 1e-8);
      assert.equal(Math.sign(bounded.vx), Math.sign(original.vx));
      assert.ok(
        Math.abs(Math.hypot(bounded.vx, bounded.vy) - Math.hypot(original.vx, original.vy)) < 1e-8,
      );
    });
  }
