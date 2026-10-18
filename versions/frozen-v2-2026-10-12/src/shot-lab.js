import { drawBallDesign, pixelPresent, compositePixels } from './display.js';
import { SERVE_FIELDS, serveSettings, serveKey } from './serve-settings.js';
import { simulateServe } from './serve-lab.js';
import { sampleJump } from './motion.js';
import { SHOT_FIELDS, shotSettings } from './shot-settings.js';
import { Match } from './engine.js';
import { Renderer } from './renderer.js';
import { DEFAULTS, COURT, FIXED_DT, TEAMS } from './config.js';
import { SHOTS, SERVES, shotImpulse } from './moves.js';
import { traceBall, isInside } from './physics.js';
import { preparedHands } from './held-contact.js';

// Preview and playback share the match's impulse, fixed step and net collision.
export function simulateShot(
  config,
  { kind, power, angle = null, playerId = 1, height = 0, contactHeight = null },
) {
  const match = new Match(config);
  match.phase = 'rally';
  const player = match.players[playerId];
  player.y = height;
  match.selected[player.team] = playerId;
  const aim =
    angle === null
      ? {}
      : {
          vector: { x: Math.cos((angle * Math.PI) / 180), y: Math.sin((angle * Math.PI) / 180) },
        };
  const ball = {
    ...match.ball,
    x: player.x,
    y: height + (contactHeight ?? (kind === 'low' ? 0.85 : kind === 'back' ? 1 : 2.05)),
    z: player.z,
    vx: 0,
    vy: 0,
    vz: 0,
  };
  const impulse = shotImpulse(ball, player, kind, power, aim, match.players, config);
  const free = shotImpulse(ball, player, kind, power, aim, match.players, {
    ...config,
    assist: false,
  });
  return {
    match,
    player,
    ball,
    impulse,
    points: traceBall({ ...ball, ...impulse }, config, 15),
    free: traceBall({ ...ball, ...free }, config, 15),
  };
}

