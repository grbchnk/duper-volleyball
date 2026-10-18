import { createAmbient } from './ambient.js';
import { drawBallDesign, pixelPresent } from './display.js';
import { exportSettings, importSettings } from './settings-file.js';
import { SKINS } from './sprites.js';
import { Match, EMPTY_INPUT } from './engine.js';
import { Renderer } from './renderer.js';
import { Sound } from './audio.js';
import { DEFAULTS, FIXED_DT, LIMITS, TEAMS, sanitizeConfig } from './config.js';
import { InputBuffer, GAME_KEYS } from './input.js';
import { GUIDE_HTML } from './guide.js';
import { SHOTS, SERVES } from './moves.js';
import { createArmLab } from './arm-lab.js';
import { createShotLab } from './shot-lab.js';
const $ = (id) => document.getElementById(id),
  storageKey = 'super-volley-club.config.one-hand.v1';
let config = { ...DEFAULTS };
try {
  const data = localStorage.getItem(storageKey);
  if (data) config = sanitizeConfig(JSON.parse(data));
  else {
    const previous = localStorage.getItem('super-volley-club.config.v2');
    if (previous) {
      const settings = JSON.parse(previous);
      // Preserve other preferences; the old back-pass tuning belongs to the backup.
      for (const key of Object.keys(DEFAULTS))
        if (key.startsWith('back')) settings[key] = DEFAULTS[key];
      config = sanitizeConfig(settings);
    }
  }
} catch {}
// Migrate the old default, preserving custom tuning.
if (config.backSpeedMax === 7.2) config.backSpeedMax = DEFAULTS.backSpeedMax;
const match = new Match(config),
  renderer = new Renderer($('game')),
  sound = new Sound(),
  input = new InputBuffer(),
  secondInput = new InputBuffer(undefined, undefined, 1);
const drawAmbient = createAmbient(document.createElement('canvas'), $('arena-background'));
let teams = [TEAMS[0], TEAMS[1]],
  started = false,
  paused = false,
  modalWasPaused = false,
  accumulator = 0,
  previousTime = performance.now(),
  lastUI = 0,
  toastTimer;
