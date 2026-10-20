import { tacticalAttack, tacticalPass, defenseScore } from './tactics.js';
import { clamp, traceBall, predictAtHeight } from './physics.js';
import { shotImpulse } from './moves.js';
import { jumpProfile } from './motion.js';
import { cpuStyle } from './cpu-styles.js';

export function cpuSkill(config) {
  const level = clamp(
    (config.cpuSkill ?? { easy: 20, normal: 55, hard: 90 }[config.difficulty]) / 100,
    0,
    1,
  );
  const mistakes = (1 - level) ** 1.5;
  return {
    level,
    reaction: 0.025 + mistakes * 0.22,
    retryDelay: 0.06 + mistakes * 0.65,
    refresh: 0.045 + mistakes * 0.14,
    speed: 0.94 + level * 0.06,
    error: 0.5 * mistakes,
    block: 0.35 + level * 0.65,
    dive: 0.5 + level * 0.5,
    serveMiss: mistakes * 0.16,
    serveError: mistakes * 0.22,
    decisionError: mistakes * 0.32,
    readError: mistakes * 0.24,
    passError: mistakes * 0.12,
    angleError: mistakes * 0.18,
    timingError: mistakes * 0.1,
    powerError: mistakes * 0.16,
    diversity: 0.2 + level * 0.8,
  };
}

export function planReception(match, team, previous = null) {
  const { config, ball } = match,
    skill = cpuSkill(config);
  const serial = match.shotSerial;
  const same = previous?.serial === serial;
  const reactionAt = same ? previous.reactionAt : match.time + skill.reaction;
  const error = same
    ? previous.error
    : (match.random() * 2 - 1) * skill.error +
      (match.random() < skill.readError ? (match.random() < 0.5 ? -1.5 : 1.5) : 0);
  const allowDive = same ? previous.allowDive : match.random() < skill.dive;
  const timing = same ? previous.timing || 0 : (match.random() * 2 - 1) * skill.timingError;
  const count = match.lastTouch === team ? match.touches[team] : 0;
  if (config.dynamic && count >= 3) return null;
  const eligible = match.players.filter(
    (p) =>
      !p.benched &&
      p.team === team &&
      p.recovery <= 0 &&
      !p.diving &&
      !p.block &&
      !(!config.duel && count && match.lastPlayer === p.id),
  );
  if (!eligible.length) return null;
  // Commit the final approach instead of chasing alternating forecast samples.
  if (
    config.dynamic &&
    same &&
    previous.contactAt > match.time &&
    previous.contactAt - match.time < 0.55 &&
    eligible.some((p) => p.id === previous.playerId) &&
    Math.abs(ball.x - previous.targetX) < 4
  )
    return { ...previous, at: match.time };
  const run = match.teamRuns?.[team];
  if (
    config.dynamic &&
    run &&
    !run.cancelled &&
    run.serial === serial &&
    match.time <= run.at + 0.12 &&
    eligible.some((p) => p.id === run.playerId)
  ) {
    return {
      playerId: run.playerId,
      targetX: run.x,
      height: run.intent === 'quick' ? 2.95 : 3.25,
      contactAt: run.at,
      jump: true,
      serial,
      reactionAt,
      error,
      allowDive,
      at: match.time,
      count,
      timing,
    };
  }
  const path = traceBall(ball, config, 5 / config.ballSpeed);
  const profile = jumpProfile(config),
    lead = profile.windup + profile.rise + profile.hang / 2;
  let best = null;
  for (let i = 4; i < path.length; i += 4) {
    const b = path[i],
      t = i / 120;
    if (b.netFault || (team === 0 ? b.x >= -0.15 : b.x <= 0.15) || b.y < 0.2 || b.vy > 1) continue;
    for (const p of eligible) {
      const jump =
        (count >= 2 || config.duel) && b.y > 2.6 && b.y <= profile.height + 2.45 && !p.jumpProfile;
      if (b.y > (jump ? profile.height + 2.45 : p.y + 2.3)) continue;
      if (jump && t < lead) continue;
      const targetX = clamp(
        b.x - (team ? -0.18 : 0.18) + error,
        team ? 0.65 : -10.3,
        team ? 10.3 : -0.65,
      );
      const travel = Math.abs(targetX - p.x);
      const available = Math.max(
        0,
        t - Math.max(0, reactionAt - match.time) - (jump ? lead * 0.65 : 0),
      );
      if (travel > config.playerSpeed * skill.speed * available + 0.65) continue;
      const score =
        t +
        travel * 0.06 -
        (jump ? 0.45 : 0) +
        (b.y < 0.6 ? 0.25 : 0) +
        (!count && config.cpuStyle === 'quick' && b.y > 1.35 ? 0.32 : 0) +
        (p.id === previous?.playerId ? -0.08 : 0);
      if (!best || score < best.score)
        best = { score, playerId: p.id, targetX, height: b.y, contactAt: match.time + t, jump };
    }
  }
  if (!best) {
    const at = predictAtHeight(ball, 0.65, config, 5 / config.ballSpeed);
    eligible.sort((a, b) => Math.abs(a.x - at.x) - Math.abs(b.x - at.x));
    best = {
      playerId: eligible[0].id,
      targetX: clamp(at.x + error, team ? 0.65 : -10.3, team ? 10.3 : -0.65),
      height: at.y,
      contactAt: match.time + at.time,
      jump: false,
    };
  }
  if (config.dynamic && same && best.playerId === previous.playerId) {
    if (Math.abs(best.targetX - previous.targetX) < 0.22) best.targetX = previous.targetX;
    else best.targetX = previous.targetX + clamp(best.targetX - previous.targetX, -0.45, 0.45);
  }
  return { ...best, serial, reactionAt, error, allowDive, at: match.time, count, timing };
}

