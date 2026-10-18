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
    age < 1.2
      ? Math.sin(age * 22) *
        Math.exp(-age * 4.5) *
        Math.min(3.5, impact.speed * 0.28) *
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
    for (const column of [-2, 2]) pixels.push([x + column + offset, y, 2, 2]);
    if ((y - top) % 12 === 0) pixels.push([x - 2 + offset, y, 6, 2]);
  }
  return pixels;
}
