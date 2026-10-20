import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, sanitizeConfig } from '../src/config.js';
import { InputBuffer, GAME_KEYS } from '../src/input.js';
import { SHOTS } from '../src/moves.js';
import { preparedHands } from '../src/held-contact.js';
import { expressivePose } from '../src/arm-motion.js';
import { ARM_STYLES } from '../src/arms.js';
import { exportSettings, importSettings } from '../src/settings-file.js';
import { challengeProfileKey } from '../src/records.js';

test('old files migrate to three current actions without restoring retired controls', () => {
  const migrated = importSettings(
    JSON.stringify({
      version: 4,
      config: {
        dynamic: false,
        cartoonFlight: 1,
        armStyle: 'whip',
        rightStickAim: true,
        backSpeedMax: 7,
        gravity: 12,
        homeColor: '#aabbcc',
      },
    }),
  );
  assert.equal(migrated.dynamic, true);
  assert.equal(migrated.gravity, 12);
  assert.equal(migrated.homeColor, '#aabbcc');
  assert.equal(migrated.armLength, DEFAULTS.armLength);
  for (const key of ['cartoonFlight', 'armStyle', 'rightStickAim', 'backSpeedMax'])
    assert.equal(Object.hasOwn(migrated, key), false);
  assert.deepEqual(Object.keys(SHOTS), ['low', 'loft', 'drive']);
  assert.deepEqual(importSettings(exportSettings(migrated)), migrated);
});

test('A is unbound; Z modifies a rally receive and selects the fourth serve', () => {
  const input = new InputBuffer(() => []);
  input.down('KeyA');
  for (const key of ['low', 'back', 'loft', 'drive']) assert.equal(input.read()[key], false);
  assert.equal(GAME_KEYS.includes('KeyA'), false);
  input.clear();
  input.down('KeyZ');
  input.down('KeyS');
  assert.equal(input.read('rally').low, true);
  assert.equal(input.read('rally').l2, true);
  assert.equal(input.read('rally').back, false);
  for (const phase of ['serve', 'serve-motion']) {
    assert.equal(input.read(phase).back, true);
    assert.equal(input.read(phase).low, false);
  }
  const match = new Match();
  match.phase = 'rally';
  match.tick(1 / 120, { back: true });
  assert.equal(match.controls[0].charge, null);
});

test('cosmetic arm length and size preserve physical palms, records and existing CPU plans', () => {
  for (const kind of ['low', 'loft'])
    for (const soft of [false, true]) {
      const match = new Match();
      match.phase = 'rally';
      const p = match.players[0];
      const action = { kind, power: 0.6, age: 0.2, playerId: p.id, aim: { soft } };
      match.ball = { ...match.ball, x: p.x + 0.4, y: kind === 'low' ? 0.8 : 2 };
      const hands = preparedHands(p, match, action);
      const profile = challengeProfileKey(match.config);
      const plans = [{ contactAt: 1 }, null];
      match.cpuPlans = plans;
      for (const armLength of [0.7, 1, 1.3]) {
        match.updateConfig({
          ...match.config,
          armLength,
          armScale: 0.65,
          armPowerMotion: 1.5,
          armJumpMotion: 0.5,
        });
        assert.deepEqual(preparedHands(p, match, action), hands);
        assert.equal(challengeProfileKey(match.config), profile);
        assert.equal(match.cpuPlans, plans);
      }
      match.updateConfig({ ...match.config, gravity: 12 });
      assert.notEqual(match.cpuPlans, plans);
    }
  const pose = (armLength) =>
    expressivePose({ spec: ARM_STYLES.whip, config: { ...DEFAULTS, armLength } });
  assert.notDeepEqual(pose(0.7).wrists, pose(1.3).wrists);
  assert.equal(sanitizeConfig({ armLength: 3 }).armLength, 1.3);
  const partial = new Match({ ...DEFAULTS, gravity: 12 });
  const plans = [{ contactAt: 1 }, null];
  partial.cpuPlans = plans;
  partial.updateConfig({ ballFire: false });
  assert.equal(partial.config.gravity, DEFAULTS.gravity);
  assert.notEqual(partial.cpuPlans, plans);
});
