import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { serveCue } from '../src/serve-cue.js';
import { simulateServe } from '../src/serve-lab.js';
import { soundCue } from '../src/audio.js';

const setup = (kind = 'low', team = 0, config = DEFAULTS, power = 0.6) => {
  const match = new Match(config);
  match.reset('versus');
  match.server = team;
  match.startServe();
  match.beginServe({ kind, power, aim: {} });
  return match;
};
const tick = (m, input = {}) =>
  m.tick(FIXED_DT, m.server === 0 ? input : {}, m.server === 1 ? input : {});
const advance = (m, time) => {
  while (m.phase === 'serve-motion' && m.phaseTime + FIXED_DT < time - 1e-9) tick(m);
};

test('all four serves launch on the second press, including an early grazing contact', () => {
  for (const kind of ['low', 'back', 'loft', 'drive'])
    for (const playerId of [0, 3])
      for (const timingOffset of [-0.1, -0.04, 0, 0.04]) {
        const data = simulateServe(DEFAULTS, { kind, power: 0.6, playerId, timingOffset });
        assert.equal(data.hit, true, `${kind}/${playerId}/${timingOffset}`);
        assert.equal(data.launchTime, data.pressTime, 'there is no delayed launch');
        if (timingOffset === 0) assert.equal(data.quality, 1);
      }
});

test('early presses are no longer promoted to perfect contacts or saved for later', () => {
  for (const kind of ['low', 'back', 'loft', 'drive']) {
    const miss = simulateServe(DEFAULTS, { kind, power: 0.6, timingOffset: -0.29 });
    assert.equal(miss.hit, false, kind);
    const early = simulateServe(DEFAULTS, { kind, power: 0.6, timingOffset: -0.2 });
    assert.ok(early.quality < 0.25, kind);
    if (early.hit) assert.equal(early.launchTime, early.pressTime);
  }
});

test('the ring contracts continuously, accelerating near the ideal moment, from yellow to green', () => {
  const m = setup();
  const sample = (progress) => {
    m.phaseTime = m.serveAction.contactTiming.start * progress;
    m.serveAction.contactQuality = progress === 1 ? 1 : 0;
    return serveCue(m);
  };
  const start = sample(0),
    middle = sample(0.5),
    near = sample(0.9),
    ideal = sample(1);
  assert.equal(start.color, 'rgb(255, 223, 124)');
  assert.equal(ideal.color, 'rgb(131, 230, 165)');
  assert.ok(start.radius - middle.radius < 1);
  assert.ok(near.radius - ideal.radius > (start.radius - ideal.radius) * 0.5);
  assert.ok(ideal.radius > 8.2 * DEFAULTS.ballSize * 1.18, 'the circle stays outside the ball');
  assert.ok(start.width < middle.width && middle.width < near.width);
  assert.ok(ideal.width < near.width, 'the preparation releases into a finer green ring');
  let previous = start.radius;
  for (let i = 1; i <= 1000; i++) {
    const current = sample(i / 1000).radius;
    assert.ok(current <= previous);
    assert.ok(previous - current < 0.2, 'the final acceleration has no radius jump');
    previous = current;
  }
});

test('green and the timing sound begin with the real hand contact window, before the ideal', () => {
  for (const kind of ['low', 'back', 'loft', 'drive']) {
    const m = setup(kind);
    const timing = m.serveAction.contactTiming;
    assert.equal(serveCue(m).stage, 'waiting');
    let firstSound = null;
    while (m.phase === 'serve-motion' && m.phaseTime < m.serveAction.ideal + FIXED_DT) {
      tick(m);
      if (serveCue(m).ready) assert.equal(m.controls[0].contactWindow, true);
      const sounded = m.events.filter((e) => e.type === 'serve-hit-cue');
      if (sounded.length && firstSound === null) {
        firstSound = m.phaseTime;
        assert.equal(serveCue(m).ready, true);
        assert.ok(Math.abs(serveCue(m).radius - serveCue(m).targetRadius) < 1e-9);
      }
    }
    assert.equal(serveCue(m).ready, true);
    assert.ok(serveCue(m).radius < 18);
    assert.ok(firstSound >= timing.start && firstSound < timing.start + FIXED_DT);
    while (m.phase === 'serve-motion') tick(m);
    assert.equal(m.events.filter((e) => e.type === 'serve-hit-cue').length, 1);
  }
});

