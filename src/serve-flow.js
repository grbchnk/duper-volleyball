import { aimOf } from './controllers.js';
import { serveSettings } from './serve-settings.js';
const EMPTY_INPUT = Object.freeze({});
import { serveMotion, serveOrigin, sampleServeMotion } from './motion.js';
import { shotImpulse, SERVES } from './moves.js';
import { traceBall, resetFlight } from './physics.js';
import { COURT } from './config.js';
import { observeContact } from './skill-feedback.js';
export function chooseServeInput(match, p, original) {
  const a = { ...original };
  const ball = { ...match.ball, ...serveOrigin(p, a.kind, match.config, true) };
  // AI chooses an input within the configured profile, never a replacement trajectory.
  const settings = serveSettings(match.config, a.kind);
  const angles = settings.Targeted ? [null] : [null, 25, 35, 45, 55, 65, 15, 75, 40, 50, 60];
  let found = false;
  for (const power of [a.power, 0.3, 0.45, 0.65, 0.8, 1]) {
    for (const angle of angles) {
      const aim =
        angle === null
          ? {}
          : {
              vector: {
                x: -match.sign(match.server) * Math.cos((angle * Math.PI) / 180),
                y: Math.sin((angle * Math.PI) / 180),
              },
            };
      const impulse = shotImpulse(ball, p, a.kind, power, aim, match.players, match.config, true);
      const path = traceBall({ ...ball, ...impulse }, match.config, 12);
      const end = path.at(-1);
      const crossing = path.findIndex((point) => point.x * match.sign(match.server) <= 0);
      const before = path[crossing - 1],
        after = path[crossing];
      const clearance =
        before && after ? before.y + (after.y - before.y) * (-before.x / (after.x - before.x)) : 0;
      if (
        !path.some((point) => point.netImpact !== ball.netImpact) &&
        clearance >= COURT.netHeight + COURT.ballRadius + 0.24 &&
        end.y <= COURT.ballRadius + 0.001 &&
        end.x * match.sign(match.server) < -1 &&
        Math.abs(end.x) < COURT.halfLength - 0.3
      ) {
        a.power = power;
        a.aim = aim;
        found = true;
        break;
      }
    }
    if (found) break;
  }
  return a;
}

export function beginServe(match, action, control = match.controls[match.serverSlot()]) {
  const p = match.serverPlayer();
  if (!match.isHuman(match.server)) action = match.chooseServeInput(p, action);
  match.serveAction = {
    ...serveMotion(p, action, match.config),
    hand: match.config.dynamic ? (p.serveHand ?? 1) : match.visualRandom() < 0.5 ? 0 : 1,
  };
  match.phase = 'serve-motion';
  match.phaseTime = 0;
  control.aimPreview = null;
  p.armSwing = null;
  p.pose = 'idle';
  p.animation = 0;
  if (match.config.dynamic) Object.assign(match.ball, sampleServeMotion(p, match.serveAction, 0));
  else match.emit('toss');
  match.label(SERVES[action.kind].name + ' · нажми ещё раз');
}

export function executeServe(match) {
  const p = match.serverPlayer(),
    a = match.serveAction;
  if (match.isHuman(match.server) && match.config.dynamic)
    a.aim = aimOf(match.inputs?.[match.serverSlot()] || EMPTY_INPUT);
  Object.assign(
    match.ball,
    shotImpulse(match.ball, p, a.kind, a.power, a.aim, match.players, match.config, true),
  );
  match.ball.vx *= a.quality ?? 1;
  match.ball.vy *= a.quality ?? 1;
  resetFlight(match.ball);
  match.phase = 'rally';
  match.phaseTime = 0;
  match.lastTouch = match.server;
  match.lastPlayer = p.id;
  match.touches = [0, 0];
  match.cooldown = 0.2;
  match.incomingShot = 'serve';
  match.stats.serves[match.server]++;
  match.teamPhases = ['defense', 'defense'];
  match.recordContact(p, a.kind, a.power);
  match.rallyInfo.start = match.time;
  observeContact(match, p, a.kind, a.power, true);
  p.armSwing.serve = true;
  p.armSwing.hand = a.hand;
  match.shotSerial++;
  match.autoSelect(1 - match.server);
  match.lastAction = `${SERVES[a.kind].name} · ${a.perfect ? 'ИДЕАЛЬНО · ' : ''}${Math.round(a.power * 100)}%`;
  match.label(match.lastAction);
  match.emit('hit', {
    kind: a.kind,
    power: a.power,
    team: match.server,
    serve: true,
    x: match.ball.x,
    y: match.ball.y,
    playerId: p.id,
  });
  match.serveAction = null;
  match.controls[match.serverSlot()].aimPreview = null;
}
