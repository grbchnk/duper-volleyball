import { Match } from './engine.js';
import { Renderer } from './renderer.js';
import { blockWindow, jumpDuration, sampleJump } from './motion.js';
import { configuredTeam } from './teams.js';
import { COURT, LIMITS } from './config.js';

export function simulateBlock(config, { time, dx = 0, dy = 0, speed = 12 } = {}) {
  const match = new Match(config);
  match.reset('versus');
  match.phase = 'rally';
  match.lastTouch = 1;
  match.lastPlayer = 5;
  match.incomingShot = 'drive';
  match.teamPhases = ['defense', 'defense'];
  match.selected[0] = 2;
  const player = match.players[2];
  player.x = -0.65;
  match.requestBlock(0);
  const profile = { ...player.jumpProfile };
  const apex = profile.windup + profile.rise + profile.hang / 2;
  player.jumpTime = time ?? apex;
  Object.assign(player, sampleJump(profile, player.jumpTime));
  player.pose = player.jumpTime < profile.windup ? 'crouch' : 'block';
  if (player.jumpTime >= jumpDuration(profile)) {
    player.jumpProfile = null;
    player.block = 0;
    player.pose = 'idle';
  }
  const zone = {
    x: player.x + 0.22,
    y: player.y + 2.05,
    width: config.blockReach * 2,
    height: config.blockHeight * 2,
  };
  Object.assign(match.ball, { x: zone.x + dx, y: zone.y + dy, vx: -speed, vy: -2 });
  const active = blockWindow(player, config);
  const hit = match.tryBlocks();
  return { match, player, profile, apex, zone, active, hit, duration: jumpDuration(profile) };
}

