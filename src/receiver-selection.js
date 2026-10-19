import { traceBall } from './physics.js';
import { shotSettings } from './shot-settings.js';
import { sampleJump } from './motion.js';

// Keep manual control while interception is feasible; hand off only a lost ball.
export function nextReceiver(
  match,
  team,
  {
    exclude = [],
    currentId = match.selected[team],
    keepReachable = false,
    preferCurrent = false,
    rescueOnly = false,
  } = {},
) {
  const { ball, config } = match;
  if (config.duel) return team * 3;
  const run = match.teamRuns?.[team];
  if (match.phase !== 'rally' || (ball.x < 0 ? 0 : 1) !== team) return null;
  const current = match.players[currentId];
  // Do not steal a just-started manual jump while the ball is still approaching.
  if (current.jumpProfile && current.jumpTime < 0.15 && (ball.x - current.x) * ball.vx <= 0)
    return current.id;
  if (match.incomingShot === 'serve' && match.lastTouch === team && ball.vx * match.sign(team) < 0)
    return null;
  // Both co-op owners consume the same forecast at the same simulation instant.
  const stamp = [
    match.time,
    ball.x,
    ball.y,
    ball.z,
    ball.vx,
    ball.vy,
    ball.vz,
    ball.spin,
    ball.attackGravity,
    ball.flightAge,
    ball.flightPhysicalAge,
    ball.flightLaunchVy,
    config.gravity,
    config.drag,
    config.restitution,
    config.ballSpeed,
    config.ballSize,
    config.cartoonFlight,
    config.cartoonStart,
    config.cartoonEnd,
    config.cartoonRamp,
    config.cartoonHang,
  ].join('|');
  if (match.receiverForecast?.stamp !== stamp || match.receiverForecast.config !== config)
    match.receiverForecast = { stamp, config, path: traceBall(ball, config, 3 / config.ballSpeed) };
  const path = match.receiverForecast.path;
  const profiles = ['low', 'back', 'loft', 'drive'].map((kind) => shotSettings(config, kind));
  const candidates = [];
  for (const p of match.players) {
    if (
      p.team !== team ||
      p.benched ||
      exclude.includes(p.id) ||
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
      const reachable = profiles.some((shot) => {
        const offset = height <= 0 ? (p.crouchAmount || 0) * 0.4 : 0;
        const speed = p.jumpProfile ? config.airMoveSpeed : config.playerSpeed;
        return (
          b.y >= height + shot.ContactMin - offset &&
          b.y <= height + shot.ContactMax - offset &&
          Math.abs(b.x - p.x) <= shot.Reach + speed * time
        );
      });
      if (reachable) {
        candidates.push({ id: p.id, time, distance: Math.abs(b.x - p.x) });
        break;
      }
    }
  }
  candidates.sort((a, b) => a.time - b.time || a.distance - b.distance);
  const currentOption = candidates.find((p) => p.id === currentId);
  // Running to receive is a manual commitment. A nearer teammate must not
  // take control while this player still has a valid interception.
  if (preferCurrent && currentOption) return currentId;
  // A theoretical sprint is not a good reason to keep a player the ball has passed.
  // Switch to someone farther along its flight, while preserving the front/back owners in co-op.
  const receding =
    config.dynamic &&
    Math.abs(ball.vx) > 0.8 &&
    (ball.x - current.x) * ball.vx > 0 &&
    Math.abs(ball.x - current.x) > 1.5;
  const farther =
    receding &&
    candidates.find((option) => {
      const p = match.players[option.id];
      return (
        option.id !== currentId &&
        (p.x - current.x) * ball.vx > 0 &&
        Math.abs(p.x - ball.x) + 0.65 < Math.abs(current.x - ball.x) &&
        (!currentOption || option.time <= currentOption.time + 0.15)
      );
    });
  if (rescueOnly && (match.lastTouch === team || Math.abs(ball.vx) < 3)) return null;
  if (farther) return farther.id;
  // Prefer a defender already near the predicted contact over a long sprint.
  // A full metre of advantage and progress along the flight prevent small
  // forecast changes from toggling control between neighbouring players.
  if (match.lastTouch !== team && Math.abs(ball.vx) >= 3 && currentOption) {
    const reception = path.find(
      (b) => (b.x < 0 ? 0 : 1) === team && b.vy < 0 && b.y <= profiles[0].ContactMax && b.y > 0.12,
    );
    const better =
      reception &&
      candidates.find(
        (option) =>
          option.id !== currentId &&
          option.time <= currentOption.time + 0.15 &&
          Math.abs(match.players[option.id].x - reception.x) + 1 <
            Math.abs(current.x - reception.x) &&
          (match.players[option.id].x - current.x) * ball.vx > 0,
      );
    if (better) return better.id;
  }
  // Movement input may protect a reasonable receiver, but cannot pin control to
  // someone who has no interception while a teammate can still save this ball.
  if (rescueOnly) return currentOption ? null : (candidates[0]?.id ?? null);
  if (keepReachable && currentOption) return currentId;
  if (
    run &&
    !run.cancelled &&
    run.serial === match.shotSerial &&
    match.time < run.at + 0.2 &&
    candidates.some((p) => p.id === run.playerId)
  )
    return run.playerId;
  if (currentOption) return currentId;
  return candidates[0]?.id ?? null;
}
