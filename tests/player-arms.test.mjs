import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, LIMITS, sanitizeConfig } from '../src/config.js';
import { ARM_PARAMETER_STEPS, randomArmProfile, playerArmConfig } from '../src/player-arms.js';
import { exportSettings, importSettings } from '../src/settings-file.js';
import { capture, captureScene, restore } from '../src/replay.js';
import { preparedHands } from '../src/held-contact.js';
import { diveHands } from '../src/dive-pose.js';

test('random arms change only elbow bend and height within slider limits', () => {
  assert.deepEqual(Object.keys(ARM_PARAMETER_STEPS).sort(), ['armBend', 'elbowHeight']);
  for (const roll of [0, 0.1, 0.53, 0.99, 1]) {
    const profile = randomArmProfile(() => roll);
    for (const [key, step] of Object.entries(ARM_PARAMETER_STEPS)) {
      const [min, max] = LIMITS[key];
      assert.ok(profile[key] >= min && profile[key] <= max);
      assert.ok(
        Math.abs((profile[key] - min) / step - Math.round((profile[key] - min) / step)) < 1e-8,
      );
    }
  }
  assert.equal(sanitizeConfig().randomArms, false);
  assert.equal(importSettings(exportSettings({ ...DEFAULTS, randomArms: true })).randomArms, true);
});

test('each player keeps their own arms through points, settings, toggles, replay and retry', () => {
  const m = new Match();
  const seed = m.seed;
  m.updateConfig({ ...m.config, randomArms: true });
  const profiles = m.players.map((p) => structuredClone(p.armProfile));
  assert.ok(new Set(profiles.map((p) => JSON.stringify(p))).size > 1);
  assert.equal(m.seed, seed);
  const snapshot = capture(m);
  assert.deepEqual(
    captureScene(m).players.map((p) => p.armProfile),
    profiles,
  );
  m.point(0, 'ТЕСТ');
  m.startServe();
  m.updateConfig({ ...m.config, armScale: 0.65 });
  assert.deepEqual(
    m.players.map((p) => p.armProfile),
    profiles,
  );
  assert.equal(playerArmConfig(m.players[0], m.config).armScale, 0.65);
  assert.equal(playerArmConfig(m.players[0], m.config).armBend, profiles[0].armBend);
  m.updateConfig({ ...m.config, randomArms: false });
  assert.equal(playerArmConfig(m.players[0], m.config), m.config);
  m.updateConfig({ ...m.config, randomArms: true });
  assert.deepEqual(
    m.players.map((p) => p.armProfile),
    profiles,
  );
  m.reset();
  assert.notDeepEqual(
    m.players.map((p) => p.armProfile),
    profiles,
  );
  restore(m, snapshot);
  assert.deepEqual(
    m.players.map((p) => p.armProfile),
    profiles,
  );
});

test('random elbows never change size, thickness, timing, palm targets or dive reach', () => {
  const m = new Match({ randomArms: true });
  m.phase = 'rally';
  const p = m.players[0];
  p.armProfile = {
    ...randomArmProfile(() => 0.2),
    armScale: 0.65,
    armRoundness: 2,
    armWindup: 0.15,
    armSpring: 2,
    armPowerMotion: 0,
    armJumpMotion: 1.5,
  };
  const effective = playerArmConfig(p, m.config);
  for (const key of [
    'armScale',
    'armRoundness',
    'armWindup',
    'armSpring',
    'armPowerMotion',
    'armJumpMotion',
  ])
    assert.equal(effective[key], m.config[key]);
  Object.assign(m.ball, { x: p.x + 0.5, y: 1.1, vx: -2, vy: -1 });
  const action = { playerId: p.id, kind: 'low', power: 0.5, age: 0.2, aim: { soft: true } };
  const config = { ...m.config, randomArms: false };
  const comparison = Object.assign(Object.create(Object.getPrototypeOf(m)), m, { config });
  assert.deepEqual(preparedHands(p, m, action), preparedHands(p, comparison, action));
  Object.assign(p, { diving: true, diveAge: 0.1, diveVelocity: 5 });
  assert.deepEqual(diveHands(p, m.ball, m.config), diveHands(p, m.ball, config));
  assert.equal(m.config.armScale, DEFAULTS.armScale);
});
