import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { serveSettings } from '../src/serve-settings.js';

for (const kind of ['low', 'loft', 'drive']) {
  test(`${kind}: serving holds full power until release on both controllers`, () => {
    for (const team of [0, 1]) {
      const m = new Match();
      m.reset('versus');
      m.server = team;
      m.startServe();
      const control = m.controls[team];
      const tick = (held) => m.tick(FIXED_DT, team === 0 ? held : {}, team === 1 ? held : {});
      for (let i = 0; i < 400; i++) tick({ [kind]: true });
      assert.equal(m.phase, 'serve');
      assert.equal(control.charge.power, 1);
      assert.equal(
        m.events.some((e) => e.type === 'toss'),
        false,
      );
      tick({});
      assert.equal(m.phase, 'serve-motion');
      assert.equal(m.serveAction.kind, kind);
      assert.equal(m.serveAction.power, 1);
      assert.equal(control.charge, null);
    }
  });

  test(`${kind}: serve power grows at half the rally rate and follows the main charge setting`, () => {
    for (const chargeSeconds of [0.15, 0.3, 0.7]) {
      const config = { ...DEFAULTS, chargeSeconds };
      const serving = new Match(config),
        rally = new Match(config);
      serving.reset('versus');
      rally.reset('test');
      Object.assign(rally.ball, { x: 5, y: 20, vx: 0, vy: 0 });
      const input = { [kind]: true };
      serving.tick(FIXED_DT, input);
      rally.tick(FIXED_DT, input);
      for (let i = 0; i < 5; i++) {
        serving.tick(FIXED_DT, input);
        rally.tick(FIXED_DT, input);
      }
      const servePower = serving.controls[0].charge.power - 0.08;
      const rallyPower = rally.controls[0].charge.power - 0.08;
      assert.ok(Math.abs(servePower * 2 - rallyPower) < 1e-9);
      assert.equal(serveSettings(config, kind).ChargeSeconds, chargeSeconds * 2);
    }
  });
}

test('a partial serve starts on release with the accumulated power', () => {
  const m = new Match();
  m.reset('versus');
  for (let i = 0; i < 15; i++) m.tick(FIXED_DT, { loft: true });
  const power = m.controls[0].charge.power;
  assert.ok(power > 0.08 && power < 1);
  m.tick(FIXED_DT, {});
  assert.equal(m.phase, 'serve-motion');
  assert.equal(m.serveAction.power, power);
});
