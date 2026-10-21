import { traceBall, launchTo } from './physics.js';

const goal = (id, label, keys, extra = {}) => ({ id, label, keys, ...extra });
// Each stage has an explanation/demo, a countdown, and verified practice goals.
export const LESSONS = [
  {
    id: 'move',
    title: 'Движение и прыжок',
    drill: 'footwork',
    demo: 'move',
    hint: 'Здесь пока нет мяча. ← / → или левый стик двигают игрока. Space / ✕ (Xbox A) — прыжок. Высота прыжка не зависит от длительности удержания. Сначала походи, затем попрыгай.',
    goals: [
      goal('walk', 'Пройти 1 метр', ['← →', 'Левый стик']),
      goal('jump', 'Прыгнуть', ['Space / ↑', '✕ / A']),
    ],
  },
  {
    id: 'receive',
    title: 'Приём: слабый пас и высокий навес',
    drill: 'receive',
    demo: 'pass',
    hint: 'S / □ (X) готовит нижний приём, W / △ (Y) — верхнюю передачу над головой. Удержание накапливает силу. Отпускание задаёт момент контакта; подготовленные руки тоже могут коснуться мяча. Сначала сделай мягкий нижний пас с Z / L2, затем высокий верхний навес с большим зарядом W. Перед каждой попыткой будет отсчёт.',
    goals: [
      goal('weak', 'Слабый нижний пас · до 60%', ['Z + S', 'L2 + □ / LT + X'], {
        kind: 'low',
        soft: true,
        maxPower: 0.6,
      }),
      goal('high', 'Сильный верхний навес · от 65%', ['Зажать W', 'Зажать △ / Y'], {
        kind: 'loft',
        minPower: 0.65,
        high: true,
      }),
    ],
  },
  {
    id: 'soft-set',
    title: 'Слабая передача верхом',
    drill: 'set',
    demo: 'pass',
    hint: 'Z / L2 выбирает мягкий профиль приёма. Удерживай модификатор и коротко нажми W / △ у мяча над головой. Короткое удержание даёт небольшой заряд. Направление задают стрелки или стик; Shift + ↑ позволяет целиться вверх без прыжка.',
    goals: [
      goal('soft-set', 'Мягкий верхний пас · до 60%', ['Z + W', 'L2 + △ / LT + Y'], {
        kind: 'loft',
        soft: true,
        maxPower: 0.6,
      }),
    ],
  },
  {
    id: 'rally',
    title: 'Пять передач друг другу',
    drill: 'set',
    demo: 'rally',
    hint: 'Сделай пять верхних передач подряд между партнёрами. После касания управление переходит принимающему; Tab / L1 или 1 / 2 / 3 помогут выбрать его вручную. Направляй W / △ к партнёру. Вверх без прыжка: Shift + ↑; на геймпаде — стик. Каждый кружок — передача, принятая другим игроком. Падение мяча или неверный приём обнуляет всю серию.',
    goals: Array.from({ length: 5 }, (_, i) =>
      goal('pass-' + i, 'Передача ' + (i + 1), ['W + направление', '△ / Y + стик'], {
        kind: 'loft',
        exchange: true,
      }),
    ),
  },
  {
    id: 'attack',
    title: 'Навес и сильный удар',
    drill: 'combination',
    demo: 'attack',
    hint: 'Сначала W / △ подними мяч партнёру у сетки. Затем выбранным принимающим прыгни Space / ✕, зажми D / ○ и отпусти у мяча над сеткой. Цель — отправить мяч на другую сторону. Противников в этом упражнении нет.',
    goals: [
      goal('set', 'Навес партнёру', ['W', '△ / Y'], { kind: 'loft' }),
      goal('spike', 'Сильный удар в прыжке · от 65%', ['Space → D', '✕ → ○ / A → B'], {
        kind: 'drive',
        minPower: 0.65,
        airborne: true,
        across: true,
      }),
    ],
  },
  {
    id: 'modifiers',
    title: 'Скидка и быстрый удар',
    drill: 'spike',
    demo: 'attack',
    hint: 'Z / L2 — мягкий профиль: короткая скидка у сетки. C / R2 — быстрый профиль. Модификатор должен оставаться нажатым при контакте. Для скидки коснись мяча выше сетки; она не перелетает сетку автоматически из любой позиции.',
    goals: [
      goal('tip', 'Мягкая скидка через сетку', ['Space → Z + D', '✕ → L2 + ○'], {
        kind: 'drive',
        soft: true,
        across: true,
      }),
      goal('fast', 'Быстрый удар через сетку', ['Space → C + D', '✕ → R2 + ○'], {
        kind: 'drive',
        fast: true,
        across: true,
      }),
    ],
  },
  {
    id: 'serve',
    title: 'Четыре вида подачи',
    drill: 'serve',
    demo: 'serve',
    hint: 'Подача выполняется в два нажатия: зажми кнопку, отпусти для подброса, затем нажми ещё раз, когда круг сойдётся к мячу и станет зелёным. S / □ — нижняя, W / △ — верхняя, D / ○ — силовая; Z + S / L2 + □ — мягкая нижняя. Сначала посмотри подброс и второе нажатие на схеме. В каждой попытке используй кнопку текущего задания.',
    goals: [
      goal('serve-low', 'Нижняя подача', ['S → отпустить → S', '□ → отпустить → □'], {
        kind: 'low',
        serve: true,
      }),
      goal('serve-loft', 'Верхняя подача', ['W → отпустить → W', '△ → отпустить → △'], {
        kind: 'loft',
        serve: true,
      }),
      goal('serve-drive', 'Силовая подача', ['D → отпустить → D', '○ → отпустить → ○'], {
        kind: 'drive',
        serve: true,
      }),
      goal('serve-back', 'Мягкая нижняя подача', ['Z + S · два нажатия', 'L2 + □ · два нажатия'], {
        kind: 'back',
        serve: true,
      }),
    ],
  },
  {
    id: 'block',
    title: 'Блок у сетки',
    drill: 'block',
    demo: 'block',
    hint: 'F / R1 (RB) запускает блок в защите. Встань у сетки и нажми чуть до прилёта мяча: руки должны встретить его над сеткой. Обычный прыжок сам по себе не считается блоком. Учебный мяч летит с другой стороны; соперник не нужен.',
    goals: [goal('block', 'Заблокировать учебный мяч', ['F', 'R1 / RB'])],
  },
  {
    id: 'one-hand',
    title: 'Приём одной рукой',
    drill: 'receive',
    demo: 'one-hand',
    hint: 'В мягком нижнем приёме Z + S / L2 + □ работает одна рука. Подготовь её перед низким мячом и направь пас партнёру. Это помогает смягчить приём; рука должна действительно встретить мяч.',
    goals: [
      goal('one-hand', 'Поднять мяч одной рукой', ['Z + S', 'L2 + □ / LT + X'], {
        kind: 'low',
        soft: true,
      }),
    ],
  },
  {
    id: 'dive',
    title: 'Спасение в броске',
    drill: 'dive-forward',
    demo: 'dive',
    hint: 'E — бросок вправо, Q — влево. На геймпаде три быстрых нажатия направления с возвратом в нейтраль. Руки в броске принимают автоматически: отдельная кнопка паса не нужна. Нужно спасти мяч, а не просто упасть.',
    goals: [
      goal('dive-right', 'Спасти мяч справа', ['E', '→ · → · →'], { save: true }),
      goal('dive-left', 'Спасти мяч слева', ['Q', '← · ← · ←'], { save: true }),
    ],
  },
  {
    id: 'switch',
    title: 'Выбор игрока и низкая стойка',
    drill: 'footwork',
    demo: 'move',
    hint: 'Tab / L1 выбирает следующего игрока; 1 / 2 / 3 — конкретного. Пока заряжаешь приём, переключиться нельзя. ↓ или стик вниз — низкая стойка: игрок приседает, оставаясь готовым к низкому мячу.',
    goals: [
      goal('switch', 'Сменить выбранного игрока', ['Tab / 1 / 2 / 3', 'L1 / LB']),
      goal('crouch', 'Принять низкую стойку', ['↓', 'Стик ↓']),
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
    return this.active && this.phase !== 'practice';
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
    this.match.tutorialNoBall = false;
  }
  enter() {
    this.completed = 0;
    this.ready = false;
    this.phase = 'explain';
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
        .filter((q) => q.team === 0 && q.id !== p.id)
        .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
      this.target = { x: partner.x, y: upper ? 3 : 2 };
    } else if (g.across || g.serve) {
      this.origin = { x: m.ball.x, y: g.serve ? 1.5 : 3.6 };
      this.target = { x: 4, y: 0.5 };
    } else {
      this.origin = this.target = null;
    }
  }
  begin() {
    if (!this.active || this.ready) return;
    if (this.lesson.id === 'rally') {
      this.previousPasser = null;
      this.completed = 0;
    }
    this.setup();
    this.phase = 'countdown';
    this.countdown = 3;
    this.input = {};
  }
  advance(dt) {
    if (!this.active || this.phase !== 'countdown') return;
    this.countdown = Math.max(0, this.countdown - dt);
    if (!this.countdown) {
      this.phase = 'practice';
      this.match.clearControls();
    }
  }
  complete() {
    this.completed++;
    if (this.completed === this.lesson.goals.length) {
      this.ready = true;
      this.phase = 'success';
      this.feedback = 'Этап пройден!';
    } else {
      this.feedback = 'Получилось! Следующая задача: ' + this.objective.label;
      // Upper-pass exchanges and set→attack continue with the actual live ball.
      if (['rally', 'attack', 'move', 'switch'].includes(this.lesson.id)) return;
      this.begin();
    }
  }
  observe(input) {
    if (!this.active) return;
    this.input = input;
    if (this.phase !== 'practice') return;
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
      this.begin();
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
            ? 'Удерживай Z / L2 при контакте.'
            : g.fast && c.modifier !== 'fast'
              ? 'Удерживай C / R2 при контакте.'
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
      error = 'Навес слишком низкий: направь пас выше (Shift + ↑ / стик вверх).';
    if (!error && !g.serve && !g.across && !g.save && c.vy <= 0)
      error = 'Подними мяч вверх к партнёру.';
    if (error) {
      if (this.lesson.id === 'rally') {
        this.begin();
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
    if (!this.active) return;
    const c = renderer.ctx;
    c.save();
    c.fillStyle = '#fff5dfee';
    c.fillRect(220, 68, 520, 63);
    c.fillStyle = '#305a50';
    c.textAlign = 'center';
    c.font = 'bold 13px sans-serif';
    c.fillText(
      this.lesson.id === 'rally'
        ? `${this.completed} / 5 ПЕРЕДАЧ ПОДРЯД`
        : this.objective?.label || 'Все задачи выполнены',
      480,
      88,
    );
    const count = this.lesson.goals.length;
    for (let i = 0; i < count; i++) {
      const x = 480 + (i - (count - 1) / 2) * 35;
      c.beginPath();
      c.arc(x, 112, 11, 0, Math.PI * 2);
      c.fillStyle = i < this.completed ? '#237b69' : '#e4ddc6';
      c.fill();
      c.fillStyle = i < this.completed ? '#ffffff' : '#546c60';
      c.fillText(i < this.completed ? '✓' : i + 1, x, 117);
    }
    if (this.origin) {
      const a = renderer.project(this.origin.x, this.origin.y),
        b = renderer.project(this.target.x, this.target.y);
      c.strokeStyle = '#237b69';
      c.fillStyle = '#237b6925';
      c.lineWidth = 2;
      c.fillRect(b.x - 26, b.y - 25, 52, 50);
      c.strokeRect(b.x - 26, b.y - 25, 52, 50);
      c.setLineDash([6, 6]);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 65, b.x, b.y);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#155b4b';
      c.font = 'bold 12px sans-serif';
      c.textAlign = 'center';
      c.fillText('ОБРАЗЕЦ · ЦЕЛЬ', b.x, b.y - 34);
    }
    if (this.phase === 'countdown' || this.phase === 'explain' || this.ready) {
      c.fillStyle = '#fff5dfed';
      c.fillRect(290, 170, 380, 100);
      c.textAlign = 'center';
      c.fillStyle = '#305a50';
      c.font = this.phase === 'explain' ? 'bold 23px sans-serif' : 'bold 36px sans-serif';
      c.fillText(
        this.phase === 'countdown'
          ? Math.ceil(this.countdown)
          : this.ready
            ? '✓ Получилось!'
            : 'Сначала посмотри пример',
        480,
        215,
      );
      c.font = '16px sans-serif';
      c.fillText(
        this.phase === 'countdown'
          ? 'Приготовься…'
          : this.ready
            ? 'Можно перейти дальше'
            : 'Объяснение и кнопки — под площадкой',
        480,
        249,
      );
    }
    c.restore();
  }
}

function diagram(lesson, objective = lesson.goals[0]) {
  const type = lesson.demo;
  const upper = objective?.kind === 'loft';
  const arm = upper
    ? 'M45 96 L37 62 M45 96 L56 62'
    : type === 'one-hand'
      ? 'M45 96 L65 102'
      : 'M45 96 L60 80';
  const path =
    type === 'move'
      ? 'M45 105 Q90 0 140 105'
      : type === 'serve'
        ? 'M45 95 Q45 0 65 55 Q130 5 230 100'
        : type === 'block'
          ? 'M225 55 Q150 10 125 45 Q155 65 205 105'
          : type === 'dive'
            ? 'M55 75 Q100 75 185 110'
            : type === 'attack'
              ? 'M45 95 Q85 0 125 40 L225 110'
              : 'M45 95 Q125 -15 210 90';
  const caption = {
    move: 'Движение → прыжок',
    pass: 'Слабый пас / высокий навес',
    rally: 'Партнёр → партнёр',
    serve: '1 · заряд → подброс → 2 · удар',
    block: 'F / R1 → руки над сеткой',
    attack: 'Навес → прыжок → удар',
    dive: 'Бросок → касание низкого мяча',
    'one-hand': 'Z / L2 → одна рука под мячом',
  }[type];
  const ball =
    type === 'move'
      ? ''
      : `<circle r="6" fill="#edbe69" stroke="#635b62"><animateMotion dur="3s" repeatCount="indefinite" path="${path}"/></circle>`;
  return `<svg viewBox="0 0 270 165" role="img" aria-label="${caption}">
    <path d="M15 125 H255" stroke="#bacbbf" stroke-width="2"/>
    ${['block', 'attack', 'serve'].includes(type) ? '<path d="M145 125 V45 M145 50 H160 M155 50 V125" stroke="#9b8d7d" fill="none"/>' : ''}
    <g stroke="#635b62" stroke-width="3" fill="#e9aa89"><circle cx="45" cy="80" r="9"/><path d="M45 90 V110 ${arm} M45 110 L35 125 M45 110 L55 125" fill="none"/>
    ${type === 'block' ? '<circle cx="130" cy="65" r="8"/><path d="M130 74 V100 M130 80 L123 42 M130 80 L138 42 M130 100 L120 115 M130 100 L140 115" fill="none"/>' : '<circle cx="215" cy="80" r="9"/><path d="M215 90 V110 M215 96 L200 80 M215 110 L205 125 M215 110 L225 125" fill="none"/>'}</g>
    <path d="${path}" fill="none" stroke="#237b69" stroke-width="2" stroke-dasharray="5 5"/>${ball}
    ${lesson.id === 'receive' ? '<path d="M45 99 Q125 65 210 100" fill="none" stroke="#c58a4a" stroke-width="2" stroke-dasharray="3 4"/><text x="125" y="100" text-anchor="middle" font-size="10" fill="#986a35">слабый</text><text x="125" y="35" text-anchor="middle" font-size="10" fill="#237b69">высокий</text>' : ''}
    ${type === 'serve' ? '<circle cx="65" cy="55" r="20" fill="none" stroke="#237b69" stroke-width="2"><animate attributeName="r" values="24;24;7;24" keyTimes="0;0.3;0.6;1" dur="3s" repeatCount="indefinite"/></circle><text x="65" y="20" text-anchor="middle" font-size="10" fill="#237b69">2 · нажми у мяча</text>' : ''}
    ${type === 'move' ? '<g fill="#80bda8"><rect x="90" y="65" width="14" height="25" rx="3"><animate attributeName="y" values="90;25;90" dur="2s" repeatCount="indefinite"/></rect></g>' : ''}
    <text x="135" y="150" text-anchor="middle" fill="#466458" font-size="11">${caption}</text></svg>`;
}

export function createTutorial(match, hooks) {
  const session = new Tutorial(match),
    panel = document.createElement('section');
  panel.id = 'tutorial-panel';
  panel.className = 'panel tutorial-panel';
  panel.hidden = true;
  panel.innerHTML = `<div class="tutorial-heading"><strong id="tutorial-title"></strong><span id="tutorial-stage"></span></div>
    <progress id="tutorial-progress" max="${LESSONS.length}" value="0" aria-label="Прогресс обучения"></progress>
    <div class="tutorial-content"><div id="tutorial-demo"></div><div><p id="tutorial-hint"></p>
    <ol id="tutorial-goals" class="tutorial-goals" aria-label="Задачи этапа"></ol>
    <div id="tutorial-keys" class="tutorial-keys"></div><label class="tutorial-power">Сила <meter id="tutorial-power" min="0" max="1" value="0"></meter><output id="tutorial-power-value">0%</output></label>
    <p id="tutorial-result" role="status" aria-live="polite"></p></div></div>
    <button id="tutorial-begin" class="primary">Понятно · попробовать</button>
    <button id="tutorial-next" class="primary" hidden>Дальше →</button>
    <button id="tutorial-repeat" class="secondary">Посмотреть объяснение снова</button>
    <button id="tutorial-exit" class="text-button">Закончить обучение</button>`;
  document.querySelector('#arena').after(panel);
  const find = (id) => panel.querySelector('#tutorial-' + id);
  let stamp;
  function sync() {
    panel.hidden = !session.active;
    if (!session.active) {
      stamp = null;
      return;
    }
    const lesson = session.lesson,
      current = session.objective;
    find('title').textContent = `${session.index + 1} / ${LESSONS.length} · ${lesson.title}`;
    find('stage').textContent = {
      explain: 'Посмотри пример',
      countdown: 'Приготовься',
      practice: 'Твоя очередь',
      success: 'Выполнено',
    }[session.phase];
    find('hint').textContent = lesson.hint;
    find('progress').value = session.index + Number(session.ready);
    const nextStamp = `${session.index}:${session.completed}`;
    if (stamp !== nextStamp) {
      stamp = nextStamp;
      find('demo').innerHTML = diagram(lesson, current);
      find('goals').innerHTML = lesson.goals
        .map(
          (g, i) =>
            `<li class="${i < session.completed ? 'done' : i === session.completed ? 'current' : ''}" aria-label="${g.label}${i < session.completed ? ' — выполнено' : ''}"><span>${i < session.completed ? '✓' : i + 1}</span><small>${g.label}</small></li>`,
        )
        .join('');
      const keys = current?.keys || lesson.goals.at(-1).keys;
      find('keys').innerHTML =
        `<span class="tutorial-key"><kbd>${keys[0]}</kbd><small>Клавиатура</small></span><span class="tutorial-key"><kbd>${keys[1]}</kbd><small>Геймпад</small></span>`;
    }
    const input = session.input || {};
    const action = current?.kind || (current?.save ? 'dive' : current?.id);
    const held =
      action === 'walk' ? !!input.axis : !!input[action] || (action === 'switch' && !!input.select);
    for (const key of find('keys').children)
      key.classList.toggle('pressed', session.phase === 'practice' && held);
    const power = match.controls[0].charge?.power || match.controls[0].pending?.power || 0;
    find('power').value = power;
    find('power-value').textContent = `${Math.round(power * 100)}%`;
    const message =
      session.phase === 'countdown'
        ? `Начало через ${Math.ceil(session.countdown)}…`
        : session.ready
          ? '✓ Все задачи выполнены. Можно идти дальше.'
          : session.feedback;
    if (find('result').textContent !== message) find('result').textContent = message;
    find('result').classList.toggle('success', session.ready);
    find('begin').hidden = session.phase !== 'explain';
    find('next').hidden = !session.ready;
    find('next').textContent =
      session.index === LESSONS.length - 1 ? 'Готово · сыграть матч →' : 'Дальше →';
  }
  document.getElementById('tutorial-start').onclick = () => {
    hooks.start();
    session.start();
    sync();
    hooks.focus();
  };
  find('begin').onclick = () => {
    session.begin();
    sync();
    hooks.focus();
  };
  find('next').onclick = () => {
    if (!session.next()) return;
    if (!session.active) hooks.finish();
    sync();
    hooks.focus();
  };
  find('repeat').onclick = () => {
    if (session.ready) session.enter();
    else {
      session.phase = 'explain';
      session.setup();
    }
    sync();
    hooks.focus();
  };
  find('exit').onclick = () => {
    session.leave();
    sync();
    hooks.finish();
  };
  return {
    get ready() {
      return session.active && session.ready;
    },
    get frozen() {
      return session.frozen;
    },
    get canConfirm() {
      return session.active && (session.ready || session.phase === 'explain');
    },
    retry() {
      if (!session.ready) session.begin();
      else {
        session.enter();
      }
      sync();
    },
    confirm() {
      if (session.ready) find('next').click();
      else if (session.phase === 'explain') find('begin').click();
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
    get active() {
      return session.active;
    },
  };
}
