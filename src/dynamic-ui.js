import { ATTACKS, PLAYS, STYLES } from './tactics.js';

export function createDynamicUI(match, hooks) {
  const panel = document.createElement('section');
  panel.className = 'dynamic-panel';
  const options = (obj) =>
    Object.entries(obj)
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join('');
  panel.innerHTML = `<h2>Формат матча</h2>
    <label>Формат <select id="dynamic-format"><option value="quick">3 × 3 · один сет</option><option value="series">3 × 3 · до двух сетов</option><option value="duel">Дуэль · 1 × 1</option></select></label>
    <label>Соперник <select id="dynamic-opponent">${options(STYLES)}</select></label>
    <details><summary>Управление командой</summary>
    <label class="dynamic-check"><input type="checkbox" id="dynamic-approach" checked>Разбег CPU после передачи</label>
    <p>Бот подбегает к своей передаче. Ваши игроки сохраняют ручное управление.</p>
    </details>
    <details><summary>Необычные правила</summary>
    <label class="dynamic-check"><input id="dynamic-bounce" type="checkbox">Один отскок от пола</label>
    <p>Можно сочетать. Настройки применяются к обеим командам.</p></details>
`;
  document.getElementById('match-settings-controls').append(panel);
  const strip = document.createElement('div');
  strip.className = 'controller-strip';
  strip.setAttribute('aria-live', 'polite');
  document.querySelector('.arena-toolbar').after(strip);
  const $ = (id) => document.getElementById('dynamic-' + id);
  let playing = false,
    replayWasPaused = false,
    cursor = 0,
    replayDown = false,
    uiElapsed = 1;
  const team = 0;
  function sync() {
    $('opponent').value = hooks.config().cpuStyle;
    $('approach').checked = hooks.config().approachAssist;
    $('bounce').checked = hooks.config().floorBounce;
    $('format').value = hooks.config().duel
      ? 'duel'
      : hooks.config().setsToWin > 1
        ? 'series'
        : 'quick';
  }
  function close() {
    const wasPlaying = playing;
    playing = false;
    $('replay-controls').hidden = true;
    document.getElementById('replay-toolbar').hidden = true;
    hooks.clear();
    if (wasPlaying) hooks.pause(replayWasPaused);
  }
  function replay() {
    if (match.challenge) {
      hooks.toast('В испытании десять мячей подряд. Повторы доступны в обычных матчах и кубке.');
      return;
    }
    if (playing) {
      close();
      return;
    }
    if (!match.replay.last.length) {
      hooks.toast('Повтор появится после первого завершённого розыгрыша.');
      return;
    }
    replayWasPaused = hooks.paused();
    playing = true;
    cursor = 0;
    hooks.pause(false);
    hooks.clear();
    document.getElementById('replay-toolbar').hidden = false;
    $('replay-controls').hidden = false;
    $('scrub').max = match.replay.last.length - 1;
  }
  function retry() {
    if (match.clubLocked) {
      hooks.toast(
        'В кубке и испытаниях попытка играется целиком. Повтор можно посмотреть после розыгрыша.',
      );
      return;
    }
    close();
    if (match.replay.retry(match)) {
      hooks.pause(false);
      hooks.clear();
    } else hooks.toast('Сначала сыграйте розыгрыш.');
  }
  $('replay').onclick = replay;
  $('retry').onclick = retry;
  $('close-replay').onclick = close;
  $('scrub').oninput = (e) => {
    cursor = Number(e.target.value);
  };
  $('opponent').onchange = (e) => hooks.apply({ ...hooks.config(), cpuStyle: e.target.value });
  $('approach').onchange = (e) =>
    hooks.apply({ ...hooks.config(), approachAssist: e.target.checked });
  $('format').onchange = (e) => {
    hooks.apply({
      ...hooks.config(),
      duel: e.target.value === 'duel',
      setsToWin: e.target.value === 'series' ? 2 : 1,
    });
    close();
    hooks.start(match.mode === 'versus' ? 'versus' : 'match');
  };
  $('bounce').onchange = (e) => hooks.apply({ ...hooks.config(), floorBounce: e.target.checked });
  const drill = document.getElementById('drill');
  for (const [value, label] of [
    ['choice', 'Выбор: скидка или силовой'],
    ['delay', 'Атака против раннего блока'],
    ['rescue', 'Спасение и продолжение'],
  ]) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    drill.append(o);
  }
  sync();
  return {
    sync,
    get playing() {
      return playing;
    },
    reset() {
      close();
      sync();
    },
    input(i) {
      if (i.replayHeld && !replayDown) replay();
      replayDown = i.replayHeld;
    },
    frame(dt, left, right) {
      uiElapsed += dt;
      if (uiElapsed >= 0.065) {
        uiElapsed = 0;
        const i = team === 0 ? left : right;
        const modifier = i.l2 && i.r2 ? 'L2 + R2' : i.l2 ? 'L2' : i.r2 ? 'R2' : 'Базовые действия';
        const square = i.l2 ? 'Одной рукой снизу' : i.r2 ? 'Быстрый навес снизу' : 'Нижний навес';
        const triangle = i.l2
          ? 'Мягко одной рукой сверху'
          : i.r2
            ? 'Быстрый верхний'
            : 'Верхний пас';
        const circle = i.l2 ? 'Сопля через сетку' : i.r2 ? 'Силовой удар' : 'Удар вперёд';
        strip.textContent =
          modifier + ' · □ ' + square + ' · △ ' + triangle + ' · ○ ' + circle + ' · ✕ Прыжок';
        const run = match.teamRuns[team];
        const stats = Object.entries(match.tacticalStats)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${ATTACKS[k] || PLAYS[k] || k}: ${v}`)
          .join(' · ');
        $('analysis').textContent = playing
          ? 'Повтор · Share/View — выйти'
          : run && !run.cancelled && run.serial === match.shotSerial
            ? `${PLAYS[run.intent]} → игрок ${(run.playerId % 3) + 1}. Отпустите ○ у мяча.`
            : `Касания ${match.touches[0]}/3 : ${match.touches[1]}/3. ${stats || 'Share/View — повтор'}`;
      }
      if (!playing) return match;
      cursor = Math.min(match.replay.last.length - 1, cursor + dt * 10);
      $('scrub').value = Math.floor(cursor);
      return match.replay.view(match, Math.floor(cursor));
    },
  };
}
