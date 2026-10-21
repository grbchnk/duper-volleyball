import { COSMETIC_KEYS } from './settings-scope.js';
import { mountSettingsPanel } from './settings-panels.js';
import { createTeamEditor, selectClub } from './team-editor.js';
import { UNIFORM_COLORS } from './teams.js';
import { createFinishScreen } from './finish-screen.js';
import { createDiagnostics } from './diagnostics.js';
import { createTutorial } from './tutorial.js';
import { PHYSICS_FIELDS as physicsFields, SETTINGS_SCHEMA } from './settings-schema.js';
import { createDynamicUI } from './dynamic-ui.js';
import { createClub } from './club.js';
import { createAmbient } from './ambient.js';
import { drawBallDesign, pixelPresent } from './display.js';
import { exportSettings, importSettings } from './settings-file.js';
import { Match, EMPTY_INPUT } from './engine.js';
import { Renderer } from './renderer.js';
import { Sound } from './audio.js';
import { createAmbienceUI } from './ambience-ui.js';
import { DEFAULTS, FIXED_DT, TEAMS, sanitizeConfig } from './config.js';
import { InputBuffer, GAME_KEYS } from './input.js';
import { GUIDE_HTML } from './guide.js';
import { SHOTS, SERVES } from './moves.js';
import { serveCue } from './serve-cue.js';
import { createArmLab } from './arm-lab.js';
import { createShotLab } from './shot-lab.js';
import { gameCanvasSize } from './canvas-size.js';
const $ = (id) => document.getElementById(id),
  storageKey = 'duper-volleyball.dynamic-v3.config';
let config = { ...DEFAULTS };
let teamEditor = null;
let drawArmLab = null,
  drawGraphicsArms = null,
  drawShotLab = null;
let sceneDirty = true;
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
renderer.onCeilingBreak = (event) => sound.play(event);
export { match };
function resizeGameCanvas() {
  sceneDirty = true;
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
    if (!e.repeat) {
      if (tutorial?.active) tutorial.retry();
      else repeatDrill();
    }
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
      } else if (e.code === 'Escape' && tutorial?.active && !paused) {
        tutorial.toggleMenu();
      } else if (e.code === 'Enter' && tutorial?.canConfirm && !paused) {
        tutorial.confirm();
      } else if (match.phase === 'finished' && e.code === 'Enter') {
        const next = $('club-next');
        if (next && !next.hidden) next.click();
        else startGame();
      } else if (tutorial?.active && !paused) tutorial.toggleMenu();
      else togglePause();
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
  if (started && !paused && !modalOpen() && !tutorial?.menuOpen) setPaused(true);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sound.updateMusic(config, false);
    flushSettings();
    clearActions();
    if (started && !tutorial?.menuOpen) setPaused(true);
  }
});
function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 4000);
}
let persistTimer;
let pendingPersist;
function flushSettings() {
  clearTimeout(persistTimer);
  if (!pendingPersist) return;
  try {
    localStorage.setItem(storageKey, exportSettings(pendingPersist));
  } catch {}
  pendingPersist = null;
}
window.addEventListener('pagehide', flushSettings);
document.addEventListener('change', flushSettings);
document.addEventListener('click', flushSettings);
function persist(value = config) {
  pendingPersist = value;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(flushSettings, 180);
}
function applyConfig(next, session = false) {
  const saved = !session ? club?.rememberChanges(next) : null;
  config = sanitizeConfig(next);
  match.updateConfig(config, true);
  sceneDirty = true;
  scheduleSettingsSync();
  if (!session) {
    persist(saved || config);
  }
}

