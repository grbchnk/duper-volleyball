import { TutorialSession } from './tutorial-session.js';
import { coachFor, controlIcon } from './tutorial-visuals.js';

// Short, controller-first chapters; keyboard testing uses the unchanged input bindings.
export const LESSONS = [
  {
    id: 'move',
    title: 'Движение и прыжок',
    drill: 'footwork',
    goals: [
      { id: 'walk-left', label: 'Левая отметка', x: -8 },
      { id: 'walk-right', label: 'Правая отметка', x: -2 },
      { id: 'jump-left', label: 'Алмаз слева', x: -7.5, y: 3 },
      { id: 'jump-right', label: 'Алмаз справа', x: -2.5, y: 3 },
    ],
  },
  {
    id: 'receive',
    title: 'Три приёма',
    drill: 'receive',
    goals: [
      { id: 'basic-low', label: 'Нижний пас', kind: 'low' },
      { id: 'basic-loft', label: 'Верхний пас', kind: 'loft' },
      { id: 'basic-drive', label: 'Удар', kind: 'drive' },
    ],
  },
  {
    id: 'streak',
    title: 'Пять мячей подряд',
    drill: 'receive',
    goals: Array.from({ length: 5 }, (_, i) => ({
      id: 'catch-' + i,
      label: 'Приём ' + (i + 1),
      any: true,
    })),
  },
  {
    id: 'block',
    title: 'Блок и защита',
    drill: 'block',
    goals: [
      { id: 'block', label: 'Блок у сетки' },
      { id: 'defend', label: 'Нижний приём в защите', kind: 'low' },
    ],
  },
  {
    id: 'power',
    title: 'Сила и направление',
    drill: 'set',
    goals: [
      { id: 'gem-0', label: 'Близкая цель', x: -5, y: 3.4 },
      { id: 'gem-1', label: 'Высокая цель', x: -3.5, y: 4.6 },
      { id: 'gem-2', label: 'Дальняя цель', x: -7, y: 5.4 },
    ],
  },
  {
    id: 'soft-set',
    title: 'Слабая передача верхом',
    drill: 'set',
    demo: 'pass',
    goals: [
      {
        id: 'soft-set',
        label: 'Мягкий верхний пас · до 60%',
        kind: 'loft',
        soft: true,
        maxPower: 0.6,
      },
    ],
  },
  {
    id: 'rally',
    title: 'Пять передач друг другу',
    drill: 'set',
    demo: 'rally',
    goals: [
      {
        id: 'pass-0',
        label: 'Передача 1',
        kind: 'loft',
        exchange: true,
      },
      {
        id: 'pass-1',
        label: 'Передача 2',
        kind: 'loft',
        exchange: true,
      },
      {
        id: 'pass-2',
        label: 'Передача 3',
        kind: 'loft',
        exchange: true,
      },
      {
        id: 'pass-3',
        label: 'Передача 4',
        kind: 'loft',
        exchange: true,
      },
      {
        id: 'pass-4',
        label: 'Передача 5',
        kind: 'loft',
        exchange: true,
      },
    ],
  },
  {
    id: 'attack',
    title: 'Навес и сильный удар',
    drill: 'combination',
    demo: 'attack',
    goals: [
      {
        id: 'set',
        label: 'Навес партнёру',
        kind: 'loft',
      },
      {
        id: 'spike',
        label: 'Сильный удар в прыжке · от 65%',
        kind: 'drive',
        minPower: 0.65,
        airborne: true,
        across: true,
      },
    ],
  },
  {
    id: 'modifiers',
    title: 'Скидка и быстрый удар',
    drill: 'spike',
    demo: 'attack',
    goals: [
      {
        id: 'tip',
        label: 'Мягкая скидка через сетку',
        kind: 'drive',
        soft: true,
        across: true,
      },
      {
        id: 'fast',
        label: 'Быстрый удар через сетку',
        kind: 'drive',
        fast: true,
        across: true,
      },
    ],
  },
  {
    id: 'serve',
    title: 'Четыре вида подачи',
    drill: 'serve',
    demo: 'serve',
    goals: [
      {
        id: 'serve-low',
        label: 'Нижняя подача',
        kind: 'low',
        serve: true,
      },
      {
        id: 'serve-loft',
        label: 'Верхняя подача',
        kind: 'loft',
        serve: true,
      },
      {
        id: 'serve-drive',
        label: 'Силовая подача',
        kind: 'drive',
        serve: true,
      },
      {
        id: 'serve-back',
        label: 'Мягкая нижняя подача',
        kind: 'back',
        serve: true,
      },
    ],
  },
  {
    id: 'one-hand',
    title: 'Приём одной рукой',
    drill: 'receive',
    demo: 'one-hand',
    goals: [
      {
        id: 'one-hand',
        label: 'Поднять мяч одной рукой',
        kind: 'low',
        soft: true,
      },
    ],
  },
  {
    id: 'dive',
    title: 'Спасение в броске',
    drill: 'dive-forward',
    demo: 'dive',
    goals: [
      {
        id: 'dive-right',
        label: 'Спасти мяч справа',
        save: true,
      },
      {
        id: 'dive-left',
        label: 'Спасти мяч слева',
        save: true,
      },
    ],
  },
  {
    id: 'switch',
    title: 'Выбор игрока и низкая стойка',
    drill: 'footwork',
    demo: 'move',
    goals: [
      {
        id: 'switch',
        label: 'Сменить выбранного игрока',
      },
      {
        id: 'crouch',
        label: 'Принять низкую стойку',
      },
    ],
  },
];

