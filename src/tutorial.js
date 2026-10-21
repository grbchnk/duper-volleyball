import { traceBall, launchTo } from './physics.js';
import { coachFor, controllerGraphic, resultGraphic } from './tutorial-visuals.js';

// Short, controller-first chapters; keyboard testing uses the unchanged input bindings.
export const LESSONS = [
  {
    id: 'move',
    title: 'Движение и прыжок',
    drill: 'footwork',
    demo: 'move',
    goals: [
      {
        id: 'walk',
        label: 'Пройти 1 метр',
      },
      {
        id: 'jump',
        label: 'Прыгнуть',
      },
    ],
  },
  {
    id: 'receive',
    title: 'Приём: слабый пас и высокий навес',
    drill: 'receive',
    demo: 'pass',
    goals: [
      {
        id: 'weak',
        label: 'Слабый нижний пас · до 60%',
        kind: 'low',
        soft: true,
        maxPower: 0.6,
      },
      {
        id: 'high',
        label: 'Сильный верхний навес · от 65%',
        kind: 'loft',
        minPower: 0.65,
        high: true,
      },
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
    id: 'block',
    title: 'Блок у сетки',
    drill: 'block',
    demo: 'block',
    goals: [
      {
        id: 'block',
        label: 'Заблокировать учебный мяч',
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

export class Tutorial {
  constructor(match) {
    this.match = match;
    this.index = -1;
  }
  get active() {
    return this.index >= 0;
  }
  get lesson() {
    return LESSONS[this.index];
  }
  get objective() {
    return this.lesson?.goals[this.completed];
  }
  get frozen() {
    return this.active && (this.menuOpen || this.phase !== 'practice');
  }
  start() {
    this.index = 0;
    this.enter();
  }
  leave() {
    if (this.savedBenched)
      this.match.players.forEach((p, i) => {
        p.benched = this.savedBenched[i];
      });
    this.savedBenched = null;
    this.index = -1;
    this.menuOpen = false;
    this.match.tutorialNoBall = false;
  }
  enter() {
    this.completed = 0;
    this.ready = false;
    this.phase = 'explain';
    this.phaseAge = 0;
    this.menuOpen = false;
    this.previousPasser = null;
    this.savedBenched ??= this.match.players.map((p) => p.benched);
    this.setup();
    this.feedback = this.objective.label;
  }
  setup() {
    const m = this.match,
      g = this.objective;
    let drill = this.lesson.drill;
    if (this.lesson.id === 'receive') drill = g.kind === 'loft' ? 'set' : 'receive';
    if (this.lesson.id === 'attack' && this.completed) drill = 'spike';
    if (g.id === 'dive-left') drill = 'dive-back';
    m.startDrill(drill);
    m.clearControls();
    m.tutorialNoBall = drill === 'footwork';
    m.players.forEach((p) => {
      p.benched = p.team === 1;
    });
    if (this.lesson.id === 'rally') {
      m.players[0].benched = true;
      m.players[1].x = -6;
      m.players[2].x = -3;
      m.selected[0] = 1;
    }
    if (drill === 'spike') m.selected[0] = 2;
    this.startPlayer = m.selected[0];
    // Keep the demonstrated receiver selected until the first real contact.
    m.controls[0].manualSerial = m.shotSerial;
    this.startX = m.players[this.startPlayer].x;
    this.startedAt = m.time;
    this.seenContact = m.lastContact;
    this.blocks = m.stats.blocks[0];
    if (drill === 'block') {
      Object.assign(m.ball, { x: 7, y: 3.6 });
      launchTo(m.ball, { x: -5, y: 0.2, z: 4.5 }, 1.3 / m.config.ballSpeed, m.config);
    }
    this.pending = null;
    this.retryAfter = null;
    if (g.kind && !g.serve && !g.across) {
      if (g.exchange && this.previousPasser != null) {
        m.selected[0] = this.previousPasser === 1 ? 2 : 1;
        this.startPlayer = m.selected[0];
      }
      const p = m.players[this.startPlayer];
      const upper = g.kind === 'loft';
      Object.assign(m.ball, {
        x: p.x + (upper ? 0 : 0.65),
        y: upper ? 5.4 : 3.6,
        vx: 0,
        vy: 0,
        vz: 0,
      });
      // This is an illustration; the live ball still obeys configured physics.
      this.origin = { x: m.ball.x, y: upper ? 2 : 1 };
      const partner = m.players
        .filter((q) => q.team === 0 && !q.benched && q.id !== p.id)
        .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
      this.target = { x: partner.x, y: upper ? 3 : 2 };
    } else if (g.across || g.serve) {
      this.origin = { x: m.ball.x, y: g.serve ? 1.5 : 3.6 };
      this.target = { x: 4, y: 0.5 };
    } else {
      this.origin = this.target = null;
    }
  }
  begin(retry = false) {
    if (!this.active || this.ready) return;
    if (this.lesson.id === 'rally') {
      this.previousPasser = null;
      this.completed = 0;
    }
    this.setup();
    this.phase = 'countdown';
    this.countdown = retry ? 1.2 : this.lesson.drill === 'footwork' ? 0 : 3;
    this.phaseAge = 0;
    if (!this.countdown) this.phase = 'practice';
    this.input = {};
  }
  advance(dt) {
    if (!this.active || this.menuOpen) return;
    this.phaseAge = (this.phaseAge || 0) + dt;
    if (this.phase === 'explain') {
      const duration = this.lesson.id === 'move' ? 3 : this.lesson.id === 'serve' ? 5.5 : 4.2;
      if (this.phaseAge >= duration) this.begin();
    } else if (this.phase === 'success') {
      if (this.index < LESSONS.length - 1 && this.phaseAge >= 1.4) this.next();
    } else if (this.phase === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      if (!this.countdown) {
        this.phase = 'practice';
        this.phaseAge = 0;
        this.match.clearControls();
      }
    }
  }
  complete() {
    this.completed++;
    if (this.completed === this.lesson.goals.length) {
      this.ready = true;
      this.phase = 'success';
      this.phaseAge = 0;
      this.feedback = 'Этап пройден!';
    } else {
      this.feedback = 'Получилось! Следующая задача: ' + this.objective.label;
      // Upper-pass exchanges and set→attack continue with the actual live ball.
      if (['rally', 'attack'].includes(this.lesson.id)) {
        this.origin = { x: this.match.ball.x, y: this.match.ball.y };
        const receiver = this.match.players[this.match.selected[0]];
        this.target = this.lesson.id === 'attack' ? { x: 4, y: 0.5 } : { x: receiver.x, y: 2.2 };
        this.phaseAge = 0;
        return;
      }
      if (['move', 'switch'].includes(this.lesson.id)) return;
      this.setup();
      this.phase = 'explain';
      this.phaseAge = 0;
    }
  }
  observe(input) {
    if (!this.active) return;
    this.input = input;
    if (this.frozen) return;
    const m = this.match,
      g = this.objective;
    if (g.id === 'walk' && Math.abs(m.players[this.startPlayer].x - this.startX) >= 1)
      this.complete();
    else if (g.id === 'jump' && m.players[m.selected[0]].y > 0.35) this.complete();
    else if (g.id === 'switch' && m.selected[0] !== this.startPlayer) this.complete();
    else if (g.id === 'crouch' && m.players[m.selected[0]].crouchAmount > 0.75) this.complete();
    else if (g.id === 'block' && m.stats.blocks[0] > this.blocks) this.complete();
    if (this.ready) return;
    const contact = m.lastContact;
    if (contact && contact !== this.seenContact && contact.time >= this.startedAt) {
      this.seenContact = contact;
      if (contact.team === 0) this.checkContact(contact);
    }
    if (this.ready) return;
    if (this.pending) {
      if (m.ball.x > 0.3 && m.ball.y > 0.2 && m.lastTouch === 0) {
        this.pending = null;
        this.complete();
      }
    }
    if (this.ready) return;
    if (
      m.phase === 'point' ||
      m.time - this.startedAt > 12 ||
      (this.retryAfter && m.time >= this.retryAfter)
    ) {
      const feedback = this.feedback;
      this.begin(true);
      this.feedback =
        this.lesson.id === 'rally'
          ? 'Серия прервана · 0 / 5. Начни пять передач заново.'
          : 'Ещё попытка. ' + feedback;
    }
  }
  checkContact(c) {
    const g = this.objective,
      m = this.match;
    if (!g.kind && !g.save) return;
    let error =
      c.serve !== !!g.serve
        ? 'Сейчас нужна другая техника.'
        : g.kind && c.kind !== g.kind
          ? 'Используй кнопку текущего задания.'
          : g.soft && c.modifier !== 'soft'
            ? 'Удерживай L2 при контакте.'
            : g.fast && c.modifier !== 'fast'
              ? 'Удерживай R2 при контакте.'
              : g.maxPower && c.power > g.maxPower
                ? 'Слишком сильно: нажми короче.'
                : g.minPower && c.power < g.minPower
                  ? 'Нужно сильнее: начни заряжать раньше.'
                  : g.airborne && !c.airborne
                    ? 'Для атаки нужно прыгнуть.'
                    : g.save && !c.save
                      ? 'Нужно коснуться мяча в броске.'
                      : g.exchange && c.playerId === this.previousPasser
                        ? 'Передачу должен выполнить другой игрок.'
                        : '';
    if (!error && g.high && Math.max(...traceBall(m.ball, m.config, 4).map((p) => p.y)) < 4.5)
      error = 'Навес низкий. Отклони левый стик вверх.';
    if (!error && !g.serve && !g.across && !g.save && c.vy <= 0)
      error = 'Подними мяч вверх к партнёру.';
    if (error) {
      if (this.lesson.id === 'rally') {
        this.begin(true);
        this.feedback = 'Серия прервана · 0 / 5. ' + error;
        return;
      }
      this.feedback = error;
      this.retryAfter = m.time + 1.5;
      return;
    }
    this.retryAfter = null;
    if (g.across || g.serve) {
      this.pending = true;
      this.feedback = 'Есть касание. Мяч должен перелететь сетку.';
    } else {
      if (g.exchange) {
        // The passing exercise permits more than three team touches; all physical
        // contacts and the same-player restriction still use normal game rules.
        m.touches[0] = 0;
        this.startedAt = m.time;
        // Count a delivered pass only when its recipient makes the next contact.
        if (this.previousPasser == null) {
          this.previousPasser = c.playerId;
          this.feedback = 'Теперь прими пас другим игроком.';
          return;
        }
        this.previousPasser = c.playerId;
      }
      this.complete();
    }
  }
  next() {
    if (!this.ready) return false;
    if (this.index === LESSONS.length - 1) {
      this.leave();
      return true;
    }
    this.index++;
    this.enter();
    return true;
  }
  draw(renderer) {
    if (
      this.active &&
      this.objective?.id === 'walk' &&
      this.phase === 'practice' &&
      !this.menuOpen
    ) {
      const c = renderer.ctx;
      c.save();
      c.strokeStyle = '#3c9c7d';
      c.lineWidth = 2;
      c.setLineDash([4, 4]);
      for (const direction of [-1, 1]) {
        const p = renderer.project(this.startX + direction * 1.2, 0);
        c.beginPath();
        c.ellipse(p.x, p.y, 16, 6, 0, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
    }
    if (
      !this.active ||
      !this.origin ||
      this.menuOpen ||
      (this.phase === 'practice' && this.phaseAge > 3)
    )
      return;
    const c = renderer.ctx,
      a = renderer.project(this.origin.x, this.origin.y),
      b = renderer.project(this.target.x, this.target.y);
    c.save();
    c.strokeStyle = '#237b69';
    c.fillStyle = '#237b6925';
    c.lineWidth = 2;
    c.fillRect(b.x - 22, b.y - 25, 44, 50);
    c.strokeRect(b.x - 22, b.y - 25, 44, 50);
    c.setLineDash([6, 6]);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 65, b.x, b.y);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#155b4b';
    c.font = 'bold 12px sans-serif';
    c.textAlign = 'center';
    c.fillText('ЦЕЛЬ', b.x, b.y - 34);
    c.restore();
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
  panel.innerHTML = `<header class="tutorial-topbar"><div><small>ШКОЛА ВОЛЕЙБОЛА</small><strong id="tutorial-title"></strong></div>
    <progress id="tutorial-progress" max="${LESSONS.length}" value="0" aria-label="Прогресс курса"></progress>
    <button id="tutorial-menu-toggle" aria-label="Меню обучения"><span class="pad-option">Options</span> Меню</button></header>
    <article class="tutorial-coach"><div class="tutorial-coach-heading"><span id="tutorial-stage"></span><span id="tutorial-step-count"></span></div>
    <h2 id="tutorial-objective"></h2><div class="tutorial-demonstration"><div id="tutorial-pad"></div><div id="tutorial-demo"></div></div>
    <p id="tutorial-hint"></p><ol id="tutorial-goals" class="tutorial-goals" aria-label="Задачи этапа"></ol>
    <div class="tutorial-power"><span>Сила</span><div class="tutorial-power-track"><span class="tutorial-power-target"></span><meter id="tutorial-power" min="0" max="1" value="0"></meter></div><output id="tutorial-power-value">0%</output></div>
    <p id="tutorial-result" role="status" aria-live="polite"></p>
    <footer class="tutorial-coach-actions"><button id="tutorial-begin"><span class="pad-key pad-cross">✕</span> Пропустить показ</button>
    <button id="tutorial-next" hidden><span class="pad-key pad-cross">✕</span> Дальше</button><span id="tutorial-auto"></span></footer></article>
    <div id="tutorial-countdown" class="tutorial-countdown" hidden><strong></strong><span>Приготовься</span></div>
    <div id="tutorial-menu" class="tutorial-menu" hidden><div class="tutorial-menu-card"><h2>Твой темп, твой урок</h2><p>Левый стик — выбор · ✕ — открыть · ○ — вернуться</p>
    <div id="tutorial-menu-items"><button id="tutorial-resume">Вернуться на площадку</button><button id="tutorial-repeat">Показать этот приём снова</button>
    <div id="tutorial-chapters"></div><button id="tutorial-exit">Закончить обучение · играть матч</button></div></div></div>`;
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
      current = session.objective || lesson.goals.at(-1),
      coach = coachFor(lesson, current);
    if (lesson.id === 'attack' && current.id === 'set' && session.phase !== 'practice') {
      coach.controls = ['triangle', 'cross', 'circle'];
      coach.sequence = true;
    }
    panel.dataset.phase = session.phase;
    panel.dataset.motion = coach.motion;
    panel.dataset.menu = String(!!session.menuOpen);
    find('title').textContent = `${session.index + 1} / ${LESSONS.length} · ${lesson.title}`;
    find('progress').value = session.index + Number(session.ready);
    find('stage').textContent = {
      explain: 'Смотри и пробуй',
      countdown: 'Приготовься',
      practice: 'Твоя очередь',
      success: 'Получилось!',
    }[session.phase];
    find('step-count').textContent =
      lesson.id === 'rally'
        ? `${session.completed} / 5 подряд`
        : `${Math.min(session.completed + 1, lesson.goals.length)} / ${lesson.goals.length}`;
    find('objective').textContent = session.ready
      ? session.index === LESSONS.length - 1
        ? 'Ты готов к матчу!'
        : 'Отлично, идём дальше!'
      : coach.title;
    find('hint').textContent = session.ready
      ? session.index === LESSONS.length - 1
        ? 'Все приёмы освоены. Время выйти на площадку.'
        : 'Следующий приём откроется сам.'
      : coach.hint;
    const nextStamp = `${session.index}:${session.completed}:${!!coach.sequence}`;
    if (stamp !== nextStamp) {
      stamp = nextStamp;
      find('pad').innerHTML = controllerGraphic(coach);
      find('demo').innerHTML = resultGraphic(coach);
      find('goals').innerHTML = lesson.goals
        .map(
          (g, i) =>
            `<li class="${i < session.completed ? 'done' : i === session.completed ? 'current' : ''}" aria-label="${g.label}${i < session.completed ? ' — выполнено' : ''}"><span>${i < session.completed ? '✓' : i + 1}</span></li>`,
        )
        .join('');
    }
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
      l2: input.l2 || input.intent === 'soft',
      r2: input.r2 || input.intent === 'fast',
    };
    for (const element of find('pad').querySelectorAll('[data-control]'))
      element.classList.toggle(
        'is-pressed',
        session.phase === 'practice' && !!held[element.dataset.control],
      );
    find('pad').style.setProperty('--stick-x', `${(vector.x || 0) * 13}px`);
    find('pad').style.setProperty('--stick-y', `${-(vector.y || 0) * 13}px`);
    const power = match.controls[0].charge?.power || match.controls[0].pending?.power || 0;
    find('power').value = power;
    find('power-value').textContent = `${Math.round(power * 100)}%`;
    panel.style.setProperty('--power-min', `${(current.minPower || 0) * 100}%`);
    panel.style.setProperty('--power-max', `${(current.maxPower || 1) * 100}%`);
    const message =
      session.phase === 'countdown'
        ? 'Смотри на мяч и приготовь нужную кнопку.'
        : session.ready
          ? '✓ Все задачи выполнены.'
          : session.phase === 'explain'
            ? 'Сейчас покажем — затем твоя очередь.'
            : session.feedback === current.label
              ? ''
              : session.feedback;
    if (find('result').textContent !== message) find('result').textContent = message;
    find('begin').hidden = session.phase !== 'explain';
    find('next').hidden = !session.ready;
    find('next').innerHTML =
      `<span class="pad-key pad-cross">✕</span> ${session.index === LESSONS.length - 1 ? 'Играть матч' : 'Дальше'}`;
    find('auto').textContent =
      session.phase === 'explain'
        ? 'Начнётся автоматически'
        : session.ready && session.index < LESSONS.length - 1
          ? 'Переходим дальше…'
          : '';
    find('countdown').hidden = session.phase !== 'countdown' || session.menuOpen;
    find('countdown').querySelector('strong').textContent = Math.ceil(session.countdown) || '→';
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
  find('begin').onclick = () => {
    session.begin();
    sync();
    focusGame();
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
      return session.active && (session.menuOpen || session.ready || session.phase === 'explain');
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
      else if (session.phase === 'explain') find('begin').click();
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
