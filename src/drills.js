import { launchTo } from './physics.js';
const TEAM_SIZE = 3;
export function startDrill(match, drill = 'receive') {
  match.tutorialNoBall = drill === 'footwork';
  match.drill = drill;
  match.teamRuns = [null, null];
  match.server = 0;
  match.startServe();
  if (drill === 'serve') return;
  match.phase = 'rally';
  match.incomingShot = 'loft';
  match.lastTouch = 1;
  match.lastPlayer = TEAM_SIZE;
  match.teamPhases = ['defense', 'defense'];
  match.players[0].x = -7;
  if (drill === 'footwork') {
    Object.assign(match.ball, { x: 0, y: 10, vx: 0, vy: 0, vz: 0 });
    match.trail = [];
    match.label('ДВИЖЕНИЕ · ПРЫЖОК', 3);
    return;
  }
  if (['choice', 'delay', 'rescue'].includes(drill)) {
    match.selected[0] = 2;
    match.lastTouch = 0;
    match.lastPlayer = 1;
    match.touches[0] = 2;
    match.teamPhases[0] = 'attack';
    match.players[2].x = -1.6;
    match.players[3].x = match.random() < 0.5 ? 2 : 7;
    match.players[4].x = match.players[3].x + 0.8;
    match.players[5].x = match.players[3].x + 1.4;
    Object.assign(match.ball, { x: -1.5, y: 4.6, vx: 0, vy: 0 });
    if (drill === 'delay') {
      match.players[5].x = 0.8;
      match.jump(match.players[5], true);
    }
    if (drill === 'rescue') {
      match.selected[0] = 0;
      match.players[0].x = -4;
      match.lastTouch = 1;
      match.lastPlayer = 5;
      match.touches = [0, 0];
      Object.assign(match.ball, { x: -6, y: 1.8, vx: -1.2, vy: -1 });
    }
    match.label(
      drill === 'choice'
        ? 'Прочитайте защиту: ○ в глубину или L2 + ○ коротко'
        : drill === 'delay'
          ? 'Дождитесь снижения блока'
          : 'Q / E: спасите мяч, затем высокий перевод',
      3,
    );
    return;
  }
  if (drill === 'combination') {
    match.selected[0] = 1;
    match.lastTouch = 0;
    match.lastPlayer = 0;
    match.touches[0] = 1;
    match.teamPhases[0] = 'attack';
    match.players[2].x = -2.5;
    Object.assign(match.ball, { x: -3.7, y: 4.5, vx: 0, vy: 0 });
  } else if (drill === 'set') {
    match.selected[0] = 1;
    match.teamPhases[0] = 'attack';
    Object.assign(match.ball, { x: -3.7, y: 4.5, vx: 0, vy: 0 });
  } else if (drill === 'spike') {
    match.selected[0] = 0;
    match.lastTouch = 0;
    match.lastPlayer = 1;
    match.touches[0] = 2;
    match.teamPhases[0] = 'attack';
    Object.assign(match.ball, { x: -0.8, y: 5.4, vx: 0, vy: 0 });
  } else if (drill === 'dive-forward' || drill === 'dive-back') {
    const dir = drill === 'dive-forward' ? 1 : -1;
    match.players[0].x = -5;
    Object.assign(match.ball, { x: -5 + dir * 3.4, y: 2.1, vx: 0, vy: -0.2 });
  } else if (drill === 'block') {
    Object.assign(match.ball, { x: 3.2, y: 3.6 });
    launchTo(match.ball, { x: -5, y: 0.2, z: 4.5 }, 1.15 / match.config.ballSpeed, match.config);
    match.incomingShot = 'drive';
    match.selected[0] = 2;
  } else {
    Object.assign(match.ball, { x: 5, y: 5 });
    launchTo(match.ball, { x: -7, y: 0.9, z: 4.5 }, 2.1 / match.config.ballSpeed, match.config);
    match.incomingShot = 'serve';
  }
  match.label(
    drill === 'dive-forward'
      ? 'E / три нажатия вправо: бросок с приёмом'
      : drill === 'dive-back'
        ? 'Q / три нажатия влево: бросок с приёмом'
        : drill === 'combination'
          ? 'W: пас → ↑ / Space: прыжок → A / W / D: касание'
          : drill === 'spike'
            ? '3 → ↑ → D: атакуй навес у сетки'
            : 'РАЗМИНКА · каждый контакт — ваш',
  );
}