const modalOpen = () => !!document.querySelector('dialog[open]');
function clearActions() {
  input.clear();
  secondInput.clear();
  match.clearControls();
  match.charge = null;
  match.pending = null;
  match.aimPreview = null;
  match.previousInput = { ...EMPTY_INPUT };
}
window.addEventListener('keydown', (e) => {
  if (e.target?.matches('input,select,textarea,[contenteditable]') || modalOpen()) return;
  if (
    e.code === 'KeyR' &&
    started &&
    ['practice', 'test'].includes(match.mode) &&
    !e.target?.closest('button,a')
  ) {
    e.preventDefault();
    if (!e.repeat) repeatDrill();
    return;
  }
  if (e.code === 'Enter' || e.code === 'Escape') {
    if (e.target?.closest('button,a')) return;
    e.preventDefault();
    if (!e.repeat) {
      if (!started) startGame();
      else togglePause();
    }
    return;
  }
  if (GAME_KEYS.includes(e.code)) {
    if (e.target?.closest('button,a')) return;
    e.preventDefault();
    if (started && !paused) input.down(e.code, e.repeat);
  }
});
window.addEventListener('keyup', (e) => input.up(e.code));
window.addEventListener('blur', () => {
  clearActions();
  if (started && !paused && !modalOpen()) setPaused(true);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearActions();
    if (started) setPaused(true);
  }
});
function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 4000);
}
function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(config));
  } catch {}
}
function applyConfig(next) {
  config = sanitizeConfig(next);
  match.updateConfig(config);
  syncSettings();
  persist();
}
const physicsFields = {
  fireSpeed: [
    'Скорость появления огня',
    0.5,
    'м/с',
    'Мяч',
    'Только визуальный эффект; скорость и сила не меняются.',
  ],
  backArmMin: [
    'Сейв A: нижний угол руки',
    1,
    '°',
    'Приём одной рукой',
    '0° — рука горизонтально (90° к телу), отрицательный угол — ниже плеча.',
  ],
  backArmMax: [
    'Сейв A: верхний угол руки',
    1,
    '°',
    'Приём одной рукой',
    'Ограничивает реальную рабочую ладонь и её анимацию.',
  ],
  ballSpeed: [
    'Скорость мяча',
    0.05,
    '×',
    'Полёт мяча',
    'Меняет только темп мяча. Бег, прыжки и часы матча сохраняют свой темп.',
  ],
  cartoonFlight: [
    'Мультяшный полёт',
    0.05,
    '×',
    'Полёт мяча',
    '0 — обычная физика; 1 — полный эффект разгона и зависания.',
  ],
  cartoonStart: [
    'Скорость после касания',
    0.05,
    '×',
    'Полёт мяча',
    'Начальная доля скорости в мультяшном режиме. Меньше — больше времени прочитать удар.',
  ],
  cartoonEnd: ['Скорость в конце полёта', 0.05, '×', 'Полёт мяча'],
  cartoonRamp: ['Длительность разгона', 0.05, 'с', 'Полёт мяча'],
  cartoonHang: [
    'Зависание у вершины',
    0.05,
    '×',
    'Полёт мяча',
    '0 — без зависания; 0.85 — сильное плавное замедление у вершины навеса. На нисходящий удар не влияет.',
  ],
  gravity: ['Гравитация', 0.01, 'м/с²', 'Мяч и игроки'],
  drag: ['Сопротивление воздуха', 0.001, '', 'Мяч и игроки'],
  restitution: ['Упругость сетки', 0.01, '', 'Мяч и игроки'],
  playerSpeed: ['Скорость бега', 0.1, 'м/с', 'Мяч и игроки'],
  airMoveSpeed: [
    'Скорость движения в прыжке',
    0.1,
    'м/с',
    'Мяч и игроки',
    'Стрелки или левый стик. 0 — без перемещения в воздухе.',
  ],
  jumpSpeed: ['Высота прыжка: импульс', 0.1, 'м/с', 'Мяч и игроки'],
  hitPower: ['Сила контакта', 0.05, '×', 'Мяч и игроки'],
  releaseWindow: [
    'Допуск после отпускания',
    0.01,
    'с',
    'Точность и замах',
    '0 — строго в момент отпускания. Больше — проще попасть по мячу.',
  ],
  chargeSeconds: ['Время набора силы', 0.01, 'с', 'Точность и замах'],
  maxHold: [
    'Предельное удержание',
    0.01,
    'с',
    'Точность и замах',
    'Полный заряд автоматически отпускает удар с обычным допуском. Лимит — резервное ограничение.',
  ],
  chargeMove: ['Бег при подготовке', 0.05, '×', 'Точность и замах'],
  jumpWindup: ['Приседание до отталкивания', 0.005, 'с', 'Фазы прыжка'],
  jumpRise: ['Длительность подъёма', 0.01, '×', 'Фазы прыжка'],
  jumpHang: [
    'Пауза на вершине',
    0.005,
    'с',
    'Фазы прыжка',
    'Короткая пауза после быстрого подъёма.',
  ],
  jumpBallHang: ['Дополнительное зависание у мяча при замахе', 0.01, 'с', 'Фазы прыжка'],
  jumpFall: ['Длительность падения', 0.01, '×', 'Фазы прыжка'],
  blockWindow: [
    'Рабочее окно блока',
    0.01,
    'с',
    'Блок',
    'Только возле вершины прыжка. В середине окна блок сильнее, по краям — смягчение.',
  ],
  blockReach: ['Досягаемость рук блока', 0.01, 'м', 'Блок'],
  blockCooldown: ['Восстановление блока', 0.05, 'с', 'Блок'],
  blockDeflect: ['Скорость отскока от блока', 0.05, '×', 'Блок'],
  elbowHeight: ['Высота локтей', 0.5, 'px', 'Внешний вид рук'],
  armRoundness: ['Толщина и округлость рук', 0.05, '×', 'Внешний вид рук'],
  armScale: [
    'Размер рук',
    0.05,
    '×',
    'Внешний вид рук',
    'Меняет позу и толщину, но не игровые зоны контакта.',
  ],
  armSpring: ['Упругость кистей', 0.05, '×', 'Внешний вид рук'],
  armBend: ['Выраженность локтей', 0.05, '×', 'Внешний вид рук'],
  armWindup: [
    'Быстрая подготовка',
    0.005,
    'с',
    'Анимация рук',
    'Время подготовки рук; удержанный приём доступен после этого интервала.',
  ],
  armPowerMotion: ['Влияние силы на замах', 0.05, '×', 'Анимация рук'],
  armJumpMotion: ['Взмах рук в прыжке', 0.05, '×', 'Анимация рук'],
  diveSpeed: ['Скорость броска', 0.1, 'м/с', 'Бросок за мячом'],
  diveLift: ['Высота броска: импульс', 0.1, 'м/с', 'Бросок за мячом'],
  diveRecovery: ['Подъём после падения', 0.01, 'с', 'Бросок за мячом'],
  divePower: ['Сила приёма в броске', 0.01, '×', 'Бросок за мячом'],
  targetScore: ['Очков до победы в сете', 1, '', 'Счёт'],
};
const drawShotLab = createShotLab($('shots-dialog'), () => config, applyConfig);
const drawArmLab = createArmLab($('arms-dialog'), () => config);
function formatPhysics(key, value) {
  return (
    value.toFixed(key === 'targetScore' ? 0 : physicsFields[key][1] < 0.01 ? 3 : 2) +
    ' ' +
    physicsFields[key][2]
  );
}
function syncSettings() {
  if (config.soundMuted && sound.enabled) sound.disable();
  sound.muted = config.soundMuted;
  syncSoundButton();
  $('pixel-graphics').checked = config.pixelGraphics;
  $('home-team').value = config.homeTeam;
  $('away-team').value = config.awayTeam;
  teams = [
    TEAMS.find((t) => t.id === config.homeTeam),
    TEAMS.find((t) => t.id === config.awayTeam),
  ];
  const preview = $('ball-preview'),
    c = preview.getContext('2d');
  c.fillStyle = '#edf1df';
  c.fillRect(0, 0, preview.width, preview.height);
  c.save();
  c.translate(120, 48);
  c.scale(3 * config.ballSize, 3 * config.ballSize);
  drawBallDesign(c, config.ballSkin, config.pixelGraphics);
  c.restore();
  pixelPresent(preview, config.pixelGraphics);
  $('home-skin').value = config.skin;
  $('away-skin').value = config.awaySkin;
  $('home-color').value = config.homeColor;
  $('away-color').value = config.awayColor;
  $('ball-skin').value = config.ballSkin;
  $('ball-size').value = config.ballSize;
  $('ball-size-value').textContent = Math.round(config.ballSize * 100) + '%';
  $('aim-mode').value = config.rightStickAim ? 'right' : 'left';
  teams = teams.map((team, i) => {
    const color = config[i ? 'awayColor' : 'homeColor'];
    const rgb = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));
    const tint = (amount, white) =>
      '#' +
      rgb
        .map((v) =>
          Math.round(v * amount + white)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
    return { ...team, color, dark: tint(0.65, 0), light: tint(0.55, 115) };
  });
  input.rightStickAim = secondInput.rightStickAim = config.rightStickAim;
  $('flight-style').value = config.cartoonFlight;
  $('flight-style-value').textContent = Math.round(config.cartoonFlight * 100) + '%';
  $('preview-skin').value = config.skin;
  for (const key of ['elbowHeight', 'armRoundness', 'armScale']) {
    const el = $('preview-' + key);
    if (el) {
      el.value = config[key];
      $('preview-value-' + key).textContent = formatPhysics(key, config[key]);
    }
  }
  document
    .querySelectorAll('[data-skin]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.skin === config.skin)),
    );
  $('speed').value = config.gameSpeed;
  $('speed-value').textContent = config.gameSpeed.toFixed(2) + '×';
  $('assist').checked = config.assist;
  $('variableJump').checked = config.variableJump;
  $('drive-assist').value = config.driveAssist;
  $('drive-assist').disabled = !config.assist;
  $('drive-assist-value').textContent = config.assist
    ? Math.round(config.driveAssist * 100) + '%'
    : 'Выкл.';
  $('pass-assist').value = config.passAssist;
  $('pass-assist').disabled = !config.assist;
  $('pass-assist-value').textContent = config.assist
    ? Math.round(config.passAssist * 100) + '%'
    : 'Выкл.';
  $('trajectory').checked = config.trajectory;
  $('difficulty').value = config.cpuSkill;
  $('difficulty-value').textContent = config.cpuSkill + ' / 100';
  $('scoring').value = config.scoring;
  for (const key of Object.keys(physicsFields)) {
    const el = $('physics-' + key);
    if (el) {
      el.value = config[key];
      $('value-' + key).textContent = formatPhysics(key, config[key]);
    }
  }
}
function setPaused(value) {
  paused = value;
  clearActions();
  accumulator = 0;
  $('pause-overlay').hidden = !value || !started || match.phase === 'finished' || modalOpen();
  $('pause').textContent = value ? '▶' : 'Ⅱ';
  $('pause').setAttribute('aria-label', value ? 'Продолжить' : 'Пауза');
}
function togglePause() {
  if (started && match.phase !== 'finished') setPaused(!paused);
}
function startGame(mode = 'match') {
  if (!sound.muted)
    sound
      .enable()
      .then(syncSoundButton)
      .catch(() => {});
  teams = [
    TEAMS.find((t) => t.id === $('home-team').value),
    TEAMS.find((t) => t.id === $('away-team').value),
  ];
  syncSettings();
  match.reset(mode);
  if (mode === 'versus')
    toast(
      'Два геймпада: 1 — слева, 2 — справа. X/□ — сейв, A/✕ — снизу, Y/△ — пас, B/○ — удар. LB/L1 — смена игрока.',
    );
  if (mode === 'practice') match.startDrill($('drill').value);
  started = true;
  setPaused(false);
  $('start-overlay').hidden = true;
  $('finish-overlay').hidden = true;
  $('practice-panel').hidden = mode !== 'practice';
  for (const key of ['match', 'versus', 'practice', 'test', 'demo'])
    $(key + '-mode').classList.toggle('active', mode === key);
  document.querySelector('.game-column').scrollIntoView({ block: 'start' });
  $('game').focus({ preventScroll: true });
  updateUI();
}
function updateUI() {
  $('controller-status').hidden = match.mode !== 'versus';
  $('controller-status').textContent =
    `Игрок 1 · слева: ${input.gamepad ? 'подключён' : 'нажмите кнопку на геймпаде'} | Игрок 2 · справа: ${secondInput.gamepad ? 'подключён' : 'нажмите кнопку на втором геймпаде'}`;
  const phase = match.teamPhases[0],
    action = match.charge || match.pending,
    percent = Math.round((action?.power || 0) * 100);
  $('phase-pill').textContent =
    match.phase === 'serve' || match.phase === 'serve-motion'
      ? 'ПОДАЧА'
      : phase === 'attack'
        ? 'АТАКА'
        : 'ЗАЩИТА';
  $('phase-pill').classList.toggle('defense', phase === 'defense');
  $('charge-label').textContent =
    match.phase === 'serve' && match.charge
      ? SERVES[match.charge.kind].name + ' · отпусти для подброса'
      : match.charge
        ? `${SHOTS[match.charge.kind].name} · до срыва ${Math.max(0, config.maxHold - match.charge.age).toFixed(2)} с`
        : match.pending
          ? 'Короткий допуск…'
          : match.chargeLock
            ? 'Отпусти кнопку для нового приёма'
            : 'Зажмите S, A, W или D';
  $('charge-value').textContent = percent + '%';
  $('power-fill').style.width = percent + '%';
  $('power-fill').style.background = percent > 88 ? '#d78e76' : '#88a481';
  $('touch-count').textContent = match.touches[0] + ' / 3';
  $('rule-label').textContent = `ТЕМП ${config.gameSpeed.toFixed(2)}×`;
  let title = 'Выбери подачу',
    hint =
      'S/✕ — снизу, A/□ — мягкая укороченная, W/△ — сверху, D/○ — в прыжке. Зажми для силы, отпусти для подброса. Затем нажми ещё раз при мигании.',
    key = 'S';
  if (match.mode === 'test') {
    title = 'ТЕСТ · непрерывные мячи';
    hint =
      'Мячи летят к выбранному игроку: два обычных, затем высокий для приёма в прыжке. Раунд и позиции не сбрасываются. R — следующий мяч.';
    key = '∞';
  } else if (match.mode === 'demo') {
    title = 'Матч компьютеров';
    hint =
      'Здесь обе команды играют сами. В «Матче» вы командуете каждым приёмом, в том числе броском за мячом.';
    key = '▶';
  } else if (['point', 'set-end'].includes(match.phase)) {
    title = match.notice;
    hint =
      match.mode === 'practice'
        ? 'Сейчас повторим упражнение. Кнопка «Повторить мяч» запускает его сразу.'
        : match.pointReason;
    key = '◆';
  } else if (match.phase === 'finished') {
    title = 'Матч завершён';
    hint = 'Попробуйте новую комбинацию или измените характер физики.';
    key = '◆';
  } else if (match.active(0).recovery > 0) {
    title = 'Поднимаемся';
    hint = 'После нырка игроку нужно встать. Tab — выбрать другого свободного игрока.';
    key = 'Tab';
  } else if (match.active().diving) {
    title = match.active().diveArmed ? 'Руки готовы к приёму' : 'Приём выполнен';
    hint =
      'Направление броска зафиксировано. Мяч должен попасть в предплечья; S нажимать не нужно.';
    key = 'Q / E';
  } else if (match.phase === 'serve' && match.charge) {
    title = SERVES[match.charge.kind].name;
    hint =
      '←/→ — направление, Shift + ↑/↓ — высота. Отпусти раньше для ручной подачи; полный заряд запускает только подброс. Для удара нажми ещё раз.';
    key = SHOTS[match.charge.kind].key;
  } else if (match.charge) {
    title = match.contactWindow ? 'Отпусти сейчас!' : SHOTS[match.charge.kind].name;
    hint = '←/→ — бег и направление, Shift + ↑/↓ — выше/ниже. Отпустите у мяча; руки уже готовы.';
    key = SHOTS[match.charge.kind].key;
  } else if (match.phase === 'rally' && phase === 'defense') {
    title = 'Сохрани мяч';
    hint =
      'S — снизу, A — сейв, W — сверху, D — удар. F — блок. ↑ — прыжок, ↓ — присесть, Q / E — бросок.';
    key = 'S';
  } else if (match.phase === 'rally') {
    title = 'Построй атаку';
    hint =
      '3 выбирает нападающего у сетки. Затем ↑, короткий заряд D и отпускание у мяча. 1/2/3 — выбор игроков.';
    key = '3';
  } else if (match.phase === 'serve-motion') {
    title = match.contactWindow ? 'Идеальный момент — нажми!' : 'Мяч подброшен';
    hint =
      'Нажми кнопку подачи ещё раз для удара. Даже на 100% происходит только подброс. Без нового нажатия мяч упадёт.';
    key = SHOTS[match.serveAction.kind].key;
  }
  $('action-title').textContent = title;
  $('action-hint').textContent = hint;
  $('action-key').textContent = key;
  $('assist-status').textContent = match.assistLabel;
  document
    .querySelectorAll('[data-phase]')
    .forEach((el) => el.classList.toggle('current', el.dataset.phase === phase));
  const score = `${teams[0].short} ${match.score[0]} : ${match.score[1]} ${teams[1].short}`;
  $('status').textContent = !started ? 'Готов к подаче' : paused ? 'Пауза' : `${score} · ${title}`;
  $('game').setAttribute('aria-label', `${score}. ${title}. ${hint}`);
  $('game').dataset.phase = match.phase;
  $('game').dataset.contacts = match.contacts;
  $('game').dataset.charge = percent;
  if (match.phase === 'finished') {
    $('finish-overlay').hidden = false;
    const winner = match.sets[0] > match.sets[1] ? 0 : 1;
    $('winner-label').textContent = winner === 0 ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
    $('final-score').textContent = match.sets.join(' : ');
    $('final-detail').textContent = `${teams[winner].name} · ${match.rallies} розыгрышей`;
  }
}
function frame(time) {
  const elapsed = Math.min(0.1, (time - previousTime) / 1000);
  previousTime = time;
  input.poll();
  secondInput.poll();
  const controllerInput = input.read(match.phase);
  const secondControllerInput = secondInput.read(match.phase);
  if (started && match.mode === 'versus' && !paused && (!input.gamepad || !secondInput.gamepad)) {
    setPaused(true);
    toast('Подключите два геймпада и нажмите на каждом любую кнопку. Затем продолжите матч.');
  }
  let controllerAction = false;
  if (!modalOpen() && controllerInput.confirmPressed && !started) {
    startGame();
    controllerAction = true;
  } else if (
    !modalOpen() &&
    (controllerInput.pausePressed ||
      (match.mode === 'versus' && secondControllerInput.pausePressed)) &&
    started
  ) {
    togglePause();
    controllerAction = true;
  }
  if (started && !paused && !controllerAction && !modalOpen()) {
    accumulator += elapsed * config.gameSpeed;
    while (accumulator >= FIXED_DT) {
      match.tick(FIXED_DT, input.read(match.phase), secondInput.read(match.phase));
      input.consume();
      secondInput.consume();
      accumulator -= FIXED_DT;
      for (const event of match.events.splice(0)) {
        renderer.effect(event, match);
        sound.play(event);
      }
    }
  }
  drawAmbient(match, teams);
  renderer.draw(match, teams, paused || modalOpen() ? 0 : elapsed);
  drawArmLab(elapsed);
  drawShotLab(elapsed);
  if (time - lastUI > 65) {
    updateUI();
    lastUI = time;
  }
  requestAnimationFrame(frame);
}
for (const id of ['home-team', 'away-team'])
  for (const team of TEAMS) {
    const option = document.createElement('option');
    option.value = team.id;
    option.textContent = team.name;
    $(id).append(option);
  }
