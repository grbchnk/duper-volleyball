import { pixelPresent } from './display.js';
import { drawArenaBackdrop } from './arenas.js';
export function createAmbient(canvas, arena) {
  canvas.width = 960;
  canvas.height = 540;
  const c = canvas.getContext('2d');
  const backdrop = document.createElement('canvas');
  backdrop.width = 960;
  backdrop.height = 540;
  let theme = null;
  let last = -1,
    stamp = null;
  return (match, teams) => {
    const time = match.config.livelyBackground ? match.time : 0;
    const nextStamp = [
      match.config.arenaTheme,
      match.config.pixelGraphics,
      match.config.livelyBackground,
      match.phase,
      match.pointWinner,
      ...teams.map((t) => t.color),
    ].join('|');
    if (stamp === nextStamp && time >= last && time - last < 1 / 20) return;
    stamp = nextStamp;
    last = time;
    if (theme !== match.config.arenaTheme) {
      theme = match.config.arenaTheme;
      drawArenaBackdrop(backdrop.getContext('2d'), theme);
    }
    c.drawImage(backdrop, 0, 0);
    if (match.config.livelyBackground && ['point', 'set-end', 'finished'].includes(match.phase))
      for (let i = 0; i < 45; i++) {
        c.fillStyle = i % 2 ? teams[match.pointWinner ?? 0].color : '#fff2bb';
        c.fillRect((i * 137 + Math.sin(time * 2 + i) * 20) % 960, (i * 31 + time * 65) % 540, 4, 7);
      }
    pixelPresent(canvas, match.config.pixelGraphics);
    const a = arena.getContext('2d');
    a.imageSmoothingEnabled = false;
    a.drawImage(canvas, 0, 0);
    arena.style.imageRendering = 'pixelated';
  };
}
