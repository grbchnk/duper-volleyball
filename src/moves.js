import { clamp, launchTo, predictAtHeight } from './physics.js';
export const SHOTS = Object.freeze({
  low: { key: 'J', name: 'Приём снизу', speed: [5, 11.7], angle: 55, min: .16, max: 1.8, reach: 1.15, pose: 'bump' },
  loft: { key: 'L', name: 'Верхний пас', speed: [5.8, 11.8], angle: 71, min: 1.25, max: 2.7, reach: 1.0, pose: 'set' },
  drive: { key: 'I', name: 'Направленный удар', speed: [7.4, 18], angle: 31, min: .8, max: 2.75, reach: 1.12, pose: 'spike' },
});
export const SERVES = Object.freeze({
  low: { name: 'Нижняя подача', speed: [10, 17], angle: 49 },
  loft: { name: 'Планирующая подача', speed: [10.5, 17.5], angle: 38 },
  drive: { name: 'Подача в прыжке', speed: [11.5, 18.5], angle: 22 },
});
export const CHARGE_SECONDS = .82;
export const RELEASE_WINDOW = .32;
// Free launch first; assist may correct only a small error toward a teammate.
export function shotImpulse(ball, player, kind, power, aim, players, config, serving = false) {
  const shot = serving ? SERVES[kind] : SHOTS[kind];
  const forward = player.team === 0 ? 1 : -1, dir = aim.axis || forward;
  let angle = shot.angle;
  if (!serving && kind === 'drive' && player.y > .25) angle = 5;
  angle += aim.up ? 16 : aim.down ? -17 : 0;
  const speed = (shot.speed[0] + (shot.speed[1] - shot.speed[0]) * power) * config.hitPower;
  const rad = angle * Math.PI / 180;
  const result = { vx: dir * speed * Math.cos(rad), vy: speed * Math.sin(rad), vz: 0, spin: !serving && kind==='drive' ? .5 : 0, assisted: false, targetId: null };
  const free = { ...ball, ...result }, landing = predictAtHeight(free, kind === 'loft' ? 2.0 : 1.4, config);
  result.rawLanding = landing.x;
  if (!serving && config.assist && kind !== 'drive') {
    const candidates = players.filter(p => p.team === player.team && p.id !== player.id && p.recovery <= 0 && (p.x - player.x) * dir > .4)
      .map(p => ({ p, error: Math.abs(p.x - landing.x) })).filter(v => v.error < 1.65).sort((a,b) => a.error-b.error);
    const candidate = candidates[0];
    if (candidate && landing.time > .2 && Math.abs(landing.x) < 10.5) {
      const corrected = { ...free };
      launchTo(corrected, { x: candidate.p.x, y: kind === 'loft' ? 2.0 : 1.4, z: 4.5 }, landing.time, config);
      const maxDelta = speed * .14;
      result.vx += clamp((corrected.vx-result.vx)*.72,-maxDelta,maxDelta);
      result.vy += clamp((corrected.vy-result.vy)*.72,-maxDelta,maxDelta);
      result.assisted = true; result.targetId = candidate.p.id;
    }
  }
  return result;
}
