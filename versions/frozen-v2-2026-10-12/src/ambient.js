import { pixelPresent } from './display.js';
export function createAmbient(canvas, arena) {
  canvas.width = 960;
  canvas.height = 540;
  const c = canvas.getContext('2d');
  let last = -1;
  return (match, teams) => {
    const time = match.time;
    if (time !== 0 && time - last < 1 / 20) return;
    last = time;
    c.fillStyle = '#d4e9df';
    c.fillRect(0, 0, 960, 540);
    c.fillStyle = '#f8e8b4';
    c.fillRect(780, 70, 58, 58);
    for (let i = 0; i < 7; i++) {
      const x = ((i * 173 + time * 3) % 1120) - 120,
        y = 45 + (i % 3) * 47;
      c.fillStyle = '#fbf3db';
      c.fillRect(x, y, 100, 15);
      c.fillRect(x + 18, y - 11, 54, 12);
    }
    for (let layer = 0; layer < 3; layer++) {
      c.fillStyle = ['#b8d4b8', '#93bb9c', '#759f85'][layer];
      for (let x = 0; x < 960; x += 12) {
        const y = 235 + layer * 85 + Math.sin(x / (90 + layer * 25) + layer) * 28;
        c.fillRect(x, Math.round(y), 12, 540 - y);
      }
    }
    for (let x = 9; x < 960; x += 39) {
      const y = 450 + ((x * 13) % 85);
      c.fillStyle = '#557f70';
      c.fillRect(x, y, 3, 9);
      c.fillStyle = x % 2 ? '#f8d889' : '#e9a2a4';
      c.fillRect(x - 2, y - 3, 7, 5);
    }
    if (['point', 'set-end', 'finished'].includes(match.phase)) {
      for (let i = 0; i < 45; i++) {
        c.fillStyle = i % 2 ? teams[match.pointWinner ?? 0].color : '#fff2bb';
        c.fillRect((i * 137 + Math.sin(time * 2 + i) * 20) % 960, (i * 31 + time * 65) % 540, 4, 7);
      }
    }
    pixelPresent(canvas, match.config.pixelGraphics);
    const a = arena.getContext('2d');
    a.imageSmoothingEnabled = false;
    a.drawImage(canvas, 0, 0);
    arena.style.imageRendering = 'pixelated';
  };
}
