import { DEFAULTS } from './config.js';
import {
  SHOT_FIELDS,
  VARIANT_FIELDS,
  variantKey,
  variantSettings,
  shotVariant,
  SHOT_VARIANTS,
  shotSettings,
} from './shot-settings.js';
import { SERVE_FIELDS, serveKey, serveSettings } from './serve-settings.js';

const SERVE_HINTS = {
  SpeedMin: 'Скорость при минимальном заряде в режиме «Скорость и угол».',
  SpeedMax: 'Скорость при полном заряде в режиме «Скорость и угол».',
  AngleMin: 'Угол вылета при минимальном заряде. 90° — вертикально вверх.',
  AngleMax: 'Угол вылета при полном заряде. 0° — горизонтально к сетке.',
  SpinMin: 'Вращение при минимальном заряде. Положительное усиливает падение.',
  SpinMax: 'Вращение при полном заряде. Отрицательное ослабляет падение.',
  PowerCurve: '1 — равномерный набор скорости. Выше 1 — прибавка ближе к полному заряду.',
  AimBlend: 'Доля выбранного ручного угла вместо угла профиля. 1 — полностью ручной угол.',
  ElevationMin: 'Минимальный угол вылета при заданном направлении.',
  ElevationMax: 'Максимальный угол вылета при заданном направлении.',
  TargetMin:
    'Точка приземления относительно сетки при минимальном заряде. Отрицательное — своя сторона.',
  TargetMax: 'Точка приземления при полном заряде. Дальше 9.25 м — за площадкой.',
  TargetCurve: 'Как заряд перемещает цель между минимальной и максимальной дальностью.',
  FlightTimeMin: 'Расчётное время до земли при минимальном заряде, до коррекции обхода сетки.',
  FlightTimeMax: 'Расчётное время до земли при полном заряде, до коррекции обхода сетки.',
  NetAssist:
    '1 — увеличить время и поднять дугу, если рассчитанная подача упирается в сетку; 0 — без коррекции.',
  IdealMin: 'Идеальное время второго нажатия после отпускания при минимальном заряде.',
  IdealMax:
    'Идеальное время второго нажатия при полном заряде. Для прыжка учитывается достижимая вершина.',
  PerfectWindow: 'По обе стороны идеального времени: в этом интервале сохраняется полная точность.',
  HitWindow: 'За пределами этого интервала — полный промах. Внутри сила плавно убывает к краям.',
  MistimePower:
    'Доля силы неточного касания на краю допустимого окна. Между краем и идеалом переход плавный.',
  TossHeight: 'Высота свободного мяча после подъёма с ладони.',
  TossGravity: 'Ускорение свободного подброса вниз. К игровому мячу после подачи не применяется.',
  ContactHeight: 'Высота точки удара над стопами. В прыжке прибавляется высота игрока.',
  ContactReach:
    'Допуск по расстоянию от мяча до рабочей кисти. У границы сила касания уменьшается.',
  Runup: 'Перемещение вперёд до отталкивания в подаче в прыжке.',
};

