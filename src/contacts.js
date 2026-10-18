import { HOMES, TEAM_SIZE } from './formation.js';
import { COURT } from './config.js';
import { SHOTS, shotImpulse } from './moves.js';
import { preparedHands, ballTouchesHands } from './held-contact.js';
import { resetFlight, predictAtHeight, clamp } from './physics.js';
import { observeContact } from './skill-feedback.js';
import { resolveChallenge } from './challenges.js';
const EMPTY_INPUT = Object.freeze({});
export function tryHeldContact(match, previous = match.ball, control = match.controls[0]) {
  const a = control.charge;
  match.refreshAim(a, match.inputs?.[control.slot] || EMPTY_INPUT);
  if (match.config.dynamic && a?.kind === 'drive') return false;
  if (!a || a.age < match.config.armWindup) return false;
  const p = match.players[a.playerId];
  if (
    !match.canContact(p, a.kind, true) ||
    !ballTouchesHands(
      match.ball,
      previous,
      preparedHands(p, match, a),
      COURT.ballRadius + 0.13 * match.config.armScale,
    )
  )
    return false;
  // Consume the entire press, including when selection switches to a teammate.
  control.charge = null;
  control.pending = null;
  control.chargeLock = true;
  p.releaseSlow = a.kind === 'back' ? 0 : match.config.releaseWindow;
  return match.makeContact(
    p,
    a.kind,
    a.power,
    shotImpulse(match.ball, p, a.kind, a.power, a.aim, match.players, match.config),
  );
}

export function tryPending(match, previous = match.ball, control = match.controls[0]) {
  const a = control.pending,
    p = match.players[a.playerId];
  match.refreshAim(a, match.inputs?.[control.slot] || EMPTY_INPUT);
  if (a.feintAt && match.time - a.feintAt < 0.09) return false;
  if (!match.canContact(p, a.kind)) return false;
  if (
    a.kind === 'back' &&
    !ballTouchesHands(
      match.ball,
      previous,
      preparedHands(p, match, { ...a, age: Math.max(a.age || 0, match.config.armWindup) }),
      COURT.ballRadius + 0.13 * match.config.armScale,
    )
  )
    return false;
  control.pending = null;
  return match.makeContact(
    p,
    a.kind,
    a.power,
    shotImpulse(match.ball, p, a.kind, a.power, a.aim, match.players, match.config),
  );
}

export function recordContact(match, p, kind, power) {
  if (p.diving) p.diveArmed = false;
  p.contact = { kind, power, x: match.ball.x, y: match.ball.y, life: 0.24, at: match.time };
  p.armSwing = {
    kind,
    power,
    age: 0,
    hit: true,
    hand: kind === 'back' ? ((match.ball.x - p.x) * (p.facing || 1) < 0 ? 0 : 1) : undefined,
    at: match.time,
    x: match.ball.x,
    y: match.ball.y,
    vx: match.ball.vx,
    vy: match.ball.vy,
  };
  p.pose = p.diving ? 'dive' : SHOTS[kind]?.pose || 'block';
  p.animation = 0.24;
}

