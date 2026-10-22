import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { Tutorial, LESSONS } from '../src/tutorial.js';
import { predictAtHeight } from '../src/physics.js';
import { capture } from '../src/replay.js';

function exercise(id) {
  const m = new Match();
  m.reset('practice');
  const t = new Tutorial(m);
  t.index = LESSONS.findIndex((l) => l.id === id);
  t.enter();
  return { m, t };
}
function play(m, t, read, seconds = 30) {
  for (let i = 0; i < seconds * 120 && !t.ready; i++) {
    const input = read(m, t);
    m.tick(1 / 120, input);
    t.observe(input);
  }
}
test('solo movement needs both ground markers and two airborne diamonds, then allows landing', () => {
  const { m, t } = exercise('move');
  assert.equal(m.players.filter((p) => !p.benched).length, 1);
  assert.equal(t.frozen, false);
  assert.equal(m.tutorialNoBall, true);
  for (const x of [-8, -2, -7.5, -2.5]) {
    const jump = x === -7.5 || x === -2.5;
    for (let i = 0; i < 500; i++) {
      const p = m.players[0],
        axis = Math.abs(p.x - x) > 0.12 ? Math.sign(x - p.x) : 0;
      const input = { axis, jump: jump && !axis };
      m.tick(1 / 120, input);
      t.observe(input);
      if (t.done.has(jump ? (x === -7.5 ? 2 : 3) : x === -8 ? 0 : 1)) break;
    }
  }
  assert.equal(t.completed, 4);
  assert.equal(t.frozen, false);
  assert.ok(m.players[0].y > 0.35);
  for (let i = 0; i < 240; i++) {
    t.advance(1 / 120);
    m.tick(1 / 120, {});
    t.observe({});
  }
  assert.equal(t.lesson.id, 'move');
  assert.equal(m.players[0].y, 0);
  for (let i = 0; i < 130; i++) {
    t.advance(1 / 120);
    m.tick(1 / 120, {});
    t.observe({});
  }
  assert.equal(t.lesson.id, 'receive');
  assert.equal(t.phase, 'practice');
  assert.equal(
    m.events.some((e) => e.type === 'serve-ready' || e.type === 'point'),
    false,
  );
});
test('three ordinary receives accept actual low, loft and drive contacts in any order', () => {
  const { m, t } = exercise('receive');
  play(m, t, () => {
    const kind = ['drive', 'low', 'loft'].find(
      (k) => !t.done.has(t.lesson.goals.findIndex((g) => g.kind === k)),
    );
    return { [kind]: m.ball.vy < 0 && m.ball.y < (kind === 'low' ? 2 : 3.2) };
  });
  assert.equal(t.completed, 3);
  assert.equal(t.ready, true);
  assert.equal(t.frozen, false);
});
test('five varied high feeds are playable; missing one immediately clears the streak without resetting players', () => {
  const { m, t } = exercise('streak');
  play(m, t, () => {
    const p = m.players[0],
      at = predictAtHeight(m.ball, 1.1, m.config);
    return {
      axis: !t.feedHit && Math.abs(at.x - p.x) > 0.2 ? Math.sign(at.x - p.x) : 0,
      low: m.ball.vy < 0 && m.ball.y < 2,
    };
  });
  assert.equal(t.completed, 5);
  t.enter();
  t.mark(0);
  t.mark(1);
  const x = m.players[0].x,
    feed = t.feedNumber;
  for (let i = 0; i < 300 && t.feedNumber === feed; i++) {
    m.tick(1 / 120, {});
    t.observe({});
  }
  assert.equal(t.completed, 0);
  assert.equal(m.players[0].x, x);
  assert.equal(m.phase, 'rally');
  assert.ok(m.ball.y > 7);
  assert.equal(t.frozen, false);
});
test('neutral upper passes complete five deliveries with default assistance and no directional input', () => {
  const { m, t } = exercise('rally');
  play(m, t, () => ({ loft: m.ball.vy < 0 && m.ball.y < 3.5 }), 20);
  assert.equal(t.completed, 5);
  assert.equal(m.stats.passes[0], 6);
});
test('block exercise repeats a visible set and attack, then accepts a rear-player lower receive', () => {
  const { m, t } = exercise('block');
  play(m, t, () => {
    if (!t.done.has(0)) return { block: m.time - t.attackAt > 1.15 };
    const p = m.players[m.selected[0]],
      at = predictAtHeight(m.ball, 1.1, m.config);
    return {
      axis: Math.abs(at.x - p.x) > 0.2 ? Math.sign(at.x - p.x) : 0,
      low: m.ball.vy < 0 && m.ball.y < 2.3,
    };
  });
  assert.equal(t.completed, 2);
  assert.ok(m.stats.blocks[0] > 0);
  assert.equal(m.lastContact.playerId, 0);
});
test('power diamonds only count an outgoing player ball and support swept collisions', () => {
  const { m, t } = exercise('power'),
    g = t.lesson.goals[0];
  Object.assign(m.ball, { x: g.x, y: g.y });
  t.observe({});
  assert.equal(t.completed, 0);
  t.feedHit = true;
  m.lastTouch = 0;
  t.previousBall = { x: g.x - 0.8, y: g.y };
  m.ball.x = g.x + 0.8;
  t.observe({});
  assert.equal(t.completed, 1);
  assert.equal(t.flashes.length, 1);
});
test('a menu pauses only on request and the teaching controller is excluded from replay snapshots', () => {
  const { m, t } = exercise('receive');
  t.observe({ low: true });
  assert.equal(t.completed, 0);
  t.menuOpen = true;
  t.advance(10);
  assert.equal(t.frozen, true);
  assert.equal('training' in capture(m), false);
  t.leave();
  assert.equal(m.training, null);
  assert.equal(m.tutorialScriptedOpponents, false);
});

