import { COURT } from './config.js';
import { clamp, launchTo, launchOverNet, resetFlight } from './physics.js';

// An invisible ball machine. Keep the sole receiver's position and animation intact.
export function feedTrainingBall(match) {
  const player = match.active(0);
  for (const p of match.players) p.benched = p.id !== player.id;
  const remote = match.random() < 0.7;
  const x = remote
    ? 1.5 + match.random() * (COURT.halfLength - 1.8)
    : -0.8 - match.random() * (COURT.halfLength - 1.2);
  const y = remote ? 3.5 + match.random() * 3 : 4.5 + match.random() * 3;
  const target = clamp(player.x + (match.random() * 2 - 1) * 1.6, -COURT.halfLength + 0.3, -0.8);
  const seconds = (0.9 + match.random() * 1.4) / match.config.ballSpeed;
  match.ball = { x, y, z: 4.5, vx: 0, vy: 0, vz: 0, spin: 0, angle: 0, attackGravity: 0 };
  const landing = { x: target, y: COURT.ballRadius, z: 4.5 };
  if (!remote || !launchOverNet(match.ball, landing, seconds, match.config))
    launchTo(match.ball, landing, seconds, match.config);
  resetFlight(match.ball);
  match.testFeeds++;
  match.testBallAge = 0;
  match.testReceivedAt = null;
  match.testNext = null;
  match.testTarget = target;
  match.testFeed = { x, y, targetX: target, speed: Math.hypot(match.ball.vx, match.ball.vy) };
  match.phase = 'rally';
  match.phaseTime = 0;
  match.pointReason = '';
  match.lastTouch = 1;
  match.lastPlayer = null;
  match.touches = [0, 0];
  match.cooldown = 0;
  match.incomingShot = 'feed';
  match.headHitEligible = false;
  match.teamPhases = ['defense', 'defense'];
  match.cpuPlans = [null, null];
  match.cpuBlockPlan = null;
  match.cpuOutForecast = null;
  match.trail = [];
  match.clearControls();
  match.emit('feed');
  match.label('ТЕСТ · мяч ' + match.testFeeds, 0.8);
}
