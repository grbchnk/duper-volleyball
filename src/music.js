import { percussionBar, synthDrum } from './percussion.js';
// Three original sixteen-bar themes, developed with a thirty-two-bar drum arrangement.
// Warm console timbres and major sevenths evoke a quiet American evening in the 1980s.
const notes = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};
export function midi(name) {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  return m ? (Number(m[2]) + 1) * 12 + notes[m[1]] : null;
}
export const MUSIC_TRACKS = {
  sunset: {
    name: 'Персиковый закат',
    bpm: 102,
    chords: [
      'D3 F#3 A3 C#4 E4',
      'B2 D3 F#3 A3',
      'G2 B2 D3 F#3',
      'A2 C#3 E3 B3',
      'D3 F#3 A3 C#4',
      'F#2 A2 C#3 E3',
      'G2 B2 D3 F#3',
      'A2 C#3 E3 G3',
      'B2 D3 F#3 A3',
      'F#2 A2 C#3 E3',
      'G2 B2 D3 F#3',
      'D3 F#3 A3 E4',
      'E3 G3 B3 D4',
      'A2 C#3 E3 B3',
      'G2 B2 D3 F#3',
      'D3 F#3 A3 C#4',
    ],
    melody: [
      'F#5:1 A5:0.5 E5:0.5 F#5:1 E5:0.5 D5:0.5',
      'R:0.5 D5:0.5 F#5:1 A5:0.5 F#5:0.5 E5:1',
      'B4:1 D5:0.5 F#5:0.5 A5:1 F#5:1',
      'E5:0.5 C#5:0.5 B4:1 C#5:0.5 E5:0.5 R:1',
      'A4:0.5 D5:0.5 F#5:1 E5:0.5 F#5:0.5 A5:1',
      'G#5:1 E5:0.5 C#5:0.5 A4:1 C#5:1',
      'D5:0.5 F#5:0.5 B5:1 A5:0.5 F#5:0.5 E5:1',
      'C#5:1 B4:0.5 C#5:0.5 E5:1 R:1',
      'F#5:0.5 A5:0.5 B5:1 A5:0.5 F#5:0.5 D5:1',
      'C#5:1 E5:0.5 F#5:0.5 A5:1 G#5:1',
      'F#5:1 D5:0.5 B4:0.5 D5:0.5 E5:0.5 F#5:1',
      'E5:1 F#5:0.5 A5:0.5 D6:1 A5:1',
      'G5:0.5 F#5:0.5 E5:1 B4:1 D5:1',
      'C#5:0.5 E5:0.5 B5:1 A5:0.5 E5:0.5 C#5:1',
      'B4:0.5 D5:0.5 F#5:1 E5:0.5 D5:0.5 B4:1',
      'A4:0.5 C#5:0.5 D5:2 R:1',
    ],
  },
  boardwalk: {
    name: 'Ночной променад',
    bpm: 112,
    chords: [
      'F2 A2 C3 E3',
      'E2 G2 B2 D3',
      'D2 F2 A2 C3',
      'G2 B2 D3 A3',
      'C3 E3 G3 B3',
      'A2 C3 E3 G3',
      'D2 F2 A2 C3',
      'G2 B2 D3 F3',
      'F2 A2 C3 E3',
      'E2 G2 B2 D3',
      'A2 C3 E3 B3',
      'D2 F2 A2 C3',
      'F2 A2 C3 E3',
      'G2 B2 D3 A3',
      'C3 E3 G3 B3',
      'C3 E3 G3 A3',
    ],
    melody: [
      'R:0.5 A4:0.5 C5:0.5 E5:1 G5:0.5 E5:1',
      'D5:0.5 B4:0.5 G4:1 B4:0.5 D5:0.5 E5:1',
      'F5:0.5 E5:0.5 C5:1 A4:0.5 C5:0.5 D5:1',
      'B4:0.5 D5:1 A4:0.5 G4:1 R:1',
      'E5:1 G5:0.5 B5:0.5 A5:0.5 G5:0.5 E5:1',
      'C5:0.5 E5:0.5 G5:1 B5:0.5 A5:0.5 G5:1',
      'F5:1 E5:0.5 D5:0.5 C5:0.5 A4:0.5 D5:1',
      'B4:0.5 D5:0.5 F5:1 E5:0.5 D5:0.5 R:1',
      'C5:0.5 E5:1 A5:0.5 G5:1 E5:1',
      'G5:0.5 E5:0.5 D5:1 B4:0.5 D5:0.5 G5:1',
      'E5:0.5 A5:0.5 B5:1 G5:0.5 E5:0.5 C5:1',
      'A4:1 C5:0.5 D5:0.5 F5:1 E5:1',
      'C5:0.5 E5:0.5 A5:1 C6:0.5 A5:0.5 G5:1',
      'A5:0.5 G5:0.5 D5:1 B4:0.5 D5:0.5 F5:1',
      'E5:1 D5:0.5 B4:0.5 C5:1 G4:1',
      'E5:0.5 D5:0.5 C5:2 R:1',
    ],
  },
  ocean: {
    name: 'Окна над океаном',
    bpm: 96,
    chords: [
      'A2 C3 E3 B3',
      'F2 A2 C3 E3',
      'D2 F2 A2 C3',
      'G2 B2 D3 E3',
      'C3 E3 G3 B3',
      'E2 G2 B2 D3',
      'F2 A2 C3 E3',
      'E2 G#2 B2 D3',
      'A2 C3 E3 G3',
      'G2 B2 D3 E3',
      'F2 A2 C3 E3',
      'C3 E3 G3 B3',
      'D2 F2 A2 C3',
      'E2 G#2 B2 D3',
      'F2 A2 C3 E3',
      'A2 C3 E3 B3',
    ],
    melody: [
      'B4:1 E5:1 C5:0.5 B4:0.5 A4:1',
      'G4:0.5 A4:0.5 C5:1 E5:1 R:1',
      'F5:1 E5:0.5 D5:0.5 C5:1 A4:1',
      'B4:1 D5:0.5 E5:0.5 G5:1 E5:1',
      'B5:1 G5:0.5 E5:0.5 D5:1 C5:1',
      'B4:1 G4:0.5 B4:0.5 D5:1 E5:1',
      'C5:1 A4:0.5 G4:0.5 A4:1 C5:1',
      'B4:0.5 G#4:0.5 E4:1 G#4:1 R:1',
      'E5:1 G5:0.5 B5:0.5 A5:1 E5:1',
      'D5:0.5 E5:0.5 G5:1 B5:1 A5:1',
      'G5:1 E5:0.5 C5:0.5 A4:1 C5:1',
      'E5:1 D5:0.5 B4:0.5 G4:1 E5:1',
      'F5:0.5 E5:0.5 D5:1 A4:1 C5:1',
      'B4:1 G#4:0.5 B4:0.5 D5:1 E5:1',
      'C5:0.5 E5:0.5 A5:1 G5:0.5 E5:0.5 C5:1',
      'B4:1 A4:2 R:1',
    ],
  },
};
export function musicBar(id, index) {
  const track = MUSIC_TRACKS[id];
  if (!track) return [];
  const bar = index % 16,
    chord = track.chords[bar].split(' ').map(midi),
    events = [];
  let beat = 0;
  for (const token of track.melody[bar].split(' ')) {
    const [name, length] = token.split(':'),
      duration = Number(length);
    if (name !== 'R')
      events.push({
        beat,
        duration: duration * 0.88,
        note: midi(name),
        voice: 'lead',
        level: 0.075,
      });
    beat += duration;
  }
  chord
    .slice(1)
    .forEach((note) => events.push({ beat: 0, duration: 3.85, note, voice: 'pad', level: 0.026 }));
  const bassRoot = chord[0] < 48 ? chord[0] : chord[0] - 12;
  for (const [beat, note] of [
    [0, bassRoot],
    [1.5, chord[0]],
    [2.5, bassRoot],
    [3.5, chord[2] - 12],
  ])
    events.push({ beat, duration: 0.44, note, voice: 'bass', level: 0.075 });
  for (let i = 0; i < 8; i++)
    events.push({
      beat: i / 2,
      duration: 0.27,
      note: chord[1 + (i % (chord.length - 1))] + 12,
      voice: 'bell',
      level: 0.016,
    });
  return [...events, ...percussionBar(id, index)];
}
export class Music {
  constructor(ctx, output) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = 0;
    this.output.connect(output);
    this.nodes = new Set();
    this.track = null;
    this.bar = 0;
    this.next = 0;
    this.drums = new Map();
  }
  stop() {
    const now = this.ctx.currentTime;
    for (const { oscillator, gain } of this.nodes) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, 0.03);
      oscillator.stop(now + 0.14);
    }
    this.nodes.clear();
    this.track = null;
  }
  update(id, volume, active = true) {
    const ctx = this.ctx,
      now = ctx.currentTime;
    if (!active || !MUSIC_TRACKS[id] || volume <= 0) {
      if (this.track) this.stop();
      return;
    }
    if (this.track !== id) {
      this.stop();
      this.track = id;
      this.bar = 0;
      this.next = now + 0.08;
    }
    const level = Math.min(0.5, volume);
    if (this.volume !== level) {
      this.output.gain.setTargetAtTime(level, now, 0.25);
      this.volume = level;
    }
    // Skip elapsed bars after suspension instead of playing a backlog of notes.
    const beatSeconds = 60 / MUSIC_TRACKS[id].bpm,
      barSeconds = 4 * beatSeconds;
    if (this.next < now - 0.2) {
      this.bar += Math.ceil((now - this.next) / barSeconds);
      this.next = now + 0.08;
    }
    if (this.next > now + 0.3) return;
    for (const event of musicBar(id, this.bar++)) this.note(event, this.next, beatSeconds);
    this.next += barSeconds;
  }
  note(event, barStart, beatSeconds) {
    const ctx = this.ctx,
      start = barStart + event.beat * beatSeconds,
      end = start + event.duration * beatSeconds;
    if (event.drum) {
      const source = ctx.createBufferSource(),
        gain = ctx.createGain();
      if (!this.drums.has(event.drum)) this.drums.set(event.drum, synthDrum(ctx, event.drum));
      source.buffer = this.drums.get(event.drum);
      gain.gain.setValueAtTime(event.level, start);
      source.connect(gain);
      gain.connect(this.output);
      const node = { oscillator: source, gain };
      this.nodes.add(node);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.nodes.delete(node);
      };
      source.start(start);
      source.stop(start + source.buffer.duration + 0.01);
      return;
    }
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain(),
      filter = ctx.createBiquadFilter();
    oscillator.type =
      event.voice === 'lead' || event.voice === 'bell'
        ? 'square'
        : event.voice === 'bass'
          ? 'triangle'
          : 'sine';
    oscillator.frequency.value = 440 * 2 ** ((event.note - 69) / 12);
    filter.type = 'lowpass';
    filter.frequency.value = event.voice === 'lead' ? 1850 : event.voice === 'bell' ? 2100 : 1100;
    filter.Q.value = 0.3;
    gain.gain.setValueAtTime(0, start);
    const level = event.level * (event.voice === 'lead' ? 0.65 : event.voice === 'bell' ? 0.5 : 1);
    gain.gain.linearRampToValueAtTime(level, start + (event.voice === 'pad' ? 0.18 : 0.012));
    gain.gain.setValueAtTime(level, Math.max(start + 0.1, end - 0.1));
    gain.gain.linearRampToValueAtTime(0, end + 0.12);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);
    const node = { oscillator, gain };
    this.nodes.add(node);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.nodes.delete(node);
    };
    oscillator.start(start);
    oscillator.stop(end + 0.14);
  }
}
