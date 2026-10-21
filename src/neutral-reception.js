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
  // Reaching hands track the ball visually, so palm-centering alone used to
  // make a stretched, glancing receive look almost as good as a central one.
  // Keep central contacts forgiving, then smoothly expose the stretched arm
  // angle and the edge of the platform near the limits of actual reach.
  const reachUse = clamp(Math.abs(ball.x - player.x) / reach, 0, 1);
  const stretchProgress = clamp((reachUse - 0.35) / 0.6, 0, 1);
  const stretch = stretchProgress * stretchProgress * (3 - 2 * stretchProgress);
  const strain = 1 - (1 - stretch) * (1 - Math.abs(edge) * 0.65);
  const tilt = ((extension * (12 + 8 * stretch) + edge * (8 + 12 * strain)) * Math.PI) / 180;
  const soft = aim.soft || kind === 'back';
  const incomingX = Number.isFinite(ball.vx) ? ball.vx : 0;
  const downward = Math.max(0, -(ball.vy || 0));
  const grazing = Math.abs(incomingX) / Math.max(1, Math.hypot(incomingX, ball.vy || 0));
  const carry =
    ((kind === 'loft' ? 0.08 : 0.12) + 0.1 * strain + 0.025 * grazing) * (soft ? 0.5 : 1);
  // A difficult contact may fly much flatter, but still attempts an upward
  // lift. L2 damps carry; it cannot turn a fully stretched arm into a flat,
  // perfectly aligned receiving platform.
  const limitDegrees = (soft ? 20 : 28) + (soft ? 25 : 20) * strain;
  const limit = speed * Math.sin((limitDegrees * Math.PI) / 180);
  const lateral = clamp(
    (speed + Math.min(downward, 30) * (0.06 + 0.1 * strain)) * Math.sin(tilt) + incomingX * carry,
    -limit,
    limit,
  );
  const vertical = Math.sqrt(Math.max(0, speed * speed - lateral * lateral));
  const physicalAngle = Math.atan2(vertical, lateral);
  // Pass assistance only steadies the lift (at most 6 degrees). Teammates
  // never change its direction, and incoming energy cannot add shot power.
  const amount = clamp(config.passAssist ?? 0, 0, 1);
  const correction =
    clamp(Math.PI / 2 - physicalAngle, -Math.PI / 30, Math.PI / 30) * amount * (1 - 0.7 * strain);
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
