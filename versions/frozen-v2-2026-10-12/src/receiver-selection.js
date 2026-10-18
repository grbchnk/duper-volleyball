import { traceBall } from './physics.js';
import { shotSettings } from './shot-settings.js';
import { sampleJump } from './motion.js';

// Keep manual control while interception is feasible; hand off only a lost ball.
export function nextReceiver(match, team) {
  const { ball, config } = match;
  if (match.phase !== 'rally' || (ball.x < 0 ? 0 : 1) !== team) return null;
  const current = match.active(team);
  // Do not steal a just-started manual jump while the ball is still approaching.
  if (current.jumpProfile && current.jumpTime < 0.15 && (ball.x - current.x) * ball.vx <= 0)
    return current.id;
  if (match.incomingShot === 'serve' && match.lastTouch === team && ball.vx * match.sign(team) < 0)
    return null;
  const path = traceBall(ball, config, 3 / config.ballSpeed);
  const candidates = [];
  for (const p of match.players) {
    if (
      p.team !== team ||
      p.recovery > 0 ||
      p.diving ||
      p.block > 0 ||
      (match.lastTouch === team && match.lastPlayer === p.id)
    )
      continue;
    for (let i = 0; i < path.length; i += 3) {
      const b = path[i],
        time = i / 120;
      if ((b.x < 0 ? 0 : 1) !== team || b.y <= 0.12) continue;
      const height = p.jumpProfile
        ? sampleJump(p.jumpProfile, p.jumpTime + time).y
        : Math.max(0, p.y + p.vy * time - (config.gravity * time * time) / 2);
      const reachable = ['low', 'back', 'loft', 'drive'].some((kind) => {
        const shot = shotSettings(config, kind);
        const offset = height <= 0 ? (p.crouchAmount || 0) * 0.4 : 0;
        const speed = p.jumpProfile ? config.airMoveSpeed : config.playerSpeed;
        return (
          b.y >= height + shot.ContactMin - offset &&
          b.y <= height + shot.ContactMax - offset &&
          Math.abs(b.x - p.x) <= shot.Reach + speed * time
        );
      });
      if (reachable) {
        candidates.push({ id: p.id, time });
        break;
      }
    }
  }
  if (candidates.some((p) => p.id === match.selected[team])) return match.selected[team];
  candidates.sort((a, b) => a.time - b.time);
  return candidates[0]?.id ?? null;
}
