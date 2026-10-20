import { clamp } from './physics.js';

// Purely visual, deterministic flames: no gameplay RNG, particle emitters or timers.
// The local +x axis points into the flight; the plume streams back along -x.
export function drawFlame(c, x, y, angle, size, time) {
  if (size <= 0) return;
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(size, size);
  const opacity = c.globalAlpha;
  const glow = c.createRadialGradient(-0.4, 0, 0, -0.4, 0, 2.5);
  glow.addColorStop(0, '#ffb64e70');
  glow.addColorStop(1, '#f05b1600');
  c.fillStyle = glow;
  c.fillRect(-3, -2.5, 6, 5);
  for (let i = 0; i < 5; i++) {
    const wave = Math.sin(time * 19 + i * 2.3);
    const offset = (i - 2) * 0.26;
    const length = 2.8 + 0.8 * Math.sin(time * 26 - i * 1.7) + (i === 2 ? 1 : 0);
    c.fillStyle = i % 2 ? '#ff8d28b0' : '#ed4d21a0';
    c.beginPath();
    c.moveTo(0.55, offset - 0.48);
    c.bezierCurveTo(
      -0.9,
      offset - 0.9,
      -length * 0.55,
      offset + wave * 0.7,
      -length,
      offset + wave * 0.5,
    );
    c.bezierCurveTo(-length * 0.45, offset + 0.25, -0.6, offset + 0.8, 0.55, offset + 0.48);
    c.closePath();
    c.fill();
  }
  c.fillStyle = '#ffdc79e0';
  c.beginPath();
  c.moveTo(0.6, -0.45);
  c.quadraticCurveTo(-0.8, -0.8, -2.5, Math.sin(time * 29) * 0.22);
  c.quadraticCurveTo(-0.7, 0.8, 0.6, 0.45);
  c.fill();
  for (let i = 0; i < 3; i++) {
    const age = (time * 1.9 + i / 3) % 1;
    c.globalAlpha = opacity * (1 - age) * 0.65;
    c.fillStyle = '#ffd981';
    c.fillRect(-1.2 - age * 4.5, Math.sin(i * 4 + time * 2) * age * 1.4, 0.18, 0.18);
  }
  c.restore();
}

export function contactAccent(event, config) {
  if (event.type !== 'hit' || event.legal === false) return null;
  if (event.kind === 'low' && event.incomingOpponent && event.incomingSpeed >= config.fireSpeed)
    return {
      kind: 'rescue',
      duration: 0.28,
      strength: clamp(event.incomingSpeed / config.fireSpeed, 1, 1.6),
      angle: Math.atan2(event.incomingVelocity?.y || 0, -(event.incomingVelocity?.x || 0)),
      hot: event.incomingBurning,
    };
  if (event.kind === 'drive' && event.modifier === 'fast' && event.power >= 0.75)
    return {
      kind: 'slash',
      duration: 0.19,
      strength: 1,
      angle: Math.atan2(-(event.outgoingVelocity?.y || 0), event.outgoingVelocity?.x || 1),
      hot: true,
    };
  return null;
}

export function drawContactAccent(c, effect) {
  const t = clamp(1 - effect.life / effect.duration, 0, 1);
  c.save();
  c.translate(effect.x, effect.y);
  c.rotate(effect.angle);
  c.globalAlpha = (1 - t) ** 1.3;
  c.lineCap = 'round';
  if (effect.kind === 'rescue') {
    // An expanding bow facing the incoming ball, with a smaller echo at the wrists.
    for (let i = 0; i < 2; i++) {
      const radius = (12 + t * 32 - i * 7) * effect.strength;
      c.strokeStyle = i ? '#fff4cc' : effect.hot ? '#ffbb6c' : '#c4f4ff';
      c.lineWidth = i ? 1.2 : 2.4 * (1 - t) + 0.5;
      c.beginPath();
      c.ellipse(0, 0, radius * 0.55, radius, 0, -1.1, 1.1);
      c.stroke();
    }
  } else {
    // A tapered curved slash behind the contact, pointing into the outgoing flight.
    c.fillStyle = '#ffbf6680';
    c.beginPath();
    c.moveTo(17 + t * 12, -6);
    c.quadraticCurveTo(-21, -43, -57 - t * 13, 20);
    c.quadraticCurveTo(-15, -20, 17 + t * 12, -6);
    c.fill();
    c.strokeStyle = '#fff2c6';
    c.lineWidth = 2 * (1 - t) + 0.4;
    c.beginPath();
    c.moveTo(-48 - t * 12, 14);
    c.quadraticCurveTo(-16, -24, 14 + t * 12, -6);
    c.stroke();
  }
  c.restore();
}
