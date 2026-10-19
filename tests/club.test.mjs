import { readFileSync } from 'node:fs';
const standardRecipes = JSON.parse(
  readFileSync(new URL('./fixtures/standard-challenges.json', import.meta.url), 'utf8'),
);
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT, COURT } from '../src/config.js';
import {
  CHALLENGES,
  startChallenge,
  targetResult,
  resolveChallenge,
  challengeStars,
} from '../src/challenges.js';
import { TOUR, sanitizeProgress, completeStage } from '../src/club.js';
import { shotImpulse } from '../src/moves.js';

function challenge(id) {
  const m = new Match({ ...DEFAULTS, duel: true, approachAssist: false });
  m.reset('challenge');
  startChallenge(m, id);
  return m;
}
function step(m, input = {}) {
  m.tick(FIXED_DT, input);
  m.events = [];
  assert.ok(Number.isFinite(m.ball.x) && Number.isFinite(m.ball.y));
}
function ready(m) {
  for (let i = 0; i < 400 && m.challenge.ready > 0; i++) step(m);
  assert.equal(m.challenge.ready, 0);
}
for (const id of Object.keys(CHALLENGES)) {
  test(`${id}: exactly ten unattended balls finish with zero points and no phantom contacts`, () => {
    const m = challenge(id);
    const initial = { ...m.ball };
    for (let i = 0; i < 120; i++) step(m, { drive: true });
    assert.equal(m.contacts, 0);
    assert.equal(m.ball.x, initial.x);
    assert.equal(m.ball.y, initial.y);
    for (let i = 0; i < 22000 && m.phase !== 'finished'; i++) step(m);
    assert.equal(m.phase, 'finished');
    assert.equal(m.challenge.results.length, 10);
    assert.equal(m.challenge.score, 0);
    assert.equal(m.challenge.hits, 0);
    assert.equal(m.challenge.stars, 0);
    assert.deepEqual(m.score, [0, 0]);
    m.reset('match');
    assert.equal(m.challenge, null);
    assert.equal(m.players.filter((p) => !p.benched).length, 2);
  });
}
test('targets reject out balls and reward their centre, with a streak reset on a miss', () => {
  assert.equal(targetResult(-1, 1).hit, false);
  assert.equal(targetResult(COURT.halfLength + 0.1, COURT.halfLength - 0.1).hit, false);
  assert.equal(targetResult(4, 4).bullseye, true);
  const m = challenge('precision');
  ready(m);
  for (let i = 0; i < 4; i++) {
    m.challenge.contacted = true;
    Object.assign(m.ball, { x: m.challenge.target, y: COURT.ballRadius });
    resolveChallenge(m);
    const before = m.challenge.score;
    resolveChallenge(m);
    assert.equal(m.challenge.score, before, 'one landing can only score once');
    while (m.challenge.waiting) step(m);
  }
  assert.equal(m.challenge.score, 1000);
  assert.equal(m.challenge.combo, 4);
  Object.assign(m.ball, { x: -3, y: COURT.ballRadius });
  resolveChallenge(m);
  assert.equal(m.challenge.combo, 0);
  assert.equal(m.challenge.bestCombo, 4);
});
test('all ten precision targets are reachable with real jump, charge, release and soft modifier input', () => {
  const recipes = standardRecipes.precision;
  const m = challenge('precision');
  ready(m);
  for (let i = 0; i < 15000 && m.phase !== 'finished'; i++) {
    const c = m.challenge,
      t = c.elapsed,
      [start, length, soft, down, buttonVector] = recipes[c.attempt - 1];
    step(
      m,
      c.waiting
        ? {}
        : {
            jump: t >= 0.05 && t < 0.08,
            drive: t >= start && t < start + length,
            l2: soft,
            down,
            buttonVector,
          },
    );
  }
  assert.equal(m.phase, 'finished');
  assert.equal(m.challenge.hits, 10, JSON.stringify(m.challenge.results));
  assert.equal(m.challenge.stars, 3);
  assert.ok(m.challenge.score > 2500);
});
test('all ten serves can hit the targets through the real toss and timed second press', () => {
  const recipes = standardRecipes.serve;
  const m = challenge('serve');
  ready(m);
  let started = 0;
  for (let i = 0; i < 16000 && m.phase !== 'finished'; i++) {
    if (m.phase === 'serve' && started !== m.challenge.attempt) {
      const [kind, power] = recipes[m.challenge.attempt - 1];
      m.beginServe({ kind, power, aim: { axis: 1, up: false, down: false } });
      started = m.challenge.attempt;
    }
    const action = m.serveAction;
    step(
      m,
      m.phase === 'serve-motion' && m.phaseTime >= action.ideal - FIXED_DT
        ? { [action.kind]: true }
        : {},
    );
  }
  assert.equal(m.phase, 'finished');
  assert.equal(m.challenge.hits, 10);
  assert.equal(m.challenge.stars, 3);
  assert.equal(m.skillStats.totalContacts[1], 0, 'the target court has no CPU interference');
});
test('rescue requires a low diving contact, and is possible on both sides of the player', () => {
  const early = challenge('rescue');
  ready(early);
  for (let i = 0; i < 300 && !early.challenge.results.length; i++)
    step(early, { dive: i === 0, diveAxis: 1 });
  assert.equal(early.contacts, 1);
  assert.equal(early.challenge.hits, 0);
  assert.match(early.challenge.message, /РАНО/);
  const m = challenge('rescue');
  ready(m);
  for (let i = 0; i < 12000 && m.phase !== 'finished'; i++) {
    const c = m.challenge;
    const at = standardRecipes.rescue[c.attempt - 1];
    step(m, {
      dive: !c.waiting && c.elapsed >= at && c.elapsed < at + 0.02,
      diveAxis: c.direction,
    });
  }
  assert.equal(m.phase, 'finished');
  assert.equal(m.challenge.hits, 10, JSON.stringify(m.challenge.results));
  assert.equal(m.challenge.stars, 3);
});
test('cup advances only on a win, awards one trophy at the final, and sanitizes stored progress', () => {
  let p = sanitizeProgress(null);
  assert.equal(p.stage, 0);
  assert.deepEqual(completeStage(p, false), p);
  for (let i = 0; i < TOUR.length; i++) p = completeStage(p, true);
  assert.equal(p.cups, 1);
  assert.equal(p.stage, 0);
  assert.equal(
    sanitizeProgress({ stage: Infinity, records: { precision: '999' } }).records.precision,
    0,
  );
  assert.equal(challengeStars('precision', 1800), 3);
});
test('shot feedback measures the actual impulse and never adds power or changes direction', () => {
  const m = new Match();
  m.reset('versus');
  m.startDrill('spike');
  const p = m.active();
  const impulse = shotImpulse(
    m.ball,
    p,
    'drive',
    0.7,
    { manualControl: true },
    m.players,
    m.config,
  );
  assert.ok(m.makeContact(p, 'drive', 0.7, impulse));
  assert.equal(m.ball.vx, impulse.vx);
  assert.equal(m.ball.vy, impulse.vy);
  assert.ok(Math.abs(m.lastContact.speed - Math.hypot(impulse.vx, impulse.vy) * 3.6) < 1e-10);
  m.point(0, 'МЯЧ КОСНУЛСЯ ПЛОЩАДКИ');
  assert.equal(m.skillStats.winners[0], 1);
  assert.equal(m.lastRally.contacts, 1);
});
