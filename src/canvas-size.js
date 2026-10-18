export function gameCanvasSize(fullscreen, width, height, pixelRatio = 1) {
  if (!fullscreen) return { width: 960, height: 540 };
  const scale = Math.min(width / 960, height / 540) * Math.max(1, pixelRatio);
  return {
    width: Math.max(1, Math.round(960 * scale)),
    height: Math.max(1, Math.round(540 * scale)),
  };
}
