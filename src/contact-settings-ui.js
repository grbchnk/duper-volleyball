import { DEFAULTS } from './config.js';
import { SHOT_FIELDS, MANUAL_SHOT_FIELDS, shotSettings } from './shot-settings.js';
import { SERVE_FIELDS, serveKey, serveSettings } from './serve-settings.js';

// The single persistent profile editor is embedded beside its live preview.
export function createContactSettings(dialog, getConfig, apply, selection, changed) {
  dialog.innerHTML = `<h3>Настройки выбранного действия</h3>
    <p class="hint">Применяются в матче и сохраняются. Траектория рядом обновляется сразу.</p>
    <label id="contact-targeted-row">Расчёт подачи<select id="contact-targeted"><option value="0">Скорость и угол</option><option value="1">Точка приземления и время</option></select></label>
    <p id="contact-settings-hint" class="hint"></p><div id="contact-fields" class="settings-fields"></div>
    <button id="contact-reset" class="secondary">Сбросить выбранное действие</button>`;
  const $ = (id) => dialog.querySelector('#contact-' + id);
  const serving = () => selection().mode === 'serve';
  const fields = () =>
    Object.entries(serving() ? SERVE_FIELDS : SHOT_FIELDS).filter(
      ([key]) => serving() || MANUAL_SHOT_FIELDS.has(key),
    );
  const keyFor = (suffix) =>
    serving() ? serveKey(selection().kind, suffix) : selection().kind + suffix;
  function build() {
    $('fields').innerHTML = fields()
      .map(
        ([suffix, [label, min, max, step, unit]]) =>
          `<div class="shot-field"><label for="contact-range-${suffix}">${label} <output id="contact-value-${suffix}"></output></label><div><input id="contact-range-${suffix}" type="range" min="${min}" max="${max}" step="${step}"><input id="contact-number-${suffix}" type="number" min="${min}" max="${max}" step="${step}" aria-label="${label}, точное значение"></div><small>${unit}</small></div>`,
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
    if (builtMode !== selection().mode) {
      builtMode = selection().mode;
      build();
    }
    const config = getConfig();
    const settings = serving()
      ? serveSettings(config, selection().kind)
      : shotSettings(config, selection().kind);
    $('targeted-row').hidden = !serving();
    $('targeted').value = settings.Targeted || 0;
    $('settings-hint').textContent = serving()
      ? 'Каждая подача имеет свой профиль. Набор силы длится вдвое дольше обычного удара; на 100% можно удерживать кнопку, подброс начинается после отпускания. Для подсечки снизу: Z / L2 + нижняя подача.'
      : 'Направление задаётся при контакте. Скорости 0% и 100% относятся к обычному удару; мягкие варианты используют свою скорость. Высоты и дальность задают игровую досягаемость.';
    for (const [suffix, [, , , , , group]] of fields()) {
      const disabled =
        (serving() &&
          ((settings.Targeted
            ? ['endpoints', 'direction'].includes(group) && suffix !== 'PowerCurve'
            : group === 'target') ||
            (suffix === 'Runup' && selection().kind !== 'drive') ||
            (config.dynamic && suffix === 'ChargeSeconds'))) ||
        (!serving() && selection().soft && ['SpeedMin', 'SpeedMax'].includes(suffix));
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