export function createShotLab(dialog, getConfig, applyConfig) {
  dialog.innerHTML = `
    <div class="dialog-top"><div><p class="eyebrow">ТРАЕКТОРИЯ · СИЛА · КОНТАКТ</p><h2>Лаборатория ударов</h2></div><button class="close" aria-label="Закрыть лабораторию ударов">×</button></div>
    <div class="shot-layout"><aside class="shot-controls">
      <label for="shot-mode">Раздел</label><select id="shot-mode"><option value="rally">Приёмы в розыгрыше</option><option value="serve">Подачи</option></select>
      <label for="shot-kind">Тип удара</label><select id="shot-kind">${Object.entries(SHOTS)
        .map(([key, s]) => `<option value="${key}">${s.key} · ${s.name}</option>`)
        .join('')}</select>
      <label for="shot-power">Сила <output id="shot-power-value"></output></label><input id="shot-power" type="range" min="0" max="100" value="50">
      <label for="shot-direction">Направление</label><select id="shot-direction"><option value="auto">Без направления</option><option value="manual">Задать угол</option></select>
      <div id="shot-dial" class="shot-dial" role="slider" tabindex="0" aria-label="Круг направления" aria-valuemin="-180" aria-valuemax="180" aria-valuenow="180">
        <svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="76"/><path class="dial-cross" d="M24 100H176 M100 24V176"/><g id="shot-needle"><path d="M100 100H166 M153 91L166 100L153 109"/><circle cx="166" cy="100" r="5"/></g><circle class="dial-center" cx="100" cy="100" r="5"/><text x="100" y="14">90°</text><text x="186" y="104">0°</text><text x="100" y="195">−90°</text><text x="14" y="104">180°</text></svg>
      </div><label for="shot-angle">Направление, ° <output id="shot-angle-value"></output></label><input id="shot-angle" type="number" min="-180" max="180" step="1" value="180"><small>Потяни стрелку или нажми на круг. ←/→: 1°, Shift: 10°. Угол на круге — относительно экрана.</small>
      <label for="shot-player">Игрок</label><select id="shot-player"><option value="0">Слева · задний</option><option value="1" selected>Слева · связующий</option><option value="2">Слева · передний</option><option value="3">Справа · задний</option><option value="4">Справа · связующий</option><option value="5">Справа · передний</option></select>
      <label for="shot-height">Высота игрока <output id="shot-height-value"></output></label><input id="shot-height" type="range" min="0" max="2" step="0.1" value="0">
      <label for="shot-contact-height">Высота мяча над стопами <output id="shot-contact-height-value"></output></label><input id="shot-contact-height" type="range" min="0.12" max="3" step="0.01" value="1">
      <div id="shot-serve-controls" hidden><label for="shot-timing">Второе нажатие относительно идеала <output id="shot-timing-value"></output></label><input id="shot-timing" type="range" min="-0.7" max="0.7" step="0.01" value="0"><button id="shot-ideal" class="secondary">Нажать точно в идеал</button><p id="shot-timing-info" class="shot-hint"></p><label for="shot-flight-mode">Расчёт полёта</label><select id="shot-flight-mode"><option value="0">По скорости и углу</option><option value="1">По точке приземления и времени</option></select><small>Без ручного направления второй режим подбирает скорость и угол по точке приземления. Ручное направление имеет приоритет у каждой подачи.</small></div>
      <div class="shot-endpoint-buttons"><button id="shot-min" class="secondary">Проверить 0%</button><button id="shot-max" class="secondary">Проверить 100%</button></div>
      <label><input id="shot-endpoints" type="checkbox"> Показать дуги 0% и 100%</label>
      <label><input id="shot-spin-reference" type="checkbox" checked> Сравнить с полётом без вращения</label>
      <hr><h3>Настройки игры</h3><small>Применяются сразу, сохраняются в браузере и общем JSON.</small>
      <p id="shot-profile-hint" class="shot-hint">Углы профиля — вверх/вниз от горизонтали в выбранную сторону. Без направления S/W/A с помощью ищут достижимого партнёра. Ручной угол смешивается с профилем, затем применяются пределы.</p>
      <div id="shot-settings"></div>
      <button id="shot-unlock" class="secondary">Разрешить все направления</button>
      <label for="shot-assist">Помощь выбранному удару <output id="shot-assist-value"></output></label><input id="shot-assist" type="range" min="0" max="1" step="0.05"><small>50% — половина поворота к подходящей траектории. Для D действует отдельная помощь: 100% — низко над сеткой, с добавлением недостающей скорости. Для подач используются отдельные настройки в разделе «Подачи».</small>
      <button id="shot-reset" class="secondary">Сбросить этот удар</button>
    </aside><section class="shot-preview">      <div id="shot-timing-preview" hidden><div id="shot-timing-map" class="timing-map" aria-label="Результат второго нажатия"></div><p class="micro">Красный — промах · жёлтый — неточно · зелёный — идеально. Нажми на шкалу: от −0.70 до +0.70 с относительно идеала.</p><button id="shot-contact-frame" class="secondary">Стоп-кадр второго нажатия</button><p id="shot-press-result" role="status"></p></div><canvas id="shot-canvas" width="960" height="520" aria-label="Полёт мяча после удара, вид сбоку"></canvas>
      <div class="shot-legend"><span>━━ В игре</span><span>┄┄ Без помощи</span><span>0% — голубой · 100% — розовый</span><span>Сиреневый — без вращения</span><span>Вид сбоку · метры</span></div>
      <p id="shot-stats" role="status"></p><p id="shot-limits" class="shot-hint"></p>

      <p id="shot-parameter-info" class="shot-hint"></p>
      <div class="arm-timeline"><button id="shot-play" class="secondary">Пауза</button><button id="shot-replay" class="secondary">Повторить ↻</button><label for="shot-slow">Темп</label><select id="shot-slow"><option value="1">1×</option><option value="0.35">0.35×</option></select></div>
      <label for="shot-time">Момент <output id="shot-time-value"></output></label><input id="shot-time" type="range" min="0" step="0.01" value="0">
      <p id="shot-explanation" class="arm-explanation">Готовое касание и полёт до земли, без последующих касаний игроков. Пунктир помогает увидеть, насколько помощь меняет выбранный удар. Время указано в секундах симуляции.</p>
    </section></div>`;
  const $ = (id) => dialog.querySelector('#shot-' + id);
  const groups = {
    endpoints: '0% → 100% силы',
    direction: 'Направление и кривая силы',
    assist: 'Ограничения помощи',
    contact: 'Допуск контакта',
    target: 'Точка приземления и время',
    timing: 'Зарядка и время удара',
    toss: 'Подброс и контакт',
  };
  const serving = () => $('mode').value === 'serve';
  const fieldsForMode = () =>
    serving()
      ? SERVE_FIELDS
      : Object.fromEntries(
          Object.entries(SHOT_FIELDS).filter(([, field]) => field[5] !== 'assist'),
        );
  const settingsFor = (config, kind) =>
    serving() ? serveSettings(config, kind) : shotSettings(config, kind);
  const configKey = (kind, suffix) => (serving() ? serveKey(kind, suffix) : kind + suffix);
  function buildSettings() {
    $('settings').innerHTML = Object.entries(groups)
      .filter(([group]) => Object.values(fieldsForMode()).some((field) => field[5] === group))
      .map(
        ([group, title]) =>
          '<details ' +
          (group ===
            (serving() && settingsFor(getConfig(), $('kind').value).Targeted
              ? 'target'
              : 'endpoints') ||
          (serving() && group === 'timing')
            ? 'open'
            : '') +
          '><summary>' +
          title +
          '</summary>' +
          Object.entries(fieldsForMode())
            .filter(([, field]) => field[5] === group)
            .map(
              ([suffix, [label, min, max, step, unit]]) =>
                `<div class="shot-field"><label for="shot-setting-${suffix}">${label} <span>${unit}</span></label><div><input id="shot-setting-${suffix}" type="range" min="${min}" max="${max}" step="${step}"><input id="shot-number-${suffix}" aria-label="${label}, точное значение" type="number" min="${min}" max="${max}" step="${step}"></div></div>`,
            )
            .join('') +
          '</details>',
      )
      .join('');

    for (const suffix of Object.keys(fieldsForMode()))
      for (const prefix of ['setting-', 'number-']) {
        $(prefix + suffix).oninput = () => {
          if ($(prefix + suffix).value === '') return;
          const kind = $('kind').value,
            value = Number($(prefix + suffix).value);
          if (!Number.isFinite(value)) return;
          const key = (suffix) => configKey(kind, suffix);
          const next = { ...getConfig(), [key(suffix)]: value };
          for (const [low, high] of [
            ['ElevationMin', 'ElevationMax'],
            ['ContactMin', 'ContactMax'],
            ['PerfectWindow', 'HitWindow'],
          ]) {
            if (suffix === low && value > next[key(high)]) next[key(high)] = value;
            if (suffix === high && value < next[key(low)]) next[key(low)] = value;
          }
          applyConfig(next);
          rebuild();
        };
      }
  }
  buildSettings();
  const renderer = new Renderer($('canvas'));
  let timingStamp = '';
  let data,
    stamp,
    time = 0,
    playing = true;
  function rebuild() {
    const config = getConfig(),
      kind = $('kind').value;
    const simulate = serving() ? simulateServe : simulateShot;
    data = simulate(config, {
      kind,
      power: +$('power').value / 100,
      angle: $('direction').value === 'auto' ? null : +$('angle').value,
      playerId: +$('player').value,
      height: +$('height').value,
      contactHeight: +$('contact-height').value,
      timingOffset: +$('timing').value,
    });
    const settings = settingsFor(config, kind);
    data.noSpin =
      data.hit === false ? [] : traceBall({ ...data.ball, ...data.impulse, spin: 0 }, config, 15);
    $('timing-preview').hidden = !serving();
    $('parameter-info').textContent = serving()
      ? ''
      : 'Угол в воздухе действует при высоте игрока > 0.25 м. Ручной угол с влиянием 100% заменяет угол профиля; помощь тоже может его скорректировать. Вращение > 0 сильнее загибает мяч вниз, < 0 замедляет падение; эффект небольшой и накапливается в полёте. Область приёма — над стопами: рамка показывает допуск, кружки — рабочие ладони. Для касания нужны оба условия.';
    if (serving()) {
      const key = JSON.stringify([config, kind, $('power').value, $('player').value]);
      if (key !== timingStamp) {
        timingStamp = key;
        $('timing-map').innerHTML = Array.from({ length: 71 }, (_, i) => {
          const offset = -0.7 + i * 0.02;
          const sample = simulateServe(config, {
            kind,
            power: +$('power').value / 100,
            playerId: +$('player').value,
            timingOffset: offset,
          });
          const color = !sample.hit
            ? '#bb625a'
            : sample.result === 'Идеально'
              ? '#3b9472'
              : '#dba640';
          return `<button style="background:${color}" data-offset="${offset.toFixed(2)}" title="${offset.toFixed(2)} с: ${sample.result}" aria-label="${offset.toFixed(2)} с: ${sample.result}"></button>`;
        }).join('');
        for (const button of $('timing-map').querySelectorAll('button'))
          button.onclick = () => {
            $('timing').value = button.dataset.offset;
            rebuild();
            time = data.pressTime ?? data.launchTime;
            setPlaying(false);
          };
      }
      for (const button of $('timing-map').querySelectorAll('button'))
        button.setAttribute(
          'aria-pressed',
          String(Math.abs(+button.dataset.offset - +$('timing').value) <= 0.01001),
        );
      $('press-result').textContent =
        data.pressTime === null
          ? 'Мяч упал до второго нажатия.'
          : `Второе нажатие: ${data.pressTime.toFixed(3)} с · ${data.result}`;
    }
    const autoTarget = serving() && settings.Targeted && $('direction').value === 'auto';
    data.endpointPaths = $('endpoints').checked
      ? [0, 1].map(
          (power) =>
            simulate(config, {
              kind,
              power,
              angle: $('direction').value === 'auto' ? null : +$('angle').value,
              playerId: +$('player').value,
              height: +$('height').value,
              contactHeight: +$('contact-height').value,
              timingOffset: +$('timing').value,
            }).points,
        )
      : [];
    stamp = JSON.stringify(config);
    time = 0;
    renderer.armRigs.clear();
    $('dial').classList.toggle('neutral', $('direction').value === 'auto');
    $('dial').setAttribute('aria-valuenow', $('angle').value);
    $('dial').setAttribute(
      'aria-valuetext',
      $('direction').value === 'auto' ? 'Без ручного направления' : $('angle').value + ' градусов',
    );
    $('needle').setAttribute('transform', 'rotate(' + -Number($('angle').value) + ' 100 100)');
    $('power-value').textContent = $('power').value + '%';
    $('angle-value').textContent =
      $('direction').value === 'auto' ? 'Автоматически' : $('angle').value + '°';
    $('height-value').textContent = $('height').value + ' м';
    $('contact-height-value').textContent = Number($('contact-height').value).toFixed(2) + ' м';
    for (const suffix of Object.keys(fieldsForMode())) {
      $('setting-' + suffix).value = settings[suffix];
      $('number-' + suffix).value = settings[suffix];
    }
    const outgoing = (Math.atan2(data.impulse.vy, data.impulse.vx) * 180) / Math.PI;
    const validContact =
      +$('contact-height').value >= settings.ContactMin &&
      +$('contact-height').value <= settings.ContactMax;
    $('limits').textContent =
      'Угол вылета: ' +
      outgoing.toFixed(1) +
      '°. Пределы высоты направления: ' +
      settings.ElevationMin +
      '…' +
      settings.ElevationMax +
      '°. Влияние ручного угла: ' +
      Math.round(settings.AimBlend * 100) +
      '%. ' +
      (validContact
        ? ''
        : 'Мяч вне допуска контакта: показан условный запуск; в игре этот удар не достанет мяч.');
    $('assist').value = config.assist
      ? config[$('kind').value === 'drive' ? 'driveAssist' : 'passAssist']
      : 0;
    $('assist-value').textContent = Math.round(+$('assist').value * 100) + '%';
    $('time').max = (data.launchTime ?? 0.65) + (data.points.length - 1) * FIXED_DT;
    const end = data.points.at(-1),
      landed = end.y <= COURT.ballRadius;
    $('stats').textContent =
      `${Math.hypot(data.impulse.vx, data.impulse.vy).toFixed(1)} м/с · вершина ${Math.max(...data.points.map((p) => p.y)).toFixed(1)} м · ${landed ? (isInside(end) ? 'На площадке' : 'Аут') : 'Полёт > 15 с'} · x = ${end.x.toFixed(1)} м · ${data.impulse.assisted ? 'помощь сработала' : 'без коррекции'}`;
    if (serving()) {
      $('flight-mode').value = settings.Targeted;
      $('timing-value').textContent =
        (+$('timing').value > 0 ? '+' : '') + Number($('timing').value).toFixed(2) + ' с';
      $('timing-info').textContent =
        'Идеал после подброса: ' +
        data.motion.ideal.toFixed(2) +
        ' с · идеальное окно ±' +
        settings.PerfectWindow.toFixed(2) +
        ' с · допустимое ±' +
        settings.HitWindow.toFixed(2) +
        ' с';
      $('limits').textContent =
        data.result +
        ' · угол вылета ' +
        outgoing.toFixed(1) +
        '° · ' +
        (autoTarget
          ? 'Без направления: скорость и угол рассчитаны по цели. Выберите ручной угол — он получит приоритет над автоподбором.'
          : 'Пределы угла: ' +
            settings.ElevationMin +
            '…' +
            settings.ElevationMax +
            '°. Ручной угол: ' +
            Math.round(settings.AimBlend * 100) +
            '%.') +
        ' Окно времени действует вместе с допуском расстояния до кисти.';
      if (!data.hit)
        $('stats').textContent =
          'Промах: мяч падает после подброса. Измените момент второго нажатия или допуски контакта.';
      for (const suffix of Object.keys(SERVE_FIELDS)) {
        const group = SERVE_FIELDS[suffix][5];
        const disabled =
          (autoTarget
            ? ['endpoints', 'direction'].includes(group) && suffix !== 'PowerCurve'
            : group === 'target') ||
          (suffix === 'Runup' && kind !== 'drive');
        $('setting-' + suffix).disabled = $('number-' + suffix).disabled = disabled;
      }
    }
    for (const id of ['direction', 'angle']) $(id).disabled = false;
    $('dial').setAttribute('aria-disabled', 'false');
    $('unlock').disabled = false;
    $('assist').disabled = serving();
    $('reset').textContent = serving() ? 'Сбросить эту подачу' : 'Сбросить этот удар';
  }
  for (const id of [
    'power',
    'direction',
    'player',
    'height',
    'contact-height',
    'endpoints',
    'timing',
    'spin-reference',
  ])
    $(id).oninput = rebuild;
  $('kind').oninput = () => {
    const kind = $('kind').value;
    const settings = settingsFor(getConfig(), kind);
    if (!serving())
      $('contact-height').value = Math.max(
        settings.ContactMin,
        Math.min(settings.ContactMax, kind === 'low' ? 0.85 : 2.05),
      );
    buildSettings();
    rebuild();
  };
  $('mode').oninput = () => {
    const isServe = serving();
    for (const option of $('kind').options)
      option.textContent =
        SHOTS[option.value].key + ' · ' + (isServe ? SERVES : SHOTS)[option.value].name;
    $('serve-controls').hidden = !isServe;
    for (const id of ['height', 'contact-height']) {
      $(id).hidden = isServe;
      dialog.querySelector('label[for="shot-' + id + '"]').hidden = isServe;
    }
    for (const option of $('player').options)
      option.disabled = isServe && !['0', '3'].includes(option.value);
    if (isServe) $('player').value = Number($('player').value) < 3 ? '0' : '3';
    $('profile-hint').textContent = isServe
      ? 'Отдельный профиль каждой подачи. Время идеального удара считается от отпускания кнопки. Подброс автоматически подстраивается под высоту контакта. Для прыжка слишком ранний идеал сдвигается до достижимой вершины.'
      : 'Углы профиля — вверх/вниз от горизонтали. Без направления S/W/A с помощью ищут достижимого партнёра при выбранной силе. D с полной помощью проходит низко над сеткой. Ручной угол смешивается с профилем.';
    $('explanation').textContent = isServe
      ? 'Полный цикл после отпускания кнопки: подброс → второе нажатие → полёт. Золотой пунктир — подброс. Дуги 0% и 100% используют тот же сдвиг нажатия относительно своего идеала. Время — секунды симуляции.'
      : 'Готовое касание и полёт до земли, без последующих касаний игроков. Время — секунды симуляции.';
    buildSettings();
    rebuild();
  };
  $('flight-mode').oninput = () => {
    applyConfig({
      ...getConfig(),
      [serveKey($('kind').value, 'Targeted')]: Number($('flight-mode').value),
    });
    buildSettings();
    rebuild();
  };
  $('ideal').onclick = () => {
    $('timing').value = 0;
    rebuild();
  };
  const setAngle = (value) => {
    $('angle').value = Math.max(-180, Math.min(180, Math.round(value)));
    $('direction').value = 'manual';
    rebuild();
  };
  $('angle').oninput = () => {
    if ($('angle').value !== '' && Number.isFinite(+$('angle').value)) setAngle(+$('angle').value);
  };
  const pointerAngle = (event) => {
    const rect = $('dial').getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = rect.top + rect.height / 2 - event.clientY;
    if (Math.hypot(x, y) > 5) setAngle((Math.atan2(y, x) * 180) / Math.PI);
  };
  $('dial').onpointerdown = (event) => {
    if (event.button !== 0) return;
    $('dial').setPointerCapture(event.pointerId);
    $('dial').focus();
    pointerAngle(event);
  };
  $('dial').onpointermove = (event) => {
    if ($('dial').hasPointerCapture(event.pointerId)) pointerAngle(event);
  };
  $('dial').onpointerup = (event) => {
    if ($('dial').hasPointerCapture(event.pointerId))
      $('dial').releasePointerCapture(event.pointerId);
  };
  $('dial').onkeydown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))
      return;
    event.preventDefault();
    let angle =
      +$('angle').value +
      (['ArrowLeft', 'ArrowUp'].includes(event.key) ? 1 : -1) * (event.shiftKey ? 10 : 1);
    if (event.key === 'Home') angle = 0;
    if (event.key === 'End') angle = 180;
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;
    setAngle(angle);
  };
  for (const [id, power] of [
    ['min', 0],
    ['max', 100],
  ])
    $(id).onclick = () => {
      $('power').value = power;
      rebuild();
    };
  $('unlock').onclick = () => {
    const kind = $('kind').value;
    applyConfig({
      ...getConfig(),
      [configKey(kind, 'ElevationMin')]: -90,
      [configKey(kind, 'ElevationMax')]: 90,
      [configKey(kind, 'AimBlend')]: 1,
    });
    rebuild();
  };
  $('assist').oninput = () => {
    applyConfig({
      ...getConfig(),
      assist: +$('assist').value > 0,
      [$('kind').value === 'drive' ? 'driveAssist' : 'passAssist']: +$('assist').value,
    });
    rebuild();
  };
  $('reset').onclick = () => {
    const kind = $('kind').value;
    applyConfig({
      ...getConfig(),
      ...Object.fromEntries(
        [...Object.keys(fieldsForMode()), ...(serving() ? ['Targeted'] : [])].map((suffix) => [
          configKey(kind, suffix),
          DEFAULTS[configKey(kind, suffix)],
        ]),
      ),
    });
    rebuild();
  };
  const setPlaying = (value) => {
    playing = value;
    $('play').textContent = value ? 'Пауза' : 'Продолжить';
  };
  $('contact-frame').onclick = () => {
    time = data.pressTime ?? data.launchTime;
    setPlaying(false);
    renderer.armRigs.clear();
  };
  $('play').onclick = () => setPlaying(!playing);
  $('replay').onclick = () => {
    rebuild();
    setPlaying(true);
  };
  $('time').oninput = () => {
    time = +$('time').value;
    setPlaying(false);
    renderer.armRigs.clear();
  };
  return (dt) => {
    if (!dialog.open) return;
    if (!data || stamp !== JSON.stringify(getConfig())) rebuild();
    const duration = +$('time').max;
    if (playing) time += dt * +$('slow').value;
    if (time > duration + 0.8) {
      time = 0;
      renderer.armRigs.clear();
    }
    $('time').value = Math.min(time, duration);
    $('time-value').textContent = Math.min(time, duration).toFixed(2) + ' с';
    const { match, player, points, free, ball, impulse } = data;
    const allPoints = [
      ...points,
      ...free,
      ...data.endpointPaths.flat(),
      ...(data.frames || []).map((frame) => frame.ball),
    ];
    const minX = Math.min(-10, ...allPoints.map((p) => p.x)) - 1;
    const maxX = Math.max(10, ...allPoints.map((p) => p.x)) + 1;
    const maxY = Math.max(6, ...allPoints.map((p) => p.y)) + 1;
    const scale = Math.min(880 / (maxX - minX), 410 / maxY);
    renderer.project = (x, y = 0) => ({
      x: 480 + (x - (minX + maxX) / 2) * scale,
      y: 460 - y * scale,
    });
    renderer.spriteScale = scale / 20;
    renderer.pixelGraphics = getConfig().pixelGraphics;
    const c = renderer.ctx;
    c.fillStyle = '#edf1df';
    c.fillRect(0, 0, 960, 520);
    function line(a, b, color, width = 1) {
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.strokeStyle = color;
      c.lineWidth = width;
      c.stroke();
    }
    for (let x = Math.ceil(minX); x <= maxX; x++)
      line(renderer.project(x), renderer.project(x, maxY), '#dce2d2');
    for (let y = 0; y <= maxY; y++)
      line(renderer.project(minX, y), renderer.project(maxX, y), '#dce2d2');
    line(renderer.project(-9), renderer.project(9), '#a89472', 5);
    line(renderer.project(0), renderer.project(0, COURT.netHeight), '#617b70', 4);
    for (const x of [-9, 0, 9]) {
      const p = renderer.project(x);
      renderer.text(x + ' м', p.x, p.y + 25, 14, '#617b70', 'center');
    }
    function path(list, color, dashed) {
      c.setLineDash(dashed ? [6, 6] : []);
      c.beginPath();
      for (const [i, b] of list.entries()) {
        const p = renderer.project(b.x, b.y);
        if (i) c.lineTo(p.x, p.y);
        else c.moveTo(p.x, p.y);
      }
      c.lineWidth = 3;
      c.strokeStyle = color;
      c.stroke();
      c.setLineDash([]);
    }
    data.endpointPaths.forEach((points, i) => path(points, i ? '#d7718c' : '#739ec2', true));
    path(free, '#b6a38a', true);
    path(points, '#3a8276', false);
    if ($('spin-reference').checked && Math.abs(data.impulse.spin) > 0.001)
      path(data.noSpin, '#9962b8', true);
    if (serving()) {
      path(
        data.frames.map((frame) => frame.ball),
        '#cba047',
        true,
      );
      const before = time < data.launchTime;
      const frame =
        data.frames[
          Math.min(data.frames.length - 1, Math.floor(Math.min(time, data.launchTime) / FIXED_DT))
        ];
      Object.assign(player, structuredClone(frame.player));
      match.phase = before ? frame.phase : data.hit ? 'rally' : frame.phase;
      match.phaseTime = before ? frame.time : time - data.launchTime;
      match.serveAction = before ? frame.action : null;
      match.time = time;
      match.ball = before
        ? frame.ball
        : points[Math.min(points.length - 1, Math.floor((time - data.launchTime) / FIXED_DT))];
      if (!before && data.hit) {
        player.armSwing = { ...frame.player.armSwing, age: time - data.launchTime };
        if (player.jumpProfile) {
          player.jumpTime += time - data.launchTime;
          Object.assign(player, sampleJump(player.jumpProfile, player.jumpTime));
        }
      }
      renderer.text(
        'Идеал: ' +
          data.motion.ideal.toFixed(2) +
          ' с · ' +
          (before ? (frame.contactWindow ? 'НАЖМИ СЕЙЧАС' : 'ПОДБРОС') : data.result.toUpperCase()),
        480,
        27,
        17,
        '#866932',
        'center',
      );
      if (data.pressFrame !== null) {
        const hitBall = data.frames[data.pressFrame].ball;
        const marker = renderer.project(hitBall.x, hitBall.y);
        c.strokeStyle = data.hit ? '#d09029' : '#c24e46';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(marker.x, marker.y, 12, 0, Math.PI * 2);
        c.stroke();
        renderer.text(
          '2-е нажатие · ' + data.result,
          marker.x,
          marker.y - 20,
          13,
          c.strokeStyle,
          'center',
        );
      }
    } else {
      match.time = time;
      match.ball =
        points[Math.min(points.length - 1, Math.max(0, Math.floor((time - 0.65) / FIXED_DT)))];
      match.controls[player.team].charge =
        time < 0.65
          ? {
              kind: $('kind').value,
              power: +$('power').value / 100,
              age: time,
              playerId: player.id,
            }
          : null;
      player.armSwing =
        time >= 0.65 && time < 1.4
          ? {
              kind: $('kind').value,
              power: +$('power').value / 100,
              hit: true,
              age: time - 0.65,
              at: 0.65,
              x: ball.x,
              y: ball.y,
              vx: impulse.vx,
              vy: impulse.vy,
            }
          : null;
    }
    renderer.foregroundContext.clearRect(0, 0, 960, 540);
    renderer.ctx = renderer.foregroundContext;
    for (const p of match.players)
      renderer.drawPlayer(p, TEAMS[p.team], match, playing ? dt * +$('slow').value : 0);
    renderer.ctx = c;
    compositePixels(c, renderer.foreground, getConfig().pixelGraphics);
    if (!serving()) {
      const settings = shotSettings(getConfig(), $('kind').value);
      const top = renderer.project(player.x - settings.Reach, player.y + settings.ContactMax);
      c.fillStyle = '#3b94721b';
      c.strokeStyle = '#3b9472';
      c.lineWidth = 2;
      c.fillRect(
        top.x,
        top.y,
        settings.Reach * 2 * scale,
        (settings.ContactMax - settings.ContactMin) * scale,
      );
      c.strokeRect(
        top.x,
        top.y,
        settings.Reach * 2 * scale,
        (settings.ContactMax - settings.ContactMin) * scale,
      );
      const preview = {
        kind: $('kind').value,
        playerId: player.id,
        power: +$('power').value / 100,
        age: 0.2,
      };
      for (const hand of preparedHands(player, match, preview)) {
        const point = renderer.project(hand.x, hand.y);
        c.beginPath();
        c.arc(point.x, point.y, 5, 0, Math.PI * 2);
        c.stroke();
      }
    }
    const b = renderer.project(match.ball.x, match.ball.y);
    c.save();
    c.translate(b.x, b.y);
    const size = Math.max(0.6, (COURT.ballRadius * scale) / 10) * getConfig().ballSize;
    c.scale(size, size);
    c.rotate(match.ball.angle || 0);
    drawBallDesign(c, getConfig().ballSkin, getConfig().pixelGraphics);
    c.restore();
    pixelPresent(renderer.canvas, getConfig().pixelGraphics, 2);
  };
}
