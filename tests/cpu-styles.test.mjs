import test from 'node:test';
import assert from 'node:assert/strict';
import { CPU_STYLES, cpuStyle, chooseServeKind } from '../src/cpu-styles.js';
import { cpuSkill, selectCPUOption, chooseCPUShot } from '../src/cpu.js';
import { Match } from '../src/engine.js';
import { DEFAULTS, sanitizeConfig } from '../src/config.js';
import { TOUR } from '../src/club.js';
import { traceBall } from '../src/physics.js';

test('every tour opponent has a distinct, selectable personality independent from difficulty', () => {
  assert.equal(new Set(TOUR.map((round) => round.style)).size, TOUR.length);
  for (const [id, style] of Object.entries(CPU_STYLES)) {
    for (const level of [0, 20, 55, 100]) {
      const config = sanitizeConfig({ cpuStyle: id, cpuSkill: level });
      assert.equal(config.cpuStyle, id);
      assert.equal(cpuStyle(config), style);
    }
  }
  assert.equal(TOUR.at(-1).style, 'adaptive');
  assert.ok(TOUR.every((round, i) => cpuStyle({ cpuStyle: round.style }).rank === i + 1));
});

test('maximum skill removes injected errors and preserves full physical movement', () => {
  const expert = cpuSkill({ cpuSkill: 100 });
  for (const key of [
    'error',
    'serveMiss',
    'serveError',
    'decisionError',
    'readError',
    'passError',
    'angleError',
    'timingError',
    'powerError',
  ])
    assert.equal(expert[key], 0, key);
  assert.equal(expert.speed, 1);
  assert.equal(expert.block, 1);
  assert.equal(expert.dive, 1);
  for (let level = 0; level < 100; level += 10) {
    const low = cpuSkill({ cpuSkill: level }),
      high = cpuSkill({ cpuSkill: level + 10 });
    for (const key of ['decisionError', 'passError', 'angleError', 'timingError', 'powerError'])
      assert.ok(low[key] > high[key], key);
    assert.ok(low.speed >= 0.9);
    assert.ok(low.diversity < high.diversity);
  }
});

test('a weak and expert quick player retain a preference for the same combination', () => {
  for (const level of [0, 100]) {
    const m = new Match({ cpuStyle: 'quick', cpuSkill: level }, 127);
    const p = m.players[0];
    const counts = { quick: 0, high: 0, back: 0, pipe: 0 };
    for (let i = 0; i < 240; i++) {
      const options = Object.keys(counts).map((intent) => ({
        kind: 'loft',
        power: 0.7,
        impulse: { intent },
        score: 10,
      }));
      counts[selectCPUOption(m, p, options).impulse.intent]++;
    }
    assert.ok(
      counts.quick > counts.high + counts.back + counts.pipe,
      JSON.stringify({ level, counts }),
    );
  }
});

test('an adaptive expert varies useful decisions instead of repeating a single shot forever', () => {
  const m = new Match({ cpuStyle: 'adaptive', cpuSkill: 100 }, 127);
  const p = m.players[0];
  const used = new Set();
  for (let i = 0; i < 60; i++) {
    const options = ['power', 'tip', 'roll', 'free', 'steep'].map((intent) => ({
      kind: 'drive',
      power: 1,
      impulse: { intent },
      score: 10,
    }));
    const shot = selectCPUOption(m, p, options);
    used.add(shot.impulse.intent);
    m.cpuHistory[0].push({ intent: shot.impulse.intent });
    if (m.cpuHistory[0].length > 12) m.cpuHistory[0].shift();
  }
  assert.equal(used.size, 5);
});

test('expert attacks evaluate real free zones and stay inside the legal shot models', () => {
  const modifiers = new Set(),
    attacks = new Set();
  for (const team of [0, 1]) {
    const m = new Match({ cpuStyle: 'adaptive', cpuSkill: 100 }, 77);
    m.mode = 'demo';
    m.phase = 'rally';
    m.lastTouch = team;
    m.touches[team] = 2;
    const p = m.players[team * 3];
    p.x = team ? 1.2 : -1.2;
    p.y = 1.3;
    Object.assign(m.ball, { x: p.x, y: 3.5, vx: 0, vy: -1 });
    for (let i = 0; i < 32; i++) {
      const shot = chooseCPUShot(m, p, ['drive']);
      assert.equal(shot.kind, 'drive');
      const end = traceBall({ ...m.ball, ...shot.impulse }, m.config, 8).at(-1);
      assert.ok(!end.netFault && end.x * (team ? -1 : 1) > 0 && Math.abs(end.x) < 9.25);
      modifiers.add(shot.impulse.cpuModifier || 'normal');
      attacks.add(shot.impulse.intent);
      m.cpuHistory[team].push({ intent: shot.impulse.intent, modifier: shot.impulse.cpuModifier });
      if (m.cpuHistory[team].length > 12) m.cpuHistory[team].shift();
    }
  }
  assert.ok(attacks.size >= 3, [...attacks].join(','));
  assert.ok(modifiers.has('fast'), [...modifiers].join(','));
});

test('quick style can deliberately receive with a real one-hand L2 impulse', () => {
  const m = new Match({ cpuStyle: 'quick', cpuSkill: 100 }, 11);
  m.mode = 'demo';
  m.phase = 'rally';
  m.lastTouch = 1;
  const p = m.players[0];
  p.x = -6;
  m.players[1].x = -3;
  m.players[2].x = -1.5;
  Object.assign(m.ball, { x: -5.8, y: 0.95, vx: 2, vy: -2 });
  const shot = chooseCPUShot(m, p, ['low']);
  assert.equal(shot.impulse.intent, 'soft-receive');
  assert.equal(shot.impulse.cpuModifier, 'soft');
  assert.ok(Math.hypot(shot.impulse.vx, shot.impulse.vy) <= 6.31 * DEFAULTS.hitPower);
  assert.ok(shot.impulse.targetId !== p.id);
});

test('serve personalities use the full repertoire on every difficulty', () => {
  for (const level of [0, 100]) {
    const m = new Match({ cpuStyle: 'adaptive', cpuSkill: level }, 17);
    const seen = new Set(Array.from({ length: 100 }, () => chooseServeKind(m)));
    assert.equal(seen.size, 4);
  }
});
