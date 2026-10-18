// Soft, rounded console pulses. Power controls both the ascent and the pulse rate.
export function chargePulse(power, index) {
  const p = Math.max(0, Math.min(1, power));
  const motif = [0, 2, 4, 7, 9, 12, 14, 16];
  const semitones = motif[Math.min(index, motif.length - 1)] + p * 3;
  const interval = 0.145 - 0.097 * p;
  return {
    frequency: 220 * 2 ** (semitones / 12),
    interval,
    duration: interval * 0.62,
    volume: 0.018 + p * 0.004,
  };
}
// A pea whistle: two resonances, a breath envelope and flutter, all computed as PCM.
export function refereeWhistle(ctx) {
  const duration = 1.15,
    rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.ceil(duration * rate), rate),
    data = buffer.getChannelData(0);
  let phase = 0,
    other = 0,
    seed = 541;
  for (let i = 0; i < data.length; i++) {
    const t = i / rate,
      attack = Math.min(1, t / 0.045),
      release = Math.min(1, (duration - t) / 0.19);
    const frequency =
      2480 -
      240 * Math.exp(-t * 35) -
      160 * Math.max(0, (t - 0.98) / 0.17) +
      18 * Math.sin(t * 2 * Math.PI * 5.5);
    phase += frequency / rate;
    other += (frequency * 1.227 + 9 * Math.sin(t * 2 * Math.PI * 31)) / rate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const breath = (seed / 2147483648 - 1) * 0.025;
    const flutter = 0.86 + 0.14 * Math.sin(t * 2 * Math.PI * 29);
    const sample =
      (Math.sin(phase * 2 * Math.PI) * 0.68 + Math.sin(other * 2 * Math.PI) * 0.23 + breath) *
      flutter *
      attack *
      release;
    data[i] = Math.round(sample * 2047) / 2047;
  }
  return buffer;
}
