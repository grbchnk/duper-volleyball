import { clamp, launchTo } from './physics.js';
import { jumpProfile } from './motion.js';
import { shotSettings } from './shot-settings.js';

// An explicitly requested team play: one free teammate sells the jump,
// while the other receives a real, freely simulated lob for the chosen attack.
export function feintPass(ball, passer, kind, power, aim, players, config) {
  if (config.duel) return null;
  const candidates = players.filter(
    (p) =>
      p.team === passer.team &&
      p.id !== passer.id &&
      !p.benched &&
      p.recovery <= 0 &&
      !p.diving &&
      !p.block,
  );
  if (candidates.length < 2) return null;
  const decoy = candidates
    .filter((p) => !aim.controlledIds?.includes(p.id) && !p.jumpProfile && p.y <= 0 && p.vy <= 0)
    .sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || a.id - b.id)[0];
  const receiver = candidates.find((p) => p.id !== decoy?.id);
  if (!decoy || !receiver) return null;
  const side = passer.team === 0 ? -1 : 1;
  const targetX = side * 2.8;
  const target = { x: targetX, y: 3.2, z: ball.z };
  const settings = shotSettings(config, kind);
  const strength = clamp(power, 0, 1) ** settings.PowerCurve;
  const budget =
    (settings.SpeedMin + (settings.SpeedMax - settings.SpeedMin) * strength) * config.hitPower;
  const jump = jumpProfile(config);
  const minimum = Math.max(
    jump.windup + jump.rise + 0.3,
    Math.abs(receiver.x - targetX) / config.playerSpeed + jump.windup + jump.rise + 0.12,
  );
  let best = null;
  for (const duration of [0.9, 1.05, 1.2, 1.35, 1.5, 1.65]) {
    const seconds = Math.max(minimum, duration / config.ballSpeed);
    const launch = { ...ball, attackGravity: 0 };
    launchTo(launch, target, seconds, config, 0);
    if (Math.hypot(launch.vx, launch.vy) > budget + 1e-6) continue;
    const score = Math.abs(
      seconds - Math.max(minimum, (1.05 + strength * 0.35) / config.ballSpeed),
    );
    if (!best || score < best.score) best = { launch, seconds, score };
  }
  if (!best) return null;
  return {
    vx: best.launch.vx,
    vy: best.launch.vy,
    vz: 0,
    spin: 0,
    attackGravity: 0,
    assisted: true,
    intent: 'feint',
    feint: true,
    targetId: receiver.id,
    targetX,
    arrival: best.seconds,
    decoyId: decoy.id,
    flightAge: 0,
    flightPhysicalAge: 0,
    flightLaunchVy: best.launch.vy,
    feedback: `Обманка: игрок ${(decoy.id % 3) + 1} прыгает, атакует ${(receiver.id % 3) + 1}`,
  };
}

export function isFeintDecoy(match, player) {
  const run = match.teamRuns?.[player.team];
  return !!(
    run?.feint &&
    !run.cancelled &&
    !run.decoyCancelled &&
    run.serial === match.shotSerial &&
    run.decoyId === player.id &&
    match.phase === 'rally' &&
    match.time < run.at + 0.3
  );
}

export function stepFeintDecoy(match, player) {
  if (!isFeintDecoy(match, player)) return false;
  const run = match.teamRuns[player.team];
  if (
    match.humanSlot(player) !== null ||
    player.recovery > 0 ||
    player.diving ||
    player.block > 0
  ) {
    run.decoyCancelled = true;
    return false;
  }
  player.returnHome = false;
  player.clearLane = null;
  player.moveVx = player.returnVx = player.vx = 0;
  player.facing = -match.sign(player.team);
  if (!run.decoyJumped && match.time >= run.decoyAt && match.jump(player)) {
    run.decoyJumped = true;
    player.armSwing = { kind: 'drive', power: 0.7, age: 0, hit: false, feint: true };
    match.emit('jump', { team: player.team, playerId: player.id, feint: true });
    // Use the existing CPU reading skill: a defender may commit to the fake.
    const j = player.jumpProfile;
    match.planReadBlock(1 - player.team, { arrival: j.windup + j.rise });
  }
  return true;
}

export function queueFeintAttack(match, control, action) {
  const run = match.teamRuns?.[control.team];
  const p = match.players[action.playerId];
  if (
    !run?.feint ||
    run.mode !== 'queued' ||
    run.attackCancelled ||
    run.serial !== match.shotSerial ||
    run.playerId !== p?.id ||
    match.controlledPlayer(control) !== p.id ||
    action.kind !== 'drive' ||
    p.jumpProfile ||
    p.diving ||
    p.recovery > 0 ||
    p.block > 0 ||
    match.phase !== 'rally'
  )
    return;
  const j = jumpProfile(match.config);
  const travel = Math.max(0, Math.abs(p.x - run.x) - 0.2) / match.config.playerSpeed;
  if (run.at - match.time < travel + j.windup + j.rise - 0.04) return;
  action.comboQueued = true;
  run.attackQueued = true;
  action.comboSerial = match.shotSerial;
  action.ttl = Math.max(action.ttl, run.at - match.time + 0.2);
  action.aim = { ...action.aim };
  match.label('Удар запомнен — атакующий выйдет под навес и прыгнет');
}

export function cancelFeintAttack(match, control) {
  const action = control.pending;
  if (!action?.comboQueued) return;
  const run = match.teamRuns?.[control.team];
  if (run?.feint) run.attackCancelled = true;
  control.pending = null;
}

export function stepFeintAttack(match, p, dt) {
  const run = match.teamRuns?.[p.team];
  if (
    !run?.feint ||
    run.mode !== 'queued' ||
    run.attackCancelled ||
    run.serial !== match.shotSerial ||
    run.playerId !== p.id ||
    match.phase !== 'rally'
  )
    return false;
  const slot = match.humanSlot(p);
  const control = match.controls[slot];
  const action = control?.pending;
  if (slot === null || !action?.comboQueued || action.playerId !== p.id) return false;
  const input = match.inputs?.[slot];
  if (p.diving || p.recovery > 0 || p.block > 0 || (input?.axis && !control.previousInput.axis)) {
    cancelFeintAttack(match, control);
    return false;
  }
  p.returnHome = false;
  p.clearLane = null;
  if (p.jumpProfile) {
    p.vx = p.moveVx = 0;
    return true;
  }
  const j = jumpProfile(match.config);
  const jumpAt = run.at - j.windup - j.rise;
  const distance = run.x - p.x;
  const old = p.x;
  const step = match.config.playerSpeed * dt;
  p.x += clamp(distance, -step, step);
  p.vx = p.moveVx = (p.x - old) / dt;
  p.facing = -match.sign(p.team);
  p.runTime = p.vx ? p.runTime + dt : 0;
  if (match.time >= jumpAt) {
    if (Math.abs(run.x - p.x) > 0.5 || match.time > jumpAt + 0.1) {
      cancelFeintAttack(match, control);
      return false;
    }
    if (match.jump(p)) {
      run.attackJumped = true;
      match.emit('jump', { team: p.team, playerId: p.id, combination: true });
    }
  }
  return true;
}
