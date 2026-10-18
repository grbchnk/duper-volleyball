import { shotSettings } from './shot-settings.js';
import { clamp } from './physics.js';

// Human contacts preserve direction and energy rather than selecting a recipient.
export function manualImpulse(ball, player, kind, power, aim, config) {
  const settings = shotSettings(config, kind);
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
      62 + Math.max(0, vertical) * 26 + Math.min(0, vertical) * 12 - (fast ? 12 : 0),
      38,
      88,
    );
  } else if (vector) {
    degrees = (Math.atan2(vector.y, Math.abs(vector.x)) * 180) / Math.PI;
  } else {
    degrees = kind === 'loft' ? 65 : player.y > 0.25 ? 12 : 24;
    degrees += vertical * 45;
  }
  if (kind !== 'low' && kind !== 'back' && fast) degrees *= 0.72;
  const base = settings.SpeedMin + (settings.SpeedMax - settings.SpeedMin) * t;
  // L2 overrides R2 so a power windup can always turn into a soft feint.
  let speed = soft ? 2.8 + 3.5 * t : base;
  speed *= config.hitPower * (fast ? 1.28 : 1);
  const angle = (degrees * Math.PI) / 180;
  let inheritedSpeed = 0;
  if (config.receiveMomentum && (kind === 'low' || kind === 'back')) {
    const closing = Math.max(
      0,
      -((ball.vx || 0) * direction * Math.cos(angle) + (ball.vy || 0) * Math.sin(angle)),
    );
    const damping = soft ? 1 - clamp(config.receiveDamping ?? 0.85, 0, 1) : 1;
    inheritedSpeed = Math.min(5, closing * clamp(config.receiveTransfer ?? 0.25, 0, 0.6)) * damping;
    speed += inheritedSpeed;
  }
  const vy = speed * Math.sin(angle);
  return {
    vx: direction * speed * Math.cos(angle),
    vy,
    vz: 0,
    spin: soft ? 0 : kind === 'drive' ? 0.35 + 0.5 * t : 0,
    attackGravity:
      kind === 'drive' && direction === forward && !soft ? (config.attackDip ?? 12) * t * t : 0,
    assisted: false,
    targetId: null,
    inheritedSpeed,
    intent: soft ? 'soft' : fast ? 'fast' : 'normal',
    flightAge: 0,
    flightPhysicalAge: 0,
    flightLaunchVy: vy,
  };
}