export function createBlockLab(root, getConfig, apply) {
  const fields = [
    [
      'blockWindow',
      'Рабочее окно',
      0.01,
      'с',
      'Время около середины паузы на вершине. Вне окна мяч проходит мимо рук.',
    ],
    [
      'blockReach',
      'Горизонтальная досягаемость',
      0.01,
      'м',
      'Полуширина зоны вокруг рук. Изменяет левую и правую границы рамки.',
    ],
    [
      'blockHeight',
      'Вертикальная досягаемость',
      0.01,
      'м',
      'Допуск над ладонями и под ними. Ниже верхнего края сетки блок не срабатывает.',
    ],
    [
      'blockCooldown',
      'Восстановление',
      0.05,
      'с',
      'Минимальный интервал между попытками; дополнительно нужно приземлиться.',
    ],
    [
      'blockDeflect',
      'Доля скорости отскока',
      0.05,
      '×',
      'Сколько горизонтальной скорости входящего мяча сохраняется после отражения.',
    ],
  ];
  root.innerHTML = `<div class="block-layout"><aside class="flat-settings"><h3>Блок · настройки матча</h3><p class="hint">Зелёная рамка — действующий блок, серая — руки пока не отбивают. Мяч должен быть выше сетки.</p>${fields.map(([key, name, step, unit, hint]) => `<label class="setting-label" for="lab-${key}">${name} <output id="lab-value-${key}"></output></label><input id="lab-${key}" type="range" min="${LIMITS[key][0]}" max="${LIMITS[key][1]}" step="${step}"><small class="setting-note">${unit} · ${hint}</small>`).join('')}<h3>Условия примера</h3><label class="setting-label" for="block-dx">Мяч по горизонтали, м</label><input id="block-dx" type="range" min="-1" max="1" step="0.05" value="0"><label class="setting-label" for="block-dy">Мяч относительно ладоней, м</label><input id="block-dy" type="range" min="-0.8" max="0.8" step="0.05" value="0"><label class="setting-label" for="block-speed">Входящая скорость, м/с</label><input id="block-speed" type="range" min="3" max="25" step="1" value="12"><button id="block-apex" class="secondary">Точно в середину окна</button><button id="block-play" class="secondary">Пауза</button></aside><section><canvas id="block-canvas" width="960" height="520" aria-label="Зона блока и положение рук во времени"></canvas><div class="block-timeline"><div id="block-window-band"></div><div id="block-time-marker"></div></div><label for="block-time">Момент прыжка <output id="block-time-value"></output></label><input id="block-time" type="range" min="0" step="0.005" value="0"><p id="block-result" role="status"></p><p class="hint">Полоса показывает всё время прыжка; зелёный отрезок — рабочее окно. В центре окна и при попадании в центральную половину зоны по высоте — точный блок. Попадание в верхний край может уйти за руки: это часть игровой физики.</p></section></div>`;
  const $ = (id) => root.querySelector('#' + id);
  const renderer = new Renderer($('block-canvas'), { scene: false });
  let time = 0,
    playing = true;
  for (const [key] of fields)
    $('lab-' + key).oninput = (e) => apply({ ...getConfig(), [key]: +e.target.value });
  $('block-time').oninput = (e) => {
    time = +e.target.value;
    playing = false;
    $('block-play').textContent = 'Продолжить';
  };
  $('block-play').onclick = () => {
    playing = !playing;
    $('block-play').textContent = playing ? 'Пауза' : 'Продолжить';
  };
  $('block-apex').onclick = () => {
    time = simulateBlock(getConfig()).apex;
    playing = false;
    $('block-play').textContent = 'Продолжить';
  };
  return (dt) => {
    const config = getConfig();
    const data = simulateBlock(config, {
      time,
      dx: +$('block-dx').value,
      dy: +$('block-dy').value,
      speed: +$('block-speed').value,
    });
    if (playing) time = (time + dt * 0.55) % (data.duration + 0.35);
    const { match, player, zone, active, hit, apex, duration } = data;
    for (const [key] of fields) {
      $('lab-' + key).value = config[key];
      $('lab-value-' + key).textContent = config[key].toFixed(2);
    }
    $('block-time').max = duration;
    $('block-time').value = Math.min(time, duration);
    $('block-time-value').textContent = time.toFixed(3) + ' с';
    $('block-window-band').style.left =
      Math.max(0, ((apex - config.blockWindow / 2) / duration) * 100) + '%';
    $('block-window-band').style.width = (config.blockWindow / duration) * 100 + '%';
    $('block-time-marker').style.left = Math.min(100, (time / duration) * 100) + '%';
    $('block-result').textContent =
      `${hit ? match.notice : active ? 'Окно открыто · мяч вне зоны' : 'Окно закрыто'} · окно ${(apex - config.blockWindow / 2).toFixed(3)}–${(apex + config.blockWindow / 2).toFixed(3)} с · мяч: Δx ${$('block-dx').value}, Δy ${$('block-dy').value} м${hit ? ' · отскок ' + Math.hypot(match.ball.vx, match.ball.vy).toFixed(1) + ' м/с' : ''}`;
    const c = renderer.ctx;
    c.fillStyle = '#edf1df';
    c.fillRect(0, 0, 960, 540);
    renderer.project = (x, y = 0) => ({ x: 520 + x * 90, y: 465 - y * 90 });
    renderer.spriteScale = 4.5;
    const floor = renderer.project(0),
      tape = renderer.project(0, COURT.netHeight);
    c.fillStyle = '#57766d';
    c.fillRect(tape.x, tape.y, 5, floor.y - tape.y);
    c.fillStyle = '#a89472';
    c.fillRect(100, floor.y, 760, 3);
    renderer.drawPlayer(player, configuredTeam(config, 0), match, 0);
    const top = renderer.project(zone.x - zone.width / 2, zone.y + zone.height / 2);
    c.fillStyle = active ? '#30957928' : '#7a87951a';
    c.strokeStyle = active ? '#27886c' : '#8b969b';
    c.lineWidth = 2;
    c.fillRect(top.x, top.y, zone.width * 90, zone.height * 90);
    c.strokeRect(top.x, top.y, zone.width * 90, zone.height * 90);
    renderer.drawBall(match);
  };
}
