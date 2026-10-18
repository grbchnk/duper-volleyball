import { randomAppearance } from './appearance.js';
import { tryHeldContact, tryPending, recordContact, makeContact } from './contacts.js';
import { startDrill } from './drills.js';
import { chooseServeInput, beginServe, executeServe } from './serve-flow.js';
import { contactReason } from './contact-rules.js';
import { challengeProfileKey } from './records.js';
import { feedTrainingBall } from './test-feed.js';
import { groundVelocity, updateBodyMotion } from './movement-feel.js';
import { contactTempo } from './contact-tempo.js';
import { heldServeBall } from './serve-support.js';
import {
  createControls,
  controlledPlayer,
  selectControlledPlayer,
  aimOf,
  updateAim,
} from './controllers.js';
import { Replay } from './replay.js';
import { advanceChallenge, resolveChallenge } from './challenges.js';
import { createSkillStats, beginRally, summarizeRally } from './skill-feedback.js';
import { ATTACKS, blockImpulse } from './tactics.js';
import { serveSettings } from './serve-settings.js';
import { sampleServeMotion } from './motion.js';

import { WIN_EMOTIONS, LOSE_EMOTIONS } from './emotions.js';
import { assistedJump } from './jump-assist.js';

import { cpuSkill, planReception, chooseCPUShot } from './cpu.js';
import { nextReceiver } from './receiver-selection.js';
import { preparedHands, ballTouchesHands } from './held-contact.js';
import { DEFAULTS, COURT, FIXED_DT, sanitizeConfig } from './config.js';
import {
  integrateBall,
  bounceFloor,
  launchOverNet,
  predictAtHeight,
  collideNet,
  isInside,
  clamp,
  resetFlight,
} from './physics.js';
import { SHOTS, shotImpulse } from './moves.js';
import { awardRally } from './rules.js';
import { jumpProfile, sampleJump, jumpDuration, serveOrigin, blockWindow } from './motion.js';
import { HOMES, ROLES, TEAM_SIZE } from './formation.js';
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
const grounded = (p) => p.y <= 0 && p.vy <= 0 && p.recovery <= 0 && !p.diving && !p.jumpProfile;
export class Match {
  constructor(config = DEFAULTS, seed = 2026) {
    this.controls = createControls(EMPTY_INPUT);
    this.config = sanitizeConfig(config);
    this.seed = seed;
    this.events = [];
    this.mode = 'match';
    this.reset();
  }

  controlledPlayer(control) {
    return controlledPlayer(this, control);
  }
  selectControlledPlayer(control, id) {
    selectControlledPlayer(this, control, id);
  }
  humanControllers() {
    return this.mode === 'coop'
      ? [
          [0, 0],
          [0, 2],
        ]
      : [0, 1].filter((team) => this.isHuman(team)).map((team) => [team, team]);
  }
  humanSlot(p) {
    if (!this.isHuman(p.team)) return null;
    if (this.mode === 'coop' && p.team === 0 && p.id === this.coopSelected) return 2;
    return p.id === this.selected[p.team] ? p.team : null;
  }

