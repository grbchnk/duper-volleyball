export const heldServeBall = (player) => ({
  x: player.x + (player.team === 0 ? 0.5 : -0.5),
  y: player.y + 0.85,
  z: player.z,
});

// The free hand supports the ball until release, then eases back into its serve pose.
export function serveSupport(match, player) {
  if (
    !match.config.dynamic ||
    player.id !== (match.serverPlayer?.().id ?? match.selected[match.server])
  )
    return null;
  if (match.phase === 'serve')
    return { hand: 1 - (player.serveHand ?? 1), weight: 1, attached: true };
  const action = match.serveAction;
  if (match.phase !== 'serve-motion' || !action?.tossDelay || action.attempted) return null;
  const progress = Math.max(0, Math.min(1, (match.phaseTime - action.tossDelay) / 0.18));
  if (progress >= 1) return null;
  return {
    hand: 1 - action.hand,
    weight: 1 - progress * progress * (3 - 2 * progress),
    attached: match.phaseTime <= action.tossDelay,
  };
}
