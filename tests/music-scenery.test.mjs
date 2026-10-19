import { courtLineBounds } from '../src/court-visual.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC_TRACKS, musicBar, Music } from '../src/music.js';
import { DRUMS, percussionBar, synthDrum } from '../src/percussion.js';
import { ARENAS, drawArenaBackdrop } from '../src/arenas.js';
import { sanitizeConfig } from '../src/config.js';
import { exportSettings, importSettings } from '../src/settings-file.js';

test('three original sixteen-bar themes have complete measures, bounded notes and different melodies', () => {
  assert.equal(Object.keys(MUSIC_TRACKS).length, 3);
  const melodies = new Set();
  for (const [id, t] of Object.entries(MUSIC_TRACKS)) {
    assert.equal(t.melody.length, 16);
    assert.equal(t.chords.length, 16);
    melodies.add(t.melody.join('|'));
    for (let bar = 0; bar < 16; bar++) {
      assert.equal(
        t.melody[bar].split(' ').reduce((sum, s) => sum + Number(s.split(':')[1]), 0),
        4,
      );
      const notes = musicBar(id, bar);
      assert.ok(notes.length >= 3 && notes.length <= 8);
      for (const n of notes) {
        if (!n.drum) assert.ok(Number.isInteger(n.note) && n.note >= 28 && n.note <= 96);
        assert.ok(n.beat >= 0 && n.beat < 4);
        assert.ok(n.level > 0 && n.level <= (n.drum ? 0.12 : 0.075));
      }
      assert.deepEqual(
        musicBar(id, bar + 16).filter((n) => !n.drum),
        notes.filter((n) => !n.drum),
      );
    }
  }
  assert.equal(melodies.size, 3);
});
class Param {
  setValueAtTime() {}
  setTargetAtTime() {}
  linearRampToValueAtTime() {}
  cancelScheduledValues() {}
}
class Node {
  constructor() {
    this.gain = new Param();
    this.frequency = new Param();
    this.Q = new Param();
  }
  connect() {}
  disconnect() {}
  start(t) {
    this.at = t;
  }
  stop(t) {
    this.stopped = t;
  }
}
function context() {
  return {
    currentTime: 0,
    nodes: [],
    sampleRate: 22050,
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length);
      return { duration: length / rate, getChannelData: () => data };
    },
    createBufferSource() {
      const n = new Node();
      this.nodes.push(n);
      return n;
    },
    createGain: () => new Node(),
    createBiquadFilter: () => new Node(),
    createOscillator() {
      const n = new Node();
      this.nodes.push(n);
      return n;
    },
  };
}
test('music switching cancels scheduled notes and resuming skips old bars without an audio backlog', () => {
  const ctx = context(),
    music = new Music(ctx, new Node());
  music.update('sunset', 0.22);
  const initial = [...music.nodes];
  assert.ok(initial.length >= 3 && initial.length <= 8);
  for (let i = 0; i < 30; i++) music.update('sunset', 0.22);
  assert.equal(music.nodes.size, initial.length, 'one bar is not scheduled twice');
  music.update('ocean', 0.22);
  assert.ok(initial.every((n) => n.oscillator.stopped === 0.14));
  ctx.currentTime = 70;
  music.update('ocean', 0.22);
  assert.ok([...music.nodes].every((n) => n.oscillator.at >= 0));
  assert.ok([...music.nodes].some((n) => n.oscillator.at >= 70));
  music.update('off', 0.22);
  assert.equal(music.nodes.size, 0);
  assert.equal(music.track, null);
});
test('seven detailed backdrops retain the same court and save with music in JSON', () => {
  assert.deepEqual(Object.keys(ARENAS), [
    'miami',
    'beach',
    'gym',
    'farm',
    'alpine',
    'sky',
    'championship',
  ]);
  const layouts = [];
  for (const id of Object.keys(ARENAS)) {
    const rects = [];
    const c = {
      fillRect: (...args) => rects.push(args),
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      arc() {},
      fill() {},
      fillText() {},
    };
    drawArenaBackdrop(c, id);
    assert.ok(rects.length > 1000, id);
    assert.deepEqual(courtLineBounds({ arenaTheme: id }), courtLineBounds({ arenaTheme: 'miami' }));
    layouts.push(JSON.stringify(rects));
    const settings = sanitizeConfig({ arenaTheme: id, musicTrack: 'ocean', musicVolume: 0.17 });
    assert.deepEqual(importSettings(exportSettings(settings)), settings);
  }
  assert.equal(new Set(layouts).size, 7);
  for (const retired of ['street', 'paris', 'stadium'])
    assert.equal(sanitizeConfig({ arenaTheme: retired }).arenaTheme, 'miami');
  const bad = sanitizeConfig({ arenaTheme: 'oops', musicTrack: 'oops', musicVolume: 100 });
  assert.equal(bad.arenaTheme, 'miami');
  assert.equal(bad.musicTrack, 'boardwalk');
  assert.equal(bad.musicVolume, 0.5);
});

