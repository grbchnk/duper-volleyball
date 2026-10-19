import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS, FEMALE_HEADS, UNIFORM_COLORS } from '../src/teams.js';
import { Match } from '../src/engine.js';
import { DEFAULTS, sanitizeConfig } from '../src/config.js';
import { exportSettings, importSettings } from '../src/settings-file.js';
import { challengeProfileKey } from '../src/records.js';
import { selectClub } from '../src/team-editor.js';

test('ten distinct clubs have complete rosters, a women-only hairstyle preset and Nigeria', () => {
  assert.equal(TEAMS.length, 10);
  assert.equal(new Set(TEAMS.map((t) => t.id)).size, 10);
  assert.equal(new Set(TEAMS.map((t) => JSON.stringify(t.roster))).size, 10);
  for (const t of TEAMS) {
    assert.equal(t.roster.length, 3);
    assert.ok(UNIFORM_COLORS.some(([c]) => c === t.color));
  }
  for (const p of TEAMS.find((t) => t.women).roster) assert.ok(FEMALE_HEADS.includes(p.head));
  assert.ok(
    TEAMS.find((t) => t.id === 'nigeria').roster.every((p) =>
      ['#633f30', '#925b3d'].includes(p.tone),
    ),
  );
  for (const head of ['bear', 'pumpkin', 'rabbit', 'robot'])
    assert.ok(TEAMS.some((t) => t.roster.some((p) => p.head === head)));
});
test('club changes and per-player edits appear immediately without changing physics state', () => {
  const m = new Match();
  const state = { seed: m.seed, ball: { ...m.ball }, score: [...m.score], time: m.time };
  m.updateConfig(selectClub(m.config, 'nigeria'));
  assert.deepEqual(
    m.players.slice(0, 3).map((p) => p.appearance),
    TEAMS.find((t) => t.id === 'nigeria').roster,
  );
  const roster = m.players.slice(0, 3).map((p) => ({ ...p.appearance }));
  roster[1].head = 'pumpkin';
  m.updateConfig({ ...m.config, customTeamAppearance: true, teamPlayers: roster });
  assert.equal(m.players[1].appearance.head, 'pumpkin');
  assert.equal(m.players[0].appearance.head, 'afro');
  assert.deepEqual({ seed: m.seed, ball: m.ball, score: m.score, time: m.time }, state);
  const saved = importSettings(exportSettings(m.config));
  const restored = new Match(saved);
  assert.deepEqual(
    restored.players.map((p) => p.appearance),
    m.players.map((p) => p.appearance),
  );
  assert.equal(challengeProfileKey(saved), challengeProfileKey(DEFAULTS));
});
test('random appearance preserves uniform and female hairstyles, survives reload, and does not drift with tuning', () => {
  const config = {
    ...selectClub(DEFAULTS, 'sakura'),
    randomTeamAppearance: true,
    homeColor: '#8bb6cd',
    appearanceSeed: 123,
  };
  const m = new Match(config);
  const roster = m.players.map((p) => p.appearance);
  assert.ok(roster.slice(0, 3).every((p) => FEMALE_HEADS.includes(p.head)));
  m.updateConfig({ ...m.config, gravity: 12 });
  assert.deepEqual(
    m.players.map((p) => p.appearance),
    roster,
  );
  m.updateConfig({ ...m.config, appearanceSeed: 456 });
  assert.notDeepEqual(
    m.players.slice(0, 3).map((p) => p.appearance),
    roster.slice(0, 3),
  );
  assert.equal(m.config.homeColor, '#8bb6cd');
  assert.deepEqual(
    new Match(importSettings(exportSettings(m.config))).players.map((p) => p.appearance),
    m.players.map((p) => p.appearance),
  );
});
test('team imports validate every player and limit roster size', () => {
  const c = sanitizeConfig({
    customTeamAppearance: true,
    teamPlayers: [
      null,
      { head: 'bad', tone: 'bad', body: 'bad', hair: 'bad' },
      { head: 'bear' },
      {},
    ],
  });
  assert.equal(c.teamPlayers.length, 3);
  assert.equal(c.teamPlayers[1].head, 'crop');
  assert.equal(c.teamPlayers[2].head, 'bear');
});
