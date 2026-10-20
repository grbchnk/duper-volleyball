export const LESSONS = Object.freeze([
  {
    id: 'move',
    title: 'Перемещение',
    hint: 'Пройди немного влево или вправо: ← / → либо левый стик.',
    drill: 'receive',
  },
  {
    id: 'charge',
    title: 'Подготовка и отпускание',
    hint: 'Зажми S / □ до заметного заряда, затем отпусти. Удержание готовит руки; отпускание открывает короткое окно контакта.',
    drill: 'receive',
  },
  {
    id: 'aim',
    title: 'Направление',
    hint: 'В упражнении верхнего паса направь стрелки или левый стик и выполни W / △ у мяча. Направление считывается при контакте. R — повтор мяча.',
    drill: 'set',
  },
  {
    id: 'serve',
    title: 'Два нажатия подачи',
    hint: 'Зажми S / □, отпусти для подброса. Круг сужается и зеленеет: коротко нажми ещё раз, когда он сойдётся к мячу. R — повтор подачи.',
    drill: 'serve',
  },
  {
    id: 'switch',
    title: 'Выбор игрока',
    hint: 'Нажми Tab / L1 или 1 / 2 / 3 и выбери другого игрока.',
    drill: 'receive',
  },
  {
    id: 'dive',
    title: 'Бросок за мячом',
    hint: 'Q / E — бросок влево / вправо. На геймпаде: три быстрых нажатия направления с возвратом в нейтраль. Приём в броске выполняется руками автоматически.',
    drill: 'dive-forward',
  },
]);

// Lessons reuse Match.startDrill and ordinary input; there is no separate training physics.
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
  start() {
    this.index = 0;
    this.enter();
  }
  leave() {
    this.index = -1;
  }
  enter() {
    this.match.startDrill(this.lesson.drill);
    this.match.clearControls();
    this.ready = false;
    this.prepared = false;
    this.directed = false;
    this.startedAt = this.match.time;
    this.startPlayer = this.match.selected[0];
    this.startX = this.match.players[this.startPlayer].x;
    this.serves = this.match.stats.serves[0];
  }
  observe(input) {
    if (!this.active || this.ready) return;
    const m = this.match,
      c = m.controls[0],
      action = c.charge || c.pending;
    this.prepared ||= (c.charge?.power || 0) >= 0.2;
    this.directed ||= !!(action && (input.buttonVector || input.axis || input.up || input.down));
    const contact = m.lastContact;
    this.ready = {
      move: Math.abs(m.players[this.startPlayer].x - this.startX) >= 0.7,
      charge:
        this.prepared &&
        !c.charge &&
        !!(c.pending || c.chargeLock || contact?.time > this.startedAt),
      aim: this.directed && contact?.team === 0 && contact.time > this.startedAt,
      serve: m.stats.serves[0] > this.serves,
      switch: !!(input.switch || input.select) && m.selected[0] !== this.startPlayer,
      dive: m.players.some((p) => p.team === 0 && p.diving),
    }[this.lesson.id];
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
}

export function createTutorial(match, hooks) {
  const session = new Tutorial(match);
  const panel = document.createElement('section');
  panel.id = 'tutorial-panel';
  panel.className = 'panel tutorial-panel';
  panel.hidden = true;
  panel.innerHTML =
    '<strong id="tutorial-title"></strong><p id="tutorial-hint"></p><button id="tutorial-next" class="primary" disabled>Дальше →</button> <button id="tutorial-repeat" class="secondary">Повторить шаг</button> <button id="tutorial-exit" class="text-button">Закончить обучение</button>';
  document.querySelector('#arena').after(panel);
  const title = panel.querySelector('#tutorial-title'),
    hint = panel.querySelector('#tutorial-hint');
  const next = panel.querySelector('#tutorial-next');
  function sync() {
    panel.hidden = !session.active;
    if (!session.active) return;
    title.textContent = `${session.index + 1} / ${LESSONS.length} · ${session.lesson.title}`;
    hint.textContent = (session.ready ? 'Получилось! ' : '') + session.lesson.hint;
    next.disabled = !session.ready;
    next.textContent =
      session.index === LESSONS.length - 1 ? 'Готово · сыграть матч →' : 'Дальше →';
  }
  document.getElementById('tutorial-start').onclick = () => {
    hooks.start();
    session.start();
    sync();
    hooks.focus();
  };
  next.onclick = () => {
    if (!session.next()) return;
    if (!session.active) hooks.finish();
    sync();
    hooks.focus();
  };
  panel.querySelector('#tutorial-repeat').onclick = () => {
    session.enter();
    sync();
    hooks.focus();
  };
  panel.querySelector('#tutorial-exit').onclick = () => {
    session.leave();
    sync();
    hooks.finish();
  };
  return {
    get ready() {
      return session.active && session.ready;
    },
    confirm() {
      if (session.ready) next.click();
    },
    leave() {
      session.leave();
      sync();
    },
    observe(input) {
      session.observe(input);
    },
    update() {
      sync();
    },
    get active() {
      return session.active;
    },
  };
}