export class Tutorial extends TutorialSession {
  constructor(match) {
    super(match, LESSONS);
  }
}

export function createTutorial(match, hooks) {
  const session = new Tutorial(match),
    arena = document.querySelector('#arena');
  const panel = document.createElement('section');
  panel.id = 'tutorial-panel';
  panel.className = 'tutorial-overlay';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Обучение с геймпадом');
  panel.innerHTML = `<header class="tutorial-topbar"><strong id="tutorial-title"></strong><progress id="tutorial-progress" max="${LESSONS.length}"></progress><button id="tutorial-menu-toggle"><span class="pad-option">Options</span></button></header>
    <article class="training-cues"><div id="tutorial-pad"></div><div class="serve-rhythm" aria-label="Заряди, подбрось, нажми снова"><span><i class="rhythm-charge"></i>Зажми</span><span><i class="rhythm-ball"></i>Отпусти</span><span><i class="rhythm-tap"></i>Нажми</span></div><p id="tutorial-hint"></p><ol id="tutorial-goals" aria-label="Задачи этапа"></ol>
    <div class="tutorial-power"><span>Сила</span><meter id="tutorial-power" min="0" max="1"></meter><output id="tutorial-power-value"></output></div>
    <button id="tutorial-next" hidden>Играть матч</button></article>
    <div id="tutorial-menu" class="tutorial-menu" hidden><div class="tutorial-menu-card"><h2>Выбрать упражнение</h2><p>Стик — выбор · крестик — открыть · круг — вернуться</p>
    <div id="tutorial-menu-items"><button id="tutorial-resume">Вернуться на площадку</button><button id="tutorial-repeat">Начать упражнение заново</button><div id="tutorial-chapters"></div><button id="tutorial-exit">Закончить обучение · играть матч</button></div></div></div>`;
  arena.append(panel);
  const find = (id) => panel.querySelector('#tutorial-' + id);
  LESSONS.forEach((lesson, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.lesson = index;
    button.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span>${lesson.title}`;
    button.onclick = () => {
      session.index = index;
      session.enter();
      closeMenu();
      sync();
    };
    find('chapters').append(button);
  });
  let stamp,
    lastIndex = -1,
    menuIndex = 0,
    menuDirection = 0,
    menuRepeat = 0,
    previousCircle = false;
  const menuButtons = () => [...find('menu-items').querySelectorAll('button')];
  function focusGame() {
    hooks.resetInput?.();
    hooks.focus();
  }
  function fit() {
    if (!session.active) return;
    const canvas = document.querySelector('#game'),
      rect = arena.getBoundingClientRect();
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    const width = canvas.width * scale,
      height = canvas.height * scale;
    Object.assign(panel.style, {
      width: width + 'px',
      height: height + 'px',
      left: (rect.width - width) / 2 + 'px',
      top: (rect.height - height) / 2 + 'px',
    });
  }
  new ResizeObserver(fit).observe(arena);
  function closeMenu() {
    session.menuOpen = false;
    session.match.clearControls();
    focusGame();
  }
  function toggleMenu() {
    if (!session.active) return;
    session.menuOpen = !session.menuOpen;
    menuIndex = 0;
    menuDirection = 0;
    menuRepeat = 0;
    previousCircle = false;
    if (!session.menuOpen) focusGame();
    sync();
  }
  function sync() {
    panel.hidden = !session.active;
    document.body.classList.toggle('learning-mode', session.active);
    arena.classList.toggle('is-learning', session.active);
    if (!session.active) {
      stamp = null;
      lastIndex = -1;
      return;
    }
    if (lastIndex !== session.index) {
      lastIndex = session.index;
      fit();
    }
    const lesson = session.lesson,
      current = session.objective || lesson.goals.at(-1);
    const coach = coachFor(lesson, current);
    panel.dataset.phase = session.phase;
    panel.dataset.motion = coach.motion;
    panel.dataset.lesson = lesson.id;
    panel.dataset.menu = String(!!session.menuOpen);
    panel.classList.toggle('streak-reset', match.time - (session.resetAt ?? -10) < 0.45);
    find('title').textContent = lesson.id === 'move' ? '' : lesson.title;
    find('progress').value = session.index + Number(session.ready);
    const controls =
      lesson.id === 'move'
        ? ['stick', 'cross']
        : lesson.id === 'block'
          ? ['r1', 'square']
          : lesson.id === 'receive' || lesson.id === 'streak'
            ? ['square', 'triangle', 'circle']
            : coach.controls;
    const labels = {
      stick:
        lesson.id === 'power'
          ? 'Направление'
          : lesson.id === 'dive'
            ? 'Три отклонения'
            : current.id === 'crouch'
              ? 'Вниз'
              : 'Ходить',
      cross: 'Прыжок',
      square: lesson.id === 'block' ? 'Задний игрок' : 'Нижний пас',
      triangle: 'Верхний пас',
      circle: 'Удар',
      l1: 'Смена игрока',
      r1: 'Блок',
      l2: 'Мягко',
      r2: 'Быстро',
    };
    const nextStamp = session.index + ':' + controls.join();
    if (stamp !== nextStamp) {
      stamp = nextStamp;
      find('pad').innerHTML = controls
        .map(
          (id) =>
            `<div class="training-control" data-kind="${id}">${controlIcon(id)}<span>${labels[id]}</span>${['receive', 'block'].includes(lesson.id) ? '<i class="control-check"></i>' : ''}</div>`,
        )
        .join('');
      find('goals').innerHTML = lesson.goals
        .map((g) => `<li aria-label="${g.label}"><span></span></li>`)
        .join('');
    }
    find('hint').textContent = ['move', 'receive'].includes(lesson.id) ? '' : coach.hint;
    [...find('goals').children].forEach((el, i) => {
      const done = session.done.has(i);
      el.classList.toggle('done', done);
      el.firstElementChild.textContent = done ? '✓' : '';
      el.setAttribute('aria-label', lesson.goals[i].label + (done ? ' — выполнено' : ''));
    });
    if (['receive', 'block'].includes(lesson.id))
      [...find('pad').children].forEach((el, i) => {
        el.classList.toggle('done', session.done.has(i));
        el.querySelector('.control-check').textContent = session.done.has(i) ? '✓' : '';
      });
    const input = session.input || {},
      vector = input.buttonVector || { x: input.axis || 0, y: input.crouch ? -1 : 0 };
    const held = {
      stick: Math.hypot(vector.x || 0, vector.y || 0) > 0.15,
      cross: input.jump,
      square: input.low || input.back,
      triangle: input.loft,
      circle: input.drive,
      l1: input.switch,
      r1: input.block,
      l2: input.l2,
      r2: input.r2,
    };
    for (const el of find('pad').querySelectorAll('[data-control]'))
      el.classList.toggle('is-pressed', !!held[el.dataset.control]);
    const power = match.controls[0].charge?.power || match.controls[0].pending?.power || 0;
    find('power').value = power;
    find('power-value').textContent = Math.round(power * 100) + '%';
    find('next').hidden = !(session.ready && session.index === LESSONS.length - 1);
    find('menu').hidden = !session.menuOpen;
    if (session.menuOpen) {
      menuButtons().forEach((button, i) => {
        button.classList.toggle('is-focused', i === menuIndex);
        if (i === menuIndex) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
    }
  }
  find('menu-toggle').onclick = toggleMenu;
  find('resume').onclick = () => {
    closeMenu();
    sync();
  };
  find('repeat').onclick = () => {
    session.enter();
    closeMenu();
    sync();
  };
  find('exit').onclick = () => {
    session.leave();
    sync();
    hooks.finish();
  };
  find('next').onclick = () => {
    if (!session.next()) return;
    sync();
    if (!session.active) hooks.finish();
    focusGame();
  };
  document.querySelector('#tutorial-start').onclick = () => {
    hooks.start();
    session.start();
    sync();
    fit();
    focusGame();
  };
  return {
    get active() {
      return session.active;
    },
    get menuOpen() {
      return session.active && !!session.menuOpen;
    },
    get ready() {
      return session.active && session.ready;
    },
    get frozen() {
      return session.frozen;
    },
    get canConfirm() {
      return (
        session.active &&
        (session.menuOpen || (session.ready && session.index === LESSONS.length - 1))
      );
    },
    toggleMenu,
    handleNavigation(input, dt) {
      if (!session.active || !session.menuOpen) {
        previousCircle = !!input.drive;
        return false;
      }
      if (input.drive && !previousCircle) {
        previousCircle = true;
        closeMenu();
        sync();
        return true;
      }
      previousCircle = !!input.drive;
      const y = input.buttonVector?.y || (input.crouch ? -1 : 0),
        direction = Math.abs(y) > 0.5 ? -Math.sign(y) : 0;
      menuRepeat -= dt;
      if (direction && (direction !== menuDirection || menuRepeat <= 0)) {
        const buttons = menuButtons();
        menuIndex = (menuIndex + direction + buttons.length) % buttons.length;
        menuRepeat = direction === menuDirection ? 0.18 : 0.35;
        sync();
        buttons[menuIndex].scrollIntoView({ block: 'nearest' });
      }
      menuDirection = direction;
      return false;
    },
    confirm() {
      if (session.menuOpen) menuButtons()[menuIndex].click();
      else if (session.ready) find('next').click();
    },
    retry() {
      if (!session.active) return;
      session.begin(true);
      sync();
    },
    leave() {
      session.leave();
      sync();
    },
    observe(input) {
      session.observe(input);
    },
    update: sync,
    advance(dt) {
      session.advance(dt);
    },
    draw(renderer) {
      session.draw(renderer);
    },
  };
}