// The single persistent profile editor is embedded beside its live preview.
export function createContactSettings(dialog, getConfig, apply, selection, changed) {
  dialog.innerHTML = `<h3 id="contact-profile-title">Настройки выбранного действия</h3>
    <p class="hint">Настройки матча · сохраняются автоматически</p>
    <label id="contact-targeted-row">Расчёт подачи<select id="contact-targeted"><option value="0">Скорость и угол</option><option value="1">Точка приземления и время</option></select></label>
    <p id="contact-settings-hint" class="hint"></p><nav id="contact-tabs" class="settings-tabs" aria-label="Параметры удара"></nav>
    <label id="contact-wait-row"><input id="contact-wait-enabled" type="checkbox"> Ждать отпускания в зоне контакта</label>
    <div id="contact-fields" class="settings-fields"></div>
    <button id="contact-reset" class="secondary">Сбросить выбранное действие</button>`;
  const $ = (id) => dialog.querySelector('#contact-' + id);
  const serving = () => selection().mode === 'serve';
  const common = new Set(['ContactMin', 'ContactMax', 'Reach']);
  const groups = {
    power: 'Сила',
    direction: 'Углы',
    contact: 'Контакт',
    flight: 'Полёт',
    timing: 'Подача: момент',
  };
  const groupFor = (suffix) =>
    /Contact|Reach|ReceiveHold/.test(suffix)
      ? 'contact'
      : /Angle|Aim|Elevation/.test(suffix)
        ? 'direction'
        : /Spin|Dip|Tempo|Target|Flight|NetAssist/.test(suffix)
          ? 'flight'
          : /Ideal|Window|Mistime|Toss|Runup/.test(suffix)
            ? 'timing'
            : 'power';
  let activeGroup = 'power';
  const rememberedWaits = new Map();
  function showGroup() {
    for (const node of $('fields').children)
      node.hidden =
        node.dataset.section !== activeGroup ||
        (node.classList.contains('setting-note') && node.dataset.expanded !== 'true');
    for (const button of $('tabs').children)
      button.setAttribute('aria-pressed', String(button.dataset.section === activeGroup));
    $('wait-row').hidden = serving() || activeGroup !== 'contact';
  }
  const fields = () =>
    serving()
      ? Object.entries(SERVE_FIELDS).filter(
          ([key]) =>
            (key !== 'ChargeSeconds' || !getConfig().dynamic) &&
            (key !== 'Runup' || selection().kind === 'drive'),
        )
      : [
          ...Object.entries(VARIANT_FIELDS)
            .filter(([key]) => key !== 'Dip' || selection().kind === 'drive')
            .map(([key, metadata]) => {
              if (selection().kind === 'low' && ['ElevationMin', 'ElevationMax'].includes(key))
                return [key, [metadata[0], 0, ...metadata.slice(2)]];
              if (selection().kind !== 'low' || !['GroundAngle', 'AirAngle'].includes(key))
                return [key, metadata];
              return [
                key,
                [
                  key === 'GroundAngle' ? 'Исходный угол · с земли' : 'Исходный угол · в прыжке',
                  38,
                  88,
                  1,
                  '°',
                  'Угол нижнего приёма при направлении по горизонтали. Наклон стика изменяет угол; без стика мяч поднимается над игроком.',
                ],
              ];
            }),
          ...Object.entries(SHOT_FIELDS).filter(([key]) => common.has(key)),
        ];
  const keyFor = (suffix) =>
    serving()
      ? serveKey(selection().kind, suffix)
      : common.has(suffix)
        ? selection().kind + suffix
        : variantKey(selection().kind, shotVariant(selection()), suffix);
  function build() {
    const available = new Set(fields().map(([suffix]) => groupFor(suffix)));
    if (!available.has(activeGroup)) activeGroup = 'power';
    $('tabs').replaceChildren(
      ...Object.entries(groups)
        .filter(([id]) => available.has(id))
        .map(([id, name]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'secondary';
          button.textContent = name;
          button.dataset.section = id;
          button.onclick = () => {
            activeGroup = id;
            showGroup();
          };
          return button;
        }),
    );
    $('fields').innerHTML = fields()
      .map(
        ([suffix, [label, min, max, step, unit, hint]]) =>
          `<label class="setting-label" for="contact-range-${suffix}">${label} <output id="contact-value-${suffix}"></output></label><input class="setting-range" id="contact-range-${suffix}" type="range" min="${min}" max="${max}" step="${step}" aria-describedby="contact-hint-${suffix}"><input class="setting-number" id="contact-number-${suffix}" type="number" min="${min}" max="${max}" step="${step}" aria-label="${label}, точное значение"><small class="setting-note" id="contact-hint-${suffix}">${unit} · ${serving() ? SERVE_HINTS[suffix] || label : common.has(suffix) ? (suffix === 'Reach' ? 'Горизонтальный допуск от игрока до мяча.' : 'Высота над стопами игрока.') + ' Общий для всех вариантов этого приёма.' : hint}</small>`,
      )
      .join('');
    fields().forEach(([suffix], index) => {
      for (const node of [...$('fields').children].slice(index * 4, index * 4 + 4))
        node.dataset.section = groupFor(suffix);
      const help = document.createElement('button');
      help.type = 'button';
      help.className = 'setting-help';
      help.textContent = '?';
      help.setAttribute('aria-label', 'Пояснение: ' + fields()[index][1][0]);
      help.setAttribute('aria-expanded', 'false');
      help.onclick = (event) => {
        event.preventDefault();
        const expanded = $('hint-' + suffix).dataset.expanded !== 'true';
        $('hint-' + suffix).dataset.expanded = String(expanded);
        help.setAttribute('aria-expanded', String(expanded));
        showGroup();
      };
      $('value-' + suffix).before(help);
      if (suffix === 'ReceiveHoldTime') {
        for (const type of ['range', 'number']) {
          $(type + '-' + suffix).max = 500;
          $(type + '-' + suffix).step = 10;
        }
        $('hint-' + suffix).textContent =
          'мс · Отсчёт с входа мяча в зону при зажатой кнопке. Удар — при отпускании, конце времени или перед выходом готового мяча из зоны. Мяч свободно летит; L2 имеет собственное значение.';
      }
    });
    showGroup();
    for (const [suffix] of fields())
      for (const type of ['range', 'number']) {
        const input = $(type + '-' + suffix);
        input.oninput = () => {
          if (input.value === '' || !Number.isFinite(+input.value)) return;
          const next = {
            ...getConfig(),
            [keyFor(suffix)]:
              Math.max(+input.min, Math.min(+input.max, +input.value)) /
              (suffix === 'ReceiveHoldTime' ? 1000 : 1),
          };
          for (const [low, high] of [
            ['SpeedMin', 'SpeedMax'],
            ['ElevationMin', 'ElevationMax'],
            ['ContactMin', 'ContactMax'],
            ['PerfectWindow', 'HitWindow'],
          ]) {
            if (suffix === low && next[keyFor(low)] > next[keyFor(high)])
              next[keyFor(high)] = next[keyFor(low)];
            if (suffix === high && next[keyFor(high)] < next[keyFor(low)])
              next[keyFor(low)] = next[keyFor(high)];
          }
          apply(next);
          sync();
          changed();
        };
      }
  }
  let builtMode;
  function sync() {
    const identity = selection().mode + selection().kind + shotVariant(selection());
    if (builtMode !== identity) {
      builtMode = identity;
      build();
    }
    const config = getConfig();
    const settings = serving()
      ? serveSettings(config, selection().kind)
      : {
          ...shotSettings(config, selection().kind),
          ...variantSettings(config, selection().kind, selection()),
        };
    $('wait-enabled').checked = settings.ReceiveHoldTime > 0;
    if (settings.ReceiveHoldTime > 0)
      rememberedWaits.set(keyFor('ReceiveHoldTime'), settings.ReceiveHoldTime);
    showGroup();
    $('profile-title').textContent = serving()
      ? 'Профиль подачи'
      : 'Профиль: ' + SHOT_VARIANTS[shotVariant(selection())];
    $('targeted-row').hidden = !serving();
    $('targeted').value = settings.Targeted || 0;
    $('settings-hint').textContent = serving()
      ? settings.Targeted && !selection().manual
        ? 'Угол рассчитывается по цели. Для ручных границ выбери расчёт «Скорость и угол». ? — пояснение.'
        : 'Профиль выбранной подачи. ? — пояснение параметра.'
      : 'Для выбранного варианта. Зона контакта общая. ? — пояснение.';
    for (const [suffix, [, , , , unit, group]] of fields()) {
      const disabled =
        serving() &&
        ((settings.Targeted && !selection().manual
          ? ['endpoints', 'direction'].includes(group) && suffix !== 'PowerCurve'
          : group === 'target') ||
          (suffix === 'Runup' && selection().kind !== 'drive') ||
          (config.dynamic && suffix === 'ChargeSeconds'));
      for (const type of ['range', 'number']) {
        $(type + '-' + suffix).value =
          suffix === 'ReceiveHoldTime' ? Math.round(settings[suffix] * 1000) : settings[suffix];
        $(type + '-' + suffix).disabled = disabled;
      }
      $('value-' + suffix).textContent =
        suffix === 'ReceiveHoldTime'
          ? Math.round(settings[suffix] * 1000) + ' мс'
          : String(settings[suffix]) + (unit ? ' ' + unit : '');
    }
  }
  $('wait-enabled').onchange = () => {
    apply({
      ...getConfig(),
      [keyFor('ReceiveHoldTime')]: $('wait-enabled').checked
        ? rememberedWaits.get(keyFor('ReceiveHoldTime')) || 0.12
        : 0,
    });
    sync();
    changed();
  };
  $('targeted').onchange = () => {
    apply({ ...getConfig(), [keyFor('Targeted')]: +$('targeted').value });
    sync();
    changed();
  };
  $('reset').onclick = () => {
    const keys = fields().map(([suffix]) => keyFor(suffix));
    if (serving()) keys.push(keyFor('Targeted'));
    apply({ ...getConfig(), ...Object.fromEntries(keys.map((key) => [key, DEFAULTS[key]])) });
    sync();
    changed();
  };
  sync();
  return { sync };
}
