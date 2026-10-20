import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { shotImpulse } from '../src/moves.js';
import { tacticalAttack, tacticalPass, blockImpulse } from '../src/tactics.js';
import { traceBall } from '../src/physics.js';
import { InputBuffer } from '../src/input.js';
import { exportSettings, importSettings } from '../src/settings-file.js';
import { capture, restore } from '../src/replay.js';
import { preparedHands } from '../src/held-contact.js';

const pad = () => ({
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
function input(buttons, phase = 'rally') {
  const p = pad();
  for (const b of buttons) p.buttons[b] = { pressed: true, value: 1 };
  const i = new InputBuffer(() => [p]);
  i.poll();
  return i.read(phase);
}
const ball = { x: -1.7, y: 3.6, z: 4.5, vx: 0, vy: 0, vz: 0, spin: 0 };
const player = { id: 2, team: 0, x: -1.9, y: 1.4, facing: 1, vx: 0 };
function rally(config = {}) {
  const m = new Match({ ...DEFAULTS, ...config });
  m.reset('versus');
  m.phase = 'rally';
  m.ball = { ...ball };
  m.players[2].x = -1.9;
  m.players[2].y = 1.4;
  m.selected[0] = 2;
  return m;
}

test('Cross jumps; Square receives; Triangle sets; Circle attacks', () => {
  assert.equal(input([0]).jump, true);
  assert.equal(input([0]).low, false);
  assert.equal(input([2]).low, true);
  assert.equal(input([2]).back, false);
  assert.equal(input([3]).loft, true);
  assert.equal(input([1]).drive, true);
});
test('Square receives a real incoming ball on prepared forearms in Dynamic', () => {
  const m = new Match();
  m.reset('versus');
  m.startDrill('receive');
  const p = m.active();
  m.lastTouch = 1;
  m.lastPlayer = 3;
  m.cooldown = 0;
  m.controls[0].charge = { kind: 'low', age: 0.2, power: 0.5, playerId: p.id, aim: { axis: 0 } };
  Object.assign(m.ball, preparedHands(p, m)[0], { vx: 0, vy: 0 });
  m.tick(FIXED_DT, input([2]));
  assert.equal(m.contacts, 1);
  assert.equal(m.events.filter((e) => e.type === 'hit').at(-1).kind, 'low');
  assert.equal(p.jumpProfile, null);
  assert.ok(m.ball.vy > 0);
});
test('only a strongly charged drive can knock down; head detaches only at full power', () => {
  for (const [power, shouldKnockDown, shouldDetachHead] of [
    [0.79, false, false],
    [0.8, true, false],
    [1, true, true],
  ]) {
    const m = new Match();
    m.reset('versus');
    m.phase = 'rally';
    m.lastTouch = 0;
    m.lastPlayer = 0;
    const attacker = m.players[3],
      target = m.players[0];
    const impulse = { vx: -14, vy: -6, vz: 0 };
    assert.equal(m.makeContact(attacker, 'drive', power, impulse), true);
    const previous = { ...m.ball, x: target.x, y: 2.6 };
    Object.assign(m.ball, { x: target.x, y: 1.9, ...impulse });
    assert.equal(m.tryHeadHit(previous), shouldKnockDown);
    assert.equal(target.recovery > 0, shouldKnockDown);
    assert.equal(!!target.headFly, shouldDetachHead);
  }
});
test('triggers change strength without changing contact type', () => {
  for (const [button, kind] of [
    [2, 'low'],
    [3, 'loft'],
    [1, 'drive'],
  ]) {
    assert.equal(input([button, 6])[kind], true);
    assert.equal(input([button, 7])[kind], true);
    assert.equal(input([button, 6]).intent, 'soft');
    assert.equal(input([button, 7]).intent, 'fast');
    assert.equal(input([button, 6, 7]).intent, 'soft');
  }
  assert.equal(input([0, 6, 7]).jumpVariant, 'normal');
});
test('left stick up aims upward without triggering or holding a jump', () => {
  const p = pad();
  p.axes[1] = -1;
  const i = new InputBuffer(() => [p]);
  i.poll();
  assert.equal(i.read().jump, false);
  assert.equal(i.read().jumpHeld, false);
  assert.equal(i.read().buttonVector.y, 1);
});
test('triggers and face buttons are independent on two controllers', () => {
  const a = pad(),
    b = pad();
  a.buttons[1].pressed = true;
  a.buttons[7].pressed = true;
  b.buttons[3].pressed = true;
  b.buttons[6].pressed = true;
  const i = new InputBuffer(() => [a, b]);
  const j = new InputBuffer(() => [a, b], undefined, 1);
  i.poll();
  j.poll();
  assert.equal(i.read().intent, 'fast');
  assert.equal(j.read().intent, 'soft');
  assert.equal(j.read().drive, false);
});
test('trigger release preserves intended shot on the release frame', () => {
  const m = rally();
  m.ball.y = 9;
  m.tick(FIXED_DT, { drive: true, intent: 'tip' });
  m.tick(FIXED_DT, {});
  assert.equal(m.controls[0].pending.aim.intent, 'tip');
  m.tick(FIXED_DT, {});
  assert.equal(m.controls[0].pending.aim.intent, 'tip');
});
test('Cross can jump during an already prepared attack', () => {
  const m = rally();
  m.players[2].y = 0;
  m.ball.y = 8;
  m.tick(FIXED_DT, { drive: true });
  m.tick(FIXED_DT, { drive: true, jump: true });
  assert.ok(m.players[2].jumpProfile);
  assert.equal(m.controls[0].charge.kind, 'drive');
});
test('manual angles remain distinct with full assistance', () => {
  const angles = [-20, 0, 35].map((deg) => {
    const a = (deg * Math.PI) / 180;
    const r = shotImpulse(
      { ...ball, x: -3 },
      player,
      'drive',
      0.7,
      { vector: { x: Math.cos(a), y: Math.sin(a) } },
      [player],
      DEFAULTS,
    );
    return (Math.atan2(r.vy, r.vx) * 180) / Math.PI;
  });
  assert.ok(new Set(angles.map((v) => v.toFixed(1))).size === 3);
});
test('net help never increases manually requested speed', () => {
  for (const y of [0.9, 2, 4])
    for (const power of [0.1, 0.5, 1]) {
      const b = { ...ball, y };
      const a = { axis: 1, down: true };
      const free = shotImpulse(b, player, 'drive', power, a, [player], {
        ...DEFAULTS,
        assist: false,
      });
      const helped = shotImpulse(b, player, 'drive', power, a, [player], DEFAULTS);
      assert.ok(Math.hypot(helped.vx, helped.vy) <= Math.hypot(free.vx, free.vy) + 1e-8);
    }
});
test('five tactical attacks produce distinct flights on both sides', () => {
  for (const team of [0, 1]) {
    const sign = team ? -1 : 1,
      p = { ...player, team, x: player.x * sign },
      b = { ...ball, x: ball.x * sign };
    const ends = Object.fromEntries(
      ['power', 'steep', 'tip', 'roll', 'free'].map((kind) => {
        const impulse = tacticalAttack(b, p, kind, 0.85, DEFAULTS);
        const path = traceBall({ ...b, ...impulse }, DEFAULTS, 8);
        return [kind, path.at(-1).x * sign];
      }),
    );
    assert.ok(ends.power > ends.tip + 2, JSON.stringify(ends));
    assert.ok(ends.roll > ends.tip + 0.6, JSON.stringify(ends));
    assert.ok(ends.free > 4, JSON.stringify(ends));
    assert.ok(ends.tip > 0, JSON.stringify(ends));
  }
});
test('steep attack from low contact is not magically lifted over net', () => {
  const b = { ...ball, y: 1.8 },
    p = { ...player, y: 0 };
  const i = tacticalAttack(b, p, 'steep', 0.8, DEFAULTS);
  const end = traceBall({ ...b, ...i }, DEFAULTS, 6).at(-1);
  assert.ok(end.x < 0);
  assert.match(i.feedback, /Низкий/);
});
test('contact location changes the shot continuously without random failures', () => {
  const a = tacticalAttack(ball, player, 'power', 0.8, DEFAULTS);
  const b = tacticalAttack(ball, { ...player, x: -2.4 }, 'power', 0.8, DEFAULTS);
  assert.notEqual(a.vy, b.vy);
  assert.deepEqual(a, tacticalAttack(ball, player, 'power', 0.8, DEFAULTS));
});
test('quick, high, back and pipe sets address legal teammates with reachable arrival', () => {
  const m = rally(),
    p = m.players[1];
  p.x = -3.7;
  const b = { ...ball, x: -3.5, y: 2.2 };
  const results = {};
  for (const play of ['high', 'quick', 'back', 'pipe']) {
    const r = tacticalPass(b, p, 0.8, { play }, m.players, DEFAULTS);
    assert.ok(r);
    assert.notEqual(r.targetId, p.id);
    assert.equal(m.players[r.targetId].team, p.team);
    assert.ok(Math.abs(r.targetX - m.players[r.targetId].x) <= DEFAULTS.playerSpeed * r.arrival);
    results[play] = r;
  }
  assert.ok(results.quick.arrival < results.high.arrival);
  assert.ok(Math.abs(results.pipe.targetX) > Math.abs(results.high.targetX));
  assert.ok(results.pipe.decoyId !== null);
});
test('poor contact safely downgrades quick to high set', () => {
  const m = rally(),
    p = m.players[1];
  p.x = -6;
  const r = tacticalPass(
    { ...ball, x: -6.8, y: 1.7 },
    p,
    0.8,
    { play: 'quick' },
    m.players,
    DEFAULTS,
  );
  assert.equal(r.intent, 'high');
});
test('set establishes an approach, manual input cancels it without auto hit', () => {
  const m = rally(),
    p = m.players[1];
  p.x = -3.7;
  m.ball = { ...ball, x: -3.5, y: 2.2 };
  const r = tacticalPass(m.ball, p, 0.8, { play: 'pipe' }, m.players, m.config);
  m.makeContact(p, 'loft', 0.8, r);
  const run = m.teamRuns[0];
  assert.equal(run.playerId, r.targetId);
  const contacts = m.contacts;
  m.tick(FIXED_DT, { axis: -1 });
  assert.equal(run.cancelled, true);
  assert.equal(m.contacts, contacts);
});
test('attack preparation cannot auto-hit before release', () => {
  const m = rally();
  m.controls[0].charge = {
    kind: 'drive',
    age: 0.3,
    power: 0.8,
    aim: { intent: 'power' },
    playerId: 2,
  };
  assert.equal(m.tryHeldContact(m.ball), false);
  assert.equal(m.contacts, 0);
});
test('edge block continues over hands; central block reflects to attacker', () => {
  const p = { ...player, team: 1, x: 0.8, y: 1 };
  const b = { ...ball, vx: 14, y: 3.05 };
  assert.ok(blockImpulse(b, p, true, DEFAULTS).vx < 0);
  assert.ok(blockImpulse(b, p, true, DEFAULTS).vy < 0);
  assert.ok(blockImpulse({ ...b, y: 3.37 }, p, false, DEFAULTS).vx > 0);
});
test('duel benches four players and faults immediately after the fourth consecutive hit', () => {
  const m = new Match({ ...DEFAULTS, duel: true });
  m.reset('versus');
  m.phase = 'rally';
  assert.equal(m.players.filter((p) => !p.benched).length, 2);
  const p = m.players[0];
  const r = { vx: 2, vy: 4, vz: 0, spin: 0, targetId: null };
  for (let i = 0; i < 3; i++) assert.equal(m.makeContact(p, 'low', 0.4, r), true);
  assert.equal(m.phase, 'rally');
  assert.equal(m.makeContact(p, 'low', 0.4, r), true);
  assert.equal(m.contacts, 4);
  assert.equal(m.pointReason, 'ЧЕТВЁРТОЕ КАСАНИЕ');
  assert.equal(m.phase, 'point');
  assert.equal(m.pointWinner, 1);
  m.autoSelect(0, 2);
  assert.equal(m.selected[0], 0);
});
test('floor modifier allows exactly one bounce before a team contact', () => {
  const m = rally({ floorBounce: true });
  m.ball = { ...ball, x: -7, y: 0.1, vy: -1 };
  m.tick(FIXED_DT, {});
  assert.equal(m.phase, 'rally');
  assert.equal(m.bounces[0], 1);
  m.ball.y = 0.1;
  m.ball.vy = -1;
  m.tick(FIXED_DT, {});
  assert.equal(m.phase, 'point');
});
test('replay restores score, seed and positions without stale held input', () => {
  const m = rally();
  const state = capture(m);
  m.players[0].x = -2;
  m.score[0] = 9;
  m.seed = 5;
  restore(m, state);
  assert.equal(m.players[0].x, state.players[0].x);
  assert.equal(m.score[0], 0);
  assert.equal(m.seed, state.seed);
  assert.equal(m.controls[0].charge, null);
  m.tick(FIXED_DT, {});
  m.point(0, 'test');
  m.replay.record(m);
  assert.ok(m.replay.last.length > 0);
  assert.equal(m.replay.retry(m), true);
  assert.equal(m.phase, 'rally');
});
test('version 4 settings round-trip, old version 2 imports, unknown version rejected', () => {
  const c = { ...DEFAULTS, cpuStyle: 'trickster', duel: true, floorBounce: true, setsToWin: 2 };
  assert.deepEqual(importSettings(exportSettings(c)), sanitizeConfig(c));
  assert.equal(importSettings(JSON.stringify({ version: 2, config: { gravity: 8 } })).gravity, 8);
  assert.throws(() => importSettings('{"version":9,"config":{"gravity":8}}'));
});
test('training scenarios reset to playable states', () => {
  for (const drill of ['choice', 'delay', 'rescue']) {
    const m = new Match();
    m.reset('practice');
    m.startDrill(drill);
    assert.equal(m.phase, 'rally');
    assert.ok(Number.isFinite(m.ball.x));
    for (let i = 0; i < 60; i++) m.tick(FIXED_DT, {});
    assert.ok(Number.isFinite(m.ball.y));
  }
});
