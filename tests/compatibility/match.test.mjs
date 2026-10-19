import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from './legacy-contract.js';
import { awardRally } from '../../src/rules.js';
import { FIXED_DT } from '../../src/config.js';
import { SHOTS, shotImpulse } from '../../src/moves.js';
import { InputBuffer } from '../../src/input.js';
import { preparedHands } from '../../src/held-contact.js';
const tick = (m, n, input = {}) => {
  for (let i = 0; i < n; i++) m.tick(FIXED_DT, input);
};
function rally() {
  const m = new Match();
  m.phase = 'rally';
  m.lastTouch = 1;
  m.lastPlayer = 3;
  m.possession = 0;
  m.teamPhases = ['defense', 'defense'];
  m.players[0].x = -7;
  m.ball = { x: -7, y: 1.5, z: 4.5, vx: 0, vy: 0, vz: 0, spin: 0, angle: 0 };
  return m;
}
const state = (more = {}) => ({ score: [0, 0], sets: [0, 0], server: 0, ...more });
test('sideout, deuce ceiling and fifth-set rally scoring', () => {
  const s = state();
  assert.equal(awardRally(s, 1, DEFAULTS).scored, false);
  assert.deepEqual(s.score, [0, 0]);
  assert.equal(awardRally(s, 1, DEFAULTS).scored, true);
  assert.equal(awardRally(state({ score: [14, 13] }), 0, DEFAULTS).setWon, true);
  assert.equal(awardRally(state({ score: [14, 14] }), 0, DEFAULTS).setWon, false);
  assert.equal(awardRally(state({ score: [16, 16] }), 0, DEFAULTS).setWon, true);
  assert.equal(awardRally(state({ score: [13, 14], sets: [2, 2] }), 1, DEFAULTS).matchWon, true);
});
test('no human contact without input, including the setter', () => {
  const m = rally();
  tick(m, 45);
  assert.equal(m.contacts, 0);
  assert.equal(m.stats.passes[0], 0);
  const s = rally();
  s.selected[0] = 1;
  s.lastTouch = 0;
  s.lastPlayer = 0;
  s.touches[0] = 1;
  s.ball.x = s.active().x;
  s.ball.y = 2.2;
  tick(s, 45);
  assert.equal(s.contacts, 0);
});
test('holding outside the palms charges; releasing performs one contact', () => {
  const m = rally();
  tick(m, 25, { low: true });
  assert.equal(m.contacts, 0);
  assert.ok(m.charge.power > 0.2);
  m.tick();
  assert.equal(m.contacts, 1);
  assert.equal(m.pending, null);
  assert.equal(m.charge, null);
  tick(m, 20);
  m.ball = { ...m.ball, x: m.active().x, y: 1.5, vx: 0, vy: 0 };
  tick(m, 10);
  assert.equal(m.contacts, 1);
});
for (const kind of Object.keys(SHOTS))
  test(`${kind} is a manually released contact`, () => {
    const m = rally();
    m.ball.y = 7;
    tick(m, 25, { [kind]: true });
    m.ball.y = kind === 'loft' ? 2.1 : 1.1;
    m.ball.vy = 0;
    if (kind === 'back') Object.assign(m.ball, preparedHands(m.active(), m)[0]);
    m.tick();
    assert.equal(m.contacts, 1);
    assert.ok(m.events.some((e) => e.type === 'hit' && e.kind === kind && e.team === 0));
  });
