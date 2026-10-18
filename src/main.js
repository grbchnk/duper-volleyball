import { createFinishScreen } from './finish-screen.js';
import { createDiagnostics } from './diagnostics.js';
import { createTutorial } from './tutorial.js';
import { PHYSICS_FIELDS as physicsFields, SETTINGS_SCHEMA } from './settings-schema.js';
import { createDynamicUI } from './dynamic-ui.js';
import { createClub } from './club.js';
import { createAmbient } from './ambient.js';
import { drawBallDesign, pixelPresent } from './display.js';
import { exportSettings, importSettings } from './settings-file.js';
import { SKINS } from './sprites.js';
import { Match, EMPTY_INPUT } from './engine.js';
import { Renderer } from './renderer.js';
import { Sound } from './audio.js';
import { createAmbienceUI } from './ambience-ui.js';
import { DEFAULTS, FIXED_DT, LIMITS, TEAMS, sanitizeConfig } from './config.js';
import { InputBuffer, GAME_KEYS } from './input.js';
import { GUIDE_HTML } from './guide.js';
import { SHOTS, SERVES } from './moves.js';
import { createArmLab } from './arm-lab.js';
import { createShotLab } from './shot-lab.js';
import { gameCanvasSize } from './canvas-size.js';
const $ = (id) => document.getElementById(id),
  storageKey = 'duper-volleyball.dynamic-v3.config';
let config = { ...DEFAULTS };
try {
  const data = localStorage.getItem(storageKey);
  if (data) config = importSettings(data);
  else {
    const previous = localStorage.getItem('duper-volleyball.dynamic-v3.previous');
    if (previous) {
      config = importSettings(previous);
    }
  }
} catch {}
const match = new Match(config),
  renderer = new Renderer($('game')),
  sound = new Sound(),
  input = new InputBuffer(),
  secondInput = new InputBuffer(undefined, undefined, 1);
