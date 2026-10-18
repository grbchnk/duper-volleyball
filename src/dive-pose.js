import { playerFrame } from './sprites.js';
import { clamp } from './physics.js';
import { netSeparates } from './receive-pose.js';
import { constrainWorldHand } from './net-reach.js';

// One bounded palm target for both drawing and contact detection.
export function diveHands(player, ball, config) {
  const frame = playerFrame(player, { time: 0 });
  const tilt = frame.pose.tilt;
  const direction = Math.sign(player.diveVelocity) || player.facing || 1;
  const shoulder = {
    x:
      player.x +
      (direction * (-3 * Math.sin(tilt) + (20 - frame.pose.y) * Math.sin(tilt)) * 2.1) / 40,
    y: player.y - ((-5 * Math.sin(tilt) + (frame.pose.y - 20) * Math.cos(tilt)) * 2.1) / 42,
  };
  if (netSeparates(player, ball)) {
    const x = shoulder.x + direction * 0.45;
    return {
      x: player.x < 0 ? Math.min(-0.04, x) : Math.max(0.04, x),
      y: Math.max(0.15, shoulder.y - 0.2),
    };
  }
  const dx = direction * (ball.x - shoulder.x);
  const dy = ball.y - shoulder.y;
  const angle = clamp(Math.atan2(dy, Math.max(0.05, dx)), -0.9, 0.65);
  const reach = clamp(Math.hypot(dx, dy), 0.45, 1.25 * config.armScale);
  return constrainWorldHand(
    {
      x: shoulder.x + direction * Math.cos(angle) * reach,
      y: Math.max(0.15, shoulder.y + Math.sin(angle) * reach),
    },
    player,
    ball,
  );
}
