import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { simulateShot } from '../src/shot-lab.js';
import { integrateBall, predictAtHeight, resetFlight } from '../src/physics.js';
import { shotImpulse } from '../src/moves.js';
import { exportSettings, importSettings } from '../src/settings-file.js';

const enabled = {
  ...DEFAULTS,
  lowSoftTempo: 0.85,
  loftSoftTempo: 0.85,
  driveSoftTempo: 0.85,
  lowFastTempo: 1.15,
  loftFastTempo: 1.15,
  driveFastTempo: 1.15,
};

test('modifier tempo preserves each authored impulse and uses L2 for double triggers and excludes serves', () => {
  for (const playerId of [1, 4])
    for (const kind of ['low', 'loft', 'drive'])
      for (const modifier of [{}, { soft: true }, { fast: true }, { soft: true, fast: true }]) {
        const options = {
          kind,
          playerId,
          power: 0.8,
          angle: playerId === 1 ? 65 : 115,
          ...modifier,
        };
        const before = simulateShot(DEFAULTS, options);
        const after = simulateShot(enabled, options);
        for (const field of ['vx', 'vy', 'vz', 'spin', 'attackGravity', 'targetId'])
          assert.equal(after.impulse[field], before.impulse[field], `${kind}/${field}`);
        assert.equal(after.impulse.flightTempo, modifier.soft ? 0.85 : modifier.fast ? 1.15 : 1);
        const serve = shotImpulse(
          after.ball,
          after.player,
          kind,
          0.8,
          after.aim,
          after.match.players,
          enabled,
          true,
        );
        assert.equal(serve.flightTempo, 1);
      }
});

test('tempo re-times the same flight, including drag, spin, attack dip and the animation clock', () => {
  for (const cartoonFlight of [0, 1])
    for (const tempo of [0.5, 0.85, 1.15, 1.5]) {
      const config = { ...enabled, cartoonFlight, cartoonHang: 0.2 };
      const normal = { x: -5, y: 4, z: 4.5, vx: 7, vy: 5, vz: 0, spin: 0.8, attackGravity: 6 };
      const changed = { ...normal, flightTempo: tempo };
      for (let n = 0; n < 120; n++) {
        integrateBall(normal, FIXED_DT, config);
        integrateBall(changed, FIXED_DT / tempo, config);
        for (const key of ['x', 'y', 'vx', 'vy', 'spin', 'flightAge', 'flightPhysicalAge'])
          assert.ok(Math.abs(normal[key] - changed[key]) < 1e-10, `${tempo}/${key}`);
      }
    }
});

test('fixed-step forecast and laboratory agree on slower and faster arrival without moving the landing', () => {
  for (const modifier of [{ soft: true }, { fast: true }]) {
    const options = { kind: 'loft', power: 0.7, angle: 80, ...modifier };
    const before = simulateShot(DEFAULTS, options);
    const after = simulateShot(enabled, options);
    const a = before.points.at(-1),
      b = after.points.at(-1);
    assert.ok(Math.abs(a.x - b.x) < 0.06);
    assert.ok(
      Math.abs(
        Math.max(...before.points.map((p) => p.y)) - Math.max(...after.points.map((p) => p.y)),
      ) < 0.03,
    );
    const ratio = (after.points.length - 1) / (before.points.length - 1);
    assert.ok(Math.abs(ratio - before.impulse.flightTempo / after.impulse.flightTempo) < 0.03);
    const landing = predictAtHeight({ ...after.ball, ...after.impulse }, 0.105, enabled, 15);
    assert.ok(Math.abs(landing.time - (after.points.length - 1) * FIXED_DT) < 0.025);
    assert.ok(Math.abs(landing.x - b.x) < 0.06);
  }
});

test('actual contacts apply tempo once and the next ordinary contact clears it', () => {
  for (const team of [0, 1]) {
    const sample = simulateShot(enabled, {
      kind: 'loft',
      power: 0.7,
      soft: true,
      playerId: team * 3 + 1,
    });
    const m = sample.match;
    m.reset('versus');
    m.phase = 'rally';
    m.lastTouch = 1 - team;
    m.lastPlayer = (1 - team) * 3;
    const hit = (soft, hittingTeam) => {
      const control = m.controls[hittingTeam];
      const p = m.players[m.controlledPlayer(control)];
      Object.assign(m.ball, { x: p.x, y: 2.05, z: p.z });
      m.cooldown = 0;
      m.inputs = [{}, {}, {}];
      m.inputs[hittingTeam] = {
        loft: true,
        l2: soft,
        buttonVector: { x: m.sign(hittingTeam) * -0.5, y: 0.866 },
      };
      control.pending = {
        kind: 'loft',
        age: DEFAULTS.armWindup,
        power: 0.7,
        playerId: p.id,
        aim: {},
        ttl: DEFAULTS.releaseWindow,
      };
      assert.equal(m.tryPending(m.ball, control), true);
    };
    hit(true, team);
    assert.equal(m.ball.flightTempo, 0.85);
    hit(false, 1 - team);
    assert.equal(m.ball.flightTempo, 1);
    m.ball.flightTempo = 0.85;
    resetFlight(m.ball);
    assert.equal(m.ball.flightTempo, 1);
  }
});

test('tempo settings are bounded, survive JSON and restore old behaviour when disabled', () => {
  const config = sanitizeConfig({ ...enabled, modifierSlowdown: 2, modifierSpeedup: -1 });
  assert.equal(config.modifierSlowdown, 0.5);
  assert.equal(config.modifierSpeedup, 0);
  assert.deepEqual(importSettings(exportSettings(config)), config);
  const ball = { x: 0, y: 3, z: 4.5, vx: 3, vy: 4, vz: 0 };
  const a = { ...ball },
    b = { ...ball, flightTempo: 1 };
  integrateBall(a, FIXED_DT, DEFAULTS);
  integrateBall(b, FIXED_DT, DEFAULTS);
  for (const field of ['x', 'y', 'vx', 'vy']) assert.equal(a[field], b[field]);
});
