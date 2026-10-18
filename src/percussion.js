// Procedural console percussion: FM drums and quantized, clocked noise. No samples.
export const DRUMS = ['kick', 'snare', 'hat', 'openhat', 'clap', 'tom'];
export function synthDrum(ctx, kind) {
  const duration = { kick: 0.31, snare: 0.23, hat: 0.065, openhat: 0.25, clap: 0.22, tom: 0.23 }[
    kind
  ];
  if (!duration) throw new Error('Unknown percussion voice');
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate),
    data = buffer.getChannelData(0);
  let seed = 1977,
    phase = 0,
    previousNoise = 0,
    sample = 0;
  const clock = Math.min(22050, ctx.sampleRate);
  for (let i = 0; i < data.length; i++) {
    // A clocked DAC and 8-bit amplitude steps give the attack a small pixel edge.
    if (
      i === 0 ||
      Math.floor((i * clock) / ctx.sampleRate) !== Math.floor(((i - 1) * clock) / ctx.sampleRate)
    ) {
      const t = i / ctx.sampleRate;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2147483648 - 1,
        high = (noise - previousNoise) * 0.5;
      previousNoise = noise;
      if (kind === 'kick') {
        phase += (48 + 140 * Math.exp(-t * 45)) / clock;
        sample =
          (Math.sin(phase * 2 * Math.PI + Math.sin(phase * 4 * Math.PI) * Math.exp(-t * 40) * 0.7) *
            Math.exp(-t * 16) +
            high * Math.exp(-t * 220) * 0.1) *
          0.88;
      } else if (kind === 'tom') {
        phase += (90 + 110 * Math.exp(-t * 24)) / clock;
        sample =
          Math.sin(phase * 2 * Math.PI + Math.sin(phase * 6 * Math.PI) * 0.8 * Math.exp(-t * 20)) *
          Math.exp(-t * 15) *
          0.85;
      } else if (kind === 'snare') {
        sample =
          (high * 0.85 +
            Math.sin(t * 2 * Math.PI * 185) * 0.24 +
            Math.sin(t * 2 * Math.PI * 335) * 0.1) *
          Math.exp(-t * 22);
      } else if (kind === 'clap') {
        const bursts = [0, 0.013, 0.027, 0.043].reduce(
          (sum, at) => sum + (t >= at ? Math.exp(-(t - at) * 90) : 0),
          0,
        );
        sample = high * (bursts * 0.35 + Math.exp(-t * 22) * 0.2);
      } else {
        const metal =
          [1889, 2633, 3419].reduce(
            (sum, f) => sum + (Math.sin(t * 2 * Math.PI * f) > 0 ? 1 : -1),
            0,
          ) / 3;
        sample = (high * 0.65 + metal * 0.22) * Math.exp(-t * (kind === 'hat' ? 75 : 20));
      }
      sample = Math.round(Math.max(-0.95, Math.min(0.95, sample)) * 127) / 127;
    }
    const t = i / ctx.sampleRate;
    data[i] = sample * Math.min(1, t / 0.001) * Math.min(1, (duration - t) / 0.012);
  }
  return buffer;
}
export function percussionBar(id, index) {
  const section = index % 32;
  let layer = index < 2 ? 0 : index < 4 ? 1 : index < 6 ? 2 : index < 8 ? 3 : 4;
  if (index >= 24 && section >= 24 && section < 30) layer = section < 26 ? 1 : section < 28 ? 2 : 3;
  const events = [],
    add = (drum, beat, level, duration = 0.2) => events.push({ drum, beat, level, duration });
  if (layer >= 1) {
    const kicks = id === 'boardwalk' ? [0, 1.5, 2.75] : id === 'ocean' ? [0, 2.5] : [0, 2];
    kicks.forEach((beat) => add('kick', beat, 0.12));
    if (layer >= 4) add('kick', id === 'ocean' ? 3.25 : 3.5, 0.085);
  }
  if (layer >= 2)
    (id === 'ocean' && index < 8 ? [3] : [1, 3]).forEach((beat) => add('snare', beat, 0.095));
  if (layer >= 3)
    for (let step = 0; step < 8; step++) {
      const beat = step / 2;
      if (layer >= 4 && step === 7) add('openhat', beat, 0.035);
      else add('hat', beat, step % 2 ? 0.042 : 0.025);
    }
  if (layer >= 4) {
    add('clap', 3, 0.032);
    if (id === 'boardwalk') add('hat', 2.75, 0.022);
    if (index % 8 === 7) {
      [3.25, 3.5, 3.75].forEach((beat, i) =>
        add(i === 2 ? 'snare' : 'tom', beat, 0.055 + i * 0.012),
      );
    }
  }
  return events;
}
