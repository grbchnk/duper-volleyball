import { paintBody, frameOf } from './sprites.js';
import { TEAMS, UNIFORM_COLORS, HAIR_COLORS, uniformPalette } from './teams.js';
import { HEAD_GROUPS, BODY_STYLES, SKIN_TONES, teamAppearance } from './appearance.js';
import { EXTRA_HEAD_STYLES } from './head-styles.js';
import { SHOE_STYLES, JERSEY_PRINTS, ACCESSORY_COLORS } from './player-accessories.js';
import { SPECIAL_HEADS } from './special-heads.js';
import { Match } from './engine.js';
import { Renderer } from './renderer.js';

const HEAD_NAMES = {
  cap: 'Кепка',
  fox: 'Лисья шапка',
  band: 'Повязка',
  crop: 'Короткая стрижка',
  bald: 'Без волос',
  ...Object.fromEntries(Object.entries(EXTRA_HEAD_STYLES).map(([id, s]) => [id, s.name])),
  ...SPECIAL_HEADS,
};
const BODY_NAMES = {
  classic: 'Однотонная',
  stripes: 'Полосы',
  sleeveless: 'Майка',
  chevron: 'Шеврон',
  longsleeve: 'Длинный рукав',
};
export function selectClub(config, id, away = false) {
  const preset = TEAMS.find((t) => t.id === id);
  return preset
    ? {
        ...config,
        [away ? 'awayTeam' : 'homeTeam']: id,
        [away ? 'awayColor' : 'homeColor']: preset.color,
        ...(away
          ? {}
          : { customTeamAppearance: false, randomTeamAppearance: false, teamPlayers: [] }),
      }
    : config;
}
let rosterRenderer;
function drawRoster(canvas, match, color, scale) {
  const renderer = (rosterRenderer ||= new Renderer(canvas, { scene: false }));
  renderer.canvas = canvas;
  renderer.ctx = canvas.getContext('2d');
  renderer.spriteScale = scale;
  renderer.project = (x, y = 0) => ({
    x: canvas.width / 6 + ((x + 6) * canvas.width) / 3,
    y: canvas.height - 30 - y * 55,
  });
  renderer.armRigs.clear();
  const c = renderer.ctx;
  c.fillStyle = '#edf1df';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#d6c4a1';
  c.fillRect(14, canvas.height - 29, canvas.width - 28, 2);
  match.phase = 'rally';
  match.selected = [0, 3];
  match.humanSlot = () => null;
  match.controllers = 0;
  for (const [i, p] of match.players.slice(0, 3).entries()) {
    Object.assign(p, { x: -6 + i, y: 0, pose: 'idle', emotion: null });
    renderer.drawPlayer(p, uniformPalette(color), match, 0);
    c.fillStyle = '#43564a';
    c.font = '12px sans-serif';
    c.textAlign = 'center';
    c.fillText(String(i + 1), canvas.width / 6 + (i * canvas.width) / 3, canvas.height - 8);
  }
}
export function createTeamEditor(dialog, getConfig, applyConfig) {
  dialog.innerHTML = `<div class="dialog-top"><div><p class="eyebrow">КЛУБ · ФОРМА · СОСТАВ</p><h2>Моя команда</h2></div><button class="close" aria-label="Закрыть мою команду">×</button></div>
  <div class="team-editor-layout"><details class="team-presets"><summary>Выбрать готовый клуб · 10 составов</summary><p class="hint">10 составов со своей внешностью. Можно взять готовый и настроить под себя.</p><div id="team-preset-grid"></div></details>
  <section class="team-custom"><div class="team-preview"><h3 id="team-current-name"></h3><canvas id="team-roster-preview" width="630" height="250" aria-label="Предпросмотр трёх игроков моей команды"></canvas><p id="team-current-description" class="hint"></p></div>
  <h3>Цвет формы</h3><div id="team-uniform-colors" class="color-swatches" role="group" aria-label="Цвет формы"></div>
  <label class="team-random"><input id="team-random-appearance" type="checkbox"> Случайная внешность</label><p class="hint">Меняются головы, причёски, форма, обувь и рисунки. Выбранный цвет команды сохраняется.</p><button id="team-reroll" class="secondary">Подобрать другую внешность ↻</button>
  <h3>Настроить игрока</h3><div id="team-player-tabs" class="team-player-tabs" role="group" aria-label="Игрок для настройки">${['1 · Задний', '2 · Связующий', '3 · Передний'].map((name, i) => `<button class="secondary" data-player="${i}">${name}</button>`).join('')}</div>
  <p id="team-edit-hint" class="hint" role="status"></p>
  <fieldset id="team-player-fields"><h3>Голова / причёска</h3><div id="team-head-gallery" class="head-gallery" role="group" aria-label="Голова или причёска"></div>
  <label>Цвет волос / шерсти</label><div id="team-hair-colors" class="color-swatches" role="group" aria-label="Цвет волос или шерсти"></div>
  <label>Тон кожи</label><div id="team-skin-colors" class="color-swatches" role="group" aria-label="Тон кожи"></div>
  <label for="team-body">Форма игрока</label><select id="team-body">${BODY_STYLES.map((id) => `<option value="${id}">${BODY_NAMES[id]}</option>`).join('')}</select>
  <h3>Рисунок на форме</h3><p class="hint">Номер или рисунок выбирается отдельно от фасона формы.</p><div id="team-print-gallery" class="accessory-gallery" role="group" aria-label="Рисунок на форме"></div>
  <label>Цвет рисунка</label><div id="team-print-colors" class="color-swatches" role="group" aria-label="Цвет рисунка на форме"></div>
  <h3>Обувь</h3><div id="team-shoe-gallery" class="accessory-gallery" role="group" aria-label="Обувь игрока"></div>
  <label>Цвет обуви</label><div id="team-shoe-colors" class="color-swatches" role="group" aria-label="Цвет обуви"></div>
  </fieldset>
  <button id="team-restore-roster" class="secondary">Вернуть исходный состав клуба</button><p class="hint">Изменения применяются сразу и сохраняются в браузере и общем JSON.</p></section></div>`;
  const $ = (id) => dialog.querySelector('#team-' + id);
  let slot = 0;
  const preview = new Match(getConfig());
  const changePlayer = (patch) => {
    const config = getConfig();
    const roster = Array.from({ length: 3 }, (_, i) => ({ ...teamAppearance(config, 0, i) }));
    roster[slot] = { ...roster[slot], ...patch };
    applyConfig({
      ...config,
      customTeamAppearance: true,
      randomTeamAppearance: false,
      teamPlayers: roster,
    });
  };
  const swatches = (id, colors, fn) => {
    for (const [color, name] of colors) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'color-swatch';
      b.style.setProperty('--swatch', color);
      b.dataset.color = color;
      b.title = name;
      b.setAttribute('aria-label', name);
      b.onclick = () => fn(color);
      $(id).append(b);
    }
  };
  swatches('uniform-colors', UNIFORM_COLORS, (color) =>
    applyConfig({ ...getConfig(), homeColor: color }),
  );
  swatches('hair-colors', HAIR_COLORS, (hair) => changePlayer({ hair }));
  swatches('print-colors', ACCESSORY_COLORS, (printColor) => changePlayer({ printColor }));
  swatches('shoe-colors', ACCESSORY_COLORS, (shoeColor) => changePlayer({ shoeColor }));
  swatches(
    'skin-colors',
    SKIN_TONES.map((c, i) => [c, 'Тон кожи ' + (i + 1)]),
    (tone) => changePlayer({ tone }),
  );
  for (const preset of TEAMS) {
    const b = document.createElement('button');
    b.className = 'team-preset';
    b.dataset.team = preset.id;
    b.setAttribute('aria-label', preset.name);
    b.innerHTML = `<canvas width="270" height="150" aria-hidden="true"></canvas><strong>${preset.name}</strong><small>${preset.description}</small>`;
    drawRoster(
      b.querySelector('canvas'),
      new Match({
        ...getConfig(),
        homeTeam: preset.id,
        randomTeamAppearance: false,
        customTeamAppearance: false,
      }),
      preset.color,
      2.25,
    );
    b.onclick = () => applyConfig(selectClub(getConfig(), preset.id));
    $('preset-grid').append(b);
  }
  $('random-appearance').onchange = () =>
    applyConfig({
      ...getConfig(),
      randomTeamAppearance: $('random-appearance').checked,
      appearanceSeed: 1 + (Date.now() % 999999999),
    });
  $('reroll').onclick = () =>
    applyConfig({
      ...getConfig(),
      randomTeamAppearance: true,
      appearanceSeed: 1 + Math.floor(Math.random() * 999999999),
    });
  $('restore-roster').onclick = () =>
    applyConfig({
      ...getConfig(),
      customTeamAppearance: false,
      randomTeamAppearance: false,
      teamPlayers: [],
    });
  for (const b of $('player-tabs').querySelectorAll('button'))
    b.onclick = () => {
      slot = Number(b.dataset.player);
      sync();
    };
  const headCards = [];
  for (const { id: category, name: title, heads } of HEAD_GROUPS) {
    const heading = document.createElement('h4');
    heading.textContent = title;
    $('head-gallery').append(heading);
    for (const head of heads) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'head-choice';
      button.dataset.head = head;
      button.dataset.category = category;
      button.setAttribute('aria-label', HEAD_NAMES[head]);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 96;
      canvas.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = HEAD_NAMES[head];
      button.append(canvas, label);
      button.onclick = () => changePlayer({ head });
      $('head-gallery').append(button);
      headCards.push({ button, canvas, head });
    }
  }
  const accessoryCards = [];
  for (const [gallery, property, catalogue, fallback, layer, scale, offsetY] of [
    ['print', 'jerseyPrint', JERSEY_PRINTS, 'none', 'torso', 4, 108],
    ['shoe', 'shoes', SHOE_STYLES, 'classic', 'feet', 4, 64],
  ]) {
    for (const [id, design] of Object.entries(catalogue)) {
      const name = typeof design === 'string' ? design : design.name;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'accessory-choice';
      button.dataset[property] = id;
      button.setAttribute('aria-label', name);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 96;
      canvas.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = name;
      button.append(canvas, label);
      button.onclick = () => changePlayer({ [property]: id });
      $(gallery + '-gallery').append(button);
      accessoryCards.push({ button, canvas, property, id, fallback, layer, scale, offsetY });
    }
  }
  let galleryStamp;
  let accessoryStamp;
  let rosterStamp;
  $('body').onchange = () => changePlayer({ body: $('body').value });
  function sync() {
    const config = getConfig(),
      preset = TEAMS.find((t) => t.id === config.homeTeam) || TEAMS[0];
    preview.updateConfig(config);
    const nextRosterStamp = JSON.stringify([
      config.homeColor,
      config.armScale,
      config.armLength,
      config.elbowHeight,
      config.armBend,
      config.armRoundness,
      preview.players.slice(0, 3).map((p) => p.appearance),
    ]);
    if (nextRosterStamp !== rosterStamp) {
      drawRoster($('roster-preview'), preview, config.homeColor, 3.7);
      rosterStamp = nextRosterStamp;
    }
    const p = preview.players[slot].appearance;
    $('current-name').textContent = preset.name;
    $('current-description').textContent = preset.description;
    $('random-appearance').checked = config.randomTeamAppearance;
    $('player-fields').disabled = config.randomTeamAppearance;
    $('edit-hint').textContent = config.randomTeamAppearance
      ? 'Сними «Случайная внешность», чтобы настроить игроков вручную.'
      : `Настройки игрока ${slot + 1}. Другие игроки сохранят свою внешность.`;
    const nextGalleryStamp = JSON.stringify([p.hair, p.tone, config.homeColor]);
    for (const { button, canvas, head } of headCards) {
      button.setAttribute('aria-pressed', String(p.head === head));
      if (galleryStamp !== nextGalleryStamp) {
        const c = canvas.getContext('2d');
        c.clearRect(0, 0, 96, 96);
        c.save();
        c.translate(48, 108);
        c.scale(2, 2);
        paintBody(c, frameOf('idle', 0), 'club', uniformPalette(config.homeColor), slot, 'head', {
          ...p,
          head,
        });
        c.restore();
      }
    }
    galleryStamp = nextGalleryStamp;
    const nextAccessoryStamp = JSON.stringify([p, config.homeColor]);
    for (const {
      button,
      canvas,
      property,
      id,
      fallback,
      layer,
      scale,
      offsetY,
    } of accessoryCards) {
      button.setAttribute('aria-pressed', String((p[property] || fallback) === id));
      if (accessoryStamp !== nextAccessoryStamp) {
        const c = canvas.getContext('2d');
        c.clearRect(0, 0, 96, 96);
        c.save();
        c.translate(48, offsetY);
        c.scale(scale, scale);
        paintBody(c, frameOf('idle', 0), 'club', uniformPalette(config.homeColor), slot, layer, {
          ...p,
          [property]: id,
        });
        c.restore();
      }
    }
    accessoryStamp = nextAccessoryStamp;
    $('body').value = p.body;
    for (const [id, color] of [
      ['uniform-colors', config.homeColor],
      ['hair-colors', p.hair],
      ['skin-colors', p.tone],
      ['print-colors', p.printColor || '#fff6e1'],
      ['shoe-colors', p.shoeColor || '#fff6e1'],
    ])
      for (const b of $(id).querySelectorAll('button'))
        b.setAttribute('aria-pressed', String(b.dataset.color === color));
    for (const b of $('preset-grid').querySelectorAll('button'))
      b.setAttribute('aria-pressed', String(b.dataset.team === config.homeTeam));
    for (const b of $('player-tabs').querySelectorAll('button'))
      b.setAttribute('aria-pressed', String(Number(b.dataset.player) === slot));
  }
  sync();
  return { sync };
}
