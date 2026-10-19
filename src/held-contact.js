import { expressivePose } from './arm-motion.js';
import { ARM_STYLES } from './arms.js';
import { playerFrame } from './sprites.js';
import { localReceiveAim } from './receive-pose.js';
import { constrainWorldHand } from './net-reach.js';
import { bodyOffset } from './movement-feel.js';

// Logical palm locations use the same prepared pose and projection as the match renderer.
export function preparedHands(
  p,
  m,
  a = m.actionForPlayer?.(p) || m.actionFor?.(p.team) || m.charge,
) {
  if (!a || a.playerId !== p.id) return [];
  const config = { ...m.config, armScale: 1, armLength: 1, armPowerMotion: 1, armJumpMotion: 1 };
  const frame = playerFrame(p, m),
    pose = expressivePose({
      spec: ARM_STYLES.whip,
      config,
      kind: a.kind,
      charge: a,
      receiveAim: localReceiveAim(p, a, m.ball, frame, config),
      actionDirection:
        Math.sign(
          a.aim?.vector?.x || a.aim?.axis || (p.team === 0 ? 1 : -1) * (a.kind === 'back' ? -1 : 1),
        ) / (p.facing || 1),
      shoulderLift: frame.pose.shoulders || 0,
      jump: p.jumpProfile ? { profile: p.jumpProfile, time: p.jumpTime } : null,
    });
  const dir = p.facing || (p.team === 0 ? 1 : -1);
  const motion = bodyOffset(p);
  return pose.activeHands
    .map((index) => pose.wrists[index])
    .map((w) =>
      constrainWorldHand(
        {
          x: p.x + ((dir * w.x + motion.torso) * 2.1) / 40,
          y: p.y - ((w.y + frame.pose.y + motion.drop) * 2.1) / 42,
        },
        p,
        m.ball,
      ),
    );
}
export function ballTouchesHands(ball, previous, hands, radius) {
  const dx = ball.x - previous.x,
    dy = ball.y - previous.y,
    len = dx * dx + dy * dy;
  return hands.some((h) => {
    const t = len
      ? Math.max(0, Math.min(1, ((h.x - previous.x) * dx + (h.y - previous.y) * dy) / len))
      : 0;
    return Math.hypot(previous.x + t * dx - h.x, previous.y + t * dy - h.y) <= radius;
  });
}
