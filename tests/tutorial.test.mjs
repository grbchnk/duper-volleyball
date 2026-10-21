import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { Tutorial, LESSONS } from '../src/tutorial.js';
import { BALL_DESIGNS, ballPattern } from '../src/ball-designs.js';
import { sanitizeConfig } from '../src/config.js';
import { predictAtHeight } from '../src/physics.js';

function exercise(id, completed = 0) {
  const m = new Match();
  m.reset('practice');
  const t = new Tutorial(m);
  t.index = LESSONS.findIndex((l) => l.id === id);
  t.enter();
  t.completed = completed;
  t.begin();
  t.advance(3);
  return { m, t };
}
function play(m, t, read, seconds = 4) {
  const initial = t.completed;
  for (let i = 0; i < seconds * 120 && t.phase === 'practice' && t.completed === initial; i++) {
    const input = read(i / 120, m);
    m.tick(1 / 120, input);
    t.observe(input);
  }
}

test('movement lesson has no simulated ball, no opponents, and needs both walking and jumping', () => {
  const { m, t } = exercise('move');
  const ball = { ...m.ball };
  for (let i = 0; i < 480; i++) {
    m.tick(1 / 120, {});
    t.observe({});
  }
  assert.deepEqual(m.ball, ball);
  assert.equal(m.phase, 'rally');
  assert.equal(t.ready, false);
  assert.ok(m.players.filter((p) => p.team === 1).every((p) => p.benched));
  play(m, t, () => ({ axis: 1 }));
  assert.equal(t.completed, 1);
  assert.equal(t.ready, false);
  play(m, t, () => ({ jump: true, jumpHeld: true }));
  assert.equal(t.ready, true);
  t.leave();
  assert.ok(m.players.every((p) => !p.benched));
  assert.equal(m.tutorialNoBall, false);
});

for (const [id, completed, delay, shot] of [
  ['receive', 0, 0.4, { low: true, l2: true, intent: 'soft' }],
  ['receive', 1, 0.4, { loft: true }],
  ['soft-set', 0, 0.45, { loft: true, l2: true, intent: 'soft' }],
  ['one-hand', 0, 0.4, { low: true, l2: true, intent: 'soft' }],
  ['block', 0, 0.2, { block: true }],
  ['dive', 0, 0, { dive: true, diveAxis: 1 }],
  ['dive', 1, 0.1, { dive: true, diveAxis: -1 }],
])
  test(`real training physics: ${id}/${completed}`, () => {
    const { m, t } = exercise(id, completed);
    play(m, t, (now) =>
      now >= delay &&
      ((id === 'receive' && completed === 1) || (!shot.low && !shot.loft) || now < delay + 0.12)
        ? shot
        : {},
    );
    assert.equal(t.completed, completed + 1, t.feedback);
    if (id === 'one-hand') assert.equal(m.lastContact.modifier, 'soft');
  });

for (const [id, completed, modifier] of [
  ['attack', 1, 'normal'],
  ['modifiers', 0, 'soft'],
  ['modifiers', 1, 'fast'],
])
  test(`real training physics: airborne attack ${modifier}`, () => {
    const { m, t } = exercise(id, completed);
    play(m, t, (now) => ({
      jump: now >= 0.16,
      jumpHeld: now >= 0.16,
      drive: now >= 0.22,
      intent: modifier,
      l2: modifier === 'soft',
      r2: modifier === 'fast',
    }));
    assert.equal(t.completed, completed + 1, t.feedback);
    assert.equal(m.lastContact.kind, 'drive');
  });

for (let completed = 0; completed < 4; completed++)
  test(`real training physics: serve ${completed + 1}`, () => {
    const { m, t } = exercise('serve', completed),
      kind = t.objective.kind;
    play(
      m,
      t,
      (now, match) => ({
        [kind]:
          match.phase === 'serve'
            ? now < 0.5
            : match.phase === 'serve-motion' && match.serveAction?.contactQuality >= 0.98,
      }),
      6,
    );
    assert.equal(t.completed, completed + 1, t.feedback);
  });

// Controlled contact records isolate the streak validator from timing/physics.
function contact(m, t, playerId, kind = 'loft') {
  m.lastContact = { time: m.time, team: 0, playerId, kind, serve: false, vy: 5, vx: 2, power: 0.5 };
  t.observe({});
}
test('five delivered upper passes must be consecutive and alternate players; every failure clears all circles', () => {
  const { m, t } = exercise('rally');
  contact(m, t, 1);
  assert.equal(t.completed, 0); // The initial feed isn't a delivered pass.
  contact(m, t, 2);
  contact(m, t, 1);
  assert.equal(t.completed, 2);
  contact(m, t, 1);
  assert.equal(t.completed, 0);
  assert.equal(t.phase, 'countdown');
  t.advance(3);
  contact(m, t, 1);
  contact(m, t, 2);
  contact(m, t, 1);
  m.phase = 'point';
  t.observe({});
  assert.equal(t.completed, 0);
  t.advance(3);
  contact(m, t, 1);
  contact(m, t, 2);
  contact(m, t, 1);
  contact(m, t, 2, 'low');
  assert.equal(t.completed, 0);
  t.advance(3);
  for (const player of [1, 2, 1, 2, 1, 2]) contact(m, t, player);
  assert.equal(t.completed, 5);
  assert.equal(t.ready, true);
});

test('five consecutive exchanges can be completed with ordinary input and live ball physics', () => {
  const { m, t } = exercise('rally');
  for (let i = 0; i < 2400 && !t.ready && t.phase === 'practice'; i++) {
    const p = m.players[m.selected[0]],
      q = m.players[p.id === 1 ? 2 : 1];
    const predicted = predictAtHeight(m.ball, 2.2, m.config);
    const angle = (55 * Math.PI) / 180;
    const input = {
      axis: Math.abs(predicted.x - p.x) > 0.15 ? Math.sign(predicted.x - p.x) : 0,
      loft: m.ball.vy < 0 && m.ball.y < 2.6,
      buttonVector: { x: (Math.sign(q.x - p.x) || 1) * Math.cos(angle), y: Math.sin(angle) },
    };
    m.tick(1 / 120, input);
    t.observe(input);
  }
  assert.equal(t.ready, true, t.feedback);
  assert.equal(t.completed, 5);
  assert.equal(m.stats.passes[0], 6); // Initial pass plus five deliveries.
});
test('practice stays frozen through explanation/countdown and a button press alone cannot complete a contact lesson', () => {
  const { m, t } = exercise('soft-set');
  t.enter();
  assert.equal(t.frozen, true);
  t.observe({ loft: true, l2: true });
  assert.equal(t.ready, false);
  t.begin();
  t.advance(2.9);
  assert.equal(t.frozen, true);
  t.advance(0.11);
  assert.equal(t.frozen, false);
  t.observe({ loft: true, l2: true });
  assert.equal(t.completed, 0);
  assert.equal(m.stats.passes[0], 0);
});
test('every new ball survives config validation and has a distinct three-color pattern', () => {
  const signatures = new Set();
  for (const [id, design] of Object.entries(BALL_DESIGNS)) {
    assert.equal(sanitizeConfig({ ballSkin: id }).ballSkin, id);
    if (design.colors.length !== 3) continue;
    const pixels = [];
    for (let y = -8; y <= 8; y++)
      for (let x = -8; x <= 8; x++) {
        const index = ballPattern(id, x, y);
        assert.ok(index >= 0 && index < 3);
        pixels.push(index);
      }
    signatures.add(JSON.stringify(pixels));
  }
  assert.equal(signatures.size, 8);
});
