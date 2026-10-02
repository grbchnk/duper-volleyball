import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { FIXED_DT, DEFAULTS } from '../src/config.js';
import { soundCue, Sound } from '../src/audio.js';
import { playerFrame } from '../src/sprites.js';
import { integrateBall } from '../src/physics.js';
test('TEST continuously feeds without points, repositioning or automatic player changes', () => {
  const m = new Match();
  m.reset('test');
  m.players[0].x = -5.5;
  for (let i = 0; i < 1200; i++) {
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
  assert.equal(m.stats.serves[0], 0);
});
test('TEST feeds to the selected player and sends a higher third ball', () => {
  const m = new Match();
  m.reset('test');
  m.active().x = -5;
  for (let i = 0; i < 3; i++) {
    m.feedTestBall();
    const high = m.testFeeds % 3 === 0,
      b = { ...m.ball };
    for (let n = 0; n < 186; n++) integrateBall(b, FIXED_DT, m.config);
    assert.ok(Math.abs(b.x + 5) < 0.05);
    assert.ok(Math.abs(b.y - (high ? 2.8 : 1.3)) < 0.05);
  }
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
    soundCue({ type: 'hit', kind: 'loft', power: 1 })[0].volume >
      soundCue({ type: 'hit', kind: 'loft', power: 0 })[0].volume,
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
  assert.equal(events.filter((e) => e[0] === 'start').length, 2);
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
