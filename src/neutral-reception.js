import { clamp } from './physics.js';
import { preparedHands } from './held-contact.js';
import { diveHands } from './dive-pose.js';
import { shotSettings } from './shot-settings.js';

// A neutral receive deliberately lifts. The hands form a slightly tilted,
// damping platform: some incoming sideways motion survives the contact.
// Canonical palms match collision detection; cosmetic arms cannot improve it.
export function neutralLift(ball, player, kind, result, aim, config) {
  const speed = Math.hypot(result.vx, result.vy);
  if (speed < 0.1) return result;
  const action = {
    kind,
    playerId: player.id,
    power: 0.5,
    age: Math.max(0.07, config.armWindup),
    aim,
  };
  // Early preparation is not a timing penalty. Live play and the lab share
  // the same prepared platform, without introducing contact-quality scoring.
  const hands = player.diving
    ? [diveHands(player, ball, { ...config, armScale: 1 })]
    : preparedHands(player, { config, ball, phase: 'rally', charge: action }, action);
  const centre = hands.length ? hands.reduce((x, hand) => x + hand.x, 0) / hands.length : player.x;
  const reach = Math.max(0.35, shotSettings(config, kind).Reach);
  const extension = clamp((centre - player.x) / reach, -1, 1);
  const edge = clamp((ball.x - centre) / 0.4, -1, 1);
  const tilt = ((extension * 12 + edge * 8) * Math.PI) / 180;
  const soft = aim.soft || kind === 'back';
  const carry = (kind === 'loft' ? 0.06 : 0.1) * (soft ? 0.5 : 1);
  const incomingX = Number.isFinite(ball.vx) ? ball.vx : 0;
  const downward = Math.max(0, -(ball.vy || 0));
  const limit = speed * Math.sin(((soft ? 20 : 28) * Math.PI) / 180);
  const lateral = clamp(
    (speed + Math.min(downward, 30) * 0.06) * Math.sin(tilt) + incomingX * carry,
    -limit,
    limit,
  );
  const vertical = Math.sqrt(Math.max(0, speed * speed - lateral * lateral));
  const physicalAngle = Math.atan2(vertical, lateral);
  // Pass assistance only steadies the lift (at most 6 degrees). Teammates
  // never change its direction, and incoming energy cannot add shot power.
  const amount = clamp(config.passAssist ?? 0, 0, 1);
  const correction = clamp(Math.PI / 2 - physicalAngle, -Math.PI / 30, Math.PI / 30) * amount;
  const angle = physicalAngle + correction;
  return {
    ...result,
    vx: speed * Math.cos(angle),
    vy: speed * Math.sin(angle),
    flightLaunchVy: speed * Math.sin(angle),
    neutralReception: true,
    requestedDirection: { vx: 0, vy: speed },
    contactLateral: lateral,
    contactHandX: centre,
    contactTiltDegrees: (tilt * 180) / Math.PI,
    assisted: Math.abs(correction) > 1e-7,
    assistDegrees: (correction * 180) / Math.PI,
    assistAmount: amount,
    assistIntent: 'Подъём над собой',
    targetId: null,
    targetX: undefined,
    arrival: undefined,
    reception: false,
  };
}