// Every candidate uses the same impulse model as human shots and the laboratory.
function chooseCPUShotBase(match, p, kinds) {
  const skill = cpuSkill(match.config),
    forward = p.team ? -1 : 1;
  const count = match.lastTouch === p.team ? match.touches[p.team] : 0;
  const teammates = match.players.filter(
    (other) =>
      !other.benched &&
      other.team === p.team &&
      other.id !== p.id &&
      other.recovery <= 0 &&
      !other.diving,
  );
  const opponents = match.players.filter(
    (other) => !other.benched && other.team !== p.team && other.recovery <= 0,
  );
  const behind = (match.ball.x - p.x) * (p.facing || forward) < -0.25;
  const options = [];
  const plan = match.cpuPlans?.[p.team];
  const availablePower = plan ? (plan.action?.power ?? 0.08) : 1;
  for (const kind of kinds) {
    for (const power of [
      ...new Set(
        (plan?.preparation ? [plan.preparation.power] : [0.2, 0.4, 0.6, 0.8, 1]).map((power) =>
          Math.min(power, availablePower),
        ),
      ),
    ])
      for (const direction of [forward, -forward]) {
        if (count >= 2 && direction !== forward) continue;
        const angles = kind === 'drive' ? [-25, 0, 20, 40, 60] : [35, 50, 65, 78, 86];
        for (const angle of angles) {
          const rad = (angle * Math.PI) / 180;
          const impulse = shotImpulse(
            match.ball,
            p,
            kind,
            power,
            {
              vector: { x: direction * Math.cos(rad), y: Math.sin(rad) },
              // A late low ball is saved with the same soft receive as a human.
              cpuControl: true,
              manualControl: match.config.dynamic && kind === 'low' && behind,
              soft: match.config.dynamic && kind === 'low' && behind,
            },
            match.players,
            { ...match.config, assist: false },
          );
          let score = -Infinity,
            targetId = null;
          if (count < 2 && !match.config.duel) {
            const at = predictAtHeight(
              { ...match.ball, ...impulse },
              count ? 2.8 : 1.9,
              match.config,
              5 / match.config.ballSpeed,
            );
            if (
              !at.netFault &&
              at.y <= (count ? 2.8 : 1.9) &&
              at.time > 0.3 &&
              at.x * forward < -0.35
            ) {
              for (const other of teammates) {
                const miss = Math.abs(at.x - other.x);
                const reachable =
                  match.config.playerSpeed * skill.speed * Math.max(0, at.time - skill.reaction) +
                  0.7;
                if (miss > reachable) continue;
                const value =
                  10 -
                  miss * 1.1 -
                  Math.abs(at.time - 1.1) * 0.7 +
                  (count === 1 && kind === 'loft' ? 1 : 0) +
                  (!count && kind === 'low' ? 0.5 : 0) +
                  (behind && kind === 'back' ? 1.4 : 0) +
                  (other.role === (count ? 'open' : 'setter') ? 0.3 : 0);
                if (value > score) {
                  score = value;
                  targetId = other.id;
                }
              }
            }
          }
          if (
            direction === forward &&
            (count >= 2 || score === -Infinity || match.config.dynamic)
          ) {
            const path = traceBall(
              { ...match.ball, ...impulse },
              match.config,
              8 / match.config.ballSpeed,
            );
            const end = path.at(-1);
            if (!end.netFault && end.y <= 0.106 && end.x * forward > 0.5 && end.x * forward < 8.8) {
              const space = Math.min(...opponents.map((other) => Math.abs(other.x - end.x)), 9);
              score =
                (count >= 2 ? 10 : 3) +
                space * (0.3 + skill.level) -
                (path.length / 120) * 0.35 +
                (kind === 'drive' ? 0.35 : 0);
              targetId = null;
            }
          }
          if (Number.isFinite(score))
            options.push({ kind, power, impulse: { ...impulse, targetId }, score });
        }
      }
  }
  if (match.config.dynamic) {
    const available = Math.max(0.08, Math.min(1, availablePower));
    const positions = [
      0.3,
      ...opponents.map((other) => other.x * forward).sort((a, b) => a - b),
      9,
    ];
    const gaps = positions
      .slice(1)
      .map((x, i) => ({ width: x - positions[i], depth: (x + positions[i]) / 2 }))
      .sort((a, b) => b.width - a.width)
      .slice(0, 2)
      .map((gap) => gap.depth);
    if (kinds.includes('drive') && (count >= 1 || match.config.duel))
      for (const style of ['power', 'steep', 'tip', 'roll', 'free'])
        for (const targetDepth of [undefined, ...gaps]) {
          const impulse = tacticalAttack(match.ball, p, style, available, match.config, {
            targetDepth,
          });
          const path = traceBall(
            { ...match.ball, ...impulse },
            match.config,
            7 / match.config.ballSpeed,
          );
          const end = path.at(-1);
          if (end.netFault || end.y > 0.11 || end.x * forward < 0.3 || end.x * forward > 8.9)
            continue;
          const covered = defenseScore(path, opponents, match.config);
          const score =
            (count >= 2 || match.config.duel ? 12 : 10) + covered * 1.8 - (path.length / 120) * 0.3;
          options.push({ kind: 'drive', power: available, impulse, score });
        }
    if (kinds.includes('loft') && count === 1 && !match.config.duel)
      for (const play of ['high', 'quick', 'back', 'dump']) {
        const impulse =
          play === 'feint'
            ? shotImpulse(
                match.ball,
                p,
                'loft',
                available,
                { manualControl: true, play: 'feint', vector: { x: forward * 0.35, y: 0.94 } },
                match.players,
                match.config,
              )
            : tacticalPass(match.ball, p, available, { play }, match.players, match.config);
        if (!impulse) continue;
        const score =
          play === 'dump'
            ? Math.min(...opponents.map((o) => Math.abs(o.x))) > 3
              ? 14
              : 6
            : 11.2 + (play === 'quick' ? 0.3 : 0);
        if (play === 'feint' && impulse.intent !== 'feint') continue;
        options.push({ kind: 'loft', power: available, impulse, score });
      }
    addModifierOptions(match, p, kinds, available, count, teammates, opponents, options);
  }
  if (!options.length) {
    const kind = kinds.includes('back') && behind ? 'back' : kinds[0];
    return {
      kind,
      power: Math.min(0.7, availablePower),
      impulse: shotImpulse(
        match.ball,
        p,
        kind,
        Math.min(0.7, availablePower),
        { vector: { x: forward * 0.4, y: 0.92 } },
        match.players,
        { ...match.config, assist: false },
      ),
    };
  }
  return selectCPUOption(match, p, options, skill);
}