export function makeContact(match, p, kind, power, impulse) {
  const control = match.controls[match.humanSlot(p) ?? p.team];
  const team = p.team;
  if (match.lastTouch !== team) match.touches[team] = 0;
  if (!match.config.duel && match.lastTouch === team && match.lastPlayer === p.id) {
    match.point(1 - team, 'ДВА КАСАНИЯ ОДНОГО ИГРОКА');
    return false;
  }
  match.touches[team]++;
  if (match.touches[team] > 3) {
    match.point(1 - team, 'ЧЕТВЁРТОЕ КАСАНИЕ');
    return false;
  }
  if (match.lastTouch !== team) match.bounces = [0, 0];
  match.lastTouch = team;
  match.lastPlayer = p.id;
  match.contacts++;
  match.cooldown = 0.13;
  match.incomingShot = kind;
  match.headHitEligible =
    kind === 'drive' &&
    (match.config.dynamic
      ? impulse.intent !== 'soft' &&
        impulse.vx * (p.team === 0 ? 1 : -1) > 0 &&
        Math.hypot(impulse.vx, impulse.vy) >= 10
      : power >= 0.8 && p.y > 0.4);
  match.shotSerial++;
  match.contactTempoState = null;
  Object.assign(match.ball, impulse);
  if (impulse.intent)
    match.tacticalStats[impulse.intent] = (match.tacticalStats[impulse.intent] || 0) + 1;
  match.teamRuns[team] =
    impulse.targetId != null && impulse.arrival
      ? {
          serial: match.shotSerial,
          playerId: impulse.targetId,
          x: impulse.targetX,
          at: match.time + impulse.arrival,
          decoyId: impulse.decoyId,
          intent: impulse.intent,
        }
      : null;
  if (impulse.arrival) match.planReadBlock(1 - team, impulse);
  resetFlight(match.ball);
  match.recordContact(p, kind, power);
  observeContact(match, p, kind, power);
  if (impulse.intent === 'soft') p.armSwing.aim = { soft: true };
  if (kind !== 'drive' && match.mode !== 'test' && !match.isHuman(team)) {
    // Pick once per pass, not every frame, so returning players settle naturally.
    const teammates = match.players.filter((other) => other.team === team && other.id !== p.id);
    const base = HOMES[p.id % TEAM_SIZE];
    const spots = [base + (match.random() - 0.5) * 0.6, 1.2, 3, 4.8, 6.6, 8.2];
    const space = (x) =>
      Math.min(...teammates.map((other) => Math.abs(match.sign(team) * x - other.x))) -
      Math.abs(x - base) * 0.18;
    spots.sort((a, b) => space(b) - space(a));
    p.homeX = match.sign(team) * Math.max(0.65, spots[0]);
    p.returnDelay = 0.35 + match.random() * 0.85;
    p.returnHome = true;
  }
  if (
    !match.isHuman(team) &&
    kind !== 'drive' &&
    match.ball.vy > 1 &&
    Math.abs(p.x) < 2.6 &&
    match.players
      .filter((other) => other.team === team)
      .every((other) => Math.abs(other.x) >= Math.abs(p.x))
  ) {
    const overhead = predictAtHeight(match.ball, p.y + 2.1, match.config);
    if (Math.abs(overhead.x - p.x) < 1 && overhead.time > 0.35) {
      p.clearLane = {
        targetX: match.sign(team) * Math.min(8.5, Math.abs(p.x) + 1.6),
        serial: match.shotSerial,
        until: match.time + clamp(overhead.time + 0.3, 0.7, 3),
      };
    }
  }
  const landing = predictAtHeight(match.ball, 0.15, match.config),
    crosses = impulse.targetId == null && landing.x * match.sign(team) < 0;
  match.teamPhases[team] = crosses ? 'defense' : 'attack';
  match.teamPhases[1 - team] = 'defense';
  if (kind === 'drive') match.stats.attacks[team]++;
  else match.stats.passes[team]++;
  match.lastAction = `${SHOTS[kind].name} · ${Math.round(power * 100)}%`;
  match.assistLabel = impulse.assisted
    ? kind === 'drive'
      ? 'Удар скорректирован над сеткой'
      : 'Пас направлен партнёру'
    : 'Свободная траектория';
  match.label(impulse.feedback || match.lastAction);
  if (crosses) {
    match.autoSelect(1 - team);
    match.scheduleCPUBlock(1 - team);
  } else {
    const candidates = match.players
      .filter((other) => other.team === team && other.id !== p.id)
      .sort((a, b) => Math.abs(a.x - landing.x) - Math.abs(b.x - landing.x));
    match.autoSelect(team, impulse.targetId ?? (match.mode === 'coop' ? null : candidates[0]?.id));
    if (!impulse.arrival) match.cpuBlockPlan = null;
  }
  if (match.isHuman(team) && p.id !== match.controlledPlayer(control)) match.clearPasser(p);
  match.emit('hit', {
    comboStage: match.lastContact?.comboStage || 0,
    kind,
    power,
    team,
    assisted: impulse.assisted,
    intent: impulse.intent,
    quality: impulse.quality,
    x: match.ball.x,
    y: match.ball.y,
    playerId: p.id,
  });
  control.aimPreview = null;
  if (match.challenge?.id === 'rescue' && p.diving) resolveChallenge(match, 'СПАСЕНИЕ');
  return true;
}
