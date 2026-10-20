import { projectCourt } from './court-visual.js';

// The scoreboard covers the top 58 pixels; its lower edge is the playfield ceiling.
export const CEILING_Y = 58;
export const ballAboveCeiling = (ball) => projectCourt(ball.x, ball.y).y < CEILING_Y;
export function ballShadowOpacity(ball) {
  const y = projectCourt(ball.x, ball.y).y;
  const t = Math.max(0, Math.min(1, (y - CEILING_Y - 18) / 260));
  return t * t * (3 - 2 * t);
}

export class CeilingVFX {
  constructor() {
    this.previous = null;
    this.bursts = [];
    this.seed = 0x6ce17;
  }
  random() {
    // Isolated visual randomness cannot change gameplay's random sequence.
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  update(m) {
    const p = projectCourt(m.ball.x, m.ball.y);
    const previous = this.previous;
    this.previous = { ...p, time: m.time, ball: m.ball, match: m, phase: m.phase };
    const flying = ['rally', 'serve-motion'].includes(m.phase) && !m.tutorialNoBall;
    if (
      !flying ||
      !previous ||
      previous.match !== m ||
      previous.ball !== m.ball ||
      !['rally', 'serve-motion'].includes(previous.phase) ||
      m.time < previous.time ||
      m.time - previous.time > 0.25
    ) {
      this.bursts = [];
      return null;
    }
    if (previous.y < CEILING_Y === p.y < CEILING_Y) return null;
    const t = (CEILING_Y - previous.y) / (p.y - previous.y);
    const x = previous.x + (p.x - previous.x) * t;
    if (x < -20 || x > 980) return null;
    const entering = p.y > previous.y;
    const pieces = Array.from({ length: 28 }, (_, i) => {
      const angle = this.random() * Math.PI;
      const speed = 45 + this.random() * 145;
      return {
        x: x + (this.random() - 0.5) * 34,
        y: CEILING_Y + this.random() * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * (entering ? 1 : 0.65),
        size: i < 11 ? 4 + this.random() * 7 : 1 + this.random() * 3,
        angle,
        spin: (this.random() - 0.5) * 12,
        color: ['#fff2d5', '#b69e88', '#70675f', '#d5c5ac'][i % 4],
      };
    });
    this.bursts.push({ x, age: 0, pieces });
    return { type: 'ceiling-break', entering, speed: Math.hypot(m.ball.vx, m.ball.vy) };
  }
  draw(c, dt) {
    this.bursts = this.bursts.filter((b) => b.age < 1.05);
    c.save();
    c.beginPath();
    c.rect(0, CEILING_Y, 960, 540 - CEILING_Y);
    c.clip();
    for (const b of this.bursts) {
      b.age += dt;
      const fade = Math.max(0, 1 - b.age / 0.48);
      if (fade > 0) {
        c.globalAlpha = fade;
        c.fillStyle = '#393430';
        c.beginPath();
        c.moveTo(b.x - 32, CEILING_Y);
        for (let i = 0; i <= 8; i++)
          c.lineTo(b.x - 32 + i * 8, CEILING_Y + [3, 9, 4, 15, 8, 13, 3, 8, 2][i]);
        c.lineTo(b.x + 32, CEILING_Y);
        c.fill();
        c.globalAlpha = fade * 0.35;
        c.fillStyle = '#f5e4c8';
        c.beginPath();
        c.ellipse(b.x, CEILING_Y + b.age * 48, 24 + b.age * 70, 9 + b.age * 38, 0, 0, Math.PI * 2);
        c.fill();
      }
      for (const p of b.pieces) {
        p.vy += 320 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        c.save();
        c.globalAlpha = Math.max(0, Math.min(1, (1.05 - b.age) / 0.55));
        c.translate(p.x, p.y);
        c.rotate(p.angle);
        c.fillStyle = p.color;
        c.beginPath();
        c.moveTo(-p.size, -p.size * 0.4);
        c.lineTo(p.size * 0.5, -p.size * 0.65);
        c.lineTo(p.size, p.size * 0.4);
        c.lineTo(-p.size * 0.5, p.size * 0.7);
        c.fill();
        c.restore();
      }
    }
    c.restore();
  }
}
