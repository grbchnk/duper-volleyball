// Short original handheld-console motifs, with room between phrases.
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
    bpm: 82,
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
      'F#4:1 A4:0.5 B4:0.5 R:2',
      'A4:1 F#4:1 R:2',
      'D4:1 F#4:1 A4:1 R:1',
      'E4:1 R:3',
      'F#4:1 A4:0.5 B4:0.5 R:2',
      'A4:1 E4:1 R:2',
      'F#4:1 E4:0.5 D4:1.5 R:1',
      'R:4',
      'F#4:1 A4:0.5 B4:0.5 R:2',
      'C#5:1 A4:1 R:2',
      'B4:1 A4:0.5 F#4:0.5 R:2',
      'E4:1 F#4:1 R:2',
      'G4:1 F#4:1 E4:1 R:1',
      'E4:1 C#4:1 R:2',
      'D4:1 F#4:1 E4:1 R:1',
      'D4:2 R:2',
    ],
  },
  boardwalk: {
    name: 'Ночной променад',
    bpm: 88,
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
      'E4:1 G4:0.5 A4:0.5 R:2',
      'G4:1 E4:1 R:2',
      'F4:1 E4:0.5 D4:0.5 R:2',
      'D4:1 R:3',
      'E4:1 G4:0.5 A4:0.5 R:2',
      'C5:1 G4:1 R:2',
      'A4:1 G4:0.5 F4:0.5 R:2',
      'R:4',
      'E4:1 G4:0.5 A4:0.5 R:2',
      'B4:1 G4:1 R:2',
      'A4:1 G4:1 E4:1 R:1',
      'F4:1 E4:0.5 D4:0.5 R:2',
      'A4:1 G4:1 E4:1 R:1',
      'D4:1 G4:1 R:2',
      'E4:1 D4:1 C4:1 R:1',
      'C4:2 R:2',
    ],
  },
  ocean: {
    name: 'Окна над океаном',
    bpm: 78,
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
      'E4:1 A4:1 B4:1 R:1',
      'A4:1 E4:1 R:2',
      'F4:1 E4:0.5 D4:0.5 R:2',
      'G4:1 R:3',
      'E4:1 G4:1 B4:1 R:1',
      'G4:1 E4:1 R:2',
      'A4:1 G4:0.5 E4:0.5 R:2',
      'R:4',
      'E4:1 A4:1 B4:1 R:1',
      'D5:1 B4:1 R:2',
      'C5:1 A4:1 G4:1 R:1',
      'E4:1 G4:1 R:2',
      'F4:1 E4:1 D4:1 R:1',
      'E4:1 B4:1 R:2',
      'A4:1 G4:1 E4:1 R:1',
      'A4:2 R:2',
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
        level: 0.048,
      });
    beat += duration;
  }
  // Two quiet harmony notes and one bass pluck leave the lead and ball audible.
  for (const note of [chord[1], chord[2]])
    events.push({ beat: 0, duration: 2.8, note, voice: 'pad', level: 0.012 });
  const bassRoot = chord[0] < 48 ? chord[0] : chord[0] - 12;
  events.push({ beat: 0, duration: 1.3, note: bassRoot, voice: 'bass', level: 0.035 });
  if (bar % 4 === 2)
    events.push({ beat: 2.5, duration: 0.6, note: chord[2], voice: 'bell', level: 0.012 });
  return events;
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
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain(),
      filter = ctx.createBiquadFilter();
    oscillator.type = ['lead', 'bass'].includes(event.voice) ? 'triangle' : 'sine';
    oscillator.frequency.value = 440 * 2 ** ((event.note - 69) / 12);
    filter.type = 'lowpass';
    filter.frequency.value = event.voice === 'lead' ? 1450 : event.voice === 'bell' ? 1600 : 850;
    filter.Q.value = 0.3;
    gain.gain.setValueAtTime(0, start);
    const level = event.level * (event.voice === 'lead' ? 0.65 : event.voice === 'bell' ? 0.5 : 1);
    gain.gain.linearRampToValueAtTime(level, start + (event.voice === 'pad' ? 0.22 : 0.018));
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
