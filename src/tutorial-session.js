import { launchTo, resetFlight } from './physics.js';

// Lessons own ball feeds; all player input and contacts use the match engine.
export class TutorialSession {
  constructor(match, lessons) {
    this.match = match;
    this.lessons = lessons;
    this.index = -1;
  }
  get active() {
    return this.index >= 0;
  }
  get lesson() {
    return this.lessons[this.index];
  }
  get objective() {
    return this.lesson?.goals.find((_, i) => !this.done?.has(i));
  }
  get frozen() {
    return this.active && !!this.menuOpen;
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
    this.match.training = null;
    this.match.tutorialNoBall = false;
    this.match.tutorialScriptedOpponents = false;
    this.index = -1;
    this.menuOpen = false;
  }
  enter() {
    this.done = new Set();
    this.completed = 0;
    this.ready = false;
    this.phase = 'practice';
    this.phaseAge = 0;
    this.menuOpen = false;
    this.previousPasser = null;
    this.feedback = '';
    this.flashes = [];
    this.savedBenched ??= this.match.players.map((p) => p.benched);
    this.match.training = this;
    this.match.events = this.match.events.filter(
      (e) => !['serve-ready', 'whistle', 'point'].includes(e.type),
    );
    this.setup();
  }
  setup() {
    const m = this.match,
      id = this.lesson.id;
    m.startDrill(this.lesson.drill);
    m.clearControls();
    m.players.forEach((p) => {
      p.benched = p.team === 1;
    });
    m.tutorialScriptedOpponents = id === 'block';
    if (['move', 'receive', 'streak', 'power'].includes(id)) {
      m.players.forEach((p) => {
        p.benched = p.id !== 0;
      });
      m.selected[0] = 0;
      m.players[0].x = -5;
    }
    if (id === 'rally') {
      m.players[0].benched = true;
      m.players[1].x = -6;
      m.players[2].x = -3;
      m.selected[0] = 1;
    }
    if (id === 'block') {
      m.players.forEach((p) => {
        p.benched = ![0, 2, 4, 5].includes(p.id);
      });
      m.players[0].x = -6;
      m.players[2].x = -0.85;
      m.players[4].x = 4;
      m.players[5].x = 1;
      m.selected[0] = 2;
    }
    this.startPlayer = m.selected[0];
    this.blocks = m.stats.blocks[0];
    this.feedNumber = 0;
    this.feed();
  }
  // Refill only the ball. Never reset a running jump or the player's position.
  feed() {
    const m = this.match,
      id = this.lesson.id,
      g = this.objective;
    this.feedNumber++;
    this.feedAt = null;
    this.retryAfter = null;
    this.pending = null;
    this.feedHit = false;
    this.startedAt = m.time;
    this.seenContact = m.lastContact;
    this.previousBall = null;
    m.phase = 'rally';
    m.phaseTime = 0;
    m.touches = [0, 0];
    m.bounces = [0, 0];
    m.lastTouch = 1;
    m.lastPlayer = 5;
    m.cooldown = 0;
    m.possession = 0;
    m.incomingShot = 'loft';
    m.shotSerial++;
    m.cpuPlans = [null, null];
    m.teamRuns = [null, null];
    m.trail = [];
    m.tutorialNoBall = ['move', 'switch'].includes(id);
    m.clearControls();
    m.controls[0].manualSerial = m.shotSerial;
    if (id === 'serve') {
      m.server = 0;
      m.startServe();
      m.players.forEach((p) => {
        p.benched = p.team === 1;
      });
      return;
    }
    const p = m.players[m.selected[0]];
    const x = id === 'streak' ? [-6.8, -3.2, -7.3, -4.5, -2.5][(this.feedNumber - 1) % 5] : p.x;
    Object.assign(m.ball, {
      x,
      y: 7.2,
      z: 4.5,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      attackGravity: 0,
      floorTouched: false,
    });
    if (id === 'block') {
      this.attackStage = 'set';
      this.attackAt = m.time;
      const setter = m.players[4];
      setter.armSwing = { kind: 'loft', power: 0.6, age: 0, hit: true };
      Object.assign(m.ball, { x: setter.x, y: 2.1 });
      launchTo(m.ball, { x: 1, y: 3.8, z: 4.5 }, 1.35 / m.config.ballSpeed, m.config);
      m.lastTouch = 1;
      m.lastPlayer = 4;
    } else if (id === 'attack' || id === 'modifiers') {
      if (id === 'attack' && g?.kind === 'loft') {
        m.lastTouch = 0;
        m.lastPlayer = 0;
        m.touches[0] = 1;
      }
      if (g?.kind === 'drive') {
        m.selected[0] = 2;
        Object.assign(m.ball, { x: m.players[2].x, y: 6.5 });
      }
    } else if (id === 'dive') {
      const dir = g?.id === 'dive-left' ? -1 : 1;
      Object.assign(m.ball, { x: Math.max(-9, Math.min(-1, p.x + dir * 2.5)), y: 3.5 });
    }
    // Longer incoming feeds give time to read the icon and move. A real contact
    // resets flight tempo through the ordinary engine, including in this lesson.
    resetFlight(
      m.ball,
      ['receive', 'streak', 'power', 'rally', 'soft-set', 'one-hand'].includes(id) ? 0.65 : 1,
    );
  }
  begin() {
    if (this.active && !this.ready) this.feed();
  }
  advance(dt) {
    if (!this.active || this.menuOpen) return;
    this.phaseAge += dt;
    this.flashes = this.flashes.filter((f) => this.match.time - f.at < 1.5);
    if (
      this.ready &&
      this.index < this.lessons.length - 1 &&
      this.phaseAge >= 2.8 &&
      this.match.players
        .filter((p) => !p.benched && p.team === 0)
        .every((p) => p.y < 0.03 && !p.jumpProfile)
    )
      this.next();
  }
  mark(i) {
    if (this.ready || this.done.has(i) || i < 0) return;
    this.done.add(i);
    this.completed = this.done.size;
    this.rewardAt = this.match.time;
    if (this.completed === this.lesson.goals.length) {
      this.ready = true;
      this.phase = 'success';
      this.phaseAge = 0;
      this.feedAt = null;
    }
  }
  complete() {
    this.mark(this.lesson.goals.indexOf(this.objective));
  }
  onPoint() {
    if (
      !this.ready &&
      (this.lesson.id === 'rally' || (this.lesson.id === 'streak' && !this.feedHit))
    ) {
      this.done.clear();
      this.completed = 0;
      this.previousPasser = null;
      this.resetAt = this.match.time;
    }
    if (!this.ready) this.feedAt = this.match.time;
    this.match.tutorialNoBall = true;
  }
  observe(input) {
    if (!this.active || this.menuOpen) return;
    this.input = input;
    const m = this.match,
      id = this.lesson.id;
    if (this.ready) return;
    if (id === 'move') {
      const p = m.players[this.startPlayer];
      this.lesson.goals.forEach((g, i) => {
        if (this.done.has(i)) return;
        const hit = g.y
          ? p.y > 0.35 && Math.hypot(p.x - g.x, p.y + 1.8 - g.y) < 0.65
          : p.y < 0.1 && Math.abs(p.x - g.x) < 0.45;
        if (hit) {
          this.mark(i);
          this.flashes.push({ x: g.x, y: g.y || 0, at: m.time });
        }
      });
      return;
    }
    if (id === 'switch') {
      if (m.selected[0] !== this.startPlayer) this.mark(0);
      if (m.players[m.selected[0]].crouchAmount > 0.75) this.mark(1);
      return;
    }
    if (id === 'block') {
      if (m.stats.blocks[0] > this.blocks) {
        this.mark(0);
        this.blocks = m.stats.blocks[0];
      }
      if (this.attackStage === 'set' && m.time - this.attackAt >= 0.9 / m.config.ballSpeed) {
        m.jump(m.players[5]);
        this.attackStage = 'jump';
      }
      if (this.attackStage === 'jump' && m.time - this.attackAt >= 1.35 / m.config.ballSpeed) {
        const hitter = m.players[5];
        hitter.armSwing = { kind: 'drive', power: 0.85, age: 0, hit: true };
        launchTo(m.ball, { x: -6, y: 0.7, z: 4.5 }, 0.95 / m.config.ballSpeed, m.config);
        m.incomingShot = 'drive';
        m.lastTouch = 1;
        m.lastPlayer = 5;
        m.headHitEligible = true;
        m.shotSerial++;
        this.attackStage = 'flight';
        m.emit('hit', { team: 1, kind: 'drive', power: 0.85 });
      }
    }
    const c = m.lastContact;
    if (c && c !== this.seenContact && c.time >= this.startedAt) {
      this.seenContact = c;
      if (c.team === 0) this.checkContact(c);
    }
    if (id === 'power' && this.feedHit && m.lastTouch === 0) {
      const a = this.previousBall || m.ball,
        b = m.ball;
      this.lesson.goals.forEach((g, i) => {
        const dx = b.x - a.x,
          dy = b.y - a.y,
          d = dx * dx + dy * dy;
        const t = d ? Math.max(0, Math.min(1, ((g.x - a.x) * dx + (g.y - a.y) * dy) / d)) : 0;
        if (!this.done.has(i) && Math.hypot(a.x + t * dx - g.x, a.y + t * dy - g.y) < 0.45) {
          this.mark(i);
          this.flashes.push({ x: g.x, y: g.y, at: m.time });
        }
      });
    }
    this.previousBall = { x: m.ball.x, y: m.ball.y };
    if (this.pending && m.ball.x > 0.3 && m.ball.y > 0.2 && m.lastTouch === 0) {
      this.pending = null;
      this.complete();
      if (!this.ready) this.feedAt = m.time + 1.3;
    }
    if (
      !this.ready &&
      ((this.feedAt != null && m.time >= this.feedAt) || m.time - this.startedAt > 14)
    )
      this.feed();
  }
  checkContact(c) {
    const m = this.match,
      id = this.lesson.id,
      g = this.objective;
    if (id === 'receive') {
      const i = this.lesson.goals.findIndex((goal) => goal.kind === c.kind);
      if (!c.serve) this.mark(i);
      this.feedHit = true;
      this.feedAt = m.time + 1.3;
      return;
    }
    if (id === 'streak') {
      if (!this.feedHit && !c.serve) {
        this.complete();
        this.feedHit = true;
        this.feedAt = m.time + 1.1;
      }
      return;
    }
    if (id === 'power') {
      this.feedHit = true;
      return;
    }
    if (id === 'block') {
      if (c.kind === 'low' && c.playerId === 0 && this.attackStage === 'flight') this.mark(1);
      this.feedHit = true;
      this.feedAt = m.time + 1.4;
      return;
    }
    if (!g || (!g.kind && !g.save)) return;
    const valid =
      c.serve === !!g.serve &&
      (!g.kind || c.kind === g.kind) &&
      (!g.soft || c.modifier === 'soft') &&
      (!g.fast || c.modifier === 'fast') &&
      (!g.maxPower || c.power <= g.maxPower) &&
      (!g.minPower || c.power >= g.minPower) &&
      (!g.airborne || c.airborne) &&
      (!g.save || c.save) &&
      (!g.exchange || c.playerId !== this.previousPasser);
    if (!valid) {
      if (id === 'rally') {
        this.done.clear();
        this.completed = 0;
        this.previousPasser = null;
        this.resetAt = m.time;
      }
      this.feedAt = m.time + 1.2;
      return;
    }
    if (g.across || g.serve) {
      this.pending = true;
      return;
    }
    if (g.exchange) {
      m.touches[0] = 0;
      this.startedAt = m.time;
      if (this.previousPasser == null) {
        this.previousPasser = c.playerId;
        return;
      }
      this.previousPasser = c.playerId;
    }
    this.complete();
    if (!this.ready && !['rally', 'attack'].includes(id)) this.feedAt = m.time + 1.5;
  }
  next() {
    if (!this.ready) return false;
    if (this.index === this.lessons.length - 1) this.leave();
    else {
      this.index++;
      this.enter();
    }
    return true;
  }
  draw(renderer) {
    if (!this.active || this.menuOpen) return;
    const c = renderer.ctx,
      m = this.match,
      id = this.lesson.id;
    c.save();
    c.lineWidth = 2;
    const diamond = (x, y) => {
      c.beginPath();
      c.moveTo(x, y - 11);
      c.lineTo(x + 8, y);
      c.lineTo(x, y + 11);
      c.lineTo(x - 8, y);
      c.closePath();
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(x, y - 7);
      c.lineTo(x - 4, y);
      c.stroke();
    };
    if (id === 'move' || id === 'power')
      this.lesson.goals.forEach((g, i) => {
        if (this.done.has(i)) return;
        const p = renderer.project(g.x, g.y || 0);
        c.fillStyle = '#43dca1';
        c.strokeStyle = '#157854';
        if (g.y) diamond(p.x, p.y + Math.sin(m.time * 3 + i) * 2);
        else {
          c.fillStyle = '#53dca455';
          c.beginPath();
          c.ellipse(p.x, p.y, 22, 7, 0, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
      });
    for (const f of this.flashes) {
      const age = m.time - f.at,
        p = renderer.project(f.x, f.y);
      c.globalAlpha = Math.max(0, 1 - age / 1.5);
      c.strokeStyle = '#32bf86';
      c.beginPath();
      c.arc(p.x, p.y, 12 + age * 28, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#167652';
      c.font = 'bold 22px sans-serif';
      c.textAlign = 'center';
      c.fillText('✓', p.x, p.y - 10 - age * 18);
    }
    c.globalAlpha = 1;
    if (['receive', 'streak', 'power'].includes(id) && !this.feedHit && !m.tutorialNoBall) {
      const p = renderer.project(m.ball.x, 0);
      c.fillStyle = '#46677922';
      c.strokeStyle = '#46677980';
      c.setLineDash([4, 4]);
      c.beginPath();
      c.ellipse(p.x, p.y, 17, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    c.restore();
  }
}