test('expired release does not hit a later ball', () => {
  const m = rally();
  m.ball.x = -2;
  m.ball.y = 6;
  m.tick(FIXED_DT, { low: true });
  m.tick();
  tick(m, 45);
  assert.equal(m.pending, null);
  m.ball.x = m.active().x;
  m.ball.y = 1.5;
  m.ball.vy = 0;
  tick(m, 3);
  assert.equal(m.contacts, 0);
});
test('charge length increases impulse and late modifiers change direction', () => {
  const m = rally(),
    p = m.active();
  const base = { axis: 1, up: false, down: false };
  const weak = shotImpulse(m.ball, p, 'drive', 0.15, base, m.players, {
    ...DEFAULTS,
    assist: false,
  });
  const strong = shotImpulse(m.ball, p, 'drive', 0.9, base, m.players, {
    ...DEFAULTS,
    assist: false,
  });
  assert.ok(Math.hypot(strong.vx, strong.vy) > Math.hypot(weak.vx, weak.vy));
  m.ball.y = 7;
  tick(m, 15, { low: true, axis: 1 });
  tick(m, 15, { low: true, axis: -1, up: true });
  m.ball.y = 1.1;
  m.ball.vy = 0;
  m.tick(FIXED_DT, { axis: -1, up: true });
  assert.ok(m.ball.vx < 0);
  assert.ok(m.ball.vy > 0);
});
test('pass assist preserves manual side and guides outgoing shots toward the net', () => {
  const m = rally(),
    p = m.active();
  const wrong = shotImpulse(m.ball, p, 'low', 0.5, { axis: -1 }, m.players, DEFAULTS);
  assert.equal(wrong.assisted, false);
  assert.ok(wrong.vx < 0);
  const tooMuch = shotImpulse(
    { ...m.ball, x: -3 },
    p,
    'low',
    1,
    { axis: 1, down: true },
    m.players,
    DEFAULTS,
  );
  assert.equal(tooMuch.assisted, true);
  assert.ok(tooMuch.vx > 0);
  let assisted = false;
  for (let q = 0.1; q <= 0.8; q += 0.05)
    if (shotImpulse(m.ball, p, 'low', q, { axis: 1 }, m.players, DEFAULTS).assisted)
      assisted = true;
  assert.ok(assisted);
});
test('human server and teammates never chase or hit autonomously', () => {
  const m = new Match();
  tick(m, 40, { low: true });
  m.tick();
  tick(m, 50);
  const xs = m.players.filter((p) => p.team === 0).map((p) => p.x);
  tick(m, 100);
  assert.deepEqual(
    m.players.filter((p) => p.team === 0).map((p) => p.x),
    xs,
  );
  assert.equal(m.stats.passes[0], 0);
});
test('human jumps allow limited movement while CPU jumps stay vertical', () => {
  const m = rally();
  m.ball.y = 12;
  const p = m.active(),
    x = p.x;
  m.tick(FIXED_DT, { jump: true, axis: 1 });
  tick(m, 40, { axis: -1 });
  assert.ok(p.y > 0);
  assert.ok(p.x < x && x - p.x < 0.6);
  const cpu = m.players[5];
  const cx = cpu.x;
  m.jump(cpu);
  tick(m, 25);
  assert.ok(cpu.y > 0);
  assert.equal(cpu.x, cx);
});
test('analog movement keeps facing discrete so sprites do not squash', () => {
  const m = rally(),
    p = m.active();
  m.tick(FIXED_DT, { axis: 0.4 });
  assert.equal(p.facing, 1);
  m.tick(FIXED_DT, { axis: -0.4 });
  assert.equal(p.facing, 1);
  m.ball.x = p.x - 2;
  m.tick(FIXED_DT, { axis: -0.4 });
  assert.equal(p.facing, -1);
});
test('one block press jumps one player; held S does not repeat; next edge jumps next player', () => {
  const m = rally();
  m.players[0].x = -8;
  m.players[1].x = -4.5;
  m.players[2].x = -2.8;
  m.ball = { ...m.ball, x: 6, y: 12, vx: 0, vy: 0 };
  m.tick(FIXED_DT, { block: true });
  assert.equal(m.players.filter((p) => p.team === 0 && p.block > 0).length, 1);
  assert.ok(
    m.players[2].block > 0,
    'the closest player blocks first, even outside the old front zone',
  );
  tick(m, 10, { block: true });
  assert.equal(m.players.filter((p) => p.team === 0 && p.block > 0).length, 1);
  m.tick();
  m.tick(FIXED_DT, { block: true });
  assert.equal(m.players.filter((p) => p.team === 0 && p.block > 0).length, 2);
  assert.ok(m.players[1].block > 0, 'the next closest available player blocks second');
  const xs = m.players.filter((p) => p.block > 0).map((p) => p.x);
  tick(m, 12, { axis: -1 });
  assert.deepEqual(
    m.players.filter((p) => p.block > 0).map((p) => p.x),
    xs,
  );
});
test('a block on the attacker side resets contacts and allows a fresh forearm reception', () => {
  const m = rally();
  m.touches = [3, 0];
  m.lastTouch = 0;
  m.lastPlayer = 2;
  m.incomingShot = 'drive';
  const blocker = m.players[5];
  blocker.x = 0.32;
  m.jump(blocker, true);
  blocker.jumpTime = blocker.jumpProfile.windup + blocker.jumpProfile.rise + 0.02;
  blocker.y = blocker.jumpProfile.height;
  m.ball = { ...m.ball, x: -0.05, y: blocker.y + 2.05, vx: 10, vy: 0 };
  assert.equal(m.tryBlocks(), true);
  assert.deepEqual(m.touches, [0, 0]);
  assert.equal(m.lastTouch, 1);
  assert.equal(m.lastPlayer, null);
  assert.ok(m.ball.vx < 0);
  m.cooldown = 0;
  m.ball = { ...m.ball, x: m.active().x, y: 1.3, vx: 0, vy: 0 };
  m.tick(FIXED_DT, { low: true });
  m.tick();
  assert.equal(m.contacts, 1);
  assert.equal(m.touches[0], 1);
  assert.equal(m.lastTouch, 0);
});
test('dive commits its direction, cannot hit a distant ball, lands on belly and recovers', () => {
  const m = rally(),
    p = m.active();
  m.ball.y = 12;
  m.tick(FIXED_DT, { dive: true, axis: 1 });
  const x = p.x;
  tick(m, 12, { axis: -1 });
  assert.ok(p.x > x);
  assert.equal(m.contacts, 0);
  tick(m, 50);
  assert.equal(p.pose, 'belly');
  assert.ok(p.recovery > 0);
  const landedX = p.x;
  tick(m, 20, { axis: 1, jump: true });
  assert.equal(p.x, landedX);
  tick(m, 120);
  assert.equal(p.recovery, 0);
});
test('diving forearms can reach a low ball; overhead cannot', () => {
  const m = rally(),
    p = m.active();
  m.dive(p, 1);
  p.y = 0.2;
  p.diveAge = 0.22;
  m.ball = { ...m.ball, x: -5.2, y: 0.35 };
  assert.equal(m.canContact(p, 'low'), true);
  assert.equal(m.canContact(p, 'loft'), false);
});
for (const kind of ['low', 'loft', 'drive'])
  test(`${kind} serve waits for release and a second press`, () => {
    const m = new Match();
    tick(m, 40, { [kind]: true });
    assert.equal(m.phase, 'serve');
    assert.equal(m.stats.serves[0], 0);
    m.tick();
    assert.equal(m.phase, 'serve-motion');
    tick(m, Math.round(m.serveAction.ideal / FIXED_DT) - 2);
    assert.equal(m.stats.serves[0], 0);
    m.tick(FIXED_DT, { [kind]: true });
    assert.equal(m.stats.serves[0], 1);
    assert.ok(m.ball.vx > 0);
  });
