// Reach toward the incoming ball, independently of the outgoing shot direction.
// The renderer and collision checks use the same bounded target.
export function netSeparates(player, ball) {
  return !!ball && ((player.x < 0 && ball.x >= 0) || (player.x > 0 && ball.x <= 0));
}
export function localReceiveAim(player, action, ball, frame, config) {
  const kind = action?.kind;
  if (!['back', 'low', 'loft'].includes(kind)) return null;
  const facing = player.facing || (player.team === 0 ? 1 : -1);
  const rest = { x: kind === 'back' ? -(player.team === 0 ? 1 : -1) / facing : 0, y: 0, weight: 0 };
  if (!ball || netSeparates(player, ball)) return rest;
  const dx = ball.x - player.x;
  const distance = Math.hypot(dx, ball.y - player.y - 1.3);
  // Start preparing from six metres away on the player's side of the net. Full reach
  // arrives before contact; smoothstep has no snap at either distance threshold.
  const fullReach = kind === 'back' ? 2.8 : 1.4;
  const proximity = Math.max(0, Math.min(1, (6 - distance) / (6 - fullReach)));
  const weight = proximity * proximity * (3 - 2 * proximity);
  if (!weight) return rest;
  // Look slightly ahead only while approaching, without reaching past the ball.
  const lead =
    dx * (ball.vx || 0) < 0
      ? Math.min(0.06, Math.abs(dx / ball.vx) * 0.4, 0.12 / Math.hypot(ball.vx, ball.vy || 0))
      : 0;
  const px = ((dx + (ball.vx || 0) * lead) * 40) / (2.1 * facing);
  const py =
    -((ball.y + (ball.vy || 0) * lead - player.y) * 42) / 2.1 -
    (frame?.pose.y || 0) -
    (frame?.pose.shoulders || 0);
  const scale = config?.armScale || 1;
  if (kind === 'back') {
    const shoulder = px < 0 ? -6 : 6;
    const dx = (px - shoulder) / (19 * scale);
    const dy = (-20 - (py + 2.2)) / (19 * scale);
    const angle =
      (Math.max(
        config?.backArmMin ?? -75,
        Math.min(config?.backArmMax ?? 10, (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI),
      ) *
        Math.PI) /
      180;
    const reach = Math.min(1, Math.hypot(dx, dy));
    return {
      x: (Math.sign(dx) || 1) * Math.cos(angle) * reach,
      y: Math.sin(angle) * reach,
      hand: px < 0 ? 0 : 1,
      weight,
    };
  }
  const centre = px / scale;
  const localY = -20 + (py + 20) / scale;
  const offset = (player.y <= 0 ? player.crouchAmount || 0 : 0) * 0.4;
  const wristHeight = (height) =>
    -20 + (-(height - offset) * 20 - (frame?.pose.y || 0) + 20) / scale;
  return {
    x: (centre - (kind === 'low' ? 7 : 4)) / (kind === 'low' ? 14 : 11),
    y: kind === 'loft' ? (-38 - localY) / 3 : (-12 - localY) / 3,
    weight,
    minWristY: wristHeight(config?.[kind + 'ContactMax'] ?? (kind === 'loft' ? 2.45 : 1.35)),
    maxWristY: wristHeight(config?.[kind + 'ContactMin'] ?? (kind === 'loft' ? 1.65 : 0.16)),
  };
}

export function receiveWrists(kind, aim, power, direction = 1) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const x = clamp(aim?.x ?? (kind === 'back' ? direction : 0), -1, 1);
  const y = clamp(aim?.y ?? 0, -1, 1);
  const finish = (wrists, hands) => {
    const weight = clamp(aim?.weight ?? 1, 0, 1);
    const neutral =
      kind === 'back'
        ? [
            { x: -9, y: -12 },
            { x: 10, y: -12 },
          ]
        : kind === 'loft'
          ? [
              { x: 1, y: -38 - power * 0.5 },
              { x: 7, y: -38 - power * 0.5 },
            ]
          : [
              { x: 5, y: -11 - power * 2 },
              { x: 9, y: -11 - power * 2 },
            ];
    return {
      wrists: wrists.map((p, i) => ({
        x: neutral[i].x + (p.x - neutral[i].x) * weight,
        y: clamp(
          neutral[i].y + (p.y - neutral[i].y) * weight,
          aim?.minWristY ?? -Infinity,
          aim?.maxWristY ?? Infinity,
        ),
      })),
      hands,
    };
  };
  if (kind === 'back') {
    const hand = aim?.hand ?? (x < 0 ? 0 : 1);
    // Normalize the raw target together, preserving the angle toward distant balls.
    const rawX = aim?.x ?? x,
      rawY = aim?.y ?? y;
    const length = Math.max(1, Math.hypot(rawX, rawY));
    const wrists = [
      { x: -9, y: -12 },
      { x: 10, y: -12 },
    ];
    wrists[hand] = { x: (hand ? 6 : -6) + (19 * rawX) / length, y: -20 - (19 * rawY) / length };
    return finish(wrists, [hand]);
  }
  if (kind === 'loft') {
    const centre = 4 + 11 * x;
    const height = -38 - power * 0.5 - 3 * Math.max(0, y);
    return finish(
      [
        { x: centre - 3, y: height },
        { x: centre + 3, y: height },
      ],
      [0, 1],
    );
  }
  if (kind === 'low') {
    const centre = 7 + 14 * x;
    const height = clamp(-11 - power * 2 - 3 * y, -17, -7);
    return finish(
      [
        { x: centre - 2, y: height },
        { x: centre + 2, y: height },
      ],
      [0, 1],
    );
  }
  return null;
}
