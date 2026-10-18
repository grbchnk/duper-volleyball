import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound, soundCue } from '../src/audio.js';
import { chargePulse, refereeWhistle } from '../src/charge-whistle.js';
import { Match } from '../src/engine.js';

class Param {
  constructor() {
    this.value = 0;
    this.changes = [];
  }
  setValueAtTime(value) {
    this.value = value;
    this.changes.push(value);
  }
  setTargetAtTime(value) {
    this.setValueAtTime(value);
  }
  linearRampToValueAtTime(value) {
    this.setValueAtTime(value);
  }
  exponentialRampToValueAtTime(value) {
    this.setValueAtTime(value);
  }
  cancelScheduledValues() {}
}
class AudioNode {
  constructor() {
    this.gain = new Param();
    this.frequency = new Param();
    this.playbackRate = new Param();
    this.Q = new Param();
  }
  connect() {}
  disconnect() {}
  start(at) {
    this.started = at ?? 0;
  }
  stop(at) {
    this.stopped = at;
  }
}
class Context {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 2;
    this.sampleRate = 22050;
    this.sources = [];
    this.oscillators = [];
  }
  async resume() {
    this.state = 'running';
  }
  createGain() {
    return new AudioNode();
  }
  createBiquadFilter() {
    return new AudioNode();
  }
  createOscillator() {
    const n = new AudioNode();
    this.oscillators.push(n);
    return n;
  }
  createBufferSource() {
    const n = new AudioNode();
    this.sources.push(n);
    return n;
  }
  createBuffer(channels, length) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  async decodeAudioData() {
    throw new Error('Recorded audio is forbidden');
  }
}
async function enabledSound() {
  globalThis.window = { AudioContext: Context };
  const s = new Sound();
  await s.enable();
  return s;
}

test('all removed crowd calls stay silent and winning points use melody and applause only', async () => {
  const s = await enabledSound();
  for (const type of ['crowd-wow', 'crowd-hurrah', 'crowd-boo']) {
    assert.deepEqual(soundCue({ type }), []);
    s.play({ type });
  }
  assert.equal(s.context.sources.length, 0);
  assert.equal(s.context.oscillators.length, 0);
  s.play({ type: 'point', winner: 0, contacts: 10, matchWon: true });
  assert.equal(s.context.sources.length, 1, 'only the generated applause buffer plays');
  assert.ok(s.context.oscillators.length >= 5);
  assert.ok(s.context.oscillators.every((n) => n.type !== 'sawtooth'));
});
test('charging plays rounded rising pulses on one oscillator, then fades on release or mute', async () => {
  const s = await enabledSound();
  s.updateCharge(0.1);
  assert.equal(s.chargeTone.oscillator.type, 'triangle');
  assert.ok(Math.max(...s.chargeTone.gain.gain.changes) < 0.025);
  const tone = s.chargeTone,
    initial = tone.oscillator.frequency.value;
  s.context.currentTime += 0.15;
  s.updateCharge(0.8);
  assert.equal(s.chargeTone, tone);
  assert.ok(tone.oscillator.frequency.value > initial);
  s.updateCharge(null);
  assert.equal(s.chargeTone, null);
  assert.ok(tone.oscillator.stopped > s.context.currentTime);
  s.updateCharge(0.5);
  const next = s.chargeTone;
  s.disable();
  assert.equal(s.master.gain.value, 0);
  assert.equal(s.chargeTone, null);
  assert.ok(next.oscillator.stopped);
  const count = s.context.sources.length;
  s.play({ type: 'point', winner: 0 });
  s.updateCharge(1);
  assert.equal(s.context.sources.length, count);
  assert.equal(s.chargeTone, null);
});
test('a suspended browser context is not reported as ready and cannot accumulate sounds', async () => {
  const s = await enabledSound();
  s.updateCharge(0.4);
  s.context.state = 'suspended';
  s.context.onstatechange();
  assert.equal(s.ready, false);
  assert.equal(s.chargeTone, null);
  const count = s.context.sources.length;
  s.play({ type: 'point', winner: 0 });
  assert.equal(s.context.sources.length, count);
  await s.enable();
  assert.equal(s.ready, true);
});

