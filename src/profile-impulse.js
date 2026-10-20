import { tacticalAttack, tacticalPass } from './tactics.js';
import { smartPass } from './smart-pass.js';
import { serveSettings } from './serve-settings.js';
import { shotSettings } from './shot-settings.js';
import { clamp, launchTo, driveOverNet, reachesNet, launchOverNet, traceBall } from './physics.js';

export function profileImpulse(ball, player, kind, power, aim, players, config, serving) {
  if (!serving && config.dynamic) {
    if (kind === 'drive' && aim.intent && aim.intent !== 'manual')
      return tacticalAttack(ball, player, aim.intent, power, config, aim);
    if (kind === 'loft' && aim.play && config.assist) {
      const pass = tacticalPass(ball, player, power, aim, players, config);
      if (pass) return pass;
    }
  }
  const settings = serving ? serveSettings(config, kind) : shotSettings(config, kind);
  power = clamp(power, 0, 1);
  const t = power ** settings.PowerCurve;
  const mix = (a, b) => a + (b - a) * t;
  const assistance = config.assist ? clamp(config.passAssist ?? 1, 0, 1) : 0;
  const forward = player.team === 0 ? 1 : -1;
  const direction = serving
    ? Math.sign(aim.vector?.x || aim.axis) || forward
    : Math.sign(aim.vector?.x || aim.axis) || (kind === 'back' ? -forward : forward);
  let elevation = serving
    ? mix(settings.AngleMin, settings.AngleMax)
    : player.y > 0.25
      ? mix(settings.AirAngleMin, settings.AirAngleMax)
      : mix(settings.AngleMin, settings.AngleMax);
  if (aim.vector) {
    const manual = (Math.atan2(aim.vector.y, Math.abs(aim.vector.x)) * 180) / Math.PI;
    elevation += (manual - elevation) * settings.AimBlend;
  } else elevation += aim.up ? 16 : aim.down ? -17 : 0;
  elevation = clamp(elevation, settings.ElevationMin, settings.ElevationMax);
  if (kind === 'drive' && !serving && !aim.vector && !aim.axis && !aim.up && !aim.down)
    elevation = 0;
  const speed = mix(settings.SpeedMin, settings.SpeedMax) * config.hitPower;
  const rad = (elevation * Math.PI) / 180;
  const result = {
    vx: direction * speed * Math.cos(rad),
    vy: speed * Math.sin(rad),
    vz: 0,
    spin: mix(settings.SpinMin, settings.SpinMax),
    assisted: false,
    targetId: null,
    flightAge: 0,
    flightLaunchVy: speed * Math.sin(rad),
    flightPhysicalAge: 0,
  };
  if (serving && settings.Targeted && !aim.vector && !aim.axis && !aim.up && !aim.down) {
    const target = {
      x:
        forward *
        (settings.TargetMin +
          (settings.TargetMax - settings.TargetMin) * power ** settings.TargetCurve) *
        config.hitPower,
      y: 0.105,
      z: ball.z,
    };
    const seconds = mix(settings.FlightTimeMin, settings.FlightTimeMax) / config.ballSpeed;
    const soft = { ...ball };
    // A gentle serve has a short target, but excess power can still send it out.
    if (
      !settings.NetAssist ||
      Math.abs(target.x) > 8.7 ||
      !launchOverNet(soft, target, seconds, config)
    )
      launchTo(soft, target, seconds, config);
    Object.assign(result, {
      vx: soft.vx,
      vy: soft.vy,
      vz: soft.vz,
      spin: soft.spin,
      flightLaunchVy: soft.vy,
    });
  }
  const neutral = !aim.vector && !aim.axis && !aim.up && !aim.down;
  if (serving || !config.assist || !speed) return result;
  const amount = kind === 'drive' ? clamp(config.driveAssist ?? 1, 0, 1) : assistance;
  if (!amount) return result;
  // An outgoing manual pass keeps its intent; a neutral pass seeks a teammate.
  const outgoing =
    kind === 'drive' ||
    (!neutral && direction === forward && reachesNet({ ...ball, ...result }, config));
  if (!outgoing)
    return smartPass(ball, player, kind, result, players, config, settings, amount, !neutral);
  if (config.dynamic) {
    const path = traceBall({ ...ball, ...result }, config, 5 / config.ballSpeed);
    if (path.some((p) => p.x * forward > 0.2)) return result;
    const guided = driveOverNet({ ...ball, spin: result.spin }, speed, forward, true, config);
    if (!guided) return result;
    const original = Math.atan2(result.vy, result.vx);
    const desired = Math.atan2(guided.vy, guided.vx);
    const delta = Math.atan2(Math.sin(desired - original), Math.cos(desired - original));
    const limit = (settings.AssistAngle * Math.PI) / 180;
    if (Math.abs(delta) > limit) return result;
    const angle = original + delta * amount;
    return {
      ...result,
      vx: speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
      assisted: true,
      flightLaunchVy: speed * Math.sin(angle),
    };
  }
  let guidedSpeed = speed;
  const flight = { ...ball, spin: result.spin };
  let guided = driveOverNet(flight, guidedSpeed, forward, true, config);
  // Full attack assistance supplies only the missing speed when rotation alone cannot clear.
  if (kind === 'drive') {
    while (!guided && guidedSpeed < 40) {
      guidedSpeed += 0.5;
      guided = driveOverNet(flight, guidedSpeed, forward, true, config);
    }
  }
  if (!guided) return result;
  const original = Math.atan2(result.vy, result.vx);
  const desired = Math.atan2(guided.vy, guided.vx);
  const delta = Math.atan2(Math.sin(desired - original), Math.cos(desired - original));
  const angle = original + delta * amount;
  const correctedSpeed = speed + (guidedSpeed - speed) * amount;
  return {
    ...result,
    vx: correctedSpeed * Math.cos(angle),
    vy: correctedSpeed * Math.sin(angle),
    flightLaunchVy: correctedSpeed * Math.sin(angle),
    assisted: Math.abs(delta * amount) > 1e-7 || guidedSpeed > speed,
  };
}
