import { DEFAULTS } from './legacy-contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from './legacy-contract.js';
import { FIXED_DT } from '../../src/config.js';
import { soundCue, Sound } from '../../src/audio.js';
import { playerFrame } from '../../src/sprites.js';
import { integrateBall } from '../../src/physics.js';
test('TEST continuously feeds without points, repositioning or automatic player changes', () => {
  const m = new Match();
  m.reset('test');
  m.players[0].x = -5.5;
  for (let i = 0; i < 1800; i++) {
    m.tick();
    assert.equal(m.phase, 'rally');
    assert.equal(m.selected[0], 0);
  }
  assert.ok(m.testFeeds > 4);
  assert.deepEqual(m.score, [0, 0]);
  assert.equal(m.rallies, 0);
  assert.equal(m.players[0].x, -5.5);
});
test('TEST replaces dead balls while preserving jumps, positions and player selection', () => {
  const m = new Match();
  m.reset('test');
  m.selected[0] = 1;
  const p = m.active();
  p.x = -4;
  m.jump(p);
  m.tick();
  const before = { x: p.x, y: p.y, jump: p.jumpTime },
    count = m.testFeeds;
  m.point(1, 'miss');
  assert.equal(m.testFeeds, count + 1);
  assert.equal(m.selected[0], 1);
  assert.equal(p.x, before.x);
  assert.equal(p.y, before.y);
  assert.equal(p.jumpTime, before.jump);
  assert.equal(m.phase, 'rally');
  assert.equal(
    m.events.some((e) => e.type === 'test-miss' || e.type === 'point'),
    false,
  );
  m.tick();
  assert.equal(m.testFeeds, count + 1);
  assert.equal(m.phase, 'rally');
  assert.equal(m.stats.serves[0], 0);
});
test('TEST rotates servers, origins, serve types and reception offsets', () => {
  const m = new Match();
  m.reset('test');
  m.active().x = -5;
  const servers = new Set(),
    kinds = new Set(),
    origins = new Set(),
    targets = new Set();
  for (let i = 0; i < 12; i++) {
    m.feedTestBall();
    servers.add(m.lastPlayer);
    kinds.add(m.incomingShot);
    origins.add(m.ball.x);
    targets.add(m.testTarget);
    assert.notEqual(m.testNext.playerId, m.lastPlayer);
    assert.ok(m.ball.vx < 0);
    assert.ok(m.testTarget >= -8.3 && m.testTarget <= -1.3);
  }
  assert.equal(servers.size, 3);
  assert.equal(kinds.size, 4);
  assert.ok(origins.size >= 4);
  assert.ok(targets.size >= 4);
});
test('TEST prepares a new opponent while receiving and feeds after any human contact', () => {
  const m = new Match();
  m.reset('test');
  const next = m.players[m.testNext.playerId];
  const before = Math.abs(next.x - m.testNext.x);
  for (let i = 0; i < 40; i++) m.tick();
  assert.ok(Math.abs(next.x - m.testNext.x) < before);
  const count = m.testFeeds;
  m.lastTouch = 0;
  m.ball.x = -4;
  m.ball.y = 12;
  m.ball.vx = 0;
  m.ball.vy = 0;
  for (let i = 0; i < 55; i++) m.tick();
  assert.equal(m.testFeeds, count + 1);
  assert.deepEqual(m.score, [0, 0]);
  assert.equal(m.selected[0], 0);
});

test('airborne overhead reception uses its air pose without affecting jump timing', () => {
  const m = new Match();
  m.phase = 'rally';
  const p = m.active();
  m.jump(p);
  p.jumpTime = p.jumpProfile.windup + 0.1;
  p.contact = { kind: 'loft', life: 0.24 };
  assert.equal(playerFrame(p, m).state, 'airset');
  assert.ok(playerFrame(p, m).pose.y <= 0);
});
test('chiptune cues distinguish passes, attacks, wins and losses and respond to power', () => {
  const kinds = ['low', 'loft', 'drive'].map((kind) => soundCue({ type: 'hit', kind, power: 0.5 }));
  assert.equal(new Set(kinds.map((x) => JSON.stringify(x))).size, 3);
  assert.ok(
    soundCue({ type: 'hit', kind: 'loft', power: 1 }).at(-1).volume >
      soundCue({ type: 'hit', kind: 'loft', power: 0 }).at(-1).volume,
  );
  assert.notDeepEqual(
    soundCue({ type: 'point', winner: 0 }),
    soundCue({ type: 'point', winner: 1 }),
  );
  assert.deepEqual(soundCue({ type: 'unknown' }), []);
  for (const event of [
    { type: 'hit', kind: 'drive' },
    { type: 'hit', kind: 'loft' },
    { type: 'point', winner: 0 },
    { type: 'block' },
  ])
    for (const n of soundCue(event)) {
      assert.ok(n.volume <= 0.13 && n.duration > 0 && n.delay >= 0);
    }
});
test('sound schedules short voices and mute stops all output through the master gain', () => {
  const events = [],
    param = {
      value: 0,
      setValueAtTime: (v, t) => events.push(['set', v, t]),
      linearRampToValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
    };
  const node = () => ({
    gain: { ...param },
    frequency: { ...param },
    connect: () => {},
    disconnect: () => {},
    start: (t) => events.push(['start', t]),
    stop: (t) => events.push(['stop', t]),
  });
  const sound = new Sound();
  sound.context = {
    state: 'running',
    currentTime: 2,
    sampleRate: 8000,
    createGain: node,
    createOscillator: node,
    createBufferSource: node,
    createBuffer: (_, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
  sound.master = node();
  sound.enabled = true;
  sound.play({ type: 'hit', kind: 'drive', power: 0.8 });
  assert.equal(events.filter((e) => e[0] === 'start').length, 3);
  sound.disable();
  const length = events.length;
  sound.play({ type: 'hit', kind: 'loft' });
  assert.equal(events.length, length);
  assert.equal(sound.muted, true);
  assert.deepEqual(events.at(-1), ['set', 0, 2]);
});
test('ball already slows near the apex and accelerates on descent', () => {
  const b = { x: 0, y: 1, z: 4.5, vx: 5, vy: 8, vz: 0, spin: 0 };
  const initial = Math.hypot(b.vx, b.vy);
  for (let i = 0; i < 98; i++) integrateBall(b, FIXED_DT, DEFAULTS);
  const apex = Math.hypot(b.vx, b.vy);
  for (let i = 0; i < 90; i++) integrateBall(b, FIXED_DT, DEFAULTS);
  assert.ok(apex < initial * 0.65);
  assert.ok(Math.hypot(b.vx, b.vy) > apex * 1.5);
});