function addModifierOptions(match, p, kinds, power, count, teammates, opponents, options) {
  const forward = p.team ? -1 : 1;
  // These are real L2/R2 inputs passed through the same manual impulse as a human.
  if (!count && kinds.includes('low') && !match.config.duel) {
    for (const strength of [0.2, 0.5, 0.8, 1].map((value) => Math.min(value, power)))
      for (const direction of [forward, -forward])
        for (const degrees of [40, 60, 78]) {
          const angle = (degrees * Math.PI) / 180;
          const impulse = shotImpulse(
            match.ball,
            p,
            'low',
            strength,
            {
              manualControl: true,
              soft: true,
              cpuControl: true,
              vector: { x: direction * Math.cos(angle), y: Math.sin(angle) },
            },
            match.players,
            { ...match.config, assist: false },
          );
          const at = predictAtHeight(
            { ...match.ball, ...impulse },
            1.9,
            match.config,
            4 / match.config.ballSpeed,
          );
          if (at.netFault || at.x * forward >= -0.35 || at.y > 1.91 || at.time < 0.18) continue;
          const skill = cpuSkill(match.config);
          const receivers = teammates.filter(
            (other) =>
              Math.abs(other.x - at.x) <=
              match.config.playerSpeed * skill.speed * Math.max(0, at.time - skill.reaction) + 0.65,
          );
          receivers.sort((a, b) => Math.abs(a.x - at.x) - Math.abs(b.x - at.x));
          if (!receivers.length) continue;
          const receiver = receivers[0];
          options.push({
            kind: 'low',
            power: strength,
            impulse: {
              ...impulse,
              targetId: receiver.id,
              intent: 'soft-receive',
              cpuModifier: 'soft',
            },
            score: 11.3 - Math.abs(receiver.x - at.x) * 0.7 - Math.abs(at.time - 0.65) * 0.5,
          });
        }
  }
  if (!kinds.includes('drive') || (!count && !match.config.duel)) return;
  for (const modifier of ['soft', 'fast'])
    for (const degrees of [-20, 0, 20, 40, 60]) {
      const angle = (degrees * Math.PI) / 180;
      const impulse = shotImpulse(
        match.ball,
        p,
        'drive',
        power,
        {
          manualControl: true,
          [modifier]: true,
          vector: { x: forward * Math.cos(angle), y: Math.sin(angle) },
        },
        match.players,
        { ...match.config, assist: false },
      );
      const path = traceBall(
        { ...match.ball, ...impulse },
        match.config,
        7 / match.config.ballSpeed,
      );
      const end = path.at(-1);
      if (end.netFault || end.y > 0.11 || end.x * forward < 0.3 || end.x * forward > 8.9) continue;
      const depth = end.x * forward;
      const intent =
        modifier === 'soft' ? (depth < 3 ? 'tip' : 'roll') : degrees < 10 ? 'steep' : 'power';
      options.push({
        kind: 'drive',
        power,
        impulse: { ...impulse, intent, cpuModifier: modifier },
        score:
          (count >= 2 || match.config.duel ? 12 : 10) +
          defenseScore(path, opponents, match.config) * 1.8 -
          (path.length / 120) * 0.3,
      });
    }
}