for (const [id, spec] of Object.entries(SKINS)) {
  const button = document.createElement('button');
  button.className = 'skin-choice';
  button.dataset.skin = id;
  button.title = spec.description;
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  canvas.setAttribute('aria-hidden', 'true');
  const previewMatch = new Match({ ...config, skin: id });
  previewMatch.selected[0] = -1;
  previewMatch.time = 0;
  const previewRenderer = new Renderer(canvas);
  previewRenderer.spriteScale = 1.9;
  previewRenderer.project = () => ({ x: 50, y: 90 });
  previewRenderer.ctx.fillStyle = '#f5f6ed';
  previewRenderer.ctx.fillRect(0, 0, 100, 100);
  previewRenderer.drawPlayer(previewMatch.players[0], TEAMS[0], previewMatch, 0);
  const label = document.createElement('span');
  label.textContent = spec.name;
  button.append(canvas, label);
  button.onclick = () => applyConfig({ ...config, skin: id });
  $('skin-cards').append(button);
  const option = document.createElement('option');
  option.value = id;
  option.textContent = spec.name;
  $('preview-skin').append(option);
}
for (const id of ['home-skin', 'away-skin']) {
  for (const [value, skin] of Object.entries(SKINS)) $(id).add(new Option(skin.name, value));
  $(id).onchange = (e) =>
    applyConfig({ ...config, [id === 'home-skin' ? 'skin' : 'awaySkin']: e.target.value });
}
for (const [id, key] of [
  ['home-color', 'homeColor'],
  ['away-color', 'awayColor'],
  ['ball-skin', 'ballSkin'],
])
  $(id).oninput = (e) => applyConfig({ ...config, [key]: e.target.value });
