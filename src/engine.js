import { WIN_EMOTIONS, LOSE_EMOTIONS } from './emotions.js';
import { preparedHands, ballTouchesHands } from './held-contact.js';
import { DEFAULTS, COURT, FIXED_DT, sanitizeConfig } from './config.js';
import {
  integrateBall,
  launchTo,
  predictAtHeight,
  collideNet,
  isInside,
  clamp,
} from './physics.js';
import { SHOTS, SERVES, shotImpulse } from './moves.js';
import { awardRally } from './rules.js';
import { jumpProfile, sampleJump, jumpDuration, serveOrigin, blockWindow } from './motion.js';
const HOMES = [7, 3.7, 0.8],
  ROLES = ['receiver', 'setter', 'open'],
  TEAM_SIZE = ROLES.length;
export const EMPTY_INPUT = Object.freeze({
  axis: 0,
  up: false,
  down: false,
  low: false,
  loft: false,
  drive: false,
  block: false,
  jump: false,
  dive: false,
  switch: false,
  select: 0,
});
const aimOf = (i) => ({ axis: i.axis, up: i.up, down: i.down });
const grounded = (p) => p.y <= 0 && p.vy <= 0 && p.recovery <= 0 && !p.diving && !p.jumpProfile;
export class Match {
  constructor(config = DEFAULTS, seed = 2026) {
    this.config = sanitizeConfig(config);
    this.seed = seed;
    this.events = [];
    this.mode = 'match';
    this.reset();
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  visualRandom() {
    this.visualSeed = (Math.imul(this.visualSeed, 1664525) + 1013904223) >>> 0;
    return this.visualSeed / 4294967296;
  }
  sign(team) {
    return team === 0 ? -1 : 1;
  }
  isHuman(team) {
    return team === 0 && this.mode !== 'demo';
  }
  player(team, role) {
    return this.players.find((p) => p.team === team && p.role === role);
  }
  active(team = 0) {
    return this.players[this.selected[team]];
  }
  emit(type, data = {}) {
    this.events.push({ type, time: this.time, ...data });
    if (this.events.length > 80) this.events.shift();
  }
  label(text, duration = 1.6) {
    this.notice = text;
    this.noticeTime = duration;
  }
  updateConfig(config) {
    this.config = sanitizeConfig(config);
  }
  reset(mode = this.mode) {
    this.testFeeds = 0;
    this.visualSeed = this.seed ^ 0x6a09e667;
    this.mode = mode;
    this.time = 0;
    this.rallies = 0;
    this.contacts = 0;
    this.server = 0;
    this.score = [0, 0];
    this.sets = [0, 0];
    this.events = [];
    this.players = [0, 1].flatMap((team) =>
      ROLES.map((role, i) => ({
        id: team * TEAM_SIZE + i,
        team,
        role,
        number: i + 1,
        x: this.sign(team) * HOMES[i],
        z: 4.5,
        y: 0,
        vy: 0,
        vx: 0,
        pose: 'idle',
        animation: 0,
        block: 0,
        recovery: 0,
        diving: false,
        diveVelocity: 0,
        blockCooldown: 0,
      })),
    );
    this.stats = {
      serves: [0, 0],
      attacks: [0, 0],
      passes: [0, 0],
      blocks: [0, 0],
      softBlocks: [0, 0],
    };
    this.selected = [0, TEAM_SIZE];
    this.previousInput = { ...EMPTY_INPUT };
    this.label('Матч начинается');
    this.startServe();
    if (mode === 'test') {
      this.players[0].x = -6;
      this.feedTestBall();
    }
  }
  startServe() {
    this.phase = 'serve';
    this.phaseTime = 0;
    this.possession = this.server;
    this.teamPhases = ['defense', 'defense'];
    this.teamPhases[this.server] = 'attack';
    this.touches = [0, 0];
    this.lastTouch = null;
    this.lastPlayer = null;
    this.shotSerial = 0;
    this.cooldown = 0;
    this.incomingShot = 'serve';
    this.charge = null;
    this.pending = null;
    this.chargeLock = false;
    this.serveAction = null;
    this.contactWindow = false;
    this.trail = [];
    this.aimPreview = null;
    this.cpuBlockPlan = null;
    this.selected = [0, TEAM_SIZE];
    this.cpuMiss = [false, false];
    this.lastAction = 'Выберите A, W или D и зажмите';
    this.assistLabel = 'Помощь только в направлении паса';
    for (const p of this.players)
      Object.assign(p, {
        x: this.sign(p.team) * HOMES[p.id % TEAM_SIZE],
        y: 0,
        vy: 0,
        vx: 0,
        pose: 'idle',
        animation: 0,
        block: 0,
        recovery: 0,
        diving: false,
        diveVelocity: 0,
        blockCooldown: 0,
        jumpProfile: null,
        jumpTime: 0,
        contact: null,
        facing: -this.sign(p.team),
        blockUsed: false,
        swingCooldown: 0,
        armSwing: null,
        emotion: null,
        diveArmed: false,
        diveAge: 0,
        runTime: 0,
      });
    this.active(this.server).x = this.sign(this.server) * 9.4;
    this.ball = {
      x: this.active(this.server).x,
      y: 1.3,
      z: 4.5,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      angle: 0,
    };
    this.emit('serve-ready', { team: this.server });
  }
  feedTestBall() {
    this.phase = 'rally';
    this.testBallAge = 0;
    this.testFeeds = (this.testFeeds || 0) + 1;
    this.lastTouch = 1;
    this.lastPlayer = 3;
    this.touches = [0, 0];
    this.cooldown = 0;
    this.teamPhases = ['defense', 'defense'];
    this.incomingShot = 'loft';
    this.charge = null;
    this.pending = null;
    this.aimPreview = null;
    this.cpuBlockPlan = null;
    this.trail = [];
    this.ball = { x: 3, y: 4.8, z: 4.5, vx: 0, vy: 0, vz: 0, spin: 0, angle: 0 };
    const height = this.testFeeds % 3 === 0 ? 2.8 : 1.3;
    launchTo(
      this.ball,
      { x: clamp(this.active().x, -8, -1.2), y: height, z: 4.5 },
      1.55,
      this.config,
    );
    this.emit('feed');
    this.label('ТЕСТ · мяч ' + this.testFeeds, 0.8);
  }
  tick(dt = FIXED_DT, raw = {}) {
    const input = { ...EMPTY_INPUT, ...raw },
      press = (key) => input[key] && !this.previousInput[key];
    if (this.phase === 'finished') {
      this.time += dt;
      this.animatePlayers(dt);
      this.previousInput = input;
      return;
    }
    this.time += dt;
    this.phaseTime += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    this.contactWindow = false;
    this.animatePlayers(dt);
    if (['point', 'set-end'].includes(this.phase)) {
      if (this.phaseTime > 2.3) {
        if (this.phase === 'set-end') this.score = [0, 0];
        if (this.mode === 'practice') this.startDrill(this.drill);
        else this.startServe();
      }
      this.previousInput = input;
      return;
    }
    if (this.isHuman(0)) {
      if (press('switch') && this.phase === 'rally' && !this.charge && !this.pending)
        this.switchPlayer();
      if (
        input.select &&
        input.select !== this.previousInput.select &&
        this.phase === 'rally' &&
        !this.charge &&
        !this.pending &&
        this.players[input.select - 1]?.recovery <= 0
      )
        this.selected[0] = input.select - 1;
      if (
        press('block') &&
        !input.low &&
        !input.loft &&
        !input.drive &&
        this.phase === 'rally' &&
        this.teamPhases[0] === 'defense'
      )
        this.requestBlock(0);
      if (press('jump') && this.phase === 'rally') this.jump(this.active(0));
      if (press('dive') && this.phase === 'rally') this.dive(this.active(0), input.axis);
      this.updateCharge(dt, input, press);
    }
    if (this.phase === 'serve') {
      if (!this.isHuman(this.server) && this.phaseTime > 1.3)
        this.beginServe({
          kind: ['low', 'loft', 'drive'][Math.floor(this.random() * 3)],
          power: 0.54,
          aim: { axis: -this.sign(this.server), up: false, down: false },
        });
      this.updatePreview();
      this.previousInput = input;
      return;
    }
    if (this.phase === 'serve-motion') {
      const p = this.active(this.server),
        a = this.serveAction,
        t = this.phaseTime,
        dir = -this.sign(this.server);
      if (a.kind === 'drive') {
        p.x = a.startX + dir * 1.05 * Math.min(t / a.jumpAt, 1);
        p.vx = t < a.jumpAt ? (dir * 1.05) / a.jumpAt : 0;
        p.runTime = t;
        if (t >= a.jumpAt && !a.jumped) {
          this.jump(p);
          a.jumped = true;
        }
      }
      this.ball.x = p.x + dir * 0.5;
      this.ball.y = 1.3 + a.tossSpeed * t - 3 * t * t;
      this.contactWindow = Math.abs(t - a.ideal) < 0.12;
      if (this.ball.y <= COURT.ballRadius) this.point(1 - this.server, 'ПОДАЧА: МЯЧ НЕ УДАРЕН');
      else if (
        (this.isHuman(this.server) && Object.keys(SHOTS).some(press)) ||
        (!this.isHuman(this.server) && t >= a.ideal)
      ) {
        a.perfect = this.contactWindow;
        a.power *= a.perfect ? 1 : 0.78;
        this.executeServe();
        this.chargeLock = true;
      }
      this.previousInput = input;
      return;
    }
    if (this.mode === 'test') {
      this.testBallAge += dt;
      if (this.testBallAge > 4.5 || (this.lastTouch === 0 && this.ball.x > 2)) this.feedTestBall();
    }
    const previous = { ...this.ball };
    integrateBall(this.ball, dt, this.config);
    if (collideNet(this.ball, previous, this.config.restitution)) {
      this.emit('net');
      this.label('Мяч от сетки — ещё можно спасти');
    }
    this.trail.push({ x: this.ball.x, y: this.ball.y });
    if (this.trail.length > 15) this.trail.shift();
    if (this.ball.y <= COURT.ballRadius) {
      this.ball.y = COURT.ballRadius;
      const inside = isInside(this.ball),
        side = this.ball.x < 0 ? 0 : 1;
      this.point(
        inside ? 1 - side : 1 - (this.lastTouch ?? this.server),
        inside ? 'МЯЧ КОСНУЛСЯ ПЛОЩАДКИ' : this.incomingShot === 'block' ? 'АУТ ОТ БЛОКА' : 'АУТ',
      );
      this.previousInput = input;
      return;
    }
    if (Math.abs(this.ball.x) > 16 || this.ball.y > 28) {
      this.point(1 - (this.lastTouch ?? this.server), 'АУТ');
      this.previousInput = input;
      return;
    }
    this.possession = this.ball.x < 0 ? 0 : 1;
    this.prediction = predictAtHeight(this.ball, 1.4, this.config);
    this.movePlayers(dt, input);
    if (this.mode !== 'test') this.updateCPU();
    this.tryBlocks();
    if (this.pending && this.cooldown <= 0) this.tryPending();
    this.tryHeldContact(previous);
    this.tryDiveContacts();
    for (const team of [0, 1])
      if (this.mode !== 'test' && !this.isHuman(team) && this.cooldown <= 0)
        this.tryCPUContact(team);
    if (this.pending) {
      this.pending.ttl -= dt;
      if (this.pending.ttl <= 0) {
        this.players[this.pending.playerId].swingCooldown = 0.16;
        this.pending = null;
        this.label('Мимо: отпускайте кнопку у мяча', 1.2);
      }
    }
    const action = this.charge || this.pending;
    this.contactWindow = action
      ? this.canContact(this.players[action.playerId], action.kind)
      : Object.keys(SHOTS).some((k) => this.canContact(this.active(0), k));
    this.updatePreview();
    this.previousInput = input;
  }
  updateCharge(dt, input, press) {
    if (this.phase === 'serve' && this.server !== 0) return;
    if (!['serve', 'rally'].includes(this.phase)) return;
    if (!input.low && !input.loft && !input.drive) this.chargeLock = false;
    if (this.charge) {
      const a = this.charge,
        p = this.players[a.playerId];
      a.aim = aimOf(input);
      a.age = (a.age || 0) + dt;
      if (this.phase !== 'serve' && a.age > this.config.maxHold) {
        this.charge = null;
        this.chargeLock = true;
        p.swingCooldown = 0.22;
        p.pose = 'whiff';
        p.animation = 0.18;
        this.label('Передержал! Отпусти кнопку и начни новый замах');
      } else if (input[a.kind]) a.power = clamp(a.power + dt / this.config.chargeSeconds, 0.08, 1);
      else {
        this.charge = null;
        if (this.phase !== 'serve')
          p.armSwing = { kind: a.kind, power: a.power, age: 0, hit: false };
        const action = { ...a, aim: { ...a.aim }, ttl: this.config.releaseWindow };
        if (this.phase === 'serve') this.beginServe(action);
        else {
          this.pending = action;
          if (!this.tryPending() && action.ttl <= 0) {
            this.pending = null;
            p.swingCooldown = 0.16;
            this.label('Мимо: касание только у мяча');
          }
        }
      }
    } else if (!this.pending && !this.chargeLock) {
      const kind = Object.keys(SHOTS).find(press),
        p = this.active(0);
      if (kind && !p.diving && p.recovery <= 0 && p.swingCooldown <= 0 && p.block <= 0)
        this.charge = { kind, power: 0.08, age: 0, aim: aimOf(input), playerId: p.id };
    }
    const preparing = this.charge || this.pending;
    if (preparing && this.phase !== 'serve') {
      const p = this.players[preparing.playerId];
      if (!p.diving && p.block <= 0 && !(p.jumpProfile && p.jumpTime < p.jumpProfile.windup)) {
        p.pose = 'ready-' + SHOTS[preparing.kind].pose;
        p.animation = 0.08;
      }
    }
  }
  beginServe(action) {
    const p = this.active(this.server),
      ideal = action.kind === 'drive' ? 1.25 : 1.15,
      profile = jumpProfile(this.config);
    const jumpAt = Math.max(0.25, ideal - profile.windup - profile.rise - profile.hang / 2);
    const height =
      action.kind === 'low' ? 0.85 : 2.05 + (action.kind === 'drive' ? profile.height : 0);
    this.serveAction = {
      ...action,
      hand: this.visualRandom() < 0.5 ? 0 : 1,
      startX: p.x,
      ideal,
      jumpAt,
      jumped: false,
      tossSpeed: (height - 1.3 + 3 * ideal * ideal) / ideal,
    };
    this.phase = 'serve-motion';
    this.phaseTime = 0;
    this.aimPreview = null;
    p.armSwing = null;
    p.pose = 'idle';
    p.animation = 0;
    this.emit('toss');
    this.label(SERVES[action.kind].name + ' · нажми ещё раз');
  }
  startDrill(drill = 'receive') {
    this.drill = drill;
    this.server = 0;
    this.startServe();
    if (drill === 'serve') return;
    this.phase = 'rally';
    this.lastTouch = 1;
    this.lastPlayer = TEAM_SIZE;
    this.teamPhases = ['defense', 'defense'];
    this.players[0].x = -7;
    if (drill === 'set') {
      this.selected[0] = 1;
      this.teamPhases[0] = 'attack';
      Object.assign(this.ball, { x: -3.7, y: 4.5, vx: 0, vy: 0 });
    } else if (drill === 'spike') {
      this.selected[0] = 0;
      this.lastTouch = 0;
      this.lastPlayer = 1;
      this.touches[0] = 2;
      this.teamPhases[0] = 'attack';
      Object.assign(this.ball, { x: -0.8, y: 5.4, vx: 0, vy: 0 });
    } else if (drill === 'dive-forward' || drill === 'dive-back') {
      const dir = drill === 'dive-forward' ? 1 : -1;
      this.players[0].x = -5;
      Object.assign(this.ball, { x: -5 + dir * 3.4, y: 2.1, vx: 0, vy: -0.2 });
    } else if (drill === 'block') {
      Object.assign(this.ball, { x: 3.2, y: 3.6 });
      launchTo(this.ball, { x: -5, y: 0.2, z: 4.5 }, 1.15, this.config);
      this.incomingShot = 'drive';
      this.selected[0] = 2;
    } else {
      Object.assign(this.ball, { x: 5, y: 5 });
      launchTo(this.ball, { x: -7, y: 0.9, z: 4.5 }, 2.1, this.config);
      this.incomingShot = 'serve';
    }
    this.label(
      drill === 'dive-forward'
        ? '→ + ↓: бросок с приёмом'
        : drill === 'dive-back'
          ? '← + ↓: бросок с приёмом'
          : drill === 'spike'
            ? '3 → ↑ → D: атакуй навес у сетки'
            : 'РАЗМИНКА · каждый контакт — ваш',
    );
  }
  executeServe() {
    const p = this.active(this.server),
      a = this.serveAction;
    Object.assign(
      this.ball,
      shotImpulse(this.ball, p, a.kind, a.power, a.aim, this.players, this.config, true),
    );
    this.phase = 'rally';
    this.phaseTime = 0;
    this.lastTouch = this.server;
    this.lastPlayer = p.id;
    this.touches = [0, 0];
    this.cooldown = 0.2;
    this.incomingShot = 'serve';
    this.stats.serves[this.server]++;
    this.teamPhases = ['defense', 'defense'];
    this.recordContact(p, a.kind, a.power);
    p.armSwing.serve = true;
    p.armSwing.hand = a.hand;
    this.shotSerial++;
    this.autoSelect(1 - this.server);
    this.lastAction = `${SERVES[a.kind].name} · ${a.perfect ? 'ИДЕАЛЬНО · ' : ''}${Math.round(a.power * 100)}%`;
    this.label(this.lastAction);
    this.emit('hit', {
      kind: a.kind,
      power: a.power,
      team: this.server,
      serve: true,
      x: this.ball.x,
      y: this.ball.y,
      playerId: p.id,
    });
    this.serveAction = null;
    this.aimPreview = null;
  }
  switchPlayer() {
    const current = this.selected[0];
    for (let i = 1; i <= TEAM_SIZE; i++) {
      const next = (current + i) % TEAM_SIZE;
      if (this.players[next].recovery <= 0) {
        this.selected[0] = next;
        return;
      }
    }
  }
  autoSelect(team, preferred = null) {
    if (this.mode === 'test') return;
    if (team === 0 && (this.charge || this.pending)) return;
    if (!this.isHuman(team) && this.lastTouch !== team)
      this.cpuMiss[team] =
        this.random() < { easy: 0.18, normal: 0.09, hard: 0.035 }[this.config.difficulty];
    if (preferred !== null && this.players[preferred].team === team) {
      this.selected[team] = preferred;
      return;
    }
    const target = predictAtHeight(this.ball, 1.45, this.config),
      players = this.players.filter((p) => p.team === team);
    players.sort(
      (a, b) =>
        Math.abs(a.x - target.x) +
        a.recovery * 4 +
        a.y -
        (Math.abs(b.x - target.x) + b.recovery * 4 + b.y),
    );
    this.selected[team] = players[0].id;
  }
  jump(p, block = false) {
    if (!grounded(p)) return false;
    p.jumpProfile = jumpProfile(this.config);
    p.jumpTime = 0;
    p.vy = 0;
    p.vx = 0;
    p.pose = 'crouch';
    p.animation = p.jumpProfile.windup;
    p.blockUsed = false;
    if (block) {
      p.block = jumpDuration(p.jumpProfile);
      p.blockCooldown = this.config.blockCooldown;
    }
    return true;
  }
  requestBlock(team) {
    if (
      this.phase !== 'rally' ||
      this.teamPhases[team] === 'attack' ||
      (this.charge && this.players[this.charge.playerId].team === team) ||
      (this.pending && this.players[this.pending.playerId].team === team) ||
      this.players.some((p) => p.team === team && p.armSwing && p.armSwing.age < 0.35)
    )
      return false;
    const front = this.players
      .filter((p) => p.team === team && Math.abs(p.x) < 3.25 && grounded(p) && p.blockCooldown <= 0)
      .sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
    if (!front.length) return false;
    this.jump(front[0], true);
    this.emit('jump', { team, playerId: front[0].id });
    return true;
  }
  dive(p, axis) {
    if (!grounded(p) || this.phase !== 'rally') return false;
    const direction = Math.sign(axis) || p.facing || -this.sign(p.team);
    if (this.charge?.playerId === p.id) this.charge = null;
    if (this.pending?.playerId === p.id) this.pending = null;
    p.diving = true;
    p.diveAge = 0;
    p.diveArmed = true;
    p.armSwing = null;
    p.contact = null;
    p.vy = this.config.diveLift;
    p.diveVelocity = direction * this.config.diveSpeed;
    p.vx = p.diveVelocity;
    p.facing = direction;
    p.pose = 'dive';
    p.animation = 0.5;
    this.emit('jump', { team: p.team, playerId: p.id });
    this.label(
      direction === -this.sign(p.team)
        ? 'БРОСОК ВПЕРЁД · руки готовы'
        : 'БРОСОК НАЗАД · руки готовы',
    );
    return true;
  }
  tryDiveContacts() {
    for (const p of this.players) {
      if (!p.diving || !p.diveArmed || p.diveAge < 0.045 || !this.canContact(p, 'low')) continue;
      // A dive is one explicitly requested forearm reception, never a repeated auto-hit.
      p.diveArmed = false;
      const aim = { axis: -this.sign(p.team), up: true, down: false },
        power = this.config.divePower;
      return this.makeContact(
        p,
        'low',
        power,
        shotImpulse(this.ball, p, 'low', power, aim, this.players, this.config),
      );
    }
    return false;
  }
  animatePlayers(dt) {
    for (const p of this.players) {
      if (p.emotion && !p.jumpProfile && !p.diving && p.recovery <= 0) {
        p.emotion.age += dt;
        if (p.emotion.age >= p.emotion.duration) p.emotion = null;
      }
      p.animation = Math.max(0, p.animation - dt);
      p.block = Math.max(0, p.block - dt);
      p.blockCooldown = Math.max(0, p.blockCooldown - dt);
      p.recovery = Math.max(0, p.recovery - dt);
      p.swingCooldown = Math.max(0, (p.swingCooldown || 0) - dt);
      if (p.diving) p.diveAge += dt;
      if (p.armSwing) {
        p.armSwing.age += dt;
        if (p.armSwing.age > 0.75) p.armSwing = null;
      }
      if (p.contact) {
        p.contact.life -= dt;
        if (p.contact.life <= 0) p.contact = null;
      }
      if (p.jumpProfile) {
        p.jumpTime += dt;
        Object.assign(p, sampleJump(p.jumpProfile, p.jumpTime));
        if (p.jumpTime >= jumpDuration(p.jumpProfile)) {
          p.jumpProfile = null;
          p.y = 0;
          p.vy = 0;
          p.block = 0;
          p.pose = 'land';
          p.animation = 0.12;
        }
      } else if (p.y > 0 || p.vy > 0) {
        p.y = Math.max(0, p.y + p.vy * dt - 0.5 * this.config.gravity * dt * dt);
        p.vy -= this.config.gravity * dt;
        if (p.diving) p.x += p.diveVelocity * dt;
        if (p.y === 0) {
          p.vy = 0;
          p.block = 0;
          if (p.diving) {
            p.diving = false;
            p.diveArmed = false;
            p.recovery = this.config.diveRecovery;
            p.recoveryTotal = p.recovery;
            p.pose = 'belly';
            p.animation = p.recovery;
            p.diveVelocity = 0;
          } else {
            p.pose = 'land';
            p.animation = 0.14;
          }
        }
      }
      if (p.jumpProfile && p.jumpTime < p.jumpProfile.windup) p.pose = 'crouch';
      else if (p.recovery > 0) p.pose = p.recovery > 0.32 ? 'belly' : 'getup';
      else if (!p.animation)
        p.pose = p.diving
          ? 'dive'
          : p.block > 0
            ? 'block'
            : p.y > 0
              ? 'jump'
              : Math.abs(p.vx) > 0.1
                ? 'run'
                : 'idle';
      p.x = clamp(p.x, p.team === 0 ? -10.5 : 0.32, p.team === 0 ? -0.32 : 10.5);
    }
  }
  movePlayers(dt, input) {
    for (const p of this.players) {
      if (!grounded(p)) {
        if (!p.diving) p.vx = 0;
        continue;
      }
      const old = p.x;
      if (this.isHuman(p.team)) {
        if (p.id === this.selected[0]) {
          p.x +=
            input.axis * this.config.playerSpeed * dt * (this.charge ? this.config.chargeMove : 1);
          if (
            input.axis &&
            Math.sign(input.axis) === Math.sign(this.ball.x - p.x) &&
            Math.abs(this.ball.x - p.x) > 0.35
          )
            p.facing = Math.sign(input.axis);
        }
      } else {
        let target = this.sign(p.team) * HOMES[p.id % TEAM_SIZE];
        if (this.possession === p.team && this.ball.vy < 4 && this.active(p.team).id === p.id)
          target = this.prediction.x;
        p.x += clamp(target - p.x, -this.config.playerSpeed * dt, this.config.playerSpeed * dt);
      }
      p.x = clamp(p.x, p.team === 0 ? -10.5 : 0.32, p.team === 0 ? -0.32 : 10.5);
      p.vx = (p.x - old) / dt;
      if (Math.abs(p.vx) > 0.1) p.runTime += dt;
      else p.runTime = 0;
    }
  }
  canContact(p, kind, handsOnly = false) {
    if (
      !p ||
      p.recovery > 0 ||
      p.block > 0 ||
      this.phase !== 'rally' ||
      this.cooldown > 0 ||
      (p.jumpProfile && p.jumpTime < p.jumpProfile.windup)
    )
      return false;
    if ((this.ball.x < -0.08 && p.team !== 0) || (this.ball.x > 0.08 && p.team !== 1)) return false;
    if (this.lastPlayer === p.id && this.lastTouch === p.team) return false;
    if (handsOnly) return true;
    const shot = SHOTS[kind];
    let min = shot.min + p.y,
      max = shot.max + p.y,
      reach = shot.reach;
    if (p.diving) {
      if (kind !== 'low') return false;
      return (
        this.ball.y >= 0.12 &&
        this.ball.y <= 1.2 &&
        Math.abs(this.ball.x - (p.x + Math.sign(p.diveVelocity) * 1.8)) <= 0.55
      );
    }
    return Math.abs(this.ball.x - p.x) <= reach && this.ball.y >= min && this.ball.y <= max;
  }
  tryHeldContact(previous = this.ball) {
    const a = this.charge;
    if (!a || a.age < this.config.armWindup) return false;
    const p = this.players[a.playerId];
    if (
      !this.canContact(p, a.kind, true) ||
      !ballTouchesHands(
        this.ball,
        previous,
        preparedHands(p, this),
        COURT.ballRadius + 0.13 * this.config.armScale,
      )
    )
      return false;
    // Consume the entire press, including when selection switches to a teammate.
    this.charge = null;
    this.pending = null;
    this.chargeLock = true;
    return this.makeContact(
      p,
      a.kind,
      a.power,
      shotImpulse(this.ball, p, a.kind, a.power, a.aim, this.players, this.config),
    );
  }
  tryPending() {
    const a = this.pending,
      p = this.players[a.playerId];
    if (!this.canContact(p, a.kind)) return false;
    this.pending = null;
    return this.makeContact(
      p,
      a.kind,
      a.power,
      shotImpulse(this.ball, p, a.kind, a.power, a.aim, this.players, this.config),
    );
  }
  recordContact(p, kind, power) {
    if (p.diving) p.diveArmed = false;
    p.contact = { kind, power, x: this.ball.x, y: this.ball.y, life: 0.24, at: this.time };
    p.armSwing = {
      kind,
      power,
      age: 0,
      hit: true,
      at: this.time,
      x: this.ball.x,
      y: this.ball.y,
      vx: this.ball.vx,
      vy: this.ball.vy,
    };
    p.pose = p.diving ? 'dive' : SHOTS[kind]?.pose || 'block';
    p.animation = 0.24;
  }
  makeContact(p, kind, power, impulse) {
    const team = p.team;
    if (this.lastTouch !== team) this.touches[team] = 0;
    if (this.lastTouch === team && this.lastPlayer === p.id) {
      this.point(1 - team, 'ДВА КАСАНИЯ ОДНОГО ИГРОКА');
      return false;
    }
    this.touches[team]++;
    if (this.touches[team] > 3) {
      this.point(1 - team, 'ЧЕТВЁРТОЕ КАСАНИЕ');
      return false;
    }
    this.lastTouch = team;
    this.lastPlayer = p.id;
    this.contacts++;
    this.cooldown = 0.13;
    this.incomingShot = kind;
    this.shotSerial++;
    Object.assign(this.ball, impulse);
    this.recordContact(p, kind, power);
    const landing = predictAtHeight(this.ball, 0.15, this.config),
      crosses = landing.x * this.sign(team) < 0;
    this.teamPhases[team] = crosses ? 'defense' : 'attack';
    this.teamPhases[1 - team] = 'defense';
    if (kind === 'drive') this.stats.attacks[team]++;
    else this.stats.passes[team]++;
    this.lastAction = `${SHOTS[kind].name} · ${Math.round(power * 100)}%`;
    this.assistLabel = impulse.assisted ? 'Пас слегка скорректирован' : 'Свободная траектория';
    this.label(this.lastAction);
    if (crosses) {
      this.autoSelect(1 - team);
      this.scheduleCPUBlock(1 - team);
    } else {
      const candidates = this.players
        .filter((other) => other.team === team && other.id !== p.id)
        .sort((a, b) => Math.abs(a.x - landing.x) - Math.abs(b.x - landing.x));
      this.autoSelect(team, impulse.targetId ?? candidates[0]?.id);
      this.cpuBlockPlan = null;
    }
    this.emit('hit', {
      kind,
      power,
      team,
      assisted: impulse.assisted,
      x: this.ball.x,
      y: this.ball.y,
      playerId: p.id,
    });
    this.aimPreview = null;
    return true;
  }
  scheduleCPUBlock(team) {
    this.cpuBlockPlan = null;
    if (
      this.isHuman(team) ||
      this.random() > { easy: 0.15, normal: 0.32, hard: 0.52 }[this.config.difficulty]
    )
      return;
    const b = { ...this.ball };
    let crossing = null;
    for (let n = 1; n < 240; n++) {
      const old = b.x;
      integrateBall(b, FIXED_DT, this.config);
      if (old * b.x <= 0) {
        crossing = { t: n * FIXED_DT, y: b.y };
        break;
      }
    }
    const profile = jumpProfile(this.config),
      lead = profile.windup + profile.rise + profile.hang / 2;
    if (crossing && crossing.y > 2.7 && crossing.y < 3.8)
      this.cpuBlockPlan = {
        team,
        at: this.time + Math.max(0.02, crossing.t + 0.045 - lead),
        serial: this.shotSerial,
      };
  }
  updateCPU() {
    if (this.cpuBlockPlan && this.time >= this.cpuBlockPlan.at) {
      const plan = this.cpuBlockPlan;
      this.cpuBlockPlan = null;
      if (plan.serial === this.shotSerial) this.requestBlock(plan.team);
    }
    for (const team of [0, 1]) {
      if (this.isHuman(team) || this.possession !== team) continue;
      const p = this.active(team);
      if (this.touches[team] >= 2 && this.lastTouch === team) {
        const target = predictAtHeight(this.ball, 3, this.config);
        if (
          target.time < 0.33 + this.config.jumpWindup &&
          this.ball.vy < 2 &&
          Math.abs(p.x - target.x) < 0.6
        )
          this.jump(p);
      }
    }
  }
  tryCPUContact(team) {
    if (this.possession !== team) return;
    const p = this.active(team),
      count = this.lastTouch === team ? this.touches[team] : 0,
      kind = count >= 2 ? 'drive' : count === 1 ? 'loft' : 'low';
    if (!this.canContact(p, kind) || this.ball.vy > 0.2 || (count === 0 && this.cpuMiss[team]))
      return;
    const s = this.sign(team);
    let target, seconds, next;
    if (count < 2) {
      next = this.player(team, count === 0 ? 'setter' : 'open');
      if (next.id === p.id)
        next =
          this.players.find(
            (other) => other.team === team && other.id !== p.id && other.role !== 'receiver',
          ) || this.player(team, 'receiver');
      target = { x: next.x, y: count === 0 ? 2.2 : 3, z: 4.5 };
      seconds = 1.25;
    } else {
      const blocker = this.players.some((other) => other.team !== team && other.block > 0);
      target = { x: -s * (4 + this.random() * 4), y: 0.15, z: 4.5 };
      seconds = blocker || this.random() < 0.22 ? 1.7 : 1.15;
    }
    const shot = { ...this.ball };
    launchTo(shot, target, seconds, this.config, count === 2 ? 0.3 : 0);
    this.makeContact(p, kind, 0.55, {
      vx: shot.vx,
      vy: shot.vy,
      vz: 0,
      spin: shot.spin,
      assisted: false,
      targetId: next?.id ?? null,
    });
  }
  tryBlocks() {
    if (this.cooldown > 0 || this.incomingShot === 'serve') return false;
    for (const p of this.players) {
      if (p.team === this.lastTouch || !blockWindow(p, this.config)) continue;
      const handX = p.x - this.sign(p.team) * 0.22,
        handY = p.y + 2.05;
      if (
        Math.abs(this.ball.x - handX) < this.config.blockReach &&
        Math.abs(this.ball.y - handY) < 0.4 &&
        this.ball.y > COURT.netHeight
      ) {
        const attacker = 1 - p.team,
          apex = p.jumpProfile.windup + p.jumpProfile.rise + p.jumpProfile.hang / 2;
        const perfect =
          Math.abs(p.jumpTime - apex) < this.config.blockWindow * 0.19 &&
          Math.abs(this.ball.y - handY) < 0.2;
        p.blockUsed = true;
        this.ball.vx =
          -this.sign(p.team) * Math.max(3, Math.abs(this.ball.vx) * this.config.blockDeflect);
        this.ball.vy = perfect ? -1.4 : 2.4;
        // Opponent contact resets the touch sequence even without a centre crossing.
        this.lastTouch = p.team;
        this.lastPlayer = null;
        this.touches = [0, 0];
        this.cooldown = 0.07;
        this.incomingShot = 'block';
        this.shotSerial++;
        this.teamPhases = ['defense', 'defense'];
        this.stats.blocks[p.team]++;
        if (!perfect) this.stats.softBlocks[p.team]++;
        this.cpuBlockPlan = null;
        this.recordContact(p, 'block', 0.6);
        this.autoSelect(attacker);
        this.label(perfect ? 'ТОЧНЫЙ БЛОК!' : 'СМЯГЧЕНИЕ — розыгрыш продолжается');
        this.emit('block', {
          team: p.team,
          kind: 'block',
          perfect,
          x: this.ball.x,
          y: this.ball.y,
          playerId: p.id,
        });
        return true;
      }
    }
    return false;
  }
  updatePreview() {
    this.aimPreview = null;
    const action = this.charge || this.pending;
    if (!action || !this.config.trajectory) return;
    const p = this.players[action.playerId],
      serving = this.phase === 'serve';
    if (!serving && !this.canContact(p, action.kind)) return;
    const origin = serving
      ? { ...this.ball, ...serveOrigin(p, action.kind, this.config, true) }
      : { ...this.ball };
    this.aimPreview = {
      ...origin,
      ...shotImpulse(
        origin,
        p,
        action.kind,
        action.power,
        action.aim,
        this.players,
        this.config,
        serving,
      ),
      kind: action.kind,
    };
  }
  point(winner, reason) {
    if (this.mode === 'test') {
      this.emit('test-miss');
      this.feedTestBall();
      return;
    }
    if (['point', 'set-end', 'finished'].includes(this.phase)) return;
    this.rallies++;
    const result =
      this.mode === 'practice'
        ? { scored: false, setWon: false, matchWon: false }
        : awardRally(this, winner, this.config);
    this.phase = result.matchWon ? 'finished' : result.setWon ? 'set-end' : 'point';
    this.phaseTime = 0;
    this.pointWinner = winner;
    this.pointReason = reason;
    this.charge = null;
    this.pending = null;
    this.aimPreview = null;
    this.cpuBlockPlan = null;
    for (const p of this.players) {
      const choices = p.team === winner ? WIN_EMOTIONS : LOSE_EMOTIONS;
      p.emotion = {
        kind: choices[Math.floor(this.visualRandom() * choices.length)],
        age: -this.visualRandom() * 0.18,
        duration: 1.95,
      };
      p.vx = 0;
      p.block = 0;
      p.contact = null;
      p.armSwing = null;
      p.animation = 0;
    }
    this.ball.vx = this.ball.vy = this.ball.vz = 0;
    this.contactWindow = false;
    this.label(
      this.mode === 'practice'
        ? 'ПОПРОБУЕМ ЕЩЁ'
        : result.matchWon
          ? 'ОТЛИЧНЫЙ МАТЧ!'
          : result.setWon
            ? 'СЕТ ЗАВЕРШЁН'
            : result.scored
              ? 'ОЧКО!'
              : 'ПЕРЕХОД ПОДАЧИ',
      3,
    );
    this.emit('point', { winner, reason, ...result });
  }
}
