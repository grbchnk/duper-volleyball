import { HOMES, TEAM_SIZE } from './formation.js';
import { COURT, FIXED_DT } from './config.js';
import { shotDefinition, shotImpulse } from './moves.js';
import { preparedHands, ballTouchesHands } from './held-contact.js';
import { resetFlight, predictAtHeight, clamp, integrateBall } from './physics.js';
import { contactReason } from './contact-rules.js';
import { sampleJump } from './motion.js';
import { observeContact } from './skill-feedback.js';
import { resolveChallenge } from './challenges.js';
import { beginBallSmoke } from './ball-smoke.js';
import { isZoneReceive, tryZoneReceive } from './zone-receive.js';
import { jumpProfile } from './motion.js';
const EMPTY_INPUT = Object.freeze({});
export function receiveHoldTime(match, kind) {
  return match.config.dynamic && kind === 'loft' ? match.config[kind + 'ReceiveHoldTime'] || 0 : 0;
}
export function validReceiveHold(match, a, p) {
  return (
    a.receiveHold.playerId === p?.id &&
    a.receiveHold.serial === match.shotSerial &&
    match.canContact(p, a.kind)
  );
}

export function cancelReceiveHold(match, control) {
  control.charge = null;
  control.pending = null;
  control.chargeLock = true;
  match.label('Мимо: мяч вышел из зоны приёма', 1.2);
}

function leavesReceiveZoneNextStep(match, p, kind, dt) {
  const nextBall = { ...match.ball };
  integrateBall(nextBall, dt, match.config);
  const nextPlayer = p.jumpProfile
    ? { ...p, ...sampleJump(p.jumpProfile, p.jumpTime + dt), jumpTime: p.jumpTime + dt }
    : p;
  return contactReason(match, nextPlayer, kind, nextBall) !== null;
}

export function tryHeldContact(
  match,
  previous = match.ball,
  control = match.controls[0],
  dt = FIXED_DT,
) {
  const a = control.charge;
  if (isZoneReceive(match, a, match.players[a?.playerId]))
    return tryZoneReceive(match, previous, control, false, dt);
  match.refreshAim(a, match.inputs?.[control.slot] || EMPTY_INPUT);
  if (match.config.dynamic && a?.kind === 'drive') return false;
  if (!a || a.age < match.config.armWindup) return false;
  const p = match.players[a.playerId];
  if (a.receiveHold) {
    if (!validReceiveHold(match, a, p)) {
      cancelReceiveHold(match, control);
      return false;
    }
  }
  if (
    !match.canContact(p, a.kind, true) ||
    (!a.receiveHold &&
      !ballTouchesHands(match.ball, previous, preparedHands(p, match, a), COURT.ballRadius + 0.13))
  )
    return false;
  if (!a.receiveHold && receiveHoldTime(match, a.kind) > 0) {
    a.receiveHold = { at: match.time, serial: match.shotSerial, playerId: p.id };
  }
  // The slider is a maximum: do not wait until a fast ball has already left
  // the legal zone. A ball that is outside NOW still fails the checks above.
  if (
    a.receiveHold &&
    match.time - a.receiveHold.at < receiveHoldTime(match, a.kind) &&
    !leavesReceiveZoneNextStep(match, p, a.kind, dt)
  ) {
    return false;
  }
  // Consume the entire press, including when selection switches to a teammate.
  control.charge = null;
  control.pending = null;
  control.chargeLock = true;
  p.releaseSlow = a.kind === 'back' ? 0 : match.config.releaseWindow;
  p.releaseSlowTotal = p.releaseSlow;
  return match.makeContact(
    p,
    a.kind,
    a.power,
    shotImpulse(match.ball, p, a.kind, a.power, a.aim, match.players, match.config),
  );
}

