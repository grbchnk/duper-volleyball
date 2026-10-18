import { Match } from './engine.js';
import { FIXED_DT } from './config.js';
import { traceBall } from './physics.js';
import { sampleServeMotion } from './motion.js';

// Drive the real serve state machine, including timing, reach, misses and penalties.
export function simulateServe(
  config,
  { kind, power, angle = null, playerId = 0, timingOffset = 0 },
) {
  const match = new Match(config);
  match.reset('versus');
  match.server = playerId < 3 ? 0 : 1;
  match.startServe();
  const player = match.active(match.server);
  const aim =
    angle === null
      ? {}
      : {
          vector: {
            x: Math.cos((angle * Math.PI) / 180),
            y: Math.sin((angle * Math.PI) / 180),
          },
        };
  match.beginServe({ kind, power, aim });
  const motion = structuredClone(match.serveAction);
  const pressTime = Math.max(FIXED_DT, motion.ideal + timingOffset);
  const frames = [];
  const capture = () => ({
    ball: { ...match.ball },
    player: structuredClone(player),
    action: structuredClone(match.serveAction),
    phase: match.phase,
    time: match.phaseTime,
    contactWindow: match.controls[match.serverSlot()].contactWindow,
  });
  // The ball starts in the tossing hand at t=0.
  Object.assign(match.ball, sampleServeMotion(player, match.serveAction, 0));
  frames.push(capture());
  let pressed = false;
  let pressFrame = null;
  for (let i = 1; i <= Math.ceil(12 / FIXED_DT); i++) {
    const hit = !pressed && i * FIXED_DT >= pressTime - 1e-9;
    const input = { buttonVector: aim.vector, ...(hit ? { [kind]: true } : {}) };
    if (hit) pressed = true;
    match.tick(FIXED_DT, player.team === 0 ? input : {}, player.team === 1 ? input : {});
    frames.push(capture());
    if (hit) pressFrame = frames.length - 1;
    if (match.phase !== 'serve-motion') break;
  }
  const hit = match.stats.serves[player.team] > 0;
  const ball = { ...match.ball };
  const impulse = Object.fromEntries(
    ['vx', 'vy', 'vz', 'spin', 'flightAge', 'flightLaunchVy', 'flightPhysicalAge'].map((key) => [
      key,
      ball[key] ?? 0,
    ]),
  );
  impulse.assisted = false;
  const points = hit ? traceBall(ball, config, 15) : [ball];
  return {
    match,
    player,
    ball,
    impulse,
    points,
    free: points,
    frames,
    motion,
    hit,
    pressTime: pressFrame === null ? null : pressFrame * FIXED_DT,
    pressFrame,
    launchTime: (frames.length - 1) * FIXED_DT,
    result: hit ? (match.lastAction.includes('ИДЕАЛЬНО') ? 'Идеально' : 'Неточно') : 'Промах',
  };
}
