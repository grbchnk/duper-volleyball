import { serveSettings } from './serve-settings.js';
import { serveMotion, sampleServeMotion } from './motion.js';
import { shotSettings } from './shot-settings.js';
import { WIN_EMOTIONS, LOSE_EMOTIONS } from './emotions.js';
import { assistedJump } from './jump-assist.js';
import { diveHands } from './dive-pose.js';
import { cpuSkill, planReception, chooseCPUShot } from './cpu.js';
import { nextReceiver } from './receiver-selection.js';
import { preparedHands, ballTouchesHands } from './held-contact.js';
import { DEFAULTS, COURT, FIXED_DT, sanitizeConfig } from './config.js';
import {
  integrateBall,
  bounceFloor,
  launchTo,
  launchOverNet,
  predictAtHeight,
  collideNet,
  isInside,
  clamp,
  resetFlight,
  traceBall,
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
  back: false,
  crouch: false,
  loft: false,
  drive: false,
  block: false,
  jump: false,
  dive: false,
  switch: false,
  select: 0,
});
const aimOf = (i) => ({
  axis: i.aimNeutral ? 0 : i.axis,
  up: i.up,
  down: i.down,
  vector: i.buttonVector,
});
const updateAim = (action, input, preserveNeutral = false) => {
  const directed =
    input.buttonVector || (!input.aimNeutral && input.axis) || input.up || input.down;
  if (action && (!preserveNeutral || directed)) action.aim = aimOf(input);
};
const grounded = (p) => p.y <= 0 && p.vy <= 0 && p.recovery <= 0 && !p.diving && !p.jumpProfile;
export class Match {
  constructor(config = DEFAULTS, seed = 2026) {
    this.controlTeam = 0;
    this.controls = [{}, {}];
    for (const key of [
      'charge',
      'pending',
      'chargeLock',
      'previousInput',
      'jumpArmed',
      'inputPlayer',
      'aimPreview',
      'contactWindow',
    ])
      Object.defineProperty(this, key, {
        get: () => this.controls[this.controlTeam][key],
        set: (value) => {
          this.controls[this.controlTeam][key] = value;
        },
      });
    this.config = sanitizeConfig(config);
    this.seed = seed;
    this.events = [];
    this.mode = 'match';
    this.reset();
  }
  withControl(team, fn) {
    const previous = this.controlTeam;
    this.controlTeam = team;
    try {
      return fn();
    } finally {
      this.controlTeam = previous;
    }
  }
  actionFor(team) {
    return (
      this.controls[team].charge ||
      this.controls[team].pending ||
      (!this.isHuman(team) &&
      this.phase === 'rally' &&
      this.cpuPlans?.[team]?.serial === this.shotSerial
        ? (this.cpuPlans[team].action ?? null)
        : null)
    );
  }
  clearControls() {
    for (const state of this.controls)
      Object.assign(state, {
        charge: null,
        pending: null,
        chargeLock: false,
        aimPreview: null,
        contactWindow: false,
        previousInput: { ...EMPTY_INPUT },
        jumpArmed: true,
        inputPlayer: -1,
      });
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
    return this.mode === 'versus' || (team === 0 && this.mode !== 'demo');
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
    this.cpuOutForecast = null;
    this.cpuPlans = [null, null];
    this.config = sanitizeConfig(config);
  }
  reset(mode = this.mode) {
    this.testFeeds = 0;
    this.testNext = null;
    this.testReceivedAt = null;
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
    this.jumpArmed = true;
    this.inputPlayer = 0;
    this.label('Матч начинается');
    this.startServe();
    if (mode === 'test') {
      this.players[0].x = -6;
      this.feedTestBall();
    }
  }
  startServe() {
    this.clearControls();
    this.headHitEligible = false;
    this.cpuOutForecast = null;
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
    this.cpuPlans = [null, null];
    this.lastAction = 'Выберите S, A, W или D и зажмите';
    this.assistLabel = 'Помощь только в направлении паса';
    for (const p of this.players)
      Object.assign(p, {
        x: this.sign(p.team) * HOMES[p.id % TEAM_SIZE],
        homeX: this.sign(p.team) * HOMES[p.id % TEAM_SIZE],
        returnHome: false,
        returnDelay: 0,
        releaseSlow: 0,
        stunned: 0,
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
        jumpAssist: null,
        jumpHold: false,

        crouchAmount: 0,
        cpuReceive: null,
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
    const number = (this.testFeeds || 0) + 1;
    const ready = this.testNext || this.prepareTestServer(number);
    const server = this.players[ready.playerId];
    server.x = ready.x;
    server.facing = -1;
    server.armSwing = { kind: ready.kind, power: ready.power, age: 0, hit: true, serve: true };
    this.headHitEligible = false;
    this.cpuOutForecast = null;
    this.phase = 'rally';
    this.testBallAge = 0;
    this.phaseTime = 0;
    this.pointReason = '';
    this.contactWindow = false;
    this.testFeeds = (this.testFeeds || 0) + 1;
    this.lastTouch = 1;
    this.lastPlayer = server.id;
    this.touches = [0, 0];
    this.cooldown = 0;
    this.teamPhases = ['defense', 'defense'];
    this.incomingShot = ready.kind;
    this.charge = null;
    this.pending = null;
    this.aimPreview = null;
    this.cpuBlockPlan = null;
    this.trail = [];
    this.ball = {
      ...serveOrigin(server, ready.kind, this.config, true),
      z: 4.5,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      angle: 0,
    };
    const offset = [-1.2, 0.65, -0.4, 1.4, 0, -0.8][(number - 1) % 6];
    this.testTarget = clamp(this.active().x + offset, -8.3, -1.3);
    launchOverNet(
      this.ball,
      { x: this.testTarget, y: 0.15, z: 4.5 },
      { low: 1.8, back: 2.25, loft: 2, drive: 1.55 }[ready.kind] / this.config.ballSpeed,
      this.config,
    );
    this.testReceivedAt = null;
    this.testNext = this.prepareTestServer(number + 1);
    this.emit('feed');
    this.label('ТЕСТ · мяч ' + this.testFeeds, 0.8);
  }
  prepareTestServer(number) {
    return {
      playerId: 3 + ((number - 1) % 3),
      kind: ['low', 'loft', 'back', 'drive'][(number - 1) % 4],
      x: [8.4, 6.7, 9.3, 7.5][(number - 1) % 4],
      power: [0.4, 0.65, 0.3, 0.85][(number - 1) % 4],
    };
  }
  tick(dt = FIXED_DT, raw = {}, second = {}) {
    this.inputs = [
      { ...EMPTY_INPUT, ...raw },
      { ...EMPTY_INPUT, ...second },
    ];
    try {
      this.step(dt, raw);
    } finally {
      this.controls.forEach((state, team) => {
        state.previousInput = this.inputs[team];
      });
    }
  }
  handleControl(dt, input, team) {
    const press = (key) => input[key] && !this.previousInput[key];
    updateAim(this.pending, input, true);
    const jumpHeld = input.jumpHeld ?? input.jump;
    if (!jumpHeld) this.jumpArmed = true;
    else if (
      (this.inputPlayer !== this.selected[team] &&
        (this.previousInput.jumpHeld ?? this.previousInput.jump)) ||
      this.charge ||
      this.pending ||
      Object.keys(SHOTS).some((kind) => input[kind])
    )
      this.jumpArmed = false;
    this.inputPlayer = this.selected[team];

    if (press('switch') && this.phase === 'rally' && !this.charge && !this.pending)
      this.switchPlayer();
    if (
      input.select &&
      input.select !== this.previousInput.select &&
      this.phase === 'rally' &&
      !this.charge &&
      !this.pending &&
      this.players[team * TEAM_SIZE + input.select - 1]?.recovery <= 0
    )
      this.selected[team] = team * TEAM_SIZE + input.select - 1;
    if (
      press('block') &&
      !input.low &&
      !input.back &&
      !input.loft &&
      !input.drive &&
      this.phase === 'rally' &&
      this.teamPhases[team] === 'defense'
    )
      this.requestBlock(team);
    if (this.inputPlayer !== this.selected[team] && jumpHeld) this.jumpArmed = false;
    if (press('jump') && this.jumpArmed && this.phase === 'rally')
      this.humanJump(this.active(team));
    if (press('dive') && this.phase === 'rally')
      this.dive(this.active(team), input.diveAxis || input.axis);
    this.updateCharge(dt, input, press);
  }
  step(dt, raw) {
    const input = { ...EMPTY_INPUT, ...raw },
      press = (key) => input[key] && !this.previousInput[key];
    if (this.phase === 'finished') {
      this.time += dt;
      this.stepDeadBall(dt);
      this.animatePlayers(dt);
      this.returnPlayers(dt);
      this.previousInput = input;
      return;
    }
    this.time += dt;
    this.phaseTime += dt;
    updateAim(this.pending, input, true);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    this.contactWindow = false;
    for (const p of this.players) {
      const crouching =
        this.phase === 'rally' &&
        this.isHuman(p.team) &&
        p.id === this.selected[p.team] &&
        this.inputs[p.team].crouch &&
        grounded(p);
      p.crouchAmount = clamp((p.crouchAmount || 0) + ((crouching ? 1 : -1) * dt) / 0.14, 0, 1);
    }
    for (const p of this.players) {
      if (!p.jumpHold || !p.jumpProfile || this.inputs[p.team].jump) continue;
      const j = p.jumpProfile,
        air = Math.max(0, p.jumpTime - j.windup);
      if (air < j.rise) {
        const original = j.height;
        j.height = Math.max(p.y, original * 0.35);
        const progress = 1 - Math.sqrt(Math.max(0, 1 - p.y / j.height));
        j.rise = progress > 0 ? air / progress : j.rise * Math.sqrt(0.35);
        j.fall *= Math.sqrt(j.height / original);
      }
      p.jumpHold = false;
    }
    this.animatePlayers(dt);
    if (['point', 'set-end'].includes(this.phase)) {
      this.stepDeadBall(dt);
      if (this.mode === 'test') {
        this.feedTestBall();
        this.previousInput = input;
        return;
      }
      const returned = this.returnPlayers(dt);
      if (this.phaseTime > 2.3 && returned) {
        if (this.phase === 'set-end') this.score = [0, 0];
        if (this.mode === 'practice') this.startDrill(this.drill);
        else this.startServe();
      }
      this.previousInput = input;
      return;
    }
    for (const team of [0, 1])
      if (this.isHuman(team))
        this.withControl(team, () => this.handleControl(dt, this.inputs[team], team));
    if (this.phase === 'serve') {
      if (!this.isHuman(this.server) && this.phaseTime > 1.3)
        this.beginServe({
          kind: ['low', 'loft', 'drive'][Math.floor(this.random() * 3)],
          power: 0.54,
          aim: { axis: -this.sign(this.server), up: false, down: false },
        });
      this.withControl(this.server, () => this.updatePreview());
      this.previousInput = input;
      return;
    }
    if (this.phase === 'serve-motion') {
      const p = this.active(this.server),
        a = this.serveAction,
        t = this.phaseTime;
      Object.assign(this.ball, sampleServeMotion(p, a, t));
      this.contactWindow = !a.attempted && Math.abs(t - a.ideal) <= a.settings.PerfectWindow;
      if (this.ball.y <= COURT.ballRadius) this.point(1 - this.server, 'ПОДАЧА: МЯЧ НЕ УДАРЕН');
      else if (
        !a.attempted &&
        ((this.isHuman(this.server) &&
          Object.keys(SHOTS).some(
            (key) =>
              this.inputs[this.server][key] && !this.controls[this.server].previousInput[key],
          )) ||
          (!this.isHuman(this.server) && t >= a.ideal))
      ) {
        a.attempted = true;
        if (this.config.rightStickAim && this.inputs[this.server].stickShot)
          updateAim(a, this.inputs[this.server], true);
        a.perfect = this.contactWindow;
        const origin = serveOrigin(p, a.kind, this.config);
        const distance = Math.hypot(this.ball.x - origin.x, this.ball.y - origin.y);
        if (Math.abs(t - a.ideal) <= a.settings.HitWindow && distance <= a.settings.ContactReach) {
          a.quality = a.perfect ? 1 : a.settings.MistimePower;
          this.executeServe();
        } else {
          p.armSwing = {
            kind: a.kind,
            power: a.power,
            age: 0,
            hit: false,
            serve: true,
            hand: a.hand,
          };
          this.label('МИМО · удар слишком рано или поздно');
        }
        this.controls[this.server].chargeLock = true;
      }
      this.previousInput = input;
      return;
    }
    if (this.mode === 'test') {
      this.testBallAge += dt;
      if (this.lastTouch === 0) this.testReceivedAt ??= this.time;
      if (
        this.testBallAge > 8 ||
        (this.testReceivedAt !== null && this.time - this.testReceivedAt > 0.4)
      )
        this.feedTestBall();
    }
    const previous = { ...this.ball };
    integrateBall(this.ball, dt, this.config);
    if (collideNet(this.ball, previous, this.config.restitution, this.config)) {
      this.cpuOutForecast = null;
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
    for (const team of [0, 1]) {
      if (!this.isHuman(team) || this.mode === 'test') continue;
      const next = nextReceiver(this, team);
      if (next === null || next === this.selected[team]) continue;
      const old = this.active(team);
      this.selected[team] = next;
      this.players[next].returnHome = false;
      this.players[next].clearLane = null;
      for (const key of ['charge', 'pending']) {
        const action = this.controls[team][key];
        if (action?.playerId === old.id) action.playerId = next;
      }
    }
    if (this.mode !== 'test') this.updateCPU();
    this.movePlayers(dt, input);
    this.tryBlocks();
    for (const team of [0, 1])
      if (this.isHuman(team))
        this.withControl(team, () => {
          if (this.pending && this.cooldown <= 0) this.tryPending(previous);
          this.tryHeldContact(previous);
        });
    this.tryDiveContacts();
    this.tryHeadHit(previous);
    for (const team of [0, 1])
      if (this.mode !== 'test' && !this.isHuman(team) && this.cooldown <= 0)
        this.tryCPUContact(team, previous);
    for (const team of [0, 1])
      if (this.isHuman(team))
        this.withControl(team, () => {
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
            : Object.keys(SHOTS).some((k) => this.canContact(this.active(team), k));
          this.updatePreview();
        });
    this.previousInput = input;
  }
  updateCharge(dt, input, press) {
    if (this.phase === 'serve' && this.server !== this.controlTeam) return;
    if (!['serve', 'rally'].includes(this.phase)) return;
    if (!Object.keys(SHOTS).some((kind) => input[kind])) this.chargeLock = false;
    const replaceable = this.pending || this.charge;
    const replacement =
      replaceable && Object.keys(SHOTS).find((kind) => kind !== replaceable.kind && press(kind));
    if (replacement) {
      const p = this.players[replaceable.playerId];
      if (!p.diving && p.recovery <= 0 && p.block <= 0 && p.swingCooldown <= 0) {
        // A fresh different key replaces an unconsumed attempt before it can hit.
        this.pending = null;
        this.chargeLock = false;
        this.charge = {
          kind: replacement,
          power: 0.08,
          age: 0,
          aim: aimOf(input),
          stickControlled: !!input.stickShot,
          playerId: p.id,
        };
        p.armSwing = null;
        p.pose = 'ready-' + SHOTS[replacement].pose;
        p.animation = 0.08;
        return;
      }
    }
    if (this.charge) {
      const a = this.charge,
        p = this.players[a.playerId];
      if (input[a.kind]) {
        a.stickControlled = input.stickShot === a.kind;
        updateAim(a, input, true);
      }
      a.age = (a.age || 0) + dt;
      if (input[a.kind]) {
        const strength = input.stickShot === a.kind ? clamp(input.stickStrength, 0.08, 1) : 1;
        // Returning an analog stick to centre must not erase accumulated power.
        a.power = Math.max(
          a.power,
          clamp(
            a.power +
              (dt * strength) /
                (this.phase === 'serve'
                  ? serveSettings(this.config, a.kind).ChargeSeconds
                  : this.config.chargeSeconds),
            0.08,
            strength,
          ),
        );
      }
      const autoRelease = a.power >= 1 || (this.phase !== 'serve' && a.age >= this.config.maxHold);
      if (!input[a.kind] || autoRelease) {
        this.charge = null;
        p.releaseSlow = a.kind === 'back' ? 0 : this.config.releaseWindow;
        if (autoRelease) this.chargeLock = true;
        if (this.phase !== 'serve')
          p.armSwing = { kind: a.kind, power: a.power, age: 0, hit: false, aim: a.aim };
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
        p = this.active(this.controlTeam);
      if (kind && !p.diving && p.recovery <= 0 && p.swingCooldown <= 0 && p.block <= 0)
        this.charge = {
          kind,
          power: 0.08,
          age: 0,
          aim: aimOf(input),
          stickControlled: !!input.stickShot,
          playerId: p.id,
        };
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
  chooseServeInput(p, original) {
    const a = { ...original };
    const ball = { ...this.ball, ...serveOrigin(p, a.kind, this.config, true) };
    // AI chooses an input within the configured profile, never a replacement trajectory.
    const settings = serveSettings(this.config, a.kind);
    const angles = settings.Targeted ? [null] : [null, 25, 35, 45, 55, 65, 15, 75];
    let found = false;
    for (const power of [a.power, 0.3, 0.45, 0.65, 0.8, 1]) {
      for (const angle of angles) {
        const aim =
          angle === null
            ? {}
            : {
                vector: {
                  x: -this.sign(this.server) * Math.cos((angle * Math.PI) / 180),
                  y: Math.sin((angle * Math.PI) / 180),
                },
              };
        const impulse = shotImpulse(ball, p, a.kind, power, aim, this.players, this.config, true);
        const path = traceBall({ ...ball, ...impulse }, this.config, 12);
        const end = path.at(-1);
        if (
          !path.some((point) => point.netImpact !== ball.netImpact) &&
          end.y <= COURT.ballRadius + 0.001 &&
          end.x * this.sign(this.server) < -1 &&
          Math.abs(end.x) < 8.7
        ) {
          a.power = power;
          a.aim = aim;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    return a;
  }
  beginServe(action) {
    const p = this.active(this.server);
    if (!this.isHuman(this.server)) action = this.chooseServeInput(p, action);
    this.serveAction = {
      ...serveMotion(p, action, this.config),
      hand: this.visualRandom() < 0.5 ? 0 : 1,
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
    if (drill === 'combination') {
      this.selected[0] = 1;
      this.lastTouch = 0;
      this.lastPlayer = 0;
      this.touches[0] = 1;
      this.teamPhases[0] = 'attack';
      this.players[2].x = -2.5;
      Object.assign(this.ball, { x: -3.7, y: 4.5, vx: 0, vy: 0 });
    } else if (drill === 'set') {
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
      launchTo(this.ball, { x: -5, y: 0.2, z: 4.5 }, 1.15 / this.config.ballSpeed, this.config);
      this.incomingShot = 'drive';
      this.selected[0] = 2;
    } else {
      Object.assign(this.ball, { x: 5, y: 5 });
      launchTo(this.ball, { x: -7, y: 0.9, z: 4.5 }, 2.1 / this.config.ballSpeed, this.config);
      this.incomingShot = 'serve';
    }
    this.label(
      drill === 'dive-forward'
        ? 'E / R3 вправо: бросок с приёмом'
        : drill === 'dive-back'
          ? 'Q / R3 влево: бросок с приёмом'
          : drill === 'combination'
            ? 'W: пас → ↑ / Space: прыжок → A / W / D: касание'
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
    this.ball.vx *= a.quality ?? 1;
    this.ball.vy *= a.quality ?? 1;
    resetFlight(this.ball);
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
    const current = this.selected[this.controlTeam];
    for (let i = 1; i <= TEAM_SIZE; i++) {
      const next = this.controlTeam * TEAM_SIZE + ((current + i) % TEAM_SIZE);
      if (this.players[next].recovery <= 0 && !this.players[next].diving) {
        this.selected[this.controlTeam] = next;
        return;
      }
    }
  }
  autoSelect(team, preferred = null) {
    if (this.mode === 'test') return;
    if (this.isHuman(team) && this.actionFor(team)) return;
    if (
      preferred !== null &&
      this.players[preferred].team === team &&
      this.players[preferred].recovery <= 0 &&
      !this.players[preferred].diving
    ) {
      this.selected[team] = preferred;
      this.players[preferred].returnHome = false;
      return;
    }
    const target = predictAtHeight(this.ball, 1.45, this.config),
      players = this.players.filter((p) => p.team === team && p.recovery <= 0 && !p.diving);
    if (!players.length) return;
    players.sort(
      (a, b) =>
        Math.abs(a.x - target.x) +
        a.recovery * 4 +
        a.y -
        (Math.abs(b.x - target.x) + b.recovery * 4 + b.y),
    );
    this.selected[team] = players[0].id;
    players[0].returnHome = false;
  }
  humanJump(p) {
    const adjustment = this.config.assist ? assistedJump(this.ball, p, this.config) : null;
    if (!this.jump(p)) return false;
    p.returnHome = false;
    if (adjustment) p.jumpProfile = adjustment.profile;
    p.jumpHold = this.config.variableJump;
    this.emit('jump', { team: p.team, playerId: p.id });
    return true;
  }
  jump(p, block = false) {
    if (!grounded(p)) return false;
    p.jumpProfile = jumpProfile(this.config);
    p.jumpAssist = null;
    p.jumpHold = false;
    p.jumpTime = 0;
    p.ballHangUsed = false;

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
    const intercept = predictAtHeight(this.ball, 0.7, this.config, 0.6);
    if (this.config.assist && (intercept.x - p.x) * direction > 0) {
      const wanted = (intercept.x - p.x - direction * 1.6) / Math.max(0.15, intercept.time);
      p.diveVelocity =
        direction *
        clamp(Math.abs(wanted), this.config.diveSpeed * 0.75, this.config.diveSpeed * 1.2);
    }
    p.vx = p.diveVelocity;
    p.facing = direction;
    p.pose = 'dive';
    p.animation = 0.5;
    if (this.isHuman(p.team) && this.selected[p.team] === p.id)
      this.withControl(p.team, () => this.switchPlayer());
    else if (!this.isHuman(p.team)) this.autoSelect(p.team);
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
  tryHeadHit(previous) {
    if (!this.headHitEligible || this.incomingShot !== 'drive' || this.ball.vy > -4) return false;
    for (const p of this.players) {
      if (p.team === this.lastTouch || p.recovery > 0 || p.diving || p.block > 0) continue;
      const top = p.y + 2.1 + COURT.ballRadius;
      if (previous.y < top || this.ball.y > top) continue;
      const t = (previous.y - top) / Math.max(0.0001, previous.y - this.ball.y);
      const x = previous.x + (this.ball.x - previous.x) * t;
      if (Math.abs(x - p.x) > 0.28) continue;
      this.headHitEligible = false;
      p.jumpProfile = p.jumpAssist = null;
      p.jumpHold = false;
      p.vy = Math.min(0, p.vy);
      p.vx = 0;
      p.stunned = p.recovery = p.recoveryTotal = 5.35;
      p.pose = 'belly';
      p.animation = 0;
      p.armSwing = p.contact = p.clearLane = null;
      p.returnHome = false;
      const state = this.controls[p.team];
      for (const key of ['charge', 'pending']) if (state[key]?.playerId === p.id) state[key] = null;
      Object.assign(this.ball, {
        x,
        y: top,
        vx: this.ball.vx * 0.35,
        vy: Math.abs(this.ball.vy) * 0.25,
      });
      resetFlight(this.ball);
      this.lastTouch = p.team;
      this.lastPlayer = p.id;
      this.touches = [0, 0];
      this.touches[p.team] = 1;
      this.cooldown = 0.13;
      this.incomingShot = 'head';
      this.shotSerial++;
      this.autoSelect(p.team);
      this.emit('head-hit', { playerId: p.id, team: p.team, x, y: top });
      this.label('УДАР В ГОЛОВУ · игрок оглушён');
      return true;
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
      p.stunned = Math.max(0, (p.stunned || 0) - dt);
      p.releaseSlow = Math.max(0, (p.releaseSlow || 0) - dt);
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
        const j = p.jumpProfile;
        if (
          !p.ballHangUsed &&
          p.jumpTime >= j.windup + j.rise &&
          p.jumpTime <= j.windup + j.rise + j.hang &&
          this.actionFor(p.team)?.playerId === p.id &&
          Math.abs(this.ball.x - p.x) < 1.3 &&
          Math.abs(this.ball.y - p.y - 2.1) < 1
        ) {
          j.hang += this.config.jumpBallHang;
          p.ballHangUsed = true;
        }
        p.jumpTime += dt;
        if (p.jumpAssist) {
          const progress = clamp((p.jumpTime - p.jumpProfile.windup) / p.jumpProfile.rise, 0, 1);
          p.x = p.jumpAssist.fromX + (p.jumpAssist.targetX - p.jumpAssist.fromX) * progress;
        }
        Object.assign(p, sampleJump(p.jumpProfile, p.jumpTime));
        if (p.jumpTime >= jumpDuration(p.jumpProfile)) {
          p.jumpProfile = null;
          p.jumpAssist = null;
          p.jumpHold = false;

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
      p.x = clamp(p.x, p.team === 0 ? -10.5 : 0.65, p.team === 0 ? -0.65 : 10.5);
    }
  }
  returnPlayers(dt) {
    let returned = true;
    for (const p of this.players) {
      p.clearLane = null;
      const target =
        this.sign(p.team) * (p.id === this.server * TEAM_SIZE ? 9.4 : HOMES[p.id % TEAM_SIZE]);
      if (!grounded(p) || (p.emotion && p.emotion.age < 0.75)) {
        returned = false;
        continue;
      }
      p.emotion = null;
      const delta = clamp(
        target - p.x,
        -this.config.playerSpeed * dt,
        this.config.playerSpeed * dt,
      );
      p.x += delta;
      p.vx = delta / dt;
      p.pose = delta ? 'run' : 'idle';
      p.runTime = delta ? p.runTime + dt : 0;
      p.facing = delta ? Math.sign(delta) : -this.sign(p.team);
      if (Math.abs(target - p.x) > 0.001) returned = false;
    }
    return returned;
  }
  clearPasser(p) {
    p.clearedSerial = this.shotSerial;
    p.returnHome = false;
    p.clearLane = null;
    if (p.id === this.selected[p.team] || this.mode === 'test') return;
    const landing = predictAtHeight(this.ball, 1.5, this.config);
    const teammates = this.players.filter((other) => other.team === p.team && other.id !== p.id);
    const min = p.team === 0 ? -8.5 : 0.5,
      max = p.team === 0 ? -0.5 : 8.5;
    const clearance = (x) => Math.min(Math.abs(x - this.ball.x), Math.abs(x - landing.x));
    const options = [-1.6, 1.6, -0.8, 0.8]
      .map((step) => clamp(p.x + step, min, max))
      .filter(
        (x) =>
          Math.abs(x - p.x) >= 0.5 &&
          teammates.every(
            (other) => Math.abs(x - other.x) >= 0.8 && !((other.x - p.x) * (other.x - x) < 0),
          ),
      )
      .map((x) => ({
        x,
        score:
          clearance(x) + Math.min(2, ...teammates.map((other) => Math.abs(x - other.x))) * 0.25,
      }))
      .sort((a, b) => b.score - a.score);
    const target = options[0];
    if (!target || clearance(target.x) <= clearance(p.x) + 0.2) return;
    p.returnDelay = 0.12;
    p.clearLane = { targetX: target.x, serial: this.shotSerial, until: this.time + 2.5 };
    // Clearing is temporary: retain the formation position for the return.
  }
  returnTarget(p) {
    let target = p.homeX;
    // Pause before a teammate instead of crossing their reception lane. Re-evaluate
    // every frame so a blocked return resumes as soon as the space opens.
    const direction = Math.sign(target - p.x);
    for (const other of this.players) {
      if (other.team !== p.team || other.id === p.id) continue;
      const gap = other.id === this.selected[p.team] ? 1.25 : 0.85;
      if ((other.x - p.x) * direction > 0 && (target - other.x) * direction > -gap)
        target = p.x + direction * Math.max(0, Math.abs(other.x - p.x) - gap);
    }
    return target;
  }
  movePlayers(dt, raw) {
    if (this.phase === 'rally' && this.mode !== 'test') {
      for (const team of [0, 1]) {
        const players = this.players
          .filter((p) => p.team === team)
          .sort((a, b) => a.x - b.x || a.id - b.id);
        const slots = HOMES.map((x) => x * this.sign(team)).sort((a, b) => a - b);
        const active = this.active(team);
        const reserved = slots.reduce((best, x) =>
          Math.abs(x - active.x) < Math.abs(best - active.x) ? x : best,
        );
        active.homeX = reserved;
        const free = slots.filter((x) => x !== reserved);
        players
          .filter((p) => p.id !== active.id)
          .forEach((p, i) => {
            p.homeX = free[i];
          });
        for (const p of players) p.role = ROLES[HOMES.indexOf(Math.abs(p.homeX))];
      }
    }
    for (const p of this.players)
      this.withControl(p.team, () => {
        const input = this.inputs?.[p.team] || (p.team === 0 ? raw : EMPTY_INPUT);
        const controlled = this.isHuman(p.team) && p.id === this.selected[p.team];
        if (controlled) {
          // Releasing the stick never hands this player back to positional AI.
          p.returnHome = false;
          p.clearLane = null;
        } else if (
          this.isHuman(p.team) &&
          this.phase === 'rally' &&
          this.lastPlayer === p.id &&
          p.clearedSerial !== this.shotSerial
        ) {
          this.clearPasser(p);
        }
        p.returnDelay = Math.max(0, (p.returnDelay || 0) - dt);
        if (
          !controlled &&
          this.isHuman(p.team) &&
          this.phase === 'rally' &&
          this.mode !== 'test' &&
          !p.clearLane &&
          Math.abs(p.x - p.homeX) > 0.01
        )
          p.returnHome = true;
        if (!grounded(p)) {
          if (
            this.phase === 'rally' &&
            p.jumpProfile &&
            p.block <= 0 &&
            p.jumpTime >= p.jumpProfile.windup &&
            this.isHuman(p.team) &&
            p.id === this.selected[p.team]
          ) {
            const old = p.x;
            p.x = clamp(
              p.x + (input.axis || 0) * this.config.airMoveSpeed * dt,
              p.team === 0 ? -10.5 : 0.65,
              p.team === 0 ? -0.65 : 10.5,
            );
            p.vx = (p.x - old) / dt;
            if (input.axis) {
              p.returnHome = false;
              p.clearLane = null;
            }
          } else if (!p.diving) p.vx = 0;
          return;
        }
        const old = p.x;
        if (p.clearLane) {
          const manual = controlled;
          if (manual || this.shotSerial !== p.clearLane.serial || this.time >= p.clearLane.until) {
            p.clearLane = null;
            p.returnHome = !manual;
          } else if (p.returnDelay <= 0) {
            p.x += clamp(
              p.clearLane.targetX - p.x,
              -this.config.playerSpeed * dt,
              this.config.playerSpeed * dt,
            );
            p.vx = (p.x - old) / dt;
            p.runTime = Math.abs(p.vx) > 0.1 ? p.runTime + dt : 0;
            p.facing = -this.sign(p.team);
            return;
          } else {
            p.vx = 0;
            return;
          }
        }
        if (this.isHuman(p.team)) {
          if (
            p.id === this.selected[p.team] &&
            (input.axis || input.crouch || this.charge || this.pending)
          )
            p.returnHome = false;
          if (p.returnHome) {
            if (p.returnDelay <= 0)
              p.x += clamp(
                this.returnTarget(p) - p.x,
                -this.config.playerSpeed * dt,
                this.config.playerSpeed * dt,
              );
            p.facing = -this.sign(p.team);
            if (Math.abs(p.x - p.homeX) < 0.001) p.returnHome = false;
          } else if (p.id === this.selected[p.team]) {
            p.x +=
              (input.axis || 0) *
              this.config.playerSpeed *
              dt *
              (this.charge?.playerId === p.id
                ? this.charge.kind === 'back'
                  ? 1
                  : this.config.chargeMove
                : 1 -
                  (1 - this.config.chargeMove) *
                    clamp(p.releaseSlow / Math.max(this.config.releaseWindow, 0.001), 0, 1)) *
              (1 - (p.crouchAmount || 0) * 0.65);
            if (
              input.axis &&
              Math.sign(input.axis) === Math.sign(this.ball.x - p.x) &&
              Math.abs(this.ball.x - p.x) > 0.35
            )
              p.facing = Math.sign(input.axis);
          }
        } else {
          let target = this.returnTarget(p);
          if (this.mode === 'test')
            target = p.id === this.testNext?.playerId ? this.testNext.x : 2 + (p.id - 3) * 1.6;
          if (p.role === 'open' && this.cpuBlockPlan?.team === p.team)
            target = this.sign(p.team) * 0.55;
          if (
            this.active(p.team).id === p.id &&
            !this.cpuLeavesOut(p.team) &&
            (this.possession === p.team || this.lastTouch !== p.team)
          ) {
            const plan = this.cpuPlans[p.team];
            if (plan?.playerId === p.id) target = this.time >= plan.reactionAt ? plan.targetX : p.x;
          }
          if (!p.returnHome || p.returnDelay <= 0 || this.active(p.team).id === p.id)
            p.x += clamp(
              target - p.x,
              -this.config.playerSpeed * cpuSkill(this.config).speed * dt,
              this.config.playerSpeed * cpuSkill(this.config).speed * dt,
            );
        }
        p.x = clamp(p.x, p.team === 0 ? -10.5 : 0.65, p.team === 0 ? -0.65 : 10.5);
        if (!controlled && p.id !== this.selected[p.team] && this.mode !== 'test') {
          const other = this.players
            .filter((q) => q.team === p.team && q.id !== p.id)
            .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
          if (other && Math.abs(other.x - p.x) < 1.15) {
            const away = Math.sign(p.x - other.x) || Math.sign(p.homeX - other.homeX) || 1;
            p.x = clamp(
              old +
                clamp(
                  other.x + away * 1.15 - old,
                  -this.config.playerSpeed * dt,
                  this.config.playerSpeed * dt,
                ),
              p.team === 0 ? -10.5 : 0.65,
              p.team === 0 ? -0.65 : 10.5,
            );
          }
        }
        p.vx = (p.x - old) / dt;
        if (Math.abs(p.vx) > 0.1) p.runTime += dt;
        else p.runTime = 0;
      });
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
    const settings = shotSettings(this.config, kind);
    const shot = { min: settings.ContactMin, max: settings.ContactMax, reach: settings.Reach };
    const crouchOffset = grounded(p) ? (p.crouchAmount || 0) * 0.4 : 0;
    let min = Math.max(0.12, shot.min + p.y - crouchOffset),
      max = shot.max + p.y - crouchOffset,
      reach = shot.reach;
    if (p.diving) {
      if (kind !== 'low') return false;
      const hands = diveHands(p, this.ball, this.config);
      return (
        this.ball.y >= 0.12 &&
        Math.hypot(this.ball.x - hands.x, this.ball.y - hands.y) <= COURT.ballRadius + 0.25
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
    p.releaseSlow = a.kind === 'back' ? 0 : this.config.releaseWindow;
    return this.makeContact(
      p,
      a.kind,
      a.power,
      shotImpulse(this.ball, p, a.kind, a.power, a.aim, this.players, this.config),
    );
  }
  tryPending(previous = this.ball) {
    const a = this.pending,
      p = this.players[a.playerId];
    if (!this.canContact(p, a.kind)) return false;
    if (
      a.kind === 'back' &&
      !ballTouchesHands(
        this.ball,
        previous,
        preparedHands(p, this, { ...a, age: Math.max(a.age || 0, this.config.armWindup) }),
        COURT.ballRadius + 0.13 * this.config.armScale,
      )
    )
      return false;
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
      hand: kind === 'back' ? ((this.ball.x - p.x) * (p.facing || 1) < 0 ? 0 : 1) : undefined,
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
    if (this.controlTeam !== p.team)
      return this.withControl(p.team, () => this.makeContact(p, kind, power, impulse));
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
    this.headHitEligible = kind === 'drive' && power >= 0.8 && p.y > 0.4;
    this.shotSerial++;
    Object.assign(this.ball, impulse);
    resetFlight(this.ball);
    this.recordContact(p, kind, power);
    if (kind !== 'drive' && this.mode !== 'test' && !this.isHuman(team)) {
      // Pick once per pass, not every frame, so returning players settle naturally.
      const teammates = this.players.filter((other) => other.team === team && other.id !== p.id);
      const base = HOMES[p.id % TEAM_SIZE];
      const spots = [base + (this.random() - 0.5) * 0.6, 1.2, 3, 4.8, 6.6, 8.2];
      const space = (x) =>
        Math.min(...teammates.map((other) => Math.abs(this.sign(team) * x - other.x))) -
        Math.abs(x - base) * 0.18;
      spots.sort((a, b) => space(b) - space(a));
      p.homeX = this.sign(team) * Math.max(0.65, spots[0]);
      p.returnDelay = 0.35 + this.random() * 0.85;
      p.returnHome = true;
    }
    if (
      !this.isHuman(team) &&
      kind !== 'drive' &&
      this.ball.vy > 1 &&
      Math.abs(p.x) < 2.6 &&
      this.players
        .filter((other) => other.team === team)
        .every((other) => Math.abs(other.x) >= Math.abs(p.x))
    ) {
      const overhead = predictAtHeight(this.ball, p.y + 2.1, this.config);
      if (Math.abs(overhead.x - p.x) < 1 && overhead.time > 0.35) {
        p.clearLane = {
          targetX: this.sign(team) * Math.min(8.5, Math.abs(p.x) + 1.6),
          serial: this.shotSerial,
          until: this.time + clamp(overhead.time + 0.3, 0.7, 3),
        };
      }
    }
    const landing = predictAtHeight(this.ball, 0.15, this.config),
      crosses = impulse.targetId == null && landing.x * this.sign(team) < 0;
    this.teamPhases[team] = crosses ? 'defense' : 'attack';
    this.teamPhases[1 - team] = 'defense';
    if (kind === 'drive') this.stats.attacks[team]++;
    else this.stats.passes[team]++;
    this.lastAction = `${SHOTS[kind].name} · ${Math.round(power * 100)}%`;
    this.assistLabel = impulse.assisted
      ? kind === 'drive'
        ? 'Удар скорректирован над сеткой'
        : 'Пас направлен партнёру'
      : 'Свободная траектория';
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
    if (this.isHuman(team) && p.id !== this.selected[team]) this.clearPasser(p);
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
    if (this.isHuman(team) || this.random() > cpuSkill(this.config).block) return;
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
      // A serve belongs to the opponent until a net rebound returns it.
      if (
        this.incomingShot === 'serve' &&
        this.lastTouch === team &&
        this.ball.vx * this.sign(team) < 0
      ) {
        this.cpuPlans[team] = null;
        continue;
      }
      if (this.isHuman(team) || this.cpuLeavesOut(team)) continue;
      const skill = cpuSkill(this.config);
      let plan = this.cpuPlans[team];
      if (
        !plan ||
        plan.serial !== this.shotSerial ||
        this.time - plan.at >= skill.refresh ||
        this.players[plan.playerId].recovery > 0 ||
        this.players[plan.playerId].diving
      ) {
        const previous = plan;
        plan = this.cpuPlans[team] = planReception(this, team, plan);
        if (plan && previous?.serial === plan.serial && previous.playerId === plan.playerId) {
          plan.preparation = previous.preparation;
          plan.action = previous.action;
          plan.proposal = previous.proposal;
        }
      }
      if (!plan) continue;
      this.selected[team] = plan.playerId;
      const p = this.active(team);
      p.returnHome = false;
      p.clearLane = null;
      if (this.time < plan.reactionAt) continue;
      const lead = jumpProfile(this.config);
      if (
        plan.jump &&
        plan.contactAt - this.time <= lead.windup + lead.rise + lead.hang / 2 &&
        Math.abs(p.x - plan.targetX) < 0.8
      )
        this.jump(p);
      const dx = this.ball.x - p.x;
      if (
        plan.allowDive &&
        grounded(p) &&
        this.ball.y < 1.05 &&
        this.ball.vy < -0.5 &&
        Math.abs(dx) > 1.3 &&
        Math.abs(dx) < 2.3 &&
        (this.ball.x < 0 ? 0 : 1) === team &&
        !(this.lastTouch === team && this.lastPlayer === p.id)
      ) {
        this.dive(p, Math.sign(dx));
        continue;
      }
      const kind =
        dx * (p.facing || -this.sign(team)) < -0.25 && this.ball.y - p.y < 1.8
          ? 'back'
          : plan.count >= 2 && (p.y > 0.2 || plan.height > 1.6)
            ? 'drive'
            : plan.height > 1.5
              ? 'loft'
              : 'low';
      if (!plan.preparation) {
        if (plan.contactAt - this.time > this.config.chargeSeconds) {
          plan.action = null;
          continue;
        }
        const future = Object.create(this);
        future.ball = { ...this.ball, x: plan.targetX, y: plan.height };
        future.cpuPlans = [null, null];
        const shot = (plan.proposal ||= chooseCPUShot(future, { ...p, x: plan.targetX }, [kind]));
        const duration = Math.max(
          this.config.armWindup,
          (shot.power - 0.08) * this.config.chargeSeconds,
        );
        if (plan.contactAt - this.time > duration) {
          plan.action = null;
          continue;
        }
        plan.preparation = { kind: shot.kind, power: shot.power, start: this.time };
      }
      const prep = plan.preparation;
      const age = this.time - prep.start;
      if (age > this.config.maxHold) {
        plan.preparation = null;
        plan.action = null;
        continue;
      }
      plan.action = {
        kind: prep.kind,
        power: Math.min(prep.power, 0.08 + age / this.config.chargeSeconds),
        age,
        playerId: p.id,
      };
    }
  }
  cpuLeavesOut(team) {
    // Rescue our own deflections; leave only clearly long opponent shots.
    if (this.lastTouch == null || this.lastTouch === team) return false;
    if (
      !this.cpuOutForecast ||
      this.cpuOutForecast.serial !== this.shotSerial ||
      this.time - this.cpuOutForecast.at > 0.08
    ) {
      this.cpuOutForecast = {
        serial: this.shotSerial,
        at: this.time,
        landing: predictAtHeight(
          this.ball,
          COURT.ballRadius,
          this.config,
          10 / this.config.ballSpeed,
        ),
      };
    }
    const b = this.cpuOutForecast.landing,
      margin = COURT.ballRadius + 0.2;
    return (
      b.y <= COURT.ballRadius &&
      b.x * this.sign(team) > 0 &&
      (Math.abs(b.x) > COURT.halfLength + margin || b.z < -margin || b.z > COURT.width + margin)
    );
  }
  tryCPUContact(team, previous = this.ball) {
    if (
      this.incomingShot === 'serve' &&
      this.lastTouch === team &&
      this.ball.vx * this.sign(team) < 0
    )
      return;
    if (this.possession !== team || this.cpuLeavesOut(team)) return;
    const plan = this.cpuPlans[team],
      p = this.active(team);
    if (p.diving || p.recovery > 0) return;
    if (plan && this.time < plan.reactionAt) return;
    if (plan && (!plan.action || plan.action.age < this.config.armWindup)) return;
    if (plan && this.time < plan.contactAt - 0.06 && this.ball.y > 0.7) return;
    if (this.ball.vy > 1 && p.y < 0.2) return;
    const behind = (this.ball.x - p.x) * (p.facing || -this.sign(team)) < -0.25;
    let kinds = Object.keys(SHOTS).filter((kind) => this.canContact(p, kind));
    const count = this.lastTouch === team ? this.touches[team] : 0;
    if (count < 2) kinds = kinds.filter((kind) => kind !== 'drive');
    if (!kinds.length) return;
    if (kinds.includes('back')) {
      const a = { kind: 'back', playerId: p.id, power: 0.6, age: this.config.armWindup };
      if (
        !ballTouchesHands(
          this.ball,
          previous,
          preparedHands(p, this, a),
          COURT.ballRadius + 0.13 * this.config.armScale,
        )
      )
        kinds = kinds.filter((kind) => kind !== 'back');
    }
    if (!kinds.length) return;
    if (behind && kinds.includes('back')) kinds = ['back'];
    if (plan?.action && kinds.includes(plan.action.kind)) kinds = [plan.action.kind];
    const shot = chooseCPUShot(this, p, kinds);
    this.makeContact(p, shot.kind, shot.power, shot.impulse);
  }
  tryBlocks() {
    // An opponent may block immediately after a spike; the hitter's debounce
    // must not consume the entire flight from the attacker's hand to the net.
    if ((this.cooldown > 0 && this.incomingShot !== 'drive') || this.incomingShot === 'serve')
      return false;
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
        resetFlight(this.ball);
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
  stepDeadBall(dt) {
    const previous = { ...this.ball };
    integrateBall(this.ball, dt, this.config);
    collideNet(this.ball, previous, this.config.restitution, this.config);
    bounceFloor(this.ball, this.config);
    this.trail.push({ x: this.ball.x, y: this.ball.y });
    if (this.trail.length > 15) this.trail.shift();
  }
  point(winner, reason) {
    if (['point', 'set-end', 'finished'].includes(this.phase)) return;
    if (this.mode === 'test') {
      this.feedTestBall();
      return;
    }
    this.rallies++;
    const result =
      this.mode === 'practice'
        ? { scored: false, setWon: false, matchWon: false }
        : awardRally(this, winner, this.config);
    this.clearControls();
    this.cpuPlans = [null, null];
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
    bounceFloor(this.ball, this.config);
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