export function tryPending(
  match,
  previous = match.ball,
  control = match.controls[0],
  dt = FIXED_DT,
) {
  const a = control.pending,
    p = match.players[a.playerId];
  if (a.comboQueued && a.comboSerial !== match.shotSerial) {
    control.pending = null;
    return false;
  }
  if (isZoneReceive(match, a, p)) return tryZoneReceive(match, previous, control, true, dt);
  match.refreshAim(a, match.inputs?.[control.slot] || EMPTY_INPUT);
  if (a.receiveHold && !validReceiveHold(match, a, p)) {
    cancelReceiveHold(match, control);
    return false;
  }
  if (a.feintAt && match.time - a.feintAt < 0.09) return false;
  if (!match.canContact(p, a.kind)) return false;
  if (
    a.kind === 'back' &&
    !ballTouchesHands(
      match.ball,
      previous,
      preparedHands(p, match, { ...a, age: Math.max(a.age || 0, match.config.armWindup) }),
      COURT.ballRadius + 0.13,
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
  p.pose = p.diving ? 'dive' : shotDefinition(kind)?.pose || 'block';
  p.animation = 0.24;
}

export function makeContact(match, p, kind, power, impulse) {
  const control = match.controls[match.humanSlot(p) ?? p.team];
  const team = p.team;
  if (match.incomingShot === 'serve' && match.lastTouch === team) {
    match.point(1 - team, 'КАСАНИЕ СВОЕЙ ПОДАЧИ');
    return false;
  }
  // Capture the incoming flight before ownership and velocity change.
  const incomingOpponent = match.lastTouch != null && match.lastTouch !== team;
  const incomingVelocity = { x: match.ball.vx, y: match.ball.vy };
  const incomingBurning =
    !!match.config.ballFire && Math.hypot(match.ball.vx, match.ball.vy) >= match.config.fireSpeed;
  if (match.lastTouch !== team) match.touches[team] = 0;
  if (!match.config.duel && match.lastTouch === team && match.lastPlayer === p.id) {
    match.point(1 - team, 'ДВА КАСАНИЯ ОДНОГО ИГРОКА');
    return false;
  }
  match.touches[team]++;
  const fourthTouch = match.touches[team] > 3;
  if (match.lastTouch !== team) match.bounces = [0, 0];
  match.lastTouch = team;
  match.lastPlayer = p.id;
  match.contacts++;
  match.cooldown = 0.13;
  match.incomingShot = kind;
  match.headHitEligible =
    kind === 'drive' &&
    (match.config.dynamic
      ? power >= 0.8 &&
        impulse.intent !== 'soft' &&
        impulse.vx * (p.team === 0 ? 1 : -1) > 0 &&
        Math.hypot(impulse.vx, impulse.vy) >= 10
      : power >= 0.8 && p.y > 0.4);
  match.headFlyEligible = match.config.dynamic && kind === 'drive' && power >= 1;
  match.shotSerial++;
  match.contactTempoState = null;
  const incomingSpeed = Math.hypot(match.ball.vx, match.ball.vy, match.ball.vz || 0);
  Object.assign(match.ball, impulse);
  beginBallSmoke(match, kind, power);
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
  if (impulse.feint && match.teamRuns[team]) {
    const j = jumpProfile(match.config);
    Object.assign(match.teamRuns[team], {
      feint: true,
      mode: match.config.feintMode,
      decoyJumped: false,
      decoyCancelled: false,
      decoyAt: match.time + Math.max(0.04, impulse.arrival - j.windup - j.rise - 0.25),
    });
  }
  if (impulse.arrival) match.planReadBlock(1 - team, impulse);
  resetFlight(match.ball, impulse.flightTempo ?? 1);
  match.recordContact(p, kind, power);
  p.armSwing.incomingVelocity = incomingVelocity;
  const modifier = impulse.cpuModifier || impulse.contactModifier;
  if (modifier) p.armSwing.aim = { soft: modifier === 'soft', fast: modifier === 'fast' };
  if (!fourthTouch && incomingOpponent && incomingBurning)
    p.handEmbers = { at: match.time, until: match.time + 5 };
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
    crosses = landing.x * match.sign(team) < 0;
  match.teamPhases[team] = crosses ? 'defense' : 'attack';
  match.teamPhases[1 - team] = 'defense';
  if (kind === 'drive') match.stats.attacks[team]++;
  else match.stats.passes[team]++;
  match.lastAction = `${shotDefinition(kind).name} · ${Math.round(power * 100)}%`;
  match.assistLabel =
    impulse.assistIntent ||
    (impulse.assisted
      ? kind === 'drive'
        ? 'Удар скорректирован над сеткой'
        : 'Пас направлен партнёру'
      : 'Свободная траектория');
  match.label(impulse.feedback || match.lastAction);
  if (crosses) {
    match.selectOnOpponentContact(1 - team);
    match.scheduleCPUBlock(1 - team);
    if (match.isHuman(team) && match.touches[team] < 3) match.selectPassReceiver(p);
  } else {
    const candidates = match.players
      .filter((other) => other.team === team && other.id !== p.id)
      .sort((a, b) => Math.abs(a.x - landing.x) - Math.abs(b.x - landing.x));
    match.selectPassReceiver(
      p,
      impulse.targetId ?? (match.mode === 'coop' ? null : candidates[0]?.id),
    );
    if (!impulse.arrival) match.cpuBlockPlan = null;
  }
  if (match.isHuman(team) && p.id !== match.controlledPlayer(control)) match.clearPasser(p);
  match.emit('hit', {
    incomingSpeed,
    incomingOpponent,
    incomingBurning,
    incomingVelocity,
    modifier: impulse.cpuModifier || impulse.contactModifier || null,
    outgoingVelocity: { x: impulse.vx, y: impulse.vy },
    legal: !fourthTouch,
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
  if (fourthTouch) match.point(1 - team, 'ЧЕТВЁРТОЕ КАСАНИЕ', p);
  else if (match.challenge?.id === 'rescue' && p.diving) resolveChallenge(match, 'СПАСЕНИЕ');
  return true;
}
