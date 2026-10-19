import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS as CURRENT, LIMITS, sanitizeConfig } from '../../src/config.js';
import { SHOT_DEFAULTS } from '../../src/shot-settings.js';
import { SERVE_DEFAULTS } from '../../src/serve-settings.js';
import { exportSettings, importSettings } from '../../src/settings-file.js';
import { hardPixelAlpha } from '../../src/display.js';

test('full settings JSON restores every profile, animation, control and display field', () => {
  const edited = { ...DEFAULTS };
  for (const [key, [min, max]] of Object.entries(LIMITS)) edited[key] = min + (max - min) * 0.37;
  for (const [key, value] of Object.entries(DEFAULTS))
    if (typeof value === 'boolean') edited[key] = !value;
  Object.assign(edited, {
    homeTeam: 'lilac',
    awayTeam: 'lemon',
    homeColor: '#123456',
    awayColor: '#abcdef',
    skin: 'street',
    awaySkin: 'fox',
    ballSkin: 'plain',
    scoring: 'rally',
  });
  const expected = sanitizeConfig({ ...edited, dynamic: true });
  const file = exportSettings(expected);
  const restored = importSettings(file);
  assert.deepEqual(restored, expected);
  assert.deepEqual(Object.keys(restored).sort(), Object.keys(CURRENT).sort());
  for (const key of [
    ...Object.keys(SHOT_DEFAULTS).filter((key) => !key.startsWith('back')),
    ...Object.keys(SERVE_DEFAULTS),
    'armScale',
    'armWindup',
    'armSpring',
    'pixelGraphics',
    'livelyBackground',
    'soundMuted',
    'homeTeam',
    'ballSkin',
  ])
    assert.equal(restored[key], expected[key], key);
});
test('old version 2 and raw settings retain their values and gain display defaults', () => {
  for (const file of [
    { version: 2, config: { gravity: 12, serveLowHitWindow: 0.4 } },
    { gravity: 12, serveLowHitWindow: 0.4 },
  ]) {
    const result = importSettings(JSON.stringify(file));
    assert.equal(result.gravity, 12);
    assert.equal(result.serveLowHitWindow, 0.4);
    assert.equal(result.pixelGraphics, false);
  }
  for (const file of ['null', '[]', '{"version":9,"config":{"gravity":9}}', '{}'])
    assert.throws(() => importSettings(file));
});
test('pixel coverage is strictly transparent or opaque, retaining source ink color', () => {
  const data = new Uint8ClampedArray([12, 80, 90, 30, 12, 80, 90, 180, 120, 40, 80, 255]);
  assert.deepEqual([...hardPixelAlpha(data)], [12, 80, 90, 0, 12, 80, 90, 255, 120, 40, 80, 255]);
});