$('ball-size').oninput = (e) => applyConfig({ ...config, ballSize: +e.target.value });
$('aim-mode').onchange = (e) => {
  clearActions();
  applyConfig({ ...config, rightStickAim: e.target.value === 'right' });
};
$('preview-skin').onchange = (e) => applyConfig({ ...config, skin: e.target.value });
$('home-team').value = teams[0].id;
$('away-team').value = teams[1].id;
$('shots-quick').onclick = $('shots-button').onclick = () => openDialog('shots-dialog');
$('arms-button').onclick = () => openDialog('arms-dialog');
$('start').onclick = () => startGame();
$('new-match').onclick = $('rematch').onclick = () => startGame(match.mode);
for (const mode of ['match', 'versus', 'practice', 'test', 'demo'])
  $(mode + '-mode').onclick = () => startGame(mode);
function repeatDrill() {
  clearActions();
  if (match.mode === 'test') match.feedTestBall();
  else match.startDrill($('drill').value);
  setPaused(false);
  $('game').focus({ preventScroll: true });
}
$('drill').onchange = $('repeat-drill').onclick = repeatDrill;
$('pause').onclick = () => {
  togglePause();
  $('game').focus({ preventScroll: true });
};
$('resume').onclick = () => {
  setPaused(false);
  $('game').focus({ preventScroll: true });
};
function syncSoundButton() {
  $('sound').textContent = sound.enabled ? '♫' : '♪';
  $('sound').setAttribute('aria-label', sound.enabled ? 'Выключить звук' : 'Включить звук');
}
$('sound').onclick = async () => {
  try {
    if (sound.enabled) sound.disable();
    else await sound.enable();
    applyConfig({ ...config, soundMuted: !sound.enabled });
    syncSoundButton();
  } catch {
    toast('Звук недоступен в этом окне браузера.');
  }
  $('game').focus({ preventScroll: true });
};
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('arena').requestFullscreen();
  } catch {
    toast('Откройте игру в обычном браузере для полного экрана.');
  }
  $('game').focus({ preventScroll: true });
};
function openDialog(id) {
  modalWasPaused = paused;
  clearActions();
  $(id).showModal();
  $('pause-overlay').hidden = true;
}
$('help-button').onclick = $('combos-button').onclick = () => openDialog('help-dialog');
$('physics-quick').onclick = $('physics-button').onclick = () => openDialog('physics-dialog');
$('graphics-quick').onclick = $('graphics-button').onclick = () => openDialog('graphics-dialog');
$('settings-button').onclick = () => openDialog('settings-dialog');
for (const [id, key] of [['pixel-graphics', 'pixelGraphics']])
  $(id).onchange = (e) => applyConfig({ ...config, [key]: e.target.checked });