test('the charge motif climbs and accelerates throughout a long charge without repeated scheduling', async () => {
  const s = await enabledSound();
  let lastFrequency = 0,
    lastInterval = Infinity;
  for (let i = 0; i < 8; i++) {
    const pulse = chargePulse(i / 7, i);
    assert.ok(pulse.frequency > lastFrequency);
    assert.ok(pulse.interval < lastInterval);
    assert.ok(pulse.volume <= 0.022);
    assert.ok(pulse.duration < pulse.interval);
    lastFrequency = pulse.frequency;
    lastInterval = pulse.interval;
  }
  s.updateCharge(0.1);
  const tone = s.chargeTone;
  for (let i = 0; i < 10; i++) s.updateCharge(0.1);
  assert.equal(tone.index, 1, 'render frames cannot duplicate a pulse');
  for (let i = 0; i < 80; i++) {
    s.context.currentTime += 0.02;
    s.updateCharge(i / 80);
  }
  assert.equal(s.chargeTone, tone);
  assert.ok(tone.index > 12);
  assert.ok(
    tone.gain.gain.changes.filter((v) => v === 0).length > 12,
    'quiet gaps separate the pu-pu-pu notes',
  );
});
test('each serve-ready plays one long coded referee whistle, while point celebrations do not repeat it', async () => {
  const s = await enabledSound(),
    m = new Match();
  m.reset('coop');
  let ready = m.events.find((e) => e.type === 'serve-ready');
  assert.ok(ready);
  s.play(ready);
  assert.equal(s.context.sources.length, 1);
  assert.equal(s.context.sources[0].buffer, s.whistleBuffer);
  assert.equal(soundCue(ready)[0].duration, 1.15);
  assert.ok(!soundCue({ type: 'point', winner: 0 }).some((n) => n.type === 'referee-whistle'));
  m.phase = 'rally';
  m.point(0, 'TEST');
  m.startServe();
  s.play(m.events.filter((e) => e.type === 'serve-ready').at(-1));
  assert.equal(s.context.sources.length, 2);
  const data = refereeWhistle(s.context).getChannelData(0),
    rate = s.context.sampleRate;
  assert.ok(Math.abs(data.length / rate - 1.15) < 0.001);
  const rms = (from, to) =>
    Math.sqrt(
      data
        .slice(Math.floor(from * rate), Math.floor(to * rate))
        .reduce((sum, v) => sum + v * v, 0) /
        ((to - from) * rate),
    );
  assert.ok(rms(0.2, 0.8) > 0.2);
  assert.ok(rms(1.13, 1.15) < rms(0.2, 0.8) * 0.2);
});
test('a fresh first-serve signal survives audio unlocking, and mute never queues it', async () => {
  globalThis.window = { AudioContext: Context };
  const s = new Sound();
  s.play({ type: 'serve-ready' });
  await s.enable();
  assert.equal(s.context.sources.length, 1);
  s.disable();
  s.play({ type: 'serve-ready' });
  assert.equal(s.pendingServeCue, null);
});

test('lost rallies and failed trials play a warm melody without crowd voices or noise', async () => {
  const s = await enabledSound();
  for (const event of [
    { type: 'point', winner: 1, contacts: 2 },
    { type: 'point', winner: 1, contacts: 12, matchWon: true },
    { type: 'challenge-result', hit: false },
    { type: 'test-miss' },
  ]) {
    const cue = soundCue(event);
    assert.ok(cue.length >= 5);
    assert.ok(cue.every((n) => ['triangle', 'sine'].includes(n.type)));
    assert.ok(cue.every((n) => n.frequency >= 523 && n.volume <= 0.035));
    const before = s.context.sources.length;
    s.play(event);
    assert.equal(
      s.context.sources.length,
      before,
      'no voice or crowd/noise buffer accompanies a loss',
    );
  }
  assert.deepEqual(soundCue({ type: 'loss-preview' }), soundCue({ type: 'point', winner: 1 }));
});