test('every displayed green frame still gives a perfect hit on the following input frame', () => {
  for (const config of [
    DEFAULTS,
    { ...DEFAULTS, serveLowContactReach: 0.2, serveLowIdealMin: 0.8, serveLowIdealMax: 0.95 },
  ])
    for (const kind of ['low', 'back', 'loft', 'drive'])
      for (const team of [0, 1])
        for (const power of [0.15, 0.6, 1]) {
          const m = setup(kind, team, config, power);
          const ideal = m.serveAction.ideal;
          let greenFrames = 0;
          let lastGreenTime = null;
          while (m.phase === 'serve-motion') {
            tick(m);
            const cue = serveCue(m);
            if (!cue) continue;
            assert.equal(cue.color === 'rgb(131, 230, 165)', cue.ready);
            if (!cue.ready) continue;
            greenFrames++;
            lastGreenTime = m.phaseTime;
            const hit = simulateServe(config, {
              kind,
              power,
              playerId: team * 3,
              timingOffset: m.phaseTime + FIXED_DT - ideal,
            });
            assert.equal(hit.hit, true, `${kind}/${team}/${power}/${m.phaseTime}`);
            assert.ok(hit.quality >= 1 - 1e-9, `${kind}/${team}/${power}/${hit.quality}`);
            assert.equal(hit.launchTime, hit.pressTime);
          }
          assert.ok(greenFrames > 0, `${kind} has a visible green window`);
          const delayed = simulateServe(config, {
            kind,
            power,
            playerId: team * 3,
            timingOffset: lastGreenTime + 2 * FIXED_DT - ideal,
          });
          assert.equal(delayed.hit, true, 'the last green frame allows a 60 Hz input frame');
          assert.equal(delayed.launchTime, delayed.pressTime);
        }
});

test('no second press or a held first press never launches a serve', () => {
  for (const held of [false, true]) {
    const m = setup('loft');
    m.controls[0].previousInput = { loft: held };
    while (m.phase === 'serve-motion') tick(m, { loft: held });
    assert.equal(m.stats.serves[0], 0);
    assert.equal(m.pointWinner, 1);
  }
});

test('a miss consumes the press immediately and suppresses the later timing sound', () => {
  const m = setup();
  tick(m, { low: true });
  assert.equal(serveCue(m).stage, 'missed');
  assert.equal(m.serverPlayer().armSwing.hit, false);
  while (m.phase === 'serve-motion') tick(m);
  assert.equal(m.stats.serves[0], 0);
  assert.equal(m.events.filter((e) => e.type === 'serve-hit-cue').length, 0);
});

test('second-press aim takes effect immediately, with no queued direction', () => {
  const m = setup('loft');
  advance(m, m.serveAction.ideal);
  tick(m, { loft: true, buttonVector: { x: -0.6, y: 0.8 }, l2: true });
  assert.equal(m.phase, 'rally');
  assert.equal(m.stats.serves[0], 1);
  assert.ok(m.ball.vx < 0, 'explicit backward direction is respected');
});

test('only the rotating serving controller can make the second press in coop', () => {
  const m = new Match();
  m.reset('coop');
  m.coopRotationCount = 1;
  m.startServe();
  m.beginServe({ kind: 'low', power: 0.6, aim: {} });
  assert.equal(m.serverSlot(), 2);
  advance(m, m.serveAction.ideal);
  m.tick(FIXED_DT, { low: true });
  assert.equal(m.phase, 'serve-motion');
  m.tick(FIXED_DT, {}, { low: true });
  assert.equal(m.phase, 'rally');
  assert.equal(m.stats.serves[0], 1);
});

test('short and long custom tosses retain immediate ideal strikes', () => {
  for (const ideal of [0.3, 1.15, 4]) {
    const config = { ...DEFAULTS, serveLowIdealMin: ideal, serveLowIdealMax: ideal };
    const sample = simulateServe(config, { kind: 'low', power: 0.6 });
    assert.equal(sample.hit, true);
    assert.equal(sample.quality, 1);
    assert.equal(sample.launchTime, sample.pressTime);
    assert.ok(Math.abs(sample.launchTime - sample.motion.ideal) < FIXED_DT + 1e-9);
  }
});

test('CPU serves have no ring or timing sound; the manual signal has one short onset', () => {
  const m = new Match();
  m.reset('demo');
  m.beginServe({ kind: 'loft', power: 0.6, aim: {} });
  assert.equal(serveCue(m), null);
  while (m.phase === 'serve-motion') m.tick(FIXED_DT);
  assert.equal(m.events.filter((e) => e.type === 'serve-hit-cue').length, 0);
  const voices = soundCue({ type: 'serve-hit-cue' });
  assert.equal(voices.length, 2);
  assert.ok(voices.every((voice) => voice.delay === 0 && voice.duration < 0.1));
});