function formatPhysics(key, value) {
  if (physicsFields[key][2] === '%') return Math.round(value * 100) + '%';
  return (
    value.toFixed(key === 'targetScore' ? 0 : physicsFields[key][1] < 0.01 ? 3 : 2) +
    ' ' +
    physicsFields[key][2]
  );
}
let settingsSyncPending = false;
function scheduleSettingsSync() {
  if (settingsSyncPending) return;
  settingsSyncPending = true;
  requestAnimationFrame(() => {
    settingsSyncPending = false;
    syncSettings();
  });
}
function syncSettings() {
  if ($('team-dialog').open) teamEditor?.sync();
  ambienceUI?.sync();
  dynamicUI?.sync();
  if (config.soundMuted && sound.enabled) sound.disable();
  sound.muted = config.soundMuted;
  syncSoundButton();
  $('pixel-graphics').checked = config.pixelGraphics;
  $('ball-fire').checked = config.ballFire;
  $('lively-background').checked = config.livelyBackground;
  $('random-arms').checked = config.randomArms;
  $('away-team').value = config.awayTeam;
  teams = [
    TEAMS.find((t) => t.id === config.homeTeam),
    TEAMS.find((t) => t.id === config.awayTeam),
  ];
  if ($('graphics-dialog').open) {
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
  }
  $('away-color').value = config.awayColor;
  $('ball-skin').value = config.ballSkin;
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
  $('speed').value = config.gameSpeed;
  $('speed-value').textContent = config.gameSpeed.toFixed(2) + '×';
  $('assist').checked = config.assist;
  $('trajectory').checked = config.trajectory;
  $('transferShotOnSwitch').checked = config.transferShotOnSwitch;
  $('passDirectionPreview').checked = config.passDirectionPreview;
  $('difficulty').value = config.cpuSkill;
  $('difficulty-value').textContent = config.cpuSkill + ' / 100';
  $('scoring').value = config.scoring;
  for (const key of Object.keys(physicsFields)) {
    const el = $('physics-' + key);
    if (el) {
      el.value = config[key];
      if (key === 'receiveTransfer' || key === 'receiveDamping')
        el.disabled = !config.receiveMomentum;
      if (key === 'modifierSlowdown' || key === 'modifierSpeedup')
        el.disabled = !config.modifierTempo;
      $('value-' + key).textContent = formatPhysics(key, config[key]);
    }
  }
}
function setPaused(value) {
  paused = value;
  sceneDirty = true;
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
    TEAMS.find((t) => t.id === config.homeTeam),
    TEAMS.find((t) => t.id === config.awayTeam),
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
  $('replay-toolbar').hidden = !dynamicUI?.playing;
  $('dynamic-replay').disabled = !match.replay.last.length || !!match.challenge;
  $('dynamic-retry').hidden = !!match.clubLocked;
  $('dynamic-retry').disabled = !(match.replay.lastStart || match.replay.start);
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
  $('rule-label').textContent = `ТЕМП ${config.gameSpeed.toFixed(2)}×`;
  let title = 'Выбери подачу',
    hint =
      '□ — снизу, △ — сверху, ○ — в прыжке. Зажми для силы, отпусти для подброса. Нажми ещё раз, когда зелёный круг сойдётся к мячу.',
    key = '□';
  if (match.mode === 'test') {
    title = 'ТЕСТ · непрерывные мячи';
    hint =
      'Один принимающий. Мяч появляется в случайных местах с разной скоростью и высотой. После приёма или промаха прилетит новый. Следующий мяч прилетит автоматически.';
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
    hint = 'После нырка игроку нужно встать. L1 — выбрать другого свободного игрока.';
    key = 'L1';
  } else if (match.active().diving) {
    title = match.active().diveArmed ? 'Руки готовы к приёму' : 'Приём выполнен';
    hint =
      'Направление броска зафиксировано. Мяч должен попасть в предплечья; Кнопку приёма нажимать не нужно.';
    key = 'Стик ×3';
  } else if (match.phase === 'serve' && hud.charge) {
    title = SERVES[hud.charge.kind].name;
    hint =
      'Левый стик — направление и высота. Отпусти кнопку для подброса. Затем нажми ещё раз, когда круг сойдётся к мячу.';
    key = { low: '□', back: 'L2 + □', loft: '△', drive: '○' }[hud.charge.kind];
  } else if (hud.charge) {
    title = hud.contactWindow
      ? 'Отпусти сейчас!'
      : (SHOTS[hud.charge.kind] || { name: SERVES[hud.charge.kind]?.name, key: 'Z + S' }).name;
    hint = 'Левый стик — движение и угол мяча. Отпустите у мяча; руки уже готовы.';
    key = { low: '□', back: 'L2 + □', loft: '△', drive: '○' }[hud.charge.kind];
  } else if (match.phase === 'rally' && phase === 'defense') {
    title = 'Сохрани мяч';
    hint =
      '□ — снизу, △ — сверху, ○ — удар. L2 — мягче. R1 — блок, ✕ — прыжок; стик вниз — низкая стойка, три отклонения — бросок.';
    key = '□';
  } else if (match.phase === 'rally') {
    title = 'Построй атаку';
    hint =
      'L1 — выбрать нападающего. ✕ — прыжок, ○ — зарядить и отпустить у мяча. Левый стик задаёт направление.';
    key = '✕ → ○';
  } else if (match.phase === 'serve-motion') {
    const cue = serveCue(match);
    title = cue?.title || (match.isHuman(match.server) ? 'Мяч подброшен' : 'Подаёт соперник');
    hint = cue?.hint || 'Нажми кнопку подачи ещё раз в момент контакта.';
    key =
      cue?.button || { low: '□', back: 'L2 + □', loft: '△', drive: '○' }[match.serveAction.kind];
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
  } else if (!modalOpen() && controllerInput.confirmPressed && tutorial?.canConfirm && !paused) {
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
    if (tutorial?.active && !paused) tutorial.toggleMenu();
    else togglePause();
    controllerAction = true;
  }
  if (!controllerAction && !paused && !modalOpen())
    controllerAction = tutorial?.handleNavigation(controllerInput, elapsed) || false;
  if (started && !controllerAction && !modalOpen() && !club?.drawerOpen && !tutorial?.active)
    dynamicUI?.input(controllerInput);
  if (
    started &&
    !paused &&
    !controllerAction &&
    !modalOpen() &&
    !dynamicUI?.playing &&
    !club?.drawerOpen
  ) {
    tutorial?.advance(elapsed);
    accumulator += elapsed * config.gameSpeed;
    while (accumulator >= FIXED_DT) {
      const primary = input.read(match.phase);
      if (!tutorial?.frozen) match.tick(FIXED_DT, primary, secondInput.read(match.phase));
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
  const shown = dynamicUI?.frame(elapsed, controllerInput, secondControllerInput) || match;
  const activeScene =
    started && (!paused || dynamicUI?.playing) && !modalOpen() && !document.hidden;
  if (!document.hidden && (sceneDirty || activeScene)) {
    drawAmbient(match, teams);
    renderer.learning = tutorial?.active || false;
    renderer.draw(shown, teams, activeScene ? elapsed : 0);
    tutorial?.draw(renderer);
    sceneDirty = false;
  }
  if (!document.hidden) {
    drawArmLab?.(elapsed);
    drawGraphicsArms?.(elapsed);
    drawShotLab?.(elapsed);
  }
  if (!document.hidden && time - lastUI > 65) {
    updateUI();
    tutorial?.update();
    lastUI = time;
  }
  requestAnimationFrame(frame);
}
for (const id of ['away-team'])
  for (const team of TEAMS) {
    const option = document.createElement('option');
    option.value = team.id;
    option.textContent = team.name;
    $(id).append(option);
  }
for (const id of ['away-color'])
  for (const [color, name] of UNIFORM_COLORS) $(id).add(new Option(name, color));
for (const [id, key] of [
  ['away-color', 'awayColor'],
  ['ball-skin', 'ballSkin'],
])
  $(id).oninput = (e) => applyConfig({ ...config, [key]: e.target.value });
$('away-team').value = teams[1].id;
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
  if (tutorial?.active && !paused) tutorial.toggleMenu();
  else togglePause();
  $('game').focus({ preventScroll: true });
};
$('resume').onclick = () => {
  setPaused(false);
  $('game').focus({ preventScroll: true });
};
function syncSoundButton() {
  $('sound').textContent = sound.muted ? '♪' : '♫';
  $('sound').setAttribute('aria-label', sound.muted ? 'Включить звук' : 'Выключить звук');
  $('sound').setAttribute('aria-pressed', String(!sound.muted));
}
sound.onStatus = syncSoundButton;
for (const eventName of ['pointerdown', 'keydown'])
  window.addEventListener(
    eventName,
    (event) => {
      if (sound.muted || sound.ready || event.target?.closest('#sound, .audio-preview')) return;
      sound
        .enable()
        .then(syncSoundButton)
        .catch(() => {});
    },
    { capture: true },
  );
$('sound').onclick = async () => {
  try {
    if (!sound.muted) sound.disable();
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
const switchingDialogs = new WeakSet();
function openDialog(id, selection) {
  const current = document.querySelector('dialog[open]');
  if (current?.id === id) return;
  if (current) {
    switchingDialogs.add(current);
    current.close();
  } else modalWasPaused = paused;
  clearActions();
  if (id === 'team-dialog' && !teamEditor)
    teamEditor = createTeamEditor($(id), () => config, applyConfig);
  if (id === 'shots-dialog' && !drawShotLab)
    drawShotLab = createShotLab($(id), () => config, applyConfig, openDialog);
  if (id === 'arms-dialog' && !drawArmLab) drawArmLab = createArmLab($(id), () => config);
  if (id === 'appearance-dialog' && !drawGraphicsArms)
    drawGraphicsArms = createArmLab($(id), () => config, 'graphics-arm-');
  if (id === 'ambience-dialog') ambienceUI.mount();
  mountSettingsPanel($(id), openDialog, (dialog) => {
    if (switchingDialogs.delete(dialog)) return;
    flushSettings();
    setPaused(modalWasPaused);
    $('game').focus({ preventScroll: true });
  });
  $(id).showModal();
  if (id === 'shots-dialog' && selection) drawShotLab.select(selection);
  syncSettings();
  $('pause-overlay').hidden = true;
}
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-panel]');
  if (button) openDialog(button.dataset.openPanel);
});
$('help-button').onclick = () => openDialog('help-dialog');
$('team-quick').onclick = () => openDialog('team-dialog');
$('graphics-button').onclick = () => openDialog('graphics-dialog');
$('settings-button').onclick = () => openDialog('match-settings-dialog');
$('config-button').onclick = () => openDialog('settings-dialog');
for (const [id, key] of [
  ['pixel-graphics', 'pixelGraphics'],
  ['ball-fire', 'ballFire'],
  ['lively-background', 'livelyBackground'],
  ['random-arms', 'randomArms'],
])
  $(id).onchange = (e) => applyConfig({ ...config, [key]: e.target.checked });
