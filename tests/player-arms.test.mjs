import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, sanitizeConfig } from '../src/config.js';
import { exportSettings, importSettings } from '../src/settings-file.js';
import { playerArmConfig } from '../src/player-arms.js';
test('retired random arms cannot be enabled by current settings or old imports', () => {
  assert.equal(sanitizeConfig({ randomArms: true }).randomArms, false);
  assert.equal(importSettings(exportSettings({ ...DEFAULTS, randomArms: true })).randomArms, false);
  const m = new Match({ randomArms: true });
  assert.ok(m.players.every((p) => !p.armProfile));
  const seed = m.seed;
  m.updateConfig({ ...m.config, randomArms: true });
  assert.equal(m.seed, seed);
  assert.ok(m.players.every((p) => !p.armProfile));
});
test('stale per-player elbow profiles cannot override current shared arm settings', () => {
  const config = { ...DEFAULTS, randomArms: true, armBend: 0.7 };
  const player = { armProfile: { armBend: 1.5, elbowHeight: 8 } };
  assert.equal(playerArmConfig(player, config), config);
});
