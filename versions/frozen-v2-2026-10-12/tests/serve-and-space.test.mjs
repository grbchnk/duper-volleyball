import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { InputBuffer } from '../src/input.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { traceBall } from '../src/physics.js';
import { expressivePose } from '../src/arm-motion.js';
import { ARM_STYLES } from '../src/arms.js';

test('four face buttons select four serves and square selects the back pass in rallies', () => {
  const pad = {
    connected: true,
    mapping: 'standard',
    axes: [],
    buttons: Array.from({ length: 4 }, () => ({ pressed: false })),
  };
  const input = new InputBuffer(() => [pad]);
  for (const [index, kind] of ['low', 'drive', 'back', 'loft'].entries()) {
    pad.buttons.forEach((b, i) => (b.pressed = i === index));
    input.poll();
    const state = input.read('serve');
    assert.equal(state[kind], true);
    assert.equal(['low', 'drive', 'back', 'loft'].filter((k) => state[k]).length, 1);
  }
  pad.buttons.forEach((b, i) => (b.pressed = i === 2));
  input.poll();
  assert.equal(input.read().back, true);
});

test('four serves have distinct windups and full charge only tosses before a fresh strike press', () => {
  const poses = new Set();
  let outs = 0;
  for (const kind of ['low', 'back', 'loft', 'drive']) {
    const pose = expressivePose({
      spec: ARM_STYLES.whip,
      config: DEFAULTS,
      kind,
      serve: { kind, age: 0.6, power: 1, hand: 1 },
    });
    poses.add(JSON.stringify(pose.wrists));
    const m = new Match();
    while (m.phase === 'serve') m.tick(FIXED_DT, { [kind]: true });
    while (m.phaseTime < m.serveAction.ideal - FIXED_DT * 2) m.tick(FIXED_DT, { [kind]: true });
    assert.equal(m.stats.serves[0], 0);
    m.tick();
    m.tick(FIXED_DT, { [kind]: true });
    assert.equal(m.stats.serves[0], 1, kind);
    assert.equal(m.players[0].armSwing.power, 1);
    const landing = traceBall(m.ball, m.config, 8).at(-1);
    if (Math.abs(landing.x) > 9.105) outs++;
    for (let i = 0; i < 5; i++) m.tick(FIXED_DT, { [kind]: true });
    assert.equal(m.stats.serves[0], 1);
  }
  assert.equal(poses.size, 4);
  assert.ok(outs > 0, 'maximum power must not be silently corrected into court');
});

test('partial serve power waits for manual release instead of a timer', () => {
  const m = new Match();
  for (let i = 0; i < 90; i++)
    m.tick(FIXED_DT, { low: true, stickShot: 'low', stickStrength: 0.5 });
  assert.equal(m.phase, 'serve');
  assert.equal(m.charge.power, 0.5);
  m.tick();
  assert.equal(m.phase, 'serve-motion');
  assert.equal(m.stats.serves[0], 0);
});

test('a new stick sector replaces an unconsumed shot immediately', () => {
  const m = new Match({ ...DEFAULTS, assist: false, releaseWindow: 0.3 });
  m.startDrill('receive');
  const p = m.active();
  Object.assign(m.ball, { x: 4, y: 10 });
  m.pending = {
    kind: 'low',
    power: 0.6,
    ttl: 0.3,
    playerId: p.id,
    stickControlled: true,
    aim: { vector: { x: 1, y: 0 } },
  };
  m.tick(FIXED_DT, {
    loft: true,
    stickShot: 'loft',
    shotAxis: -1,
    shotVector: { x: -0.6, y: 0.8 },
    buttonVector: { x: -0.6, y: 0.8 },
  });
  assert.equal(m.pending, null);
  assert.equal(m.charge.kind, 'loft');
  assert.equal(m.charge.power, 0.08);
  assert.equal(m.charge.aim.vector.x, -0.6);
  Object.assign(m.ball, { x: p.x, y: 2, vx: 0, vy: 0 });
  m.tick();
  assert.equal(m.contacts, 1);
  assert.ok(m.ball.vx < 0);
});

test('front player clears an overhead pass and returns after the next contact on either team', () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.startDrill('receive');
    const p = m.player(team, 'open');
    const x = p.x;
    Object.assign(m.ball, { x, y: 2.1 });
    m.makeContact(p, 'loft', 0.5, { vx: 0, vy: 7, vz: 0, spin: 0, targetId: null });
    assert.ok(p.clearLane);
    for (let i = 0; i < 200; i++) m.movePlayers(FIXED_DT, { axis: 0 });
    assert.ok(Math.abs(p.x) > Math.abs(x) + 1.4);
    const teammate = m.player(team, 'setter');
    m.makeContact(teammate, 'drive', 0.5, {
      vx: team ? -10 : 10,
      vy: 3,
      vz: 0,
      spin: 0,
      targetId: null,
    });
    // A human-selected player must stay under manual control; select the setter
    // to exercise the front player's autonomous return.
    m.selected[team] = teammate.id;
    for (let i = 0; i < 200; i++) m.movePlayers(FIXED_DT, { axis: 0 });
    assert.equal(p.clearLane, null);
    assert.ok(Math.abs(p.x - p.homeX) < 0.01);
  }
});

test('manual control cancels clearing and an airborne passer waits until landing', () => {
  const m = new Match();
  m.startDrill('receive');
  const p = m.player(0, 'open');
  Object.assign(m.ball, { x: p.x, y: 2.1 });
  m.makeContact(p, 'loft', 0.5, { vx: 0, vy: 7, vz: 0, spin: 0 });
  const x = p.x;
  m.jump(p);
  m.movePlayers(FIXED_DT, { axis: 0 });
  assert.equal(p.x, x);
  p.jumpProfile = null;
  p.y = p.vy = 0;
  m.selected[0] = p.id;
  m.movePlayers(FIXED_DT, { axis: 1 });
  assert.equal(p.clearLane, null);
  assert.ok(p.x > x);
});