for (const [id, key] of [['away-team', 'awayTeam']])
  $(id).onchange = (e) => applyConfig(selectClub(config, e.target.value, key === 'awayTeam'));
$('guide-content').innerHTML = GUIDE_HTML;
ambienceUI = createAmbienceUI({
  config: () => config,
  apply: applyConfig,
  sound,
  open: openDialog,
});
$('speed').oninput = (e) => applyConfig({ ...config, gameSpeed: Number(e.target.value) });
for (const key of ['assist', 'trajectory', 'transferShotOnSwitch', 'passDirectionPreview'])
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
const visualKeys = COSMETIC_KEYS;
const tuningGroups = new Map();
for (const [key, [label, step, , group, hint]] of Object.entries(physicsFields)) {
  const parent = $(
    key === 'targetScore'
      ? 'match-rule-controls'
      : ['fireSpeed', 'smokeTrailOpacity', 'smokeTrailLife'].includes(key)
        ? 'graphics-effects-controls'
        : visualKeys.has(key)
          ? 'graphics-controls'
          : 'physics-controls',
  );
  const groupKey = parent.id + ':' + group;
  let container = tuningGroups.get(groupKey);
  if (!container) {
    container = document.createElement('section');
    tuningGroups.set(groupKey, container);
    parent.append(container);
    const heading = document.createElement('h3');
    heading.className = 'physics-group';
    heading.textContent = group;
    container.append(heading);
  }
  container.classList.add('flat-settings');
  const lab = document.createElement('label');
  lab.className = 'setting-label';
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
  container.append(lab, slider);
  if (hint) {
    const note = document.createElement('small');
    note.id = 'hint-' + key;
    slider.setAttribute('aria-describedby', note.id);
    note.textContent = hint;
    note.className = 'setting-note';
    container.append(note);
  }
}
let resetSnapshot;
function resetSettings(keys) {
  resetSnapshot = config;
  applyConfig(
    keys ? { ...config, ...Object.fromEntries(keys.map((key) => [key, DEFAULTS[key]])) } : DEFAULTS,
  );
  $('undo-settings').hidden = false;
  toast('Настройки сброшены. Отмена доступна в разделе «Сохранить / загрузить».');
}
$('reset-physics').onclick = () =>
  resetSettings([
    ...Object.keys(physicsFields).filter((key) => !visualKeys.has(key) && key !== 'targetScore'),
    'receiveMomentum',
    'modifierTempo',
  ]);
