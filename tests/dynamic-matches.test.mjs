import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';

for (const [seed, style, extra] of [
  [31, 'balanced', {}],
  [42, 'blocker', {}],
  [75, 'trickster', {}],
  [15, 'deep', { duel: true }],
  [21, 'patient', { floorBounce: true, gravity: 6, cpuSkill: 35 }],
  [61, 'quick', {}],
  [89, 'adaptive', {}],
]) {
  test(`dynamic CPU match finishes with finite physical state: ${style}`, () => {
    const m = new Match(
      { ...DEFAULTS, targetScore: 5, cpuSkill: 65, cpuStyle: style, ...extra },
      seed,
    );
    m.reset('demo');
    let underNetFaults = 0;
    for (let i = 0; i < 65000 && m.phase !== 'finished'; i++) {
      m.tick(FIXED_DT, {});
      underNetFaults += m.events.filter(
        (event) => event.type === 'point' && event.reason === 'МЯЧ ПОД СЕТКОЙ',
      ).length;
      assert.ok(
        !m.events.some((event) => event.type === 'point' && event.reason === 'ЧЕТВЁРТОЕ КАСАНИЕ'),
        'CPU must release the third ball instead of attempting a fourth contact',
      );
      m.events = [];
      if (i % 120 === 0) {
        assert.ok(Number.isFinite(m.ball.x) && Number.isFinite(m.ball.y));
        if (m.phase === 'rally') assert.ok(m.touches.every((n) => n <= 3));
      }
    }
    assert.equal(
      m.phase,
      'finished',
      JSON.stringify({ style, phase: m.phase, rallies: m.rallies, score: m.score, time: m.time }),
    );
    assert.ok(m.rallies >= 5);
    assert.ok(m.contacts > 5);
    if (['balanced', 'blocker', 'trickster'].includes(style)) {
      assert.equal(underNetFaults, 0, 'CPU must not choose a forbidden route below the net');
      assert.ok(
        m.contacts / m.rallies >= 12,
        'normal CPU rallies should retain sustained exchanges',
      );
      assert.ok(
        ['power', 'tip', 'roll', 'free'].filter((kind) => m.tacticalStats[kind] > 0).length >= 3,
      );
      assert.ok(
        ['quick', 'high', 'back', 'pipe', 'feint', 'dump'].filter(
          (kind) => m.tacticalStats[kind] > 0,
        ).length >= 2,
      );
    }
    if (!extra.duel) assert.ok(Object.values(m.tacticalStats).reduce((a, b) => a + b, 0) > 0);
    assert.ok(m.replay.last.length > 0 && m.replay.last.length <= 300);
    console.log(
      JSON.stringify({
        style,
        rallies: m.rallies,
        contacts: m.contacts,
        seconds: Math.round(m.time),
        shots: m.tacticalStats,
      }),
    );
  });
}