export function selectCPUOption(match, p, options, skill = cpuSkill(match.config)) {
  const count = match.lastTouch === p.team ? match.touches[p.team] : 0;
  if (match.config.dynamic && (count >= 2 || match.config.duel)) {
    const finishers = options.filter((option) => option.kind === 'drive' && option.impulse.intent);
    if (finishers.length) options = finishers;
  }
  const style = cpuStyle(match.config);
  const recent = (match.cpuHistory?.[p.team] || []).slice(-4);
  for (const option of options) {
    const intent = option.impulse.intent;
    const repeats = recent.filter((shot) => shot.intent === intent && intent).length;
    option.score += (style.bias[intent] || 0) - repeats * skill.diversity * 0.65;
    if (
      option.impulse.cpuModifier &&
      !recent.some((shot) => shot.modifier === option.impulse.cpuModifier)
    )
      option.score += skill.diversity * 0.45;
    if (match.cpuPlans?.[p.team]?.preparation?.intent === intent) option.score += 0.25;
  }
  options.sort((a, b) => b.score - a.score);
  if (match.random() < skill.decisionError) {
    // A worse tactical decision remains a legal physical shot, not a forced loss.
    const weaker = options.filter((option) => option.score >= options[0].score - 4).slice(2, 16);
    if (weaker.length) return weaker[Math.floor(match.random() * weaker.length)];
  }
  const pool = options
    .filter((option) => option.score >= options[0].score - (0.4 + skill.diversity * 1.5))
    .slice(0, 20);
  const temperature = 0.15 + skill.diversity * 0.4;
  const weights = pool.map((option) => Math.exp((option.score - pool[0].score) / temperature));
  let roll = match.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[0];
}

// Execution error is a small physical angle error, never a scripted miss.
// The same seeded input reproduces it; stronger players have less variation.
export function chooseCPUShot(match, p, kinds) {
  const result = chooseCPUShotBase(match, p, kinds);
  if (!match.config.dynamic) return result;
  const skill = cpuSkill(match.config);
  const i = result.impulse,
    speed = Math.hypot(i.vx, i.vy);
  const spread = result.impulse.targetId != null ? skill.passError : skill.angleError;
  const angle = Math.atan2(i.vy, i.vx) + (match.random() * 2 - 1) * spread;
  const magnitude = speed * (1 - match.random() * skill.powerError);
  const varied = {
    ...result,
    impulse: {
      ...i,
      vx: magnitude * Math.cos(angle),
      vy: magnitude * Math.sin(angle),
      flightLaunchVy: magnitude * Math.sin(angle),
    },
  };
  // Execution variation may hit the tape, but must not turn a legal selected
  // shot into a deliberate flight through the open space under the mesh.
  if (
    traceBall({ ...match.ball, ...varied.impulse }, match.config, 8 / match.config.ballSpeed).at(-1)
      .netFault
  )
    return result;
  return varied;
}