for (const [id, key] of [
  ['home-team', 'homeTeam'],
  ['away-team', 'awayTeam'],
])
  $(id).onchange = (e) => applyConfig({ ...config, [key]: e.target.value });
$('graphics-controls').before($('trajectory').closest('label'));
$('guide-content').innerHTML = GUIDE_HTML;
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('.close').onclick = () => dialog.close();
  const outside = (e) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  let backdropPress = false;
  dialog.addEventListener('pointerdown', (e) => {
    backdropPress = e.target === dialog && outside(e);
  });
  dialog.addEventListener('click', (e) => {
    if (backdropPress && e.target === dialog && outside(e)) dialog.close();
    backdropPress = false;
  });
  dialog.addEventListener('close', () => {
    setPaused(modalWasPaused);
    $('game').focus({ preventScroll: true });
  });
}
$('speed').oninput = (e) => applyConfig({ ...config, gameSpeed: Number(e.target.value) });
$('drive-assist').oninput = (e) => applyConfig({ ...config, driveAssist: Number(e.target.value) });
$('pass-assist').oninput = (e) => applyConfig({ ...config, passAssist: Number(e.target.value) });
$('flight-style').oninput = (e) =>
  applyConfig({ ...config, cartoonFlight: Number(e.target.value) });
for (const key of ['assist', 'trajectory', 'variableJump'])
  $(key).onchange = (e) => applyConfig({ ...config, [key]: e.target.checked });