  get coopBackSlot() {
    return (this.coopRotationCount || 0) % 2 === 0 ? 0 : 2;
  }
  coopOwns(slot, id) {
    return id >= 0 && id < TEAM_SIZE && (slot === this.coopBackSlot ? id < 2 : id === 2);
  }
  serverSlot() {
    return this.mode === 'coop' && this.server === 0 ? this.coopBackSlot : this.server;
  }
  serverPlayer() {
    return this.mode === 'coop' && this.server === 0 ? this.players[0] : this.active(this.server);
  }
  coopPlayer(slot) {
    return slot === 2 ? this.coopSelected : this.selected[0];
  }
  assignCoopReceiver(slot, id) {
    const previous = this.coopPlayer(slot),
      other = this.coopPlayer(slot === 2 ? 0 : 2);
    const player = this.players[id];
    if (
      id === previous ||
      id === other ||
      !this.coopOwns(slot, id) ||
      !player ||
      player.team !== 0 ||
      player.benched ||
      player.recovery > 0 ||
      player.diving
    )
      return false;
    this.selectControlledPlayer(this.controls[slot], id);
    for (const key of ['charge', 'pending']) {
      const action = this.controls[slot][key];
      if (action?.playerId === previous) action.playerId = id;
    }
    player.returnHome = false;
    player.clearLane = null;
    this.emit('receiver-switch', { slot, playerId: id });
    return true;
  }
  autoCoopReceiver(preferred = null) {
    if (this.phase !== 'rally' || this.lastTouch === null) return;
    // Opponent serves/shots must not preselect a receiver before the ball arrives.
    // Incoming balls use the stable, reachability-based handoff on our own side.
    if (this.lastTouch !== 0) return;
    const hitter = this.lastTouch === 0 ? this.lastPlayer : null;
    const target = predictAtHeight(this.ball, 1.9, this.config);
    if (target.x >= 0) return;
    const eligible = this.players.filter(
      (p) =>
        p.team === 0 && !p.benched && p.id !== hitter && p.recovery <= 0 && !p.diving && !p.block,
    );
    eligible.sort((a, b) => Math.abs(a.x - target.x) - Math.abs(b.x - target.x));
    const receiver = eligible.find((p) => p.id === preferred) || eligible[0];
    if (!receiver) return;
    const owner = [0, 2].find((slot) => this.coopPlayer(slot) === receiver.id);
    if (owner !== undefined) return;
    const slots = [0, 2].filter(
      (slot) => this.coopOwns(slot, receiver.id) && this.coopManualSerial[slot] !== this.shotSerial,
    );
    slots.sort(
      (a, b) =>
        Math.abs(this.players[this.coopPlayer(a)].x - target.x) -
        Math.abs(this.players[this.coopPlayer(b)].x - target.x),
    );
    if (slots.length) this.assignCoopReceiver(slots[0], receiver.id);
  }
  updateCoopReceiver() {
    if (this.phase !== 'rally' || this.lastTouch === null || this.ball.x >= 0) return;
    const hitter = this.lastTouch === 0 ? this.lastPlayer : null;
    for (const slot of [0, 2]) {
      const currentId = this.coopPlayer(slot);
      if (this.coopManualSerial[slot] === this.shotSerial) continue;
      const other = this.coopPlayer(slot === 2 ? 0 : 2);
      const exclude = this.players.filter((p) => !this.coopOwns(slot, p.id)).map((p) => p.id);
      const next = nextReceiver(this, 0, {
        currentId,
        exclude: [...exclude, other, hitter],
        keepReachable: true,
      });
      if (next !== null) this.assignCoopReceiver(slot, next);
    }
  }
  refreshAim(action, input) {
    if (this.config.dynamic && action) {
      const previous = action.aim || {};
      action.aim = aimOf(input);
      if (!input[action.kind])
        for (const key of ['soft', 'fast', 'intent', 'play']) action.aim[key] = previous[key];
    } else if (action?.aim) updateAim(action, input, true);
    if (action?.aim) {
      const player = this.players[action.playerId];
      action.aim.previousPlayerId = this.lastTouch === player?.team ? this.lastPlayer : null;
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
  actionForPlayer(p) {
    if (this.mode === 'coop' && p.team === 0) {
      for (const slot of [0, 2]) {
        const a = this.controls[slot].charge || this.controls[slot].pending;
        if (a?.playerId === p.id) return a;
      }
      return null;
    }
    return this.actionFor(p.team);
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
    return (
      this.mode === 'challenge' || this.mode === 'versus' || (team === 0 && this.mode !== 'demo')
    );
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
    if (
      this.challenge &&
      !this.challenge.done &&
      this.challenge.profileKey !== challengeProfileKey(this.config)
    )
      this.challenge.profileChanged = true;
  }
  reset(mode = this.mode) {
    this.coopManualSerial = [-1, -1, -1];
    this.cupStage = null;
    this.coopSelected = 2;
    this.coopPrimary = 0;
    this.challenge = null;
    this.clubLocked = false;
    this.skillStats = createSkillStats();
    this.lastContact = null;
    this.lastRally = null;
    this.outMarker = null;
    this.replay = new Replay();
    this.attackStyles = ['power', 'power'];
    this.playStyles = ['high', 'high'];
    this.teamRuns = [null, null];
    this.tacticalStats = {
      power: 0,
      steep: 0,
      tip: 0,
      roll: 0,
      free: 0,
      quick: 0,
      high: 0,
      back: 0,
      pipe: 0,
      dump: 0,
    };
    this.testFeeds = 0;
    this.testNext = null;
    this.testReceivedAt = null;
    this.visualSeed = this.seed ^ 0x6a09e667;
    this.mode = mode;
    this.time = 0;
    this.rallies = 0;
    this.coopRotationCount = 0;
    this.contacts = 0;
    this.server = 0;
    this.score = [0, 0];
    this.sets = [0, 0];
    this.events = [];
    this.players = [0, 1].flatMap((team) =>
      ROLES.map((role, i) => ({
        id: team * TEAM_SIZE + i,
        benched: this.config.duel && i !== 0,
        team,
        role,
        number: i + 1,
        appearance: { ...randomAppearance(), headShape: team === 0 ? 'square' : 'round' },
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
    this.controls[0].previousInput = { ...EMPTY_INPUT };
    this.controls[0].jumpArmed = true;
    this.controls[0].inputPlayer = 0;
    this.label('Матч начинается');
    this.startServe();
    if (mode === 'test') {
      this.players[0].x = -6;
      this.feedTestBall();
    }
  }
  startServe() {
    this.outMarker = null;
    this.contactTempoState = null;
    this.coopManualSerial = [-1, -1, -1];
    beginRally(this);
    this.clearControls();
    this.teamRuns = [null, null];
    this.bounces = [0, 0];
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
    this.controls[0].charge = null;
    this.controls[0].pending = null;
    this.controls[0].chargeLock = false;
    this.serveAction = null;
    this.controls[0].contactWindow = false;
    this.trail = [];
    this.controls[0].aimPreview = null;
    this.cpuBlockPlan = null;
    this.selected = [0, TEAM_SIZE];
    this.coopPrimary = 0;
    this.coopSelected = 2;
    this.cpuPlans = [null, null];
    if (this.mode === 'coop' && this.coopBackSlot === 2) {
      this.selected[0] = this.coopPrimary = 2;
      this.coopSelected = 0;
    }
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
        headFly: null,
        bodyMotion: null,
        moveVx: 0,
        lastSkid: -1,
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
    this.serverPlayer().x = this.sign(this.server) * (COURT.halfLength + 0.15);
    if (this.config.dynamic) this.serverPlayer().serveHand = this.visualRandom() < 0.5 ? 0 : 1;
    this.ball = {
      x: this.serverPlayer().x,
      y: 1.3,
      z: 4.5,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      angle: 0,
    };
    if (this.config.dynamic) Object.assign(this.ball, heldServeBall(this.serverPlayer()));
    this.emit('serve-ready', { team: this.server });
  }
  feedTestBall() {
    if (this.config.dynamic) return feedTrainingBall(this);
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
    this.controls[0].contactWindow = false;
    this.testFeeds = (this.testFeeds || 0) + 1;
    this.lastTouch = 1;
    this.lastPlayer = server.id;
    this.touches = [0, 0];
    this.cooldown = 0;
    this.teamPhases = ['defense', 'defense'];
    this.incomingShot = ready.kind;
    this.controls[0].charge = null;
    this.controls[0].pending = null;
    this.controls[0].aimPreview = null;
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
    dt *= contactTempo(this, dt);
    this.inputs = [
      { ...EMPTY_INPUT, intent: this.attackStyles[0], play: this.playStyles[0], ...raw },
      {
        ...EMPTY_INPUT,
        intent: this.attackStyles[1],
        play: this.playStyles[1],
        ...(this.mode === 'coop' ? {} : second),
      },
      {
        ...EMPTY_INPUT,
        intent: this.attackStyles[0],
        play: this.playStyles[0],
        ...(this.mode === 'coop' ? second : {}),
      },
    ];
    this.coopPrimary = this.selected[0];
    for (let team = 0; team < 2; team++) {
      this.inputs[team].intent ||= this.attackStyles[team];
      this.inputs[team].play ||= this.playStyles[team];
    }
    try {
      if (advanceChallenge(this, dt)) return;
      this.step(dt, raw);
      this.replay?.record(this);
    } finally {
      this.controls.forEach((state, team) => {
        state.previousInput = this.inputs[team];
      });
    }
  }
  handleControl(dt, input, team, control = this.controls[team]) {
    if (this.mode === 'coop' && this.phase !== 'rally' && control.slot !== this.serverSlot())
      return;
    const press = (key) => input[key] && !control.previousInput[key];
    this.refreshAim(control.pending, input);
    const jumpHeld = input.jumpHeld ?? input.jump;
    if (!jumpHeld) control.jumpArmed = true;
    else if (
      (control.inputPlayer !== this.controlledPlayer(control) &&
        (control.previousInput.jumpHeld ?? control.previousInput.jump)) ||
      (!this.config.dynamic &&
        (control.charge || control.pending || Object.keys(SHOTS).some((kind) => input[kind])))
    )
      control.jumpArmed = false;
    control.inputPlayer = this.controlledPlayer(control);

    if (
      !this.config.duel &&
      press('switch') &&
      this.phase === 'rally' &&
      !control.charge &&
      !control.pending
    )
      this.switchPlayer(control);
    if (
      !this.config.duel &&
      input.select &&
      !(this.mode === 'test' && this.config.dynamic) &&
      input.select !== control.previousInput.select &&
      this.phase === 'rally' &&
      !control.charge &&
      !control.pending &&
      !(
        this.mode === 'coop' &&
        team === 0 &&
        !this.coopOwns(control.slot, team * TEAM_SIZE + input.select - 1)
      ) &&
      this.players[team * TEAM_SIZE + input.select - 1]?.recovery <= 0
    ) {
      this.selectControlledPlayer(control, team * TEAM_SIZE + input.select - 1);
      if (this.mode === 'coop') this.coopManualSerial[control.slot] = this.shotSerial;
    }
    if (
      press('block') &&
      !input.low &&
      !input.back &&
      !input.loft &&
      !input.drive &&
      this.phase === 'rally' &&
      this.teamPhases[team] === 'defense'
    )
      this.requestBlock(team, control);
    if (control.inputPlayer !== this.controlledPlayer(control) && jumpHeld)
      control.jumpArmed = false;
    if (press('jump') && control.jumpArmed && this.phase === 'rally') {
      const p = this.players[this.controlledPlayer(control)];
      if (input.jumpVariant === 'block' && this.teamPhases[team] === 'defense')
        this.requestBlock(team, control);
      else {
        this.humanJump(p);
        if (input.jumpVariant === 'short' && p.jumpProfile) {
          p.jumpProfile = {
            ...p.jumpProfile,
            height: p.jumpProfile.height * 0.65,
            rise: p.jumpProfile.rise * 0.72,
            fall: p.jumpProfile.fall * 0.8,
          };
        }
      }
    }
    if (press('dive') && this.phase === 'rally')
      this.dive(this.players[this.controlledPlayer(control)], input.diveAxis || input.axis);
    this.updateCharge(dt, input, press, control);
  }
  step(dt, raw) {
    const input = { ...EMPTY_INPUT, ...raw },
      press = (key) => input[key] && !this.controls[0].previousInput[key];
    if (this.phase === 'finished') {
      this.time += dt;
      this.stepDeadBall(dt);
      this.animatePlayers(dt);
      this.returnPlayers(dt);
      this.controls[0].previousInput = input;
      return;
    }
    this.time += dt;
    this.phaseTime += dt;
    this.refreshAim(this.controls[0].pending, input);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    this.controls[0].contactWindow = false;
    for (const p of this.players) {
      const slot = this.humanSlot(p);
      const crouching =
        this.phase === 'rally' &&
        this.isHuman(p.team) &&
        slot !== null &&
        this.inputs[slot].crouch &&
        grounded(p);
      p.crouchAmount = clamp((p.crouchAmount || 0) + ((crouching ? 1 : -1) * dt) / 0.14, 0, 1);
    }
    for (const p of this.players) {
      if (!p.jumpHold || !p.jumpProfile || this.inputs[this.humanSlot(p) ?? p.team].jump) continue;
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
        this.controls[0].previousInput = input;
        return;
      }
      const returned = this.returnPlayers(dt);
      if (this.phaseTime > 2.3 && returned) {
        if (this.phase === 'set-end') this.score = [0, 0];
        if (this.mode === 'practice') this.startDrill(this.drill);
        else this.startServe();
      }
      this.controls[0].previousInput = input;
      return;
    }
    for (const [team, slot] of this.humanControllers()) {
      this.handleControl(dt, this.inputs[slot], team, this.controls[slot]);
      if (slot === 0) this.coopPrimary = this.selected[0];
    }
    if (this.phase === 'serve') {
      if (this.config.dynamic) Object.assign(this.ball, heldServeBall(this.serverPlayer()));
      if (!this.isHuman(this.server) && this.phaseTime > 1.3)
        this.beginServe({
          kind: ['low', 'loft', 'drive'][Math.floor(this.random() * 3)],
          power: 0.54,
          aim: { axis: -this.sign(this.server), up: false, down: false },
        });
      this.updatePreview(this.controls[this.serverSlot()]);
      this.controls[0].previousInput = input;
      return;
    }
    if (this.phase === 'serve-motion') {
      const p = this.serverPlayer(),
        a = this.serveAction,
        t = this.phaseTime;
      if (!a.released && t >= (a.tossDelay || 0)) {
        a.released = true;
        if (a.tossDelay) this.emit('toss');
      }
      Object.assign(this.ball, sampleServeMotion(p, a, t));
      this.controls[this.serverSlot()].contactWindow =
        !a.attempted && Math.abs(t - a.ideal) <= a.settings.PerfectWindow;
      if (this.ball.y <= COURT.ballRadius) this.point(1 - this.server, 'ПОДАЧА: МЯЧ НЕ УДАРЕН');
      else if (
        !a.attempted &&
        ((this.isHuman(this.server) &&
          Object.keys(SHOTS).some(
            (key) =>
              this.inputs[this.serverSlot()][key] &&
              !this.controls[this.serverSlot()].previousInput[key],
          )) ||
          (!this.isHuman(this.server) && t >= a.ideal))
      ) {
        a.attempted = true;
        a.perfect = this.controls[this.serverSlot()].contactWindow;
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
        this.controls[this.serverSlot()].chargeLock = true;
      }
      this.controls[0].previousInput = input;
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
      this.rallyInfo.net = true;
      this.cpuOutForecast = null;
      this.emit('net');
      this.label('Мяч от сетки — ещё можно спасти');
    }
    this.trail.push({ x: this.ball.x, y: this.ball.y });
    if (this.trail.length > 15) this.trail.shift();
    if (this.ball.y <= COURT.ballRadius) {
      this.ball.y = COURT.ballRadius;
      const bounceSide = this.ball.x < 0 ? 0 : 1;
      if (this.config.floorBounce && isInside(this.ball) && !this.bounces?.[bounceSide]) {
        this.bounces ||= [0, 0];
        this.bounces[bounceSide]++;
        this.ball.vy = Math.max(5, Math.abs(this.ball.vy) * 0.65);
        resetFlight(this.ball);
        this.label('Один отскок — спасайте!');
        return;
      }
      const inside = isInside(this.ball),
        side = this.ball.x < 0 ? 0 : 1;
      this.point(
        inside ? 1 - side : 1 - (this.lastTouch ?? this.server),
        inside ? 'МЯЧ КОСНУЛСЯ ПЛОЩАДКИ' : this.incomingShot === 'block' ? 'АУТ ОТ БЛОКА' : 'АУТ',
      );
      this.controls[0].previousInput = input;
      return;
    }
    if (Math.abs(this.ball.x) > 16 || this.ball.y > 28) {
      this.point(1 - (this.lastTouch ?? this.server), 'АУТ');
      this.controls[0].previousInput = input;
      return;
    }
    this.possession = this.ball.x < 0 ? 0 : 1;
    this.prediction = predictAtHeight(this.ball, 1.4, this.config);
    for (const team of [0, 1]) {
      if (!this.isHuman(team) || this.mode === 'test') continue;
      if (this.mode === 'coop') {
        this.updateCoopReceiver();
        continue;
      }
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
    for (const [, slot] of this.humanControllers()) {
      const control = this.controls[slot];
      if (control.pending && this.cooldown <= 0) this.tryPending(previous, control);
      this.tryHeldContact(previous, control);
    }
    this.tryDiveContacts();
    this.tryHeadHit(previous);
    for (const team of [0, 1])
      if (this.mode !== 'test' && !this.isHuman(team) && this.cooldown <= 0)
        this.tryCPUContact(team, previous);
    for (const [team, slot] of this.humanControllers()) {
      const control = this.controls[slot];
      if (control.pending) {
        control.pending.ttl -= dt;
        if (control.pending.ttl <= 0) {
          this.players[control.pending.playerId].swingCooldown = 0.16;
          control.pending = null;
          this.label('Мимо: отпускайте кнопку у мяча', 1.2);
        }
      }
      const action = control.charge || control.pending;
      control.contactWindow = action
        ? this.canContact(this.players[action.playerId], action.kind)
        : Object.keys(SHOTS).some((k) =>
            this.canContact(this.players[this.controlledPlayer(control)], k),
          );
      this.updatePreview(control);
    }
    this.controls[0].previousInput = input;
  }
  updateCharge(dt, input, press, control = this.controls[0]) {
    if (this.phase === 'serve' && this.server !== control.team) return;
    if (!['serve', 'rally'].includes(this.phase)) return;
    if (!Object.keys(SHOTS).some((kind) => input[kind])) control.chargeLock = false;
    const replaceable = control.pending || control.charge;
    const replacement =
      replaceable && Object.keys(SHOTS).find((kind) => kind !== replaceable.kind && press(kind));
    if (replacement) {
      const p = this.players[replaceable.playerId];
      if (!p.diving && p.recovery <= 0 && p.block <= 0 && p.swingCooldown <= 0) {
        // A fresh different key replaces an unconsumed attempt before it can hit.
        control.pending = null;
        control.chargeLock = false;
        control.charge = {
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
    if (control.charge) {
      const a = control.charge,
        p = this.players[a.playerId];
      if (input[a.kind]) {
        const intentBefore = a.aim.intent;
        a.stickControlled = input.stickShot === a.kind;
        this.refreshAim(a, input);
        if (this.config.dynamic && intentBefore !== a.aim.intent && a.kind === 'drive') {
          a.feintAt = this.time;
          this.label('Смена замаха · ' + (ATTACKS[a.aim.intent] || 'удар'));
        }
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
      const autoRelease =
        a.power >= 1 ||
        (!this.config.dynamic && this.phase !== 'serve' && a.age >= this.config.maxHold);
      if (!input[a.kind] || autoRelease) {
        this.refreshAim(a, input);
        control.charge = null;
        p.releaseSlow = a.kind === 'back' ? 0 : this.config.releaseWindow;
        if (autoRelease) control.chargeLock = true;
        if (this.phase !== 'serve')
          p.armSwing = { kind: a.kind, power: a.power, age: 0, hit: false, aim: a.aim };
        const action = { ...a, aim: { ...a.aim }, ttl: this.config.releaseWindow };
        if (this.phase === 'serve') this.beginServe(action, control);
        else {
          control.pending = action;
          if (!this.tryPending(this.ball, control) && action.ttl <= 0) {
            control.pending = null;
            p.swingCooldown = 0.16;
            this.label('Мимо: касание только у мяча');
          }
        }
      }
    } else if (!control.pending && !control.chargeLock) {
      const kind = Object.keys(SHOTS).find(press),
        p = this.players[this.controlledPlayer(control)];
      if (kind && !p.diving && p.recovery <= 0 && p.swingCooldown <= 0 && p.block <= 0) {
        this.emit('windup', { team: p.team, kind, power: 0.3 });
        control.charge = {
          kind,
          power: 0.08,
          age: 0,
          aim: aimOf(input),
          stickControlled: !!input.stickShot,
          playerId: p.id,
        };
      }
    }
    const preparing = control.charge || control.pending;
    if (preparing && this.phase !== 'serve') {
      const p = this.players[preparing.playerId];
      if (!p.diving && p.block <= 0 && !(p.jumpProfile && p.jumpTime < p.jumpProfile.windup)) {
        p.pose = 'ready-' + SHOTS[preparing.kind].pose;
        p.animation = 0.08;
      }
    }
  }
  chooseServeInput(p, original) {
    return chooseServeInput(this, p, original);
  }
  beginServe(action, control = this.controls[this.serverSlot()]) {
    return beginServe(this, action, control);
  }
  startDrill(drill = 'receive') {
    return startDrill(this, drill);
  }
  executeServe() {
    return executeServe(this);
  }
  switchPlayer(control = this.controls[0]) {
    if (this.config.duel || this.challenge || (this.mode === 'test' && this.config.dynamic)) return;
    const current = this.controlledPlayer(control);
    for (let i = 1; i <= TEAM_SIZE; i++) {
      const next = control.team * TEAM_SIZE + ((current + i) % TEAM_SIZE);
      if (this.mode === 'coop' && !this.coopOwns(control.slot, next)) continue;
      if (this.players[next].recovery <= 0 && !this.players[next].diving) {
        this.selectControlledPlayer(control, next);
        if (this.mode === 'coop') this.coopManualSerial[control.slot] = this.shotSerial;
        return;
      }
    }
  }
  autoSelect(team, preferred = null) {
    if (this.mode === 'coop' && team === 0) {
      this.autoCoopReceiver(preferred);
      return;
    }
    if (this.challenge) return;
    if (this.config.duel) {
      this.selected[team] = team * TEAM_SIZE;
      return;
    }
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
      players = this.players.filter(
        (p) => !p.benched && p.team === team && p.recovery <= 0 && !p.diving,
      );
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
  requestBlock(team, control = this.controls[team]) {
    if (
      this.phase !== 'rally' ||
      this.teamPhases[team] === 'attack' ||
      (control.charge && this.players[control.charge.playerId].team === team) ||
      (control.pending && this.players[control.pending.playerId].team === team) ||
      this.players.some((p) => p.team === team && p.armSwing && p.armSwing.age < 0.35)
    )
      return false;
    const front = this.players
      .filter(
        (p) =>
          !p.benched &&
          p.team === team &&
          !(this.mode === 'coop' && p.id !== this.controlledPlayer(control)) &&
          Math.abs(p.x) < 3.25 &&
          grounded(p) &&
          p.blockCooldown <= 0,
      )
      .sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
    if (!front.length) return false;
    this.jump(front[0], true);
    this.emit('jump', { team, playerId: front[0].id });
    return true;
  }
  dive(p, axis, control = this.controls[this.humanSlot(p) ?? p.team]) {
    if (!grounded(p) || this.phase !== 'rally') return false;
    const direction = Math.sign(axis) || p.facing || -this.sign(p.team);
    if (control.charge?.playerId === p.id) control.charge = null;
    if (control.pending?.playerId === p.id) control.pending = null;
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
    if (this.isHuman(p.team) && this.selected[p.team] === p.id && this.mode !== 'coop')
      this.switchPlayer(control);
    else if (!this.isHuman(p.team)) this.autoSelect(p.team);
    this.emit('jump', { team: p.team, playerId: p.id });
    this.label(
      direction === -this.sign(p.team)
        ? 'БРОСОК ВПЕРЁД · руки готовы'
        : 'БРОСОК НАЗАД · руки готовы',
    );
    this.emit('dive', { team: p.team });
    return true;
  }
  tryDiveContacts() {
    for (const p of this.players) {
      if (
        this.config.dynamic &&
        !this.isHuman(p.team) &&
        this.lastTouch === p.team &&
        this.touches[p.team] >= 3
      )
        continue;
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
    if (this.config.dynamic && Math.hypot(this.ball.vx, this.ball.vy) < 10) return false;
    if (
      !this.headHitEligible ||
      this.incomingShot !== 'drive' ||
      (!this.config.dynamic && this.ball.vy > -4)
    )
      return false;
    for (const p of this.players) {
      if (p.benched || p.team === this.lastTouch || p.recovery > 0 || p.diving || p.block > 0)
        continue;
      const top = p.y + 2.1 + COURT.ballRadius;
      let t;
      if (this.config.dynamic) {
        const dx = this.ball.x - previous.x,
          dy = this.ball.y - previous.y;
        const ox = previous.x - p.x,
          oy = previous.y - (p.y + 1.9);
        const a = dx * dx + dy * dy,
          b = 2 * (ox * dx + oy * dy);
        const c = ox * ox + oy * oy - (0.28 + COURT.ballRadius * 0.5) ** 2;
        const discriminant = b * b - 4 * a * c;
        if (a < 1e-10 || discriminant < 0) continue;
        t = c <= 0 ? 0 : (-b - Math.sqrt(discriminant)) / (2 * a);
        if (t < 0 || t > 1) continue;
      } else {
        if (previous.y < top || this.ball.y > top) continue;
        t = (previous.y - top) / Math.max(0.0001, previous.y - this.ball.y);
      }
      const x = previous.x + (this.ball.x - previous.x) * t;
      const impactY = this.config.dynamic ? previous.y + (this.ball.y - previous.y) * t : top;
      if (!this.config.dynamic && Math.abs(x - p.x) > 0.28) continue;
      const incomingSpeed = Math.hypot(this.ball.vx, this.ball.vy);
      const flyingHead = this.config.dynamic && incomingSpeed >= 18;
      p.headFly = flyingHead
        ? { x: p.x, y: p.y + 1.8, vx: clamp(this.ball.vx * 0.4, -7, 7), vy: 4.5, age: 0 }
        : null;
      this.headHitEligible = false;
      p.jumpProfile = p.jumpAssist = null;
      p.jumpHold = false;
      p.vy = Math.min(0, p.vy);
      p.vx = 0;
      p.stunned = p.recovery = p.recoveryTotal = this.config.dynamic ? 1.2 : 5.35;
      p.pose = 'belly';
      p.animation = 0;
      p.armSwing = p.contact = p.clearLane = null;
      p.returnHome = false;
      const state = this.controls[p.team];
      for (const key of ['charge', 'pending']) if (state[key]?.playerId === p.id) state[key] = null;
      Object.assign(this.ball, {
        x,
        y: impactY,
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
      this.emit('head-hit', { playerId: p.id, team: p.team, x, y: impactY, flyingHead });
      this.label('УДАР В ГОЛОВУ · игрок оглушён');
      return true;
    }
    return false;
  }
  animatePlayers(dt) {
    for (const p of this.players) {
      updateBodyMotion(p, dt, this.config);
      if (p.headFly) {
        p.headFly.age += dt;
        if (p.recovery <= dt) p.headFly = null;
      }
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
          this.actionForPlayer(p)?.playerId === p.id &&
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
          if (this.config.dynamic) {
            p.bodyMotion.landing = 0.22;
            this.emit('land', { x: p.x, y: 0 });
          }
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
            if (this.config.dynamic) {
              p.bodyMotion.landing = 0.22;
              this.emit('land', { x: p.x, y: 0 });
            }
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
        this.sign(p.team) *
        (p.id === this.server * TEAM_SIZE ? COURT.halfLength + 0.15 : HOMES[p.id % TEAM_SIZE]);
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
    if (this.config.dynamic) {
      p.clearLane = null;
      p.returnHome = true;
      return;
    }
    p.returnHome = false;
    p.clearLane = null;
    if (p.id === this.selected[p.team] || this.humanSlot(p) !== null || this.mode === 'test')
      return;
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
    if (this.config.dynamic && !this.isHuman(p.team)) return target;
    // Pause before a teammate instead of crossing their reception lane. Re-evaluate
    // every frame so a blocked return resumes as soon as the space opens.
    const direction = Math.sign(target - p.x);
    for (const other of this.players) {
      if (other.benched || other.team !== p.team || other.id === p.id) continue;
      const gap = (
        this.config.dynamic ? this.humanSlot(other) !== null : other.id === this.selected[p.team]
      )
        ? 1.25
        : 0.85;
      if ((other.x - p.x) * direction > 0 && (target - other.x) * direction > -gap)
        target = p.x + direction * Math.max(0, Math.abs(other.x - p.x) - gap);
    }
    return target;
  }
  movePlayers(dt, raw) {
    if (this.phase === 'rally' && this.mode !== 'test') {
      for (const team of [0, 1]) {
        const players = this.players
          .filter((p) => p.team === team && !p.benched)
          .sort((a, b) => a.x - b.x || a.id - b.id);
        const slots = HOMES.map((x) => x * this.sign(team)).sort((a, b) => a - b);
        const active = this.active(team);
        let reserved = slots.reduce((best, x) =>
          Math.abs(x - active.x) < Math.abs(best - active.x) ? x : best,
        );
        // Hysteresis prevents role changes from oscillating around a zone boundary.
        if (
          this.config.dynamic &&
          slots.includes(active.homeX) &&
          Math.abs(active.x - active.homeX) < Math.abs(active.x - reserved) + 0.65
        )
          reserved = active.homeX;
        active.homeX = reserved;
        const reservedSlots = [reserved];
        if (this.mode === 'coop' && team === 0) {
          const partner = this.players[this.coopSelected];
          const available = slots.filter((x) => x !== reserved);
          partner.homeX = available.reduce((best, x) =>
            Math.abs(x - partner.x) < Math.abs(best - partner.x) ? x : best,
          );
          reservedSlots.push(partner.homeX);
        }
        const free = slots.filter((x) => !reservedSlots.includes(x));
        players
          .filter(
            (p) => p.id !== active.id && !(this.mode === 'coop' && p.id === this.coopSelected),
          )
          .forEach((p, i) => {
            p.homeX = free[i];
          });
        for (const p of players) p.role = ROLES[HOMES.indexOf(Math.abs(p.homeX))];
      }
    }
    for (const p of this.players) this.movePlayer(p, dt, raw);
  }
  movePlayer(p, dt, raw) {
    if (p.benched) return;
    const control = this.controls[this.humanSlot(p) ?? p.team];
    const input = this.inputs?.[control.slot] || (p.team === 0 ? raw : EMPTY_INPUT);
    const controlled = this.isHuman(p.team) && p.id === this.controlledPlayer(control);
    const scheduledRun = this.teamRuns[p.team];
    if (
      controlled &&
      scheduledRun?.playerId === p.id &&
      (input.axis || input.jump || input.dive || input.select || input.switch)
    )
      scheduledRun.cancelled = true;
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
        p.id === this.controlledPlayer(control)
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
    const run = this.teamRuns[p.team];
    const manual =
      controlled && (input.axis || input.jump || input.dive || input.select || input.switch);
    if (manual && run?.playerId === p.id) run.cancelled = true;
    if (
      this.config.approachAssist &&
      run &&
      !run.cancelled &&
      run.serial === this.shotSerial &&
      this.time < run.at + 0.3 &&
      (p.id === run.playerId || p.id === run.decoyId)
    ) {
      const target = p.id === run.decoyId ? this.sign(p.team) * 1.25 : run.x;
      p.x += clamp(target - p.x, -this.config.playerSpeed * dt, this.config.playerSpeed * dt);
      p.vx = (p.x - old) / dt;
      p.facing = -this.sign(p.team);
      const j = jumpProfile(this.config);
      if (
        Math.abs(p.x - target) < 0.45 &&
        run.at - this.time < j.windup + j.rise + (p.id === run.decoyId ? 0.2 : 0)
      )
        this.jump(p);
      return;
    }
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
        p.id === this.controlledPlayer(control) &&
        (input.axis || input.crouch || control.charge || control.pending)
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
      } else if (p.id === this.controlledPlayer(control)) {
        let movement =
          (input.axis || 0) *
          this.config.playerSpeed *
          dt *
          (control.charge?.playerId === p.id
            ? control.charge.kind === 'back'
              ? 1
              : this.config.chargeMove
            : 1 -
              (1 - this.config.chargeMove) *
                clamp(p.releaseSlow / Math.max(this.config.releaseWindow, 0.001), 0, 1)) *
          (1 - (p.crouchAmount || 0) * 0.65);
        if (this.config.dynamic) {
          const target = movement / dt;
          const previous = p.moveVx || 0;
          if (
            previous * target < 0 &&
            Math.abs(previous) > this.config.playerSpeed * 0.55 &&
            this.time - (p.lastSkid ?? -1) > 0.16
          ) {
            this.emit('skid', { x: p.x, y: 0, direction: Math.sign(previous) });
            p.lastSkid = this.time;
          }
          p.moveVx = groundVelocity(previous, target, this.config.playerSpeed, dt);
          movement = p.moveVx * dt;
        }
        p.x += movement;
        if (
          input.axis &&
          Math.sign(input.axis) === Math.sign(this.ball.x - p.x) &&
          Math.abs(this.ball.x - p.x) > 0.35
        )
          p.facing = Math.sign(input.axis);
      }
    } else {
      let target = this.returnTarget(p);
      if (this.config.dynamic && this.lastTouch !== p.team) {
        const homes =
          this.config.cpuStyle === 'deep'
            ? [7.8, 5, 2.8]
            : this.config.cpuStyle === 'blocker'
              ? [6.5, 3.4, 0.8]
              : [7, 3.8, 1.5];
        target = this.sign(p.team) * homes[p.id % 3];
        const fallen = this.players.find(
          (q) => q.team === p.team && !q.benched && (q.diving || q.recovery > 0),
        );
        if (fallen && p.id !== this.controlledPlayer(control)) target = (target + fallen.x) / 2;
      }
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
          this.config.dynamic && Math.abs(target - p.x) < 0.08 ? 0 : target - p.x,
          -this.config.playerSpeed * cpuSkill(this.config).speed * dt,
          this.config.playerSpeed * cpuSkill(this.config).speed * dt,
        );
    }
    p.x = clamp(p.x, p.team === 0 ? -10.5 : 0.65, p.team === 0 ? -0.65 : 10.5);
    if (
      !this.config.dynamic &&
      !controlled &&
      p.id !== this.controlledPlayer(control) &&
      this.mode !== 'test'
    ) {
      const other = this.players
        .filter((q) => !q.benched && q.team === p.team && q.id !== p.id)
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
  }
  canContact(p, kind) {
    return contactReason(this, p, kind) === null;
  }
  tryHeldContact(previous = this.ball, control = this.controls[0]) {
    return tryHeldContact(this, previous, control);
  }
  tryPending(previous = this.ball, control = this.controls[0]) {
    return tryPending(this, previous, control);
  }
  recordContact(p, kind, power) {
    return recordContact(this, p, kind, power);
  }
  makeContact(p, kind, power, impulse) {
    return makeContact(this, p, kind, power, impulse);
  }
  planReadBlock(team, impulse) {
    if (!this.config.dynamic || this.isHuman(team) || this.config.duel) return;
    const style = this.config.cpuStyle;
    if (style === 'deep' || this.random() > 0.6 + cpuSkill(this.config).level * 0.25) return;
    const profile = jumpProfile(this.config);
    const early = style === 'blocker' ? -0.25 : style === 'patient' ? 0.1 : -0.06;
    this.cpuBlockPlan = {
      team,
      serial: this.shotSerial,
      read: true,
      at: this.time + Math.max(0.1, impulse.arrival - profile.rise - profile.windup + early),
    };
  }
  scheduleCPUBlock(team) {
    if (this.config.dynamic && this.cpuBlockPlan?.read && this.cpuBlockPlan.team === team) {
      this.cpuBlockPlan.serial = this.shotSerial;
      return;
    }
    if (this.config.dynamic && this.players.some((p) => p.team === team && p.block > 0)) return;
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
      if (this.config.dynamic && this.lastTouch === team && this.touches[team] >= 3) {
        this.cpuPlans[team] = null;
        continue;
      }
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
        plan.preparation = {
          kind: shot.kind,
          power: shot.power,
          intent: shot.impulse.intent,
          start: this.time,
        };
        this.emit('windup', { team, kind: shot.kind, power: shot.power });
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
    if (this.config.dynamic && this.lastTouch === team && this.touches[team] >= 3) return;
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
    if (count < (this.config.dynamic ? 1 : 2) && !this.config.duel)
      kinds = kinds.filter((kind) => kind !== 'drive');
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
      if (p.benched || p.team === this.lastTouch || !blockWindow(p, this.config)) continue;
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
        const incomingBlock = { ...this.ball };
        this.ball.attackGravity = 0;
        p.blockUsed = true;
        this.ball.vx =
          -this.sign(p.team) * Math.max(3, Math.abs(this.ball.vx) * this.config.blockDeflect);
        this.ball.vy = perfect ? -1.4 : 2.4;
        let blockText;
        if (this.config.dynamic) {
          const deflection = blockImpulse(incomingBlock, p, perfect, this.config);
          Object.assign(this.ball, { vx: deflection.vx, vy: deflection.vy, spin: deflection.spin });
          blockText = deflection.label;
        }
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
        this.label(blockText || (perfect ? 'ТОЧНЫЙ БЛОК!' : 'СМЯГЧЕНИЕ — розыгрыш продолжается'));
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
  updatePreview(control = this.controls[0]) {
    control.aimPreview = null;
    const action = control.charge || control.pending;
    if (!action || !this.config.trajectory) return;
    const p = this.players[action.playerId],
      serving = this.phase === 'serve';
    if (!serving && !this.canContact(p, action.kind)) return;
    const origin = serving
      ? { ...this.ball, ...serveOrigin(p, action.kind, this.config, true) }
      : { ...this.ball };
    control.aimPreview = {
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
    if (!this.outMarker && this.pointReason?.includes('АУТ') && this.ball.y <= COURT.ballRadius)
      this.outMarker = { x: this.ball.x, z: this.ball.z, at: this.time };
    collideNet(this.ball, previous, this.config.restitution, this.config);
    if (this.ball.y <= COURT.ballRadius && this.ball.vy < -2) this.emit('floor');
    bounceFloor(this.ball, this.config);
    this.trail.push({ x: this.ball.x, y: this.ball.y });
    if (this.trail.length > 15) this.trail.shift();
  }
  point(winner, reason) {
    if (['point', 'set-end', 'finished'].includes(this.phase)) return;
    if (this.challenge) {
      resolveChallenge(this, reason);
      return;
    }
    if (this.mode === 'test') {
      this.feedTestBall();
      return;
    }
    if (reason.includes('АУТ') && this.ball.y <= COURT.ballRadius + 0.01)
      this.outMarker = { x: this.ball.x, z: this.ball.z, at: this.time };
    this.rallies++;
    if (this.mode === 'coop' && winner === 0) this.coopRotationCount++;
    summarizeRally(this, winner, reason);
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
    this.controls[0].charge = null;
    this.controls[0].pending = null;
    this.controls[0].aimPreview = null;
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
    this.controls[0].contactWindow = false;
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
    this.emit('point', { winner, reason, contacts: this.rallyInfo.contacts, ...result });
  }
}