for (const [id, goal, threshold, jumpHeight] of [
  ['soft-set', 0, 2.5, 4],
  ['attack', 0, 2.5, 4],
  ['attack', 1, 4.5, 4],
  ['modifiers', 0, 5, 4],
  ['modifiers', 1, 5, 4],
  ['dive', 0, 2.5, 4],
  ['dive', 1, 2.5, 4],
])
  test(`real live controls can complete ${id}/${goal}`, () => {
    const { m, t } = exercise(id);
    for (let i = 0; i < goal; i++) t.mark(i);
    t.feed();
    const g = t.objective;
    for (let i = 0; i < 480 && t.completed === goal; i++) {
      const input =
        id === 'dive'
          ? { dive: m.time - t.startedAt > 0.25, diveAxis: goal ? -1 : 1 }
          : {
              [g.kind]: m.ball.vy < 0 && m.ball.y < threshold,
              jump: g.kind === 'drive' && m.ball.y < jumpHeight,
              l2: !!g.soft,
              r2: !!g.fast,
              intent: g.soft ? 'soft' : g.fast ? 'fast' : 'manual',
            };
      if (g.soft && m.controls[0].charge?.receiveHold) input[g.kind] = false;
      m.tick(1 / 120, input);
      t.observe(input);
    }
    assert.equal(t.completed, goal + 1);
  });
test('all four serves complete through toss and second press, without restarting the course', () => {
  const { m, t } = exercise('serve');
  play(m, t, () => ({
    [t.objective.kind]:
      m.phase === 'serve'
        ? m.phaseTime < 0.5
        : m.phase === 'serve-motion' && m.serveAction?.contactQuality >= 0.98,
  }));
  assert.equal(t.completed, 4);
});
test('each power diamond is reachable by a real charged upper pass', () => {
  const { m, t } = exercise('power');
  for (const g of t.lesson.goals) {
    m.players[0].x = g.x;
    t.feed();
    const before = t.completed;
    for (let i = 0; i < 600 && t.completed === before; i++) {
      const input = {
        loft: !t.feedHit && m.ball.vy < 0 && m.ball.y < 3.5,
        buttonVector: { x: 0, y: 1 },
      };
      m.tick(1 / 120, input);
      t.observe(input);
    }
    assert.equal(t.completed, before + 1, g.label);
  }
});
test('consecutive delivered passes reset on same-player, wrong-kind and floor faults', () => {
  const { m, t } = exercise('rally');
  const hit = (playerId, kind = 'loft') =>
    t.checkContact({ playerId, kind, serve: false, vy: 4, power: 0.5 });
  hit(1);
  hit(2);
  assert.equal(t.completed, 1);
  hit(2);
  assert.equal(t.completed, 0);
  hit(1);
  hit(2);
  hit(1, 'low');
  assert.equal(t.completed, 0);
  hit(1);
  hit(2);
  m.point(1, 'МЯЧ КОСНУЛСЯ ПЛОЩАДКИ');
  assert.equal(t.completed, 0);
  assert.equal(t.frozen, false);
  assert.equal(m.phase, 'rally');
});