export { match };
function resizeGameCanvas() {
  const canvas = $('game');
  const size = gameCanvasSize(
    document.fullscreenElement === $('arena'),
    window.innerWidth,
    window.innerHeight,
    window.devicePixelRatio || 1,
  );
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
}
document.addEventListener('fullscreenchange', resizeGameCanvas);
window.addEventListener('resize', resizeGameCanvas);
const updateDiagnostics = createDiagnostics(
  match,
  new URLSearchParams(location.search).has('debug'),
);
const drawAmbient = createAmbient(document.createElement('canvas'), $('arena-background'));
const finishScreen = createFinishScreen();
let dynamicUI, club, ambienceUI, tutorial;
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
  sound.updateCharge(null);
  input.clear();
  secondInput.clear();
  match.clearControls();
  match.controls[0].charge = null;
  match.controls[0].pending = null;
  match.controls[0].aimPreview = null;
  match.controls[0].previousInput = { ...EMPTY_INPUT };
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
      if (!started) {
        if (e.code === 'Enter') {
          if (club) club.startSelected();
          else startGame();
        }
      } else if (match.phase === 'finished' && e.code === 'Enter') {
        const next = $('club-next');
        if (next && !next.hidden) next.click();
        else startGame();
      } else togglePause();
    }
    return;
  }
  if (GAME_KEYS.includes(e.code)) {
    if (e.target?.closest('button,a')) return;
    e.preventDefault();
    if (!started && ['ArrowLeft', 'ArrowRight'].includes(e.code)) {
      if (!e.repeat) club?.moveChoice(e.code === 'ArrowRight' ? 1 : -1);
      return;
    }
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
    sound.updateMusic(config, false);
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
    localStorage.setItem(storageKey, exportSettings(config));
  } catch {}
}
function applyConfig(next, session = false) {
  const saved = !session ? club?.rememberChanges(next) : null;
  config = sanitizeConfig(next);
  match.updateConfig(config);
  syncSettings();
  if (!session) {
    if (saved) {
      try {
        localStorage.setItem(storageKey, exportSettings(saved));
      } catch {}
    } else persist();
  }
}

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
  ambienceUI?.sync();
  if (config.soundMuted && sound.enabled) sound.disable();
  sound.muted = config.soundMuted;
  syncSoundButton();
  $('pixel-graphics').checked = config.pixelGraphics;
  $('ball-fire').checked = config.ballFire;
  $('lively-background').checked = config.livelyBackground;
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
  $('receive-momentum').checked = config.receiveMomentum;
  $('profile-assistance').hidden = config.dynamic;
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
      if (key === 'receiveTransfer' || key === 'receiveDamping')
        el.disabled = !config.receiveMomentum;
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
function startGame(mode = 'match', activity = false, learning = false) {
  if (!learning) tutorial?.leave();
  if (!activity) club?.leave();
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
  dynamicUI?.reset();
  if (mode === 'versus')
    toast(
      'Два геймпада: □ приём, △ пас, ○ атака, ✕ прыжок. L2 — мягко одной рукой, R2 — сильнее и прямее. L1 — смена, R1 — блок.',
    );
  if (mode === 'practice') match.startDrill($('drill').value);
  started = true;
  setPaused(false);
  $('start-overlay').hidden = true;
  finishScreen.reset();
  $('practice-panel').hidden = mode !== 'practice';
  for (const key of ['match', 'versus', 'practice', 'test', 'demo'])
    $(key + '-mode').classList.toggle('active', mode === key);
  document.querySelector('.game-column').scrollIntoView({ block: 'start' });
  $('game').focus({ preventScroll: true });
  updateUI();
}
function updateUI() {
  updateDiagnostics();
  $('controller-status').hidden = !['versus', 'coop'].includes(match.mode);
  $('controller-status').textContent =
    match.mode === 'coop'
      ? `P1: ${match.coopBackSlot === 0 ? 'два задних' : 'передний'}${input.gamepad ? '' : ' · подключите геймпад'} | P2: ${match.coopBackSlot === 2 ? 'два задних' : 'передний'}${secondInput.gamepad ? '' : ' · подключите геймпад'} · смена после нашего очка`
      : `P1 · слева: ${input.gamepad ? 'подключён' : 'нажмите кнопку на геймпаде'} | P2 · справа: ${secondInput.gamepad ? 'подключён' : 'нажмите кнопку на втором геймпаде'}`;
  const phase = match.teamPhases[0],
    hud =
      match.mode === 'coop' && ['serve', 'serve-motion'].includes(match.phase)
        ? match.controls[match.serverSlot()]
        : match.controls[0],
    action = hud.charge || hud.pending,
    percent = Math.round((action?.power || 0) * 100);
  $('phase-pill').textContent =
    match.phase === 'serve' || match.phase === 'serve-motion'
      ? 'ПОДАЧА'
      : phase === 'attack'
        ? 'АТАКА'
        : 'ЗАЩИТА';
  $('phase-pill').classList.toggle('defense', phase === 'defense');
  $('charge-label').textContent =
    match.phase === 'serve' && hud.charge
      ? SERVES[hud.charge.kind].name + ' · отпусти для подброса'
      : hud.charge
        ? `${SHOTS[hud.charge.kind].name} · отпусти у мяча · ${Math.round(hud.charge.power * 100)}%`
        : hud.pending
          ? 'Короткий допуск…'
          : match.controls[0].chargeLock
            ? 'Отпусти кнопку для нового приёма'
            : 'Зажмите S, A, W или D';
  $('charge-value').textContent = percent + '%';
  $('power-fill').style.width = percent + '%';
  $('power-fill').style.background = percent > 88 ? '#d78e76' : '#88a481';
  $('touch-count').textContent = match.touches[0] + ' / 3';
  $('rule-label').textContent = `ТЕМП ${config.gameSpeed.toFixed(2)}×`;
  let title = 'Выбери подачу',
    hint =
      '□ — снизу, △ — сверху, ○ — в прыжке. Зажми для силы, отпусти для подброса. Затем нажми ещё раз при мигании.',
    key = 'S';
  if (match.mode === 'test') {
    title = 'ТЕСТ · непрерывные мячи';
    hint =
      'Один принимающий. Мяч появляется в случайных местах с разной скоростью и высотой. После приёма или промаха прилетит новый. R — следующий мяч.';
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
  } else if (match.phase === 'serve' && hud.charge) {
    title = SERVES[hud.charge.kind].name;
    hint =
      '←/→ — направление, Shift + ↑/↓ — высота. Отпусти раньше для ручной подачи; полный заряд запускает только подброс. Для удара нажми ещё раз.';
    key = SHOTS[hud.charge.kind].key;
  } else if (hud.charge) {
    title = hud.contactWindow ? 'Отпусти сейчас!' : SHOTS[hud.charge.kind].name;
    hint = '←/→ — бег и направление, Shift + ↑/↓ — выше/ниже. Отпустите у мяча; руки уже готовы.';
    key = SHOTS[hud.charge.kind].key;
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
    title = hud.contactWindow ? 'Идеальный момент — нажми!' : 'Мяч подброшен';
    hint =
      'Нажми кнопку подачи ещё раз для удара. Даже на 100% происходит только подброс. Без нового нажатия мяч упадёт.';
    key = SHOTS[match.serveAction.kind].key;
  }
  if (
    match.mode === 'coop' &&
    ['serve', 'serve-motion'].includes(match.phase) &&
    match.server === 0
  )
    hint = `Подаёт P${match.coopBackSlot === 0 ? 1 : 2} · ${hint}`;
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
  const clubResult = club?.ui();
  if (match.phase === 'finished') {
    const winner = match.sets[0] > match.sets[1] ? 0 : 1;
    finishScreen.render({
      label: winner === 0 ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ',
      score: match.sets.join(' : '),
      detail: teams[winner].name + ' · ' + match.rallies + ' розыгрышей',
      ...clubResult,
    });
  }
}
function frame(time) {
  const elapsed = Math.min(0.1, (time - previousTime) / 1000);
  previousTime = time;
  input.poll();
  secondInput.poll();
  const controllerInput = input.read(match.phase);
  const secondControllerInput = secondInput.read(match.phase);
  if (!started) club?.lobbyInput(controllerInput);
  if (
    started &&
    ['versus', 'coop'].includes(match.mode) &&
    !paused &&
    (!input.gamepad || !secondInput.gamepad)
  ) {
    setPaused(true);
    toast('Подключите два геймпада и нажмите на каждом любую кнопку. Затем продолжите матч.');
  }
  let controllerAction = false;
  if (!modalOpen() && controllerInput.confirmPressed && !started) {
    if (club) club.startSelected();
    else startGame();
    controllerAction = true;
  } else if (!modalOpen() && controllerInput.confirmPressed && tutorial?.ready) {
    tutorial.confirm();
    controllerAction = true;
  } else if (!modalOpen() && controllerInput.confirmPressed && match.phase === 'finished') {
    const next = $('club-next');
    if (next && !next.hidden) next.click();
    else startGame();
    controllerAction = true;
  } else if (
    !modalOpen() &&
    (controllerInput.pausePressed ||
      (['versus', 'coop'].includes(match.mode) && secondControllerInput.pausePressed)) &&
    started
  ) {
    togglePause();
    controllerAction = true;
  }
  if (started && !controllerAction && !modalOpen() && !club?.drawerOpen)
    dynamicUI?.input(controllerInput);
  if (
    started &&
    !paused &&
    !controllerAction &&
    !modalOpen() &&
    !dynamicUI?.playing &&
    !club?.drawerOpen
  ) {
    accumulator += elapsed * config.gameSpeed;
    while (accumulator >= FIXED_DT) {
      const primary = input.read(match.phase);
      match.tick(FIXED_DT, primary, secondInput.read(match.phase));
      tutorial?.observe(primary);
      input.consume();
      secondInput.consume();
      accumulator -= FIXED_DT;
      for (const event of match.events.splice(0)) {
        renderer.effect(event, match);
        sound.play(event);
      }
    }
  }
  const charges =
    started && !paused && !modalOpen() && !dynamicUI?.playing && !club?.drawerOpen
      ? match
          .humanControllers()
          .map(([, slot]) => match.controls[slot].charge?.power)
          .filter((p) => p !== undefined)
      : [];
  sound.updateCharge(charges.length ? Math.max(...charges) : null);
  sound.updateMusic(config, !document.hidden, paused || modalOpen());
  drawAmbient(match, teams);
  const shown = dynamicUI?.frame(elapsed, controllerInput, secondControllerInput) || match;
  renderer.draw(shown, teams, paused || modalOpen() ? 0 : elapsed);
  drawArmLab(elapsed);
  drawShotLab(elapsed);
  if (time - lastUI > 65) {
    updateUI();
    tutorial?.update();
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
$('preview-skin').onchange = (e) => applyConfig({ ...config, skin: e.target.value });
$('home-team').value = teams[0].id;
$('away-team').value = teams[1].id;
$('shots-quick').onclick = $('shots-button').onclick = () => openDialog('shots-dialog');
$('arms-button').onclick = () => openDialog('arms-dialog');
$('start').onclick = () => startGame();
$('new-match').onclick = () => (club?.active ? club.restart() : startGame(match.mode));
$('rematch').onclick = () => startGame('match');
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
  $('sound').textContent = sound.ready ? '♫' : '♪';
  $('sound').setAttribute('aria-label', sound.ready ? 'Выключить звук' : 'Включить звук');
  const unlock = $('sound-unlock');
  if (unlock) {
    unlock.hidden = sound.ready;
    unlock.textContent = sound.muted ? '♪ Звук выключен · включить' : '♪ Включить звук';
  }
}
const soundUnlock = document.createElement('button');
soundUnlock.id = 'sound-unlock';
soundUnlock.textContent = '♪ Включить звук';
$('controller-status').before(soundUnlock);
sound.onStatus = syncSoundButton;
soundUnlock.onclick = async () => {
  try {
    await sound.enable();
    applyConfig({ ...config, soundMuted: false });
    sound.play({ type: 'whistle' });
  } catch {
    toast('Браузер не разрешил воспроизведение звука.');
  }
};
for (const eventName of ['pointerdown', 'keydown'])
  window.addEventListener(
    eventName,
    (event) => {
      if (
        sound.muted ||
        sound.ready ||
        event.target?.closest('#sound, #sound-unlock, .audio-preview')
      )
        return;
      sound
        .enable()
        .then(syncSoundButton)
        .catch(() => {});
    },
    { capture: true },
  );
$('sound').onclick = async () => {
  try {
    if (sound.ready) sound.disable();
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
    resizeGameCanvas();
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
for (const [id, key] of [
  ['pixel-graphics', 'pixelGraphics'],
  ['ball-fire', 'ballFire'],
  ['lively-background', 'livelyBackground'],
])
  $(id).onchange = (e) => applyConfig({ ...config, [key]: e.target.checked });
for (const [id, key] of [
  ['home-team', 'homeTeam'],
  ['away-team', 'awayTeam'],
])
  $(id).onchange = (e) => applyConfig({ ...config, [key]: e.target.value });
$('graphics-controls').before($('trajectory').closest('label'));
$('guide-content').innerHTML = GUIDE_HTML;
ambienceUI = createAmbienceUI({
  config: () => config,
  apply: applyConfig,
  sound,
  open: openDialog,
});
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
$('receive-momentum').onchange = (e) =>
  applyConfig({ ...config, receiveMomentum: e.target.checked });
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
  slider.min = SETTINGS_SCHEMA[key].min;
  slider.max = SETTINGS_SCHEMA[key].max;
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
const audioPreview = document.createElement('section');
audioPreview.className = 'audio-preview';
audioPreview.innerHTML =
  '<h3>Звуки арены · послушать</h3><p>Мелодии, аплодисменты, свисток и нарастающий заряд удара. Нажмите любую кнопку для проверки.</p>';
for (const [label, type] of [
  ['Свисток', 'whistle'],
  ['Замах', 'windup'],
  ['Ещё один мяч · мелодия проигрыша', 'loss-preview'],
  ['Аплодисменты', 'applause'],
  ['Набор силы', 'charge-preview'],
  ['Выход на арену', 'stage-start'],
]) {
  const button = document.createElement('button');
  button.textContent = label;
  button.onclick = async () => {
    try {
      await sound.enable();
      applyConfig({ ...config, soundMuted: false });
      sound.play({ type });
      syncSoundButton();
    } catch {
      toast('Браузер не разрешил воспроизведение звука.');
    }
  };
  audioPreview.append(button);
}
$('settings-dialog').append(audioPreview);
dynamicUI = createDynamicUI(match, {
  apply: applyConfig,
  config: () => config,
  start: startGame,
  pause: setPaused,
  clear: clearActions,
  toast,
});
club = createClub(match, {
  apply: (next) => applyConfig(next, true),
  config: () => config,
  start: (mode) => startGame(mode, true),
  focus: () => $('game').focus({ preventScroll: true }),
  paused: () => paused,
  pause: setPaused,
  event: (event) => sound.play(event),
  toast,
});
tutorial = createTutorial(match, {
  start: () => startGame('practice', false, true),
  finish: () => startGame('match'),
  focus: () => $('game').focus({ preventScroll: true }),
});
// A button held while loading must be released before it can start a game.
input.poll();
secondInput.poll();
clearActions();
requestAnimationFrame(frame);
if (new URLSearchParams(location.search).get('view') === 'arms') openDialog('arms-dialog');

if (new URLSearchParams(location.search).get('view') === 'shots') openDialog('shots-dialog');
