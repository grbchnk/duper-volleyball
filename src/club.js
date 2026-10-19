import { TEAMS } from './teams.js';
import { DEFAULTS } from './config.js';
import { CHALLENGES, challengeStars, startChallenge } from './challenges.js';
import { challengeProfileKey, profileRecords, sanitizeRecordProfiles } from './records.js';

export const TOUR = Object.freeze([
  {
    name: 'Гул улиц',
    style: 'balanced',
    skill: 0,
    team: 'mint',
    arena: 'miami',
    hint: 'Освой подачу и отправляй мяч в свободное место.',
  },
  {
    name: 'Стена мегаполиса',
    style: 'blocker',
    skill: 20,
    team: 'bears',
    arena: 'gym',
    hint: 'Ранний блок: задержи удар или обмани мягкой скидкой Z / L2.',
  },
  {
    name: 'Берег чемпионов',
    style: 'deep',
    skill: 40,
    team: 'sakura',
    arena: 'farm',
    hint: 'Глубокая защита: попробуй короткий мяч за сетку.',
  },
  {
    name: 'Ночной квартал',
    style: 'trickster',
    skill: 60,
    team: 'nigeria',
    arena: 'beach',
    hint: 'Соперник меняет темп. Береги третий контакт и готовь бросок.',
  },
  {
    name: 'Континентальный финал',
    style: 'patient',
    skill: 80,
    team: 'pumpkins',
    arena: 'alpine',
    hint: 'Терпеливый соперник. Чередуй силу, высоту и направление.',
  },
  {
    name: 'Мировая арена',
    style: 'blocker',
    skill: 92,
    team: 'robots',
    arena: 'sky',
    hint: 'Плотный блок и быстрые ответы. Разыгрывайте мяч на двоих.',
  },
  {
    name: 'Кубок мира',
    style: 'patient',
    skill: 100,
    team: 'rabbits',
    arena: 'championship',
    hint: 'Финал до 11 очков. Терпение, обман и точный третий удар.',
  },
]);
const STORE = 'duper-volleyball.club.v1';
export function sanitizeProgress(value = {}) {
  const number = (v, max) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
  return {
    stage: number(value?.stage, TOUR.length - 1),
    cups: number(value?.cups, 9999),
    records: Object.fromEntries(
      Object.keys(CHALLENGES).map((id) => [id, number(value?.records?.[id], 10000)]),
    ),
    recordProfiles: sanitizeRecordProfiles(value?.recordProfiles),
  };
}
export function completeStage(progress, won) {
  const p = sanitizeProgress(progress);
  if (!won) return p;
  if (p.stage === TOUR.length - 1) {
    p.cups++;
    p.stage = 0;
  } else p.stage++;
  return p;
}
export function createClub(match, hooks) {
  let coop = false;
  let displayedProfile = null;
  const testingOverrides = {};
  let profile;
  try {
    profile = sanitizeProgress(JSON.parse(localStorage.getItem(STORE) || '{}'));
  } catch {
    profile = sanitizeProgress();
  }
  let activity = null,
    original = null,
    settled = false,
    tourWon = false,
    newRecord = false;
  const panel = document.createElement('section');
  panel.className = 'club-panel';
  panel.innerHTML = `<p class="club-kicker">ТВОЙ ВОЛЕЙБОЛЬНЫЙ КЛУБ</p>
    <div class="club-heading"><h2>Кубок мира</h2><span id="club-cups" aria-label="Выигранные кубки"></span></div>
    <div class="club-feedback" role="status"><b id="club-feedback-title">Точность решает.</b><span id="club-feedback-detail"></span></div>
    <label class="club-coop-label"><input id="club-coop" type="checkbox">На двоих · одна команда<small>P1 красный / P2 синий · задние ↔ передний после нашего очка</small></label>
    <div id="club-stages" class="club-stages"></div>
    <h3 id="club-stage-name"></h3><p id="club-stage-hint"></p>
    <button id="club-tour" class="primary">Продолжить турнир ↗</button>
    <div class="club-section-title"><h3>Проверь свой скилл</h3><span>10 мячей</span></div>
    <div class="club-challenges">${Object.entries(CHALLENGES)
      .map(
        ([id, c]) =>
          `<button data-challenge="${id}" class="club-challenge"><span><b>${c.name}</b><small>${c.subtitle}</small></span><span id="club-best-${id}" class="club-record"></span></button>`,
      )
      .join('')}</div>
    <p class="club-footnote">Рекорды и этап турнира сохраняются на этом устройстве.</p>`;
  document.querySelector('.sidebar').prepend(panel);
  const sidebar = document.querySelector('.sidebar');
  const menu = document.createElement('button');
  menu.id = 'club-menu';
  menu.className = 'club-menu';
  menu.textContent = 'Клуб ☰';
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-controls', 'club-sidebar');
  sidebar.id = 'club-sidebar';
  document.querySelector('.arena-tools').prepend(menu);
  const closeMenu = document.createElement('button');
  closeMenu.className = 'club-menu-close';
  closeMenu.textContent = 'Вернуться на площадку ×';
  sidebar.prepend(closeMenu);
  let drawerPaused = false;
  function closeDrawer(resume = true) {
    if (!sidebar.classList.contains('club-open')) return;
    sidebar.classList.remove('club-open');
    menu.setAttribute('aria-expanded', 'false');
    if (resume) hooks.pause(drawerPaused);
    hooks.focus();
  }
  menu.onclick = () => {
    if (sidebar.classList.contains('club-open')) {
      closeDrawer();
      return;
    }
    drawerPaused = hooks.paused();
    hooks.pause(true);
    sidebar.classList.add('club-open');
    menu.setAttribute('aria-expanded', 'true');
    closeMenu.focus();
  };
  closeMenu.onclick = () => closeDrawer();
  sidebar.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && sidebar.classList.contains('club-open')) {
      event.stopPropagation();
      event.preventDefault();
      closeDrawer();
    }
  });
  const $ = (id) => document.getElementById('club-' + id);
  const hud = document.getElementById('club-hud');
  let lobbyChoice = 0,
    previousAxis = 0;
  const choices = [
    document.getElementById('club-lobby-tour'),
    document.getElementById('club-lobby-precision'),
    document.getElementById('start'),
    document.getElementById('tutorial-start'),
  ];
  function markChoice() {
    choices.forEach((button, index) => {
      button.classList.toggle('club-selected', index === lobbyChoice);
      button.setAttribute('aria-pressed', String(index === lobbyChoice));
    });
  }
  function moveChoice(axis) {
    lobbyChoice = (lobbyChoice + axis + choices.length) % choices.length;
    markChoice();
  }
  function lobbyInput(input) {
    const axis = input.axis > 0.55 ? 1 : input.axis < -0.55 ? -1 : 0;
    if (axis && axis !== previousAxis) {
      moveChoice(axis);
    }
    previousAxis = axis;
  }
  markChoice();
  const tourButton = document.getElementById('club-tour-mode');
  tourButton.onclick = () => launchTour();
  const coopButton = document.getElementById('coop-mode');
  coopButton.onclick = () => {
    coop = true;
    $('coop').checked = true;
    launchTour();
  };
  $('coop').onchange = (event) => {
    coop = event.target.checked;
  };
  $('tour').onclick = $('lobby-tour').onclick = () => launchTour();
  $('lobby-precision').onclick = () => launchChallenge('precision');
  panel.querySelectorAll('[data-challenge]').forEach((button) => {
    button.onclick = () => launchChallenge(button.dataset.challenge);
  });
  const next = document.getElementById('club-next');
  next.onclick = () => (activity === 'tour' ? launchTour() : launchChallenge(activity));
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(profile));
    } catch {
      hooks.toast('Результат доступен до закрытия страницы: браузер не разрешил сохранение.');
    }
    syncProfile();
  }
  function syncProfile() {
    $('cups').textContent = '♜ ' + profile.cups;
    $('stages').innerHTML = TOUR.map(
      (s, i) =>
        `<span class="${i < profile.stage ? 'completed' : i === profile.stage ? 'current' : ''}" title="${s.name}">${i < profile.stage ? '✓' : i + 1}</span>`,
    ).join('');
    $('stage-name').textContent =
      `${profile.stage + 1} / ${TOUR.length} · ${TOUR[profile.stage].name}`;
    $('stage-hint').textContent = TOUR[profile.stage].hint;
    $('tour').textContent = profile.stage ? 'Продолжить турнир ↗' : 'Начать турнир ↗';
    for (const id of Object.keys(CHALLENGES)) {
      const best = profileRecords(profile, hooks.config())[id];
      $('best-' + id).textContent =
        `${'★'.repeat(challengeStars(id, best))}${'☆'.repeat(3 - challengeStars(id, best))}\n${best ? best + ' очк.' : 'Твой рекорд?'}${profile.records[id] ? ' · прежний: ' + profile.records[id] : ''}`;
    }
  }
  function leave() {
    closeDrawer(false);
    activity = null;
    settled = false;
    if (original) {
      const restore = original;
      original = null;
      hooks.apply(restore);
    }
    hud.hidden = true;
    tourButton.classList.remove('active');
    coopButton.classList.remove('active');
  }
  function prepare(id, options) {
    closeDrawer(false);
    if (!original) original = { ...hooks.config() };
    activity = id;
    settled = false;
    newRecord = false;
    const settings = { ...DEFAULTS, ...original, ...options, ...testingOverrides };
    if (id === 'tour') {
      // Stage identity and progression always come from the new round.
      for (const key of ['arenaTheme', 'cpuSkill', 'cpuStyle']) settings[key] = options[key];
    }
    hooks.apply(settings);
    hooks.start(id === 'tour' ? (coop ? 'coop' : 'match') : 'challenge');
    match.clubLocked = true;
    hud.hidden = false;
    tourButton.classList.toggle('active', id === 'tour');
    document
      .querySelectorAll('.mode-tabs button:not(#club-tour-mode)')
      .forEach((button) => button.classList.remove('active'));
    coopButton.classList.toggle('active', id === 'tour' && coop);
  }
  function launchTour() {
    const stage = TOUR[profile.stage];
    prepare('tour', {
      cpuStyle: stage.style,
      cpuSkill: stage.skill,
      awayTeam: stage.team,
      arenaTheme: stage.arena,
      awayColor: TEAMS.find((t) => t.id === stage.team).color,
      targetScore: profile.stage === TOUR.length - 1 ? 11 : 7,
      duel: false,
      setsToWin: 1,
      scoring: 'rally',
    });
    match.label(stage.name + ' · ' + (profile.stage + 1) + ' / ' + TOUR.length, 3);
    match.cupStage = profile.stage;
    hooks.event?.({ type: 'stage-start', final: profile.stage === TOUR.length - 1 });
  }
  function launchChallenge(id) {
    prepare(id, { duel: true, approachAssist: false });
    startChallenge(match, id);
    hooks.focus();
  }
  function finish() {
    if (settled || !activity || match.phase !== 'finished') return;
    settled = true;
    tourWon = match.sets[0] > match.sets[1];
    if (activity === 'tour') {
      const wasFinal = profile.stage === TOUR.length - 1;
      profile = completeStage(profile, tourWon);
      if (tourWon) save();
      match.cupWon = tourWon && wasFinal;
    } else {
      const c = match.challenge;
      const records = profileRecords(profile, match.config, true);
      newRecord =
        !c.profileChanged &&
        c.profileKey === challengeProfileKey(match.config) &&
        c.score > records[c.id];
      if (newRecord) {
        records[c.id] = c.score;
        save();
      }
    }
  }
  function ui() {
    const recordKey = challengeProfileKey(hooks.config());
    if (recordKey !== displayedProfile) {
      displayedProfile = recordKey;
      syncProfile();
    }
    finish();
    const c = match.challenge;
    if (activity && c) {
      $('hud-kicker').textContent = CHALLENGES[c.id].name.toUpperCase();
      $('hud-title').textContent =
        c.ready > 0
          ? `Приготовься · ${Math.ceil(c.ready)}`
          : c.waiting || c.done
            ? c.message
            : `Мяч ${c.attempt} / ${c.total}`;
      $('hud-score').textContent = c.score + ' очк.';
      $('hud-detail').textContent =
        `Серия ${c.combo} · ×${Math.min(3, 1 + Math.floor(Math.max(0, c.combo - 1) / 3))}`;
      document.getElementById('action-title').textContent = CHALLENGES[c.id].name;
      document.getElementById('action-hint').textContent = CHALLENGES[c.id].hint;
      document.getElementById('action-key').textContent =
        c.id === 'rescue' ? 'Q / E' : c.id === 'serve' ? 'S' : 'D';
      document
        .getElementById('game')
        .setAttribute(
          'aria-label',
          `${CHALLENGES[c.id].name}. Мяч ${c.attempt} из 10. ${c.score} очков. ${CHALLENGES[c.id].hint}`,
        );
      document.getElementById('status').textContent =
        `${CHALLENGES[c.id].name} · ${c.hits} / ${c.attempt} · рекорд ${profileRecords(profile, match.config)[c.id]} · ${recordKey.startsWith('custom:') ? 'свои настройки' : 'стандарт'}`;
    } else if (activity === 'tour') {
      const stage =
        TOUR[settled && tourWon ? (profile.stage + TOUR.length - 1) % TOUR.length : profile.stage];
      $('hud-kicker').textContent =
        `${coop ? 'ВДВОЁМ · ' : ''}КУБОК МИРА · ДО ${match.config.targetScore} ОЧКОВ`;
      $('hud-title').textContent = stage.name;
      $('hud-score').textContent = match.score.join(' : ');
      $('hud-detail').textContent = `Сила соперника ${stage.skill} / 100`;
    }
    const last = match.lastContact,
      rally = match.lastRally;
    const atPoint = ['point', 'set-end', 'finished'].includes(match.phase);
    if (c) {
      $('feedback-title').textContent =
        c.waiting || c.done
          ? c.message
          : c.id === 'rescue'
            ? 'Встреть мяч в броске'
            : 'Золото — цель. Центр — бонус.';
      $('feedback-detail').textContent =
        c.waiting || c.done
          ? `${c.hits} попаданий · лучшая серия ${c.bestCombo} · три точных мяча подряд повышают множитель.`
          : CHALLENGES[c.id].hint;
    } else if (atPoint && rally) {
      $('feedback-title').textContent = rally.headline;
      $('feedback-detail').textContent =
        `${rally.contacts} касаний · ${rally.duration.toFixed(1)} с · ${rally.hint}`;
    } else if (last && match.time - last.time < 4) {
      $('feedback-title').textContent = `${last.team === 0 ? 'Ты' : 'Соперник'} · ${last.label}`;
      $('feedback-detail').textContent =
        `${Math.round(last.speed)} км/ч · угол ${last.angle}° · сила ${Math.round(last.power * 100)}%`;
    } else {
      $('feedback-title').textContent = 'Точность решает.';
      $('feedback-detail').textContent =
        'Z / L2 — мягко · C / R2 — мощно · удержание — сила · направление — стрелки / левый стик';
    }
    if (match.phase !== 'finished') return null;
    if (!activity) {
      const s = match.skillStats;
      return {
        stats:
          'Эйсы ' +
          s.aces[0] +
          ' · атаки навылет ' +
          s.winners[0] +
          ' · спасения ' +
          s.saves[0] +
          ' · самый длинный розыгрыш ' +
          s.longestRally +
          ' касаний',
      };
    }
    if (activity === 'tour')
      return {
        label: match.cupWon ? 'КУБОК ТВОЙ!' : tourWon ? 'ЭТАП ПРОЙДЕН!' : 'ЕЩЁ ОДНА ПОПЫТКА',
        score: match.score.join(' : '),
        detail: match.cupWon
          ? 'Семь арен позади. Кубок мира ваш!'
          : tourWon
            ? 'Дальше: ' + TOUR[profile.stage].name
            : TOUR[profile.stage].hint,
        nextLabel: tourWon
          ? match.cupWon
            ? 'За следующим кубком ↗'
            : 'Следующий соперник ↗'
          : 'Переиграть этап ↻',
        rematchLabel: 'Обычный матч →',
      };
    return {
      label: newRecord ? 'НОВЫЙ ЛИЧНЫЙ РЕКОРД!' : CHALLENGES[c.id].name.toUpperCase(),
      score: c.score + ' очк.',
      detail:
        '★'.repeat(c.stars) +
        '☆'.repeat(3 - c.stars) +
        ' · ' +
        c.hits +
        ' / 10 · в яблочко ' +
        c.bullseyes,
      stats: c.profileChanged
        ? 'Настройки менялись во время попытки. Рекорд не обновлен.'
        : 'Лучшая серия: ' +
          c.bestCombo +
          '. Рекорд: ' +
          profileRecords(profile, match.config)[c.id] +
          '. ' +
          (recordKey.startsWith('custom:') ? 'Свои настройки.' : 'Стандартный профиль.'),
      nextLabel: 'Побить рекорд ↻',
      rematchLabel: 'Обычный матч →',
    };
  }
  syncProfile();
  return {
    rememberChanges(next) {
      if (!original) return null;
      const current = hooks.config();
      for (const key of Object.keys(DEFAULTS))
        if (next[key] !== current[key]) {
          original[key] = next[key];
          testingOverrides[key] = next[key];
        }
      return original;
    },
    leave,
    ui,
    lobbyInput,
    moveChoice,
    startSelected: () => choices[lobbyChoice].click(),
    get drawerOpen() {
      return sidebar.classList.contains('club-open');
    },
    restart: () => (activity === 'tour' ? launchTour() : launchChallenge(activity)),
    get active() {
      return activity;
    },
  };
}
