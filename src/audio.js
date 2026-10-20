import { Music } from './music.js';
import { chargePulse, refereeWhistle } from './charge-whistle.js';
// Entirely code-generated console effects, applause and music.
export function soundCue(event) {
  if (event.type === 'combination-preview')
    return ['low', 'loft', 'drive'].flatMap((kind, i) =>
      soundCue({ type: 'hit', kind, power: 0.65, incomingSpeed: 12, comboStage: i + 1 }).map(
        (voice) => ({ ...voice, delay: voice.delay + i * 0.5 }),
      ),
    );
  const p = Math.max(0, Math.min(1, event.power ?? 0.5)),
    gain = 0.07 + p * 0.055;
  const note = (
    frequency,
    duration,
    delay = 0,
    type = 'square',
    end = frequency,
    volume = gain,
  ) => ({ frequency, duration, delay, type, end, volume });
  const whistle = [note(2480, 1.15, 0, 'referee-whistle', 2480, 0.09)];
  // A gentle C-major/add-sixth answer: encouragement, even after a lost rally.
  const encouragement = () => [
    ...[659.25, 783.99, 880, 783.99, 1046.5].map((f, i) =>
      note(f, i === 4 ? 0.42 : 0.24, [0, 0.14, 0.28, 0.44, 0.62][i], 'triangle', f, 0.035),
    ),
    ...[523.25, 659.25, 880].map((f) => note(f, 0.5, 0.62, 'sine', f, 0.012)),
  ];
  if (event.type === 'ceiling-break') {
    const impact = Math.max(0.3, Math.min(1, (event.speed ?? 12) / 24));
    return [
      note(170, 0.16, 0, 'sine', 45, 0.075 * impact),
      note(2400, 0.2, 0, 'noise', 180, 0.085 * impact),
      ...[0.055, 0.11, 0.19, 0.28].map((delay, i) =>
        note(1400 - i * 230, 0.045, delay, 'noise', 260, 0.025 * impact),
      ),
    ];
  }
  if (event.type === 'windup')
    return [note(800, 0.1, 0, 'noise', 400, 0.008), note(140, 0.1, 0, 'sine', 220, 0.009)];
  if (event.type === 'serve-hit-cue')
    return [
      note(1174.66, 0.09, 0, 'sine', 1174.66, 0.07),
      note(1761.99, 0.06, 0, 'triangle', 1761.99, 0.035),
    ];
  if (event.type === 'dive')
    return [note(1100, 0.14, 0, 'noise', 300, 0.022), note(180, 0.09, 0.07, 'triangle', 75, 0.03)];
  if (event.type === 'floor' || event.type === 'floor-touch') {
    const impact = Math.max(0, Math.min(1, (event.speed ?? 6) / 18));
    return [
      note(155 + impact * 45, 0.11 + impact * 0.035, 0, 'sine', 55, 0.035 + impact * 0.035),
      note(760, 0.025, 0, 'noise', 240, 0.008 + impact * 0.014),
      note(310, 0.065, 0.008, 'triangle', 140, 0.012),
    ];
  }
  if (event.type === 'skid')
    return [
      note(1100, 0.045, 0, 'noise', 350, 0.018),
      note(740, 0.035, 0.01, 'square', 420, 0.009),
    ];
  if (event.type === 'land') return [note(115, 0.055, 0, 'triangle', 65, 0.018)];
  if (event.type === 'head-hit')
    return event.flyingHead
      ? [
          note(220, 0.14, 0, 'square', 740, 0.035),
          note(1046.5, 0.09, 0.09, 'triangle', 523.25, 0.025),
        ]
      : [note(180, 0.09, 0, 'triangle', 65, 0.035), note(880, 0.1, 0.03, 'square', 440, 0.015)];
  if (event.type === 'applause') return [note(1000, 1.4, 0, 'applause', 1000, 0.2)];
  if (event.type === 'charge-preview') return [note(220, 1.2, 0, 'triangle', 660, 0.022)];
  if (event.type === 'whistle') return whistle;
  if (event.type === 'stage-start')
    return [523, 659, 784, event.final ? 1047 : 880].map((f, i) =>
      note(f, 0.12, i * 0.1, 'triangle', f, 0.04),
    );
  if (event.type === 'hit') {
    // Incoming energy describes the catch; charge describes the outgoing shot.
    const impact = Math.max(0, Math.min(1, (event.incomingSpeed ?? p * 14) / 20));
    const cue =
      event.kind === 'loft' || event.kind === 'back'
        ? [
            note(330 + p * 80, 0.095, 0, 'triangle', 590 + p * 100, 0.045),
            note(783.99, 0.13, 0.025, 'sine', 783.99, 0.025),
            note(1200, 0.018, 0, 'noise', 500, 0.006 + impact * 0.012),
          ]
        : event.kind === 'low'
          ? [
              note(
                205 + impact * 110,
                0.09 + impact * 0.04,
                0,
                'triangle',
                110,
                0.04 + impact * 0.04,
              ),
              note(
                950 + impact * 700,
                0.018 + impact * 0.02,
                0,
                'noise',
                260,
                0.009 + impact * 0.025,
              ),
              note(523.25, 0.115, 0.012, 'sine', 523.25, 0.024),
            ]
          : [
              note(310 + p * 200, 0.085, 0, 'triangle', 70, 0.065 + p * 0.035),
              note(1800, 0.03 + p * 0.018, 0, 'noise', 200, 0.025 + p * 0.035),
              note(155, 0.09, 0.005, 'sine', 65, 0.035 + p * 0.02),
            ];
    if (event.serve) cue.push(note(880, 0.04, 0.06, 'triangle', 440, 0.035));
    if (event.intent === 'soft') for (const voice of cue) voice.volume *= 0.7;
    if (!event.serve && event.comboStage > 0) {
      const melody = [523.25, 659.25, 783.99][event.comboStage - 1];
      if (melody) cue.push(note(melody, 0.18, 0.018, 'triangle', melody, 0.038));
      if (event.comboStage === 3) {
        cue.push(note(1046.5, 0.22, 0.085, 'triangle', 1046.5, 0.028));
        cue.push(note(659.25, 0.2, 0.085, 'sine', 659.25, 0.016));
      }
    }
    return cue;
  }
  if (event.type === 'block')
    return [note(240, 0.09, 0, 'square', 110), note(1000, 0.035, 0, 'noise', 300, 0.05)];
  if (event.type === 'net') return [note(85, 0.11, 0, 'triangle', 45, 0.07)];
  if (event.type === 'jump') return [note(150, 0.055, 0, 'square', 310, 0.025)];
  if (event.type === 'toss' || event.type === 'feed')
    return [note(660, 0.035, 0, 'triangle', 880, 0.035)];
  if (event.type === 'loss-preview' || event.type === 'test-miss') return encouragement();
  if (event.type === 'serve-ready') return whistle;
  if (event.type === 'point' && event.winner !== 0) return encouragement();
  if (event.type === 'point')
    return [
      ...(event.matchWon ? [523, 659, 784, 1047, 1318] : [523, 659, 784]).map((f, i) =>
        note(f, 0.09 + i * 0.025, i * 0.095, 'square', f, 0.055),
      ),
    ];
  if (event.type === 'challenge-result' && !event.hit) return encouragement();
  if (event.type === 'challenge-result')
    return (event.bullseye ? [660, 880, 1320] : [660, 990]).map((f, i) =>
      note(f, 0.08, i * 0.075, 'triangle', f, 0.065),
    );
  if (event.type === 'challenge-feed') return [note(480, 0.04, 0, 'triangle', 660, 0.03)];
  return [];
}
export class Sound {
  constructor() {
    this.enabled = false;
    this.muted = false;
    this.context = null;
    this.master = null;
    this.chargeTone = null;
    this.music = null;
    this.chargePreviewUntil = 0;
    this.pendingServeCue = null;
  }
  get ready() {
    return this.enabled && !this.muted && this.context?.state === 'running';
  }
  async enable() {
    this.context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.context.destination);
      this.context.onstatechange = () => {
        if (this.context.state !== 'running') this.updateCharge(null);
        this.onStatus?.();
      };
    }
    this.muted = false;
    await this.context.resume();
    this.enabled = true;
    if (!this.muted) this.master.gain.setValueAtTime(0.8, this.context.currentTime);
    const pendingServeCue = this.pendingServeCue;
    this.pendingServeCue = null;
    if (pendingServeCue && Date.now() - pendingServeCue < 1500) {
      this.play({ type: 'serve-ready' });
    }
    this.onStatus?.();
  }
  disable() {
    this.enabled = false;
    this.muted = true;
    this.chargePreviewUntil = 0;
    this.pendingServeCue = null;
    this.updateCharge(null);
    this.music?.stop();
    if (this.master) this.master.gain.setValueAtTime(0, this.context.currentTime);
    this.onStatus?.();
  }
  updateCharge(power) {
    if (power === null && this.ready && this.context.currentTime < this.chargePreviewUntil)
      power = 1 - (this.chargePreviewUntil - this.context.currentTime) / 1.2;
    if (power === null || !this.ready) {
      if (this.chargeTone) {
        const { oscillator, gain } = this.chargeTone,
          now = this.context.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, 0.035);
        oscillator.stop(now + 0.18);
        this.chargeTone = null;
      }
      return;
    }
    const ctx = this.context,
      now = ctx.currentTime;
    if (!this.chargeTone) {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain(),
        filter = ctx.createBiquadFilter();
      oscillator.type = 'triangle';
      oscillator.frequency.value = 220;
      filter.type = 'lowpass';
      filter.frequency.value = 1150;
      filter.Q.value = 0.4;
      gain.gain.value = 0;
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      oscillator.start();
      oscillator.onended = () => {
        oscillator.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      this.chargeTone = { oscillator, gain, next: now + 0.006, index: 0 };
    }
    const p = Math.max(0, Math.min(1, power));
    const tone = this.chargeTone;
    if (tone.next > now + 0.025) return;
    const pulse = chargePulse(p, tone.index++),
      start = Math.max(now + 0.006, tone.next);
    tone.oscillator.frequency.setTargetAtTime(pulse.frequency, start, 0.012);
    tone.gain.gain.cancelScheduledValues(start);
    tone.gain.gain.setValueAtTime(0, start);
    tone.gain.gain.linearRampToValueAtTime(pulse.volume, start + 0.009);
    tone.gain.gain.linearRampToValueAtTime(0, start + pulse.duration);
    tone.next = start + pulse.interval;
  }
  updateMusic(config, active = true, quiet = false) {
    if (!this.ready || !active) {
      this.music?.stop();
      return;
    }
    this.music ||= new Music(this.context, this.master);
    this.music.update(config.musicTrack, config.musicVolume * (quiet ? 0.5 : 1), true);
  }
  play(event) {
    if (!this.ready) {
      if (!this.muted && event.type === 'serve-ready') this.pendingServeCue = Date.now();
      return;
    }
    const ctx = this.context,
      now = ctx.currentTime;
    if (event.type === 'charge-preview') {
      this.chargePreviewUntil = now + 1.2;
      this.updateCharge(0);
      return;
    }
    if (event.type === 'point' && event.winner === 0) this.play({ type: 'applause' });
    for (const n of soundCue(event)) {
      const start = now + n.delay,
        g = ctx.createGain();
      let source;
      if (n.type === 'referee-whistle') {
        source = ctx.createBufferSource();
        this.whistleBuffer ||= refereeWhistle(ctx);
        source.buffer = this.whistleBuffer;
      } else if (n.type === 'noise' || n.type === 'applause') {
        const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * n.duration), ctx.sampleRate),
          data = buffer.getChannelData(0);
        let seed = 731,
          value = 0;
        for (let i = 0; i < data.length; i++) {
          if (i % 8 === 0) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            value = seed / 2147483648 - 1;
          }
          data[i] = value;
        }
        if (n.type === 'applause') {
          data.fill(0);
          // Many short, staggered handclaps, with a gentle tail and no sharp full-scale clicks.
          for (let clap = 0; clap < 65; clap++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const at = Math.floor((seed / 4294967296) * (n.duration - 0.09) * ctx.sampleRate);
            const strength = 0.16 + (1 - at / data.length) * 0.23;
            for (let j = 0; j < ctx.sampleRate * 0.07 && at + j < data.length; j++) {
              seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
              const t = j / ctx.sampleRate;
              data[at + j] +=
                (seed / 2147483648 - 1) * strength * Math.min(1, t / 0.0015) * Math.exp(-t * 85);
            }
          }
        }
        source = ctx.createBufferSource();
        source.buffer = buffer;
      } else {
        source = ctx.createOscillator();
        source.type = n.type;
        source.frequency.setValueAtTime(n.frequency, start);
        // Discrete pitch steps give the descending attacks a small 8-bit crunch.
        for (let i = 1; i <= 5; i++)
          source.frequency.setValueAtTime(
            n.frequency * (n.end / n.frequency) ** (i / 5),
            start + (n.duration * i) / 5,
          );
      }
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(n.volume, start + 0.003);
      if (n.type === 'applause' || n.type === 'referee-whistle') {
        g.gain.setValueAtTime(n.volume, start + n.duration * 0.7);
        g.gain.linearRampToValueAtTime(0, start + n.duration);
      } else g.gain.exponentialRampToValueAtTime(0.0001, start + n.duration);
      source.connect(g);
      g.connect(this.master);
      source.start(start);
      source.stop(start + n.duration + 0.01);
      source.onended = () => {
        source.disconnect();
        g.disconnect();
      };
    }
  }
}
