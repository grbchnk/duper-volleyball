// Render-only state: replay snapshots copy impact objects, and a new match rewinds time.
// Neither should restart an old impact or amplify a negative-age ripple.
export function netVisual(previous, hit, time) {
  let impact = previous?.impact ?? null;
  if (!hit || !Number.isFinite(time) || (previous && time < previous.time)) impact = null;
  if (hit && Number.isFinite(time) && (!impact || impact.serial !== hit.serial))
    impact = {
      serial: hit.serial,
      at: time,
      speed: Number.isFinite(hit.speed) ? Math.max(0, hit.speed) : 0,
      direction: hit.direction < 0 ? -1 : 1,
    };
  const age = impact ? Math.max(0, time - impact.at) : Infinity;
  const wave =
    age < 2.2
      ? (Math.sin(age * 16) + Math.sin(age * 29) * 0.18) *
        Math.exp(-age * 2.6) *
        Math.min(11, impact.speed * 0.8) *
        impact.direction
      : 0;
  return { time, impact, wave };
}

// A deforming mesh made exclusively of 2 px blocks, regardless of the scene smoothing mode.
export function netMesh(wave, top, bottom = 462, x = 480) {
  top = Math.round(top / 2) * 2;
  const pixels = [];
  for (let y = top + 4; y < bottom; y += 2) {
    const offset = Math.round((wave * Math.sin(((y - top) / (bottom - top)) * Math.PI)) / 2) * 2;
    const phase = ((y - top) % 16) / 8;
    const spread = Math.round((phase <= 1 ? phase : 2 - phase) * 3) * 2;
    pixels.push([x - spread + offset, y, 2, 2]);
    if (spread) pixels.push([x + spread + offset, y, 2, 2]);
  }
  return pixels;
}

export function diamondMesh(columns = 8, rows = 8) {
  const segments = [];
  for (let x = 0; x < columns; x++)
    for (let y = 0; y < rows; y++) {
      const points = [
        [x + 0.5, y],
        [x + 1, y + 0.5],
        [x + 0.5, y + 1],
        [x, y + 0.5],
      ];
      for (let i = 0; i < 4; i++)
        segments.push(
          [points[i], points[(i + 1) % 4]].map(([u, v]) => ({ u: u / columns, v: v / rows })),
        );
    }
  return segments;
}
