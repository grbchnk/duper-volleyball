import { shotSettings, variantSettings } from './shot-settings.js';
import { clamp } from './physics.js';

// Human contacts preserve direction and energy rather than selecting a recipient.
export function manualImpulse(ball, player, kind, power, aim, config) {
  const settings =
    kind === 'back'
      ? shotSettings(config, kind)
      : {
          ...shotSettings(config, kind),
          ...variantSettings(config, kind, aim),
        };
  const forward = player.team === 0 ? 1 : -1;
  const vector = aim.vector;
  const direction = Math.sign(vector?.x || aim.axis) || forward;
  const t = clamp(power, 0, 1) ** settings.PowerCurve;
  const soft = aim.soft || kind === 'back';
  const fast = aim.fast && !soft;
  const vertical = vector ? clamp(vector.y, -1, 1) : aim.up ? 1 : aim.down ? -1 : 0;
  let degrees;
  if (kind === 'low' || kind === 'back') {
    // A lower receive always lifts, even when aiming down or holding R2.
    degrees = clamp(
      ((player.y > 0.25 ? settings.AirAngle : settings.GroundAngle) ?? 62) +
        (Math.max(0, vertical) * 26 + Math.min(0, vertical) * 12) * (settings.AimScale ?? 1),
      38,
      88,
    );
  } else if (vector) {
    degrees = ((Math.atan2(vector.y, Math.abs(vector.x)) * 180) / Math.PI) * settings.AimScale;
  } else {
    degrees = player.y > 0.25 ? settings.AirAngle : settings.GroundAngle;
    degrees += vertical * 45 * settings.AimScale;
  }
  degrees = clamp(degrees, kind === 'low' || kind === 'back' ? 38 : -90, 90);
  const base = settings.SpeedMin + (settings.SpeedMax - settings.SpeedMin) * t;
  // L2 overrides R2 and selects its independent soft profile.
  let speed = base * config.hitPower;
  const angle = (degrees * Math.PI) / 180;
  let inheritedSpeed = 0;
  if (!config.dynamic && config.receiveMomentum && (kind === 'low' || kind === 'back')) {
    const closing = Math.max(
      0,
      -((ball.vx || 0) * direction * Math.cos(angle) + (ball.vy || 0) * Math.sin(angle)),
    );
    const damping = soft ? 1 - clamp(config.receiveDamping ?? 0.85, 0, 1) : 1;
    inheritedSpeed = Math.min(5, closing * clamp(config.receiveTransfer ?? 0.25, 0, 0.6)) * damping;
    speed += inheritedSpeed;
  }
  const neutralLow =
    kind === 'low' &&
    config.dynamic &&
    !aim.cpuControl &&
    !aim.axis &&
    !aim.up &&
    !aim.down &&
    !Math.hypot(vector?.x || 0, vector?.y || 0);
  let vx = direction * speed * Math.cos(angle);
  let vy = speed * Math.sin(angle);
  return {
    vx,
    vy,
    vz: 0,
    spin: (settings.SpinMin ?? 0) + ((settings.SpinMax ?? 0) - (settings.SpinMin ?? 0)) * t,
    attackGravity: kind === 'drive' && direction === forward ? settings.Dip * t * t : 0,
    assisted: false,
    targetId: null,
    ...(neutralLow ? { neutralReceive: true } : {}),
    inheritedSpeed,
    intent: soft ? 'soft' : fast ? 'fast' : 'normal',
    contactModifier: soft ? 'soft' : fast ? 'fast' : null,
    flightTempo: settings.Tempo ?? 1,
    flightAge: 0,
    flightPhysicalAge: 0,
    flightLaunchVy: vy,
  };
}
