import { Match } from './engine.js';
import { Renderer } from './renderer.js';
import { Sound } from './audio.js';
import { TEAMS, COURT } from './config.js';
import { integrateBall, resetFlight } from './physics.js';
import { ballAboveCeiling } from './ceiling-vfx.js';

const match = new Match();
match.mode = 'demo';
match.phase = 'rally';
match.noticeTime = 0;
match.config.trajectory = false;
const renderer = new Renderer(document.querySelector('#game'));
const sound = new Sound();
const status = document.querySelector('#status');
export { match, renderer, sound };
renderer.onCeilingBreak = (event) => sound.play(event);
document.querySelector('#sound').onclick = async () => {
  if (sound.enabled) sound.disable();
  else await sound.enable();
  document.querySelector('#sound').textContent = sound.enabled ? 'Выключить звук' : 'Включить звук';
};
let waiting = 0;
function launch() {
  Object.assign(match.ball, {
    x: -6,
    y: 2,
    z: 4.5,
    vx: 2.6,
    vy: 22,
    vz: 0,
    spin: 0,
    attackGravity: 0,
  });
  resetFlight(match.ball);
  match.trail = [];
  match.smokeTrail = [];
  renderer.ceiling.previous = null;
}
launch();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  match.time += dt;
  if (waiting > 0) {
    waiting -= dt;
    if (waiting <= 0) launch();
  } else {
    for (let remaining = dt; remaining > 0; remaining -= 1 / 120)
      integrateBall(match.ball, Math.min(remaining, 1 / 120), match.config);
    if (match.ball.y < COURT.ballRadius) {
      match.ball.y = COURT.ballRadius;
      match.ball.vx = match.ball.vy = 0;
      waiting = 1.2;
    }
  }
  renderer.draw(match, [TEAMS[0], TEAMS[1]], dt);
  status.textContent = ballAboveCeiling(match.ball)
    ? 'Мяч за экраном — его положение скрыто'
    : waiting > 0
      ? 'Повтор…'
      : match.ball.vy > 0
        ? 'Мяч набирает высоту'
        : 'Мяч возвращается через потолок';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