test('practice retries without changing score', () => {
  const m = new Match();
  m.reset('practice');
  m.startDrill('receive');
  m.point(1, 'TEST');
  assert.deepEqual(m.score, [0, 0]);
  tick(m, 290);
  assert.equal(m.phase, 'rally');
  assert.equal(m.lastTouch, 1);
});
test('all three neutral serves land in court at the documented beginner power', () => {
  for (const kind of ['low', 'loft', 'drive'])
    for (const power of [0.45, 0.5, 0.55]) {
      const m = new Match();
      m.beginServe({ kind, power, aim: { axis: 1 } });
      tick(m, Math.round(m.serveAction.ideal / FIXED_DT) - 1);
      m.tick(FIXED_DT, { [kind]: true });
      for (const p of m.players) p.recovery = 100;
      for (let i = 0; i < 600 && m.phase === 'rally'; i++) m.tick();
      assert.equal(m.pointReason, 'МЯЧ КОСНУЛСЯ ПЛОЩАДКИ', `${kind} ${power}`);
      assert.equal(m.pointWinner, 0);
    }
});
test('switching cannot replace the server but works after the serve', () => {
  const m = new Match();
  m.tick(FIXED_DT, { switch: true });
  assert.equal(m.selected[0], 0);
  m.phase = 'rally';
  m.ball.y = 10;
  m.tick();
  m.tick(FIXED_DT, { switch: true });
  assert.equal(m.selected[0], 1);
});
test('fast keyboard taps are retained for a tick, key repeat does not create extra edges', () => {
  const b = new InputBuffer();
  b.down('KeyX');
  b.up('KeyX');
  assert.equal(b.read().low, true);
  b.consume();
  assert.equal(b.read().low, false);
  b.down('KeyF');
  b.consume();
  b.down('KeyF', true);
  assert.equal(b.pressed.size, 0);
  assert.equal(b.read().block, true);
  b.clear();
  assert.equal(b.read().block, false);
  b.down('KeyW');
  assert.equal(b.read().loft, true);
  b.clear();
  b.down('ArrowUp');
  assert.equal(b.read().jump, true);
  assert.equal(b.read().low, false);
});
test('CPU does not attempt a block on every attack and cannot spam within one shot', () => {
  const m = rally();
  let plans = 0;
  for (let i = 0; i < 200; i++) {
    m.ball = { ...m.ball, x: -2, y: 3.1, vx: 10, vy: 1 };
    m.shotSerial++;
    m.scheduleCPUBlock(1);
    if (m.cpuBlockPlan) plans++;
  }
  assert.ok(plans > 5 && plans < 100, plans);
});
test('seeded CPU match scores and finishes with varied valid contact types', () => {
  const m = new Match({ ...DEFAULTS, targetScore: 5, scoring: 'rally' }, 42);
  m.reset('demo');
  const hits = new Set();
  // Bounded full match: the lower save pose changes seeded choices and rally length.
  for (let i = 0; i < 120 * 3600 && m.phase !== 'finished'; i++) {
    m.tick();
    assert.ok(Number.isFinite(m.ball.x) && Number.isFinite(m.ball.y));
    for (const e of m.events.splice(0)) if (e.type === 'hit') hits.add(e.kind);
  }
  assert.ok(m.rallies > 10);
  assert.equal(m.phase, 'finished');
  assert.ok(hits.size >= 3);
  for (const kind of hits) assert.ok(['back', 'drive', 'loft', 'low'].includes(kind));
});