test('each theme introduces kick then snare then hats and percussion, with a later break and return', () => {
  for (const id of Object.keys(MUSIC_TRACKS)) {
    const voices = (bar) => new Set(percussionBar(id, bar).map((n) => n.drum));
    assert.equal(voices(0).size, 0);
    assert.equal(voices(1).size, 0);
    assert.deepEqual([...voices(2)], ['kick']);
    assert.ok(!voices(3).has('snare'));
    assert.ok(voices(4).has('kick') && voices(4).has('snare'));
    assert.ok(!voices(5).has('hat'));
    assert.ok(voices(6).has('hat'));
    assert.ok(!voices(6).has('clap'));
    assert.ok(voices(8).has('clap') && voices(8).has('openhat'));
    assert.ok(voices(15).has('tom'));
    assert.deepEqual([...voices(24)], ['kick']);
    assert.ok(voices(26).has('snare'));
    assert.ok(voices(28).has('hat'));
    assert.ok(voices(30).has('clap'));
    assert.ok(voices(32).has('snare'), 'the next melody loop continues the developed groove');
  }
  const patterns = Object.keys(MUSIC_TRACKS).map((id) => JSON.stringify(percussionBar(id, 8)));
  assert.equal(new Set(patterns).size, 3, 'each melody has its own groove');
});
test('every drum is generated as deterministic bounded PCM with a clean tail', () => {
  const ctx = context();
  for (const kind of DRUMS) {
    const a = synthDrum(ctx, kind).getChannelData(0),
      b = synthDrum(ctx, kind).getChannelData(0);
    assert.deepEqual(a, b);
    let energy = 0;
    for (const sample of a) {
      assert.ok(Number.isFinite(sample) && Math.abs(sample) <= 0.96);
      energy += sample * sample;
    }
    assert.ok(Math.sqrt(energy / a.length) > 0.015, kind);
    assert.ok(Math.abs(a.at(-1)) < 0.01, kind + ' fades before its source stops');
  }
});
test('gameplay music stays sparse, low and free of growing drum layers across repeated loops', () => {
  for (const [id, track] of Object.entries(MUSIC_TRACKS)) {
    assert.ok(track.bpm >= 75 && track.bpm <= 90);
    let restBeats = 0;
    for (const bar of track.melody) {
      for (const token of bar.split(' '))
        if (token.startsWith('R:')) restBeats += Number(token.split(':')[1]);
    }
    assert.ok(restBeats >= 24, 'phrases leave breathing room');
    for (let bar = 0; bar < 96; bar++) {
      const events = musicBar(id, bar);
      assert.ok(!events.some((n) => n.drum));
      assert.ok(events.length <= 8);
      assert.ok(events.filter((n) => n.voice === 'lead').every((n) => n.note <= 74));
      assert.deepEqual(events, musicBar(id, bar % 16));
    }
    const ctx = context(),
      music = new Music(ctx, new Node());
    music.update(id, 0.22);
    assert.ok([...music.nodes].every((n) => ['triangle', 'sine'].includes(n.oscillator.type)));
  }
});