$('difficulty').oninput = (e) => {
  const cpuSkill = Number(e.target.value);
  applyConfig({
    ...config,
    cpuSkill,
    difficulty: cpuSkill < 35 ? 'easy' : cpuSkill < 75 ? 'normal' : 'hard',
  });
};
$('scoring').onchange = (e) => applyConfig({ ...config, scoring: e.target.value });
const visualKeys = new Set([
  'fireSpeed',
  'elbowHeight',
  'armRoundness',
  'armScale',
  'armSpring',
  'armBend',
  'armWindup',
  'armPowerMotion',
  'armJumpMotion',
]);
let lastPhysicsGroup;
for (const [key, [label, step, , group, hint]] of Object.entries(physicsFields)) {
  const container = $(visualKeys.has(key) ? 'graphics-controls' : 'physics-controls');
  if (group !== lastPhysicsGroup) {
    const heading = document.createElement('h3');
    heading.className = 'physics-group';
    heading.textContent = group;
    container.append(heading);
    lastPhysicsGroup = group;
  }
  const div = document.createElement('div'),
    lab = document.createElement('label');
  lab.className = 'slider-label';
  lab.htmlFor = 'physics-' + key;
  lab.append(document.createTextNode(label));
  const out = document.createElement('output');
  out.id = 'value-' + key;
  lab.append(out);
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = 'physics-' + key;
  slider.min = LIMITS[key][0];
  slider.max = LIMITS[key][1];
  slider.step = step;
  slider.oninput = () => applyConfig({ ...config, [key]: Number(slider.value) });
  div.append(lab, slider);
  if (hint) {
    const note = document.createElement('small');
    note.textContent = hint;
    div.append(note);
  }
  container.append(div);
}
$('reset-physics').onclick = () => {
  applyConfig(DEFAULTS);
  $('config-message').textContent = 'Базовые настройки восстановлены.';
};
$('export-config').onclick = () => {
  const url = URL.createObjectURL(new Blob([exportSettings(config)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'duper-volleyball-settings.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('config-message').textContent = 'Настройки готовы к скачиванию.';
};
$('import-config').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 50000) throw new Error('слишком большой файл');
    const candidate = importSettings(await file.text());
    applyConfig(candidate);
    $('config-message').textContent = 'Настройки загружены и проверены.';
  } catch (err) {
    $('config-message').textContent = 'Не удалось загрузить: ' + err.message;
  }
  e.target.value = '';
};
for (const key of ['elbowHeight', 'armRoundness', 'armScale']) {
  const row = document.createElement('label');
  row.className = 'slider-label';
  row.textContent = physicsFields[key][0];
  const out = document.createElement('output');
  out.id = 'preview-value-' + key;
  row.append(out);
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = 'preview-' + key;
  row.htmlFor = slider.id;
  [slider.min, slider.max] = LIMITS[key];
  slider.step = physicsFields[key][1];
  slider.oninput = () => applyConfig({ ...config, [key]: Number(slider.value) });
  $('arm-cards').before(row, slider);
}
syncSettings();
updateUI();
requestAnimationFrame(frame);
if (new URLSearchParams(location.search).get('view') === 'arms') openDialog('arms-dialog');

if (new URLSearchParams(location.search).get('view') === 'shots') openDialog('shots-dialog');
