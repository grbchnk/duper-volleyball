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
    <p class="hint">Применяются в матче и сохраняются. Траектория рядом обновляется сразу.</p>
    <label id="contact-targeted-row">Расчёт подачи<select id="contact-targeted"><option value="0">Скорость и угол</option><option value="1">Точка приземления и время</option></select></label>
    <p id="contact-settings-hint" class="hint"></p><div id="contact-fields" class="settings-fields"></div>
    <button id="contact-reset" class="secondary">Сбросить выбранное действие</button>`;
  const $ = (id) => dialog.querySelector('#contact-' + id);
  const serving = () => selection().mode === 'serve';
  const common = new Set(['ContactMin', 'ContactMax', 'Reach']);
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
              if (selection().kind !== 'low' || !['GroundAngle', 'AirAngle'].includes(key))
                return [key, metadata];
              return [
                key,
                [
                  key === 'GroundAngle'
                    ? 'Угол с направлением · с земли'
                    : 'Угол с направлением · в прыжке',
                  38,
                  88,
                  1,
                  '°',
                  'Базовый угол при заданном направлении. Без направления нижний приём рассчитывает отскок по месту касания; этот угол его не меняет.',
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
    $('fields').innerHTML = fields()
      .map(
        ([suffix, [label, min, max, step, unit, hint]]) =>
          `<label class="setting-label" for="contact-range-${suffix}">${label} <output id="contact-value-${suffix}"></output></label><input class="setting-range" id="contact-range-${suffix}" type="range" min="${min}" max="${max}" step="${step}" aria-describedby="contact-hint-${suffix}"><input class="setting-number" id="contact-number-${suffix}" type="number" min="${min}" max="${max}" step="${step}" aria-label="${label}, точное значение"><small class="setting-note" id="contact-hint-${suffix}">${unit} · ${serving() ? SERVE_HINTS[suffix] || label : common.has(suffix) ? (suffix === 'Reach' ? 'Горизонтальный допуск от игрока до мяча.' : 'Высота над стопами игрока.') + ' Общий для всех вариантов этого приёма.' : hint}</small>`,
      )
      .join('');
    for (const [suffix] of fields())
      for (const type of ['range', 'number']) {
        const input = $(type + '-' + suffix);
        input.oninput = () => {
          if (input.value === '' || !Number.isFinite(+input.value)) return;
          const next = {
            ...getConfig(),
            [keyFor(suffix)]: Math.max(+input.min, Math.min(+input.max, +input.value)),
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
    $('profile-title').textContent = serving()
      ? 'Профиль подачи'
      : 'Профиль: ' + SHOT_VARIANTS[shotVariant(selection())];
    $('targeted-row').hidden = !serving();
    $('targeted').value = settings.Targeted || 0;
    $('settings-hint').textContent = serving()
      ? 'Каждая подача имеет свой профиль. Набор силы длится вдвое дольше обычного удара; на 100% можно удерживать кнопку, подброс начинается после отпускания. Для подсечки снизу: Z / L2 + нижняя подача.'
      : 'Выберите L2 или R2 выше: редактируется только этот вариант данного приёма. L2 + R2 использует L2. Общие допуски контакта действуют на все три варианта. Значения сразу применяются к вашей игре.';
    for (const [suffix, [, , , , , group]] of fields()) {
      const disabled =
        serving() &&
        ((settings.Targeted && !selection().manual
          ? ['endpoints', 'direction'].includes(group) && suffix !== 'PowerCurve'
          : group === 'target') ||
          (suffix === 'Runup' && selection().kind !== 'drive') ||
          (config.dynamic && suffix === 'ChargeSeconds'));
      for (const type of ['range', 'number']) {
        $(type + '-' + suffix).value = settings[suffix];
        $(type + '-' + suffix).disabled = disabled;
      }
      $('value-' + suffix).textContent = String(settings[suffix]);
    }
  }
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