$('reset-appearance').onclick = () =>
  resetSettings(
    [...COSMETIC_KEYS].filter(
      (key) => key.startsWith('arm') || key === 'elbowHeight' || key === 'randomArms',
    ),
  );
$('reset-graphics').onclick = () =>
  resetSettings([
    'ballSkin',
    'ballFire',
    'fireSpeed',
    'smokeTrailOpacity',
    'smokeTrailLife',
    'pixelGraphics',
    'livelyBackground',
    'trajectory',
    'passDirectionPreview',
  ]);
$('reset-all').onclick = () => resetSettings();
$('undo-settings').onclick = () => {
  if (resetSnapshot) applyConfig(resetSnapshot);
  resetSnapshot = null;
  $('undo-settings').hidden = true;
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
syncSettings();
updateUI();
const audioPreview = document.createElement('section');
audioPreview.className = 'audio-preview';
audioPreview.innerHTML =
  '<h3>Звуки арены · послушать</h3><p>Сравните мягкий и сильный приём, навес, удар и звучание полной комбинации.</p>';
for (const [label, type, details = {}] of [
  ['Мягкий приём', 'hit', { kind: 'low', incomingSpeed: 3, power: 0.5 }],
  ['Сильный приём', 'hit', { kind: 'low', incomingSpeed: 19, power: 0.5 }],
  ['Навес', 'hit', { kind: 'loft', power: 0.6 }],
  ['Удар', 'hit', { kind: 'drive', power: 0.9 }],
  ['Приём → навес → удар', 'combination-preview'],
  ['Мяч об пол', 'floor-touch', { speed: 12 }],
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
      sound.play({ type, ...details });
      syncSoundButton();
    } catch {
      toast('Браузер не разрешил воспроизведение звука.');
    }
  };
  audioPreview.append(button);
}
$('audio-dialog').append(audioPreview);
dynamicUI = createDynamicUI(match, {
  apply: applyConfig,
  config: () => config,
  start: startGame,
  pause: setPaused,
  paused: () => paused,
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
  resetInput: clearActions,
});
// A button held while loading must be released before it can start a game.
input.poll();
secondInput.poll();
clearActions();
requestAnimationFrame(frame);
if (new URLSearchParams(location.search).get('view') === 'arms') openDialog('arms-dialog');

if (new URLSearchParams(location.search).get('view') === 'shots') openDialog('shots-dialog');
