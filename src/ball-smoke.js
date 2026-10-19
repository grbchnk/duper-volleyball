// World-space samples: smoke never travels with the ball or affects its flight.
export const MAX_SMOKE_POINTS = 160;
const SPACING = 0.22;

function enabled(match) {
  return match.config.smokeTrailOpacity > 0 && match.config.smokeTrailLife > 0;
}

function addPoint(match, x, y) {
  const life = match.config.smokeTrailLife;
  match.smokeTrail ??= [];
  match.smokeTrail.push({ x, y, life, duration: life });
  if (match.smokeTrail.length > MAX_SMOKE_POINTS)
    match.smokeTrail.splice(0, match.smokeTrail.length - MAX_SMOKE_POINTS);
}

export function beginBallSmoke(match, kind, power) {
  match.smokeShot = null;
  if (
    !enabled(match) ||
    kind !== 'drive' ||
    power < 0.8 ||
    Math.hypot(match.ball.vx, match.ball.vy) < 10
  )
    return;
  match.smokeShot = { serial: match.shotSerial, x: match.ball.x, y: match.ball.y };
  addPoint(match, match.ball.x, match.ball.y);
}

export function sampleBallSmoke(match) {
  const shot = match.smokeShot;
  if (!enabled(match) || !shot || shot.serial !== match.shotSerial || match.phase !== 'rally')
    return;
  const dx = match.ball.x - shot.x,
    dy = match.ball.y - shot.y;
  const distance = Math.hypot(dx, dy);
  // Limit even a corrupt or teleported frame to the bounded sample budget.
  const count = Math.min(MAX_SMOKE_POINTS, Math.floor(distance / SPACING));
  for (let i = 1; i <= count; i++)
    addPoint(match, shot.x + (dx * i * SPACING) / distance, shot.y + (dy * i * SPACING) / distance);
  if (count) {
    shot.x += (dx * count * SPACING) / distance;
    shot.y += (dy * count * SPACING) / distance;
  }
}

export function ageBallSmoke(match, dt) {
  if (!enabled(match)) {
    match.smokeTrail = [];
    match.smokeShot = null;
    return;
  }
  match.smokeTrail = (match.smokeTrail || []).filter((point) => {
    point.life -= dt;
    return point.life > 0;
  });
}
