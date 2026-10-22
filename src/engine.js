import { COSMETIC_KEYS } from './settings-scope.js';
import { cpuStyle, chooseServeKind } from './cpu-styles.js';
import { teamAppearance, appearanceKey } from './appearance.js';
import { assignPlayerArms } from './player-arms.js';
import { courtLineBounds } from './court-visual.js';
import {
  tryHeldContact,
  tryPending,
  recordContact,
  makeContact,
  validReceiveHold,
  cancelReceiveHold,
} from './contacts.js';
import { startDrill } from './drills.js';
import { chooseServeInput, beginServe, executeServe } from './serve-flow.js';
import { contactReason } from './contact-rules.js';
import { challengeProfileKey } from './records.js';
import { feedTrainingBall } from './test-feed.js';
import { groundVelocity, updateBodyMotion, releaseMoveFactor } from './movement-feel.js';
import { contactTempo } from './contact-tempo.js';
import { heldServeBall } from './serve-support.js';
import { sampleServeContact } from './serve-contact.js';
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

import { WIN_EMOTIONS, LOSE_EMOTIONS } from './emotions.js';
import { assistedJump } from './jump-assist.js';

import { cpuSkill, planReception, chooseCPUShot } from './cpu.js';
import { nextReceiver } from './receiver-selection.js';
import { serveReceiver } from './serve-reception.js';
import {
  isFeintDecoy,
  stepFeintDecoy,
  queueFeintAttack,
  stepFeintAttack,
  cancelFeintAttack,
} from './feint-play.js';
import { preparedHands, ballTouchesHands } from './held-contact.js';
import { DEFAULTS, COURT, FIXED_DT, sanitizeConfig } from './config.js';
import {
  integrateBall,
  bounceFloor,
  launchOverNet,
  predictAtHeight,
  collideNet,
  netBallRadius,
  crossesUnderNet,
  isInside,
  clamp,
  resetFlight,
} from './physics.js';
import { shotImpulse, shotKinds, shotDefinition } from './moves.js';
import { awardRally } from './rules.js';
import {
  jumpProfile,
  sampleJump,
  jumpDuration,
  serveOrigin,
  blockWindow,
  updateJumpButtonHold,
} from './motion.js';
import { ageBallSmoke, sampleBallSmoke } from './ball-smoke.js';
import { isZoneReceive } from './zone-receive.js';
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
const hasShotInput = (input) => ['low', 'loft', 'drive', 'back'].some((kind) => input?.[kind]);
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
    return selectControlledPlayer(this, control, id);
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
    player.returnHome = false;
    player.clearLane = null;
    this.emit('receiver-switch', { slot, playerId: id });
    return true;
  }
  autoCoopReceiver(preferred = null) {
    if (this.phase !== 'rally' || this.lastTouch === null) return;
    const hitter = this.lastTouch === 0 ? this.lastPlayer : null;
    const target = predictAtHeight(this.ball, 1.9, this.config);
    if (target.x >= 0) return;
    const eligible = this.players.filter(
      (p) =>
        p.team === 0 &&
        !p.benched &&
        p.id !== hitter &&
        p.recovery <= 0 &&
        !p.diving &&
        !p.block &&
        !isFeintDecoy(this, p),
    );
    eligible.sort((a, b) => Math.abs(a.x - target.x) - Math.abs(b.x - target.x));
    const receiverId = preferred ?? serveReceiver(this, 0, eligible);
    const receiver = eligible.find((p) => p.id === receiverId) || eligible[0];
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
      if (this.handoffMissedBlock(this.controls[slot])) continue;
      const currentId = this.coopPlayer(slot);
      if (this.coopManualSerial[slot] === this.shotSerial) continue;
      const other = this.coopPlayer(slot === 2 ? 0 : 2);
      const exclude = this.players.filter((p) => !this.coopOwns(slot, p.id)).map((p) => p.id);
      const next = nextReceiver(this, 0, {
        currentId,
        exclude: [...exclude, other, hitter],
        keepReachable: true,
        preferCurrent: this.config.dynamic && this.lastTouch !== 0 && !!this.inputs?.[slot]?.axis,
      });
      if (next !== null) this.assignCoopReceiver(slot, next);
    }
  }
  handoffMissedBlock(control) {
    const player = this.players[this.controlledPlayer(control)];
    const side = this.sign(control.team);
    // Once an incoming ball is behind the blocking reach and moving deeper,
    // finishing the block must not strand control at the net.
    if (
      !this.config.dynamic ||
      this.phase !== 'rally' ||
      this.challenge ||
      this.config.duel ||
      this.mode === 'test' ||
      this.lastTouch === null ||
      this.lastTouch === control.team ||
      !player?.jumpProfile ||
      player.block <= 0 ||
      player.diving ||
      control.charge ||
      control.pending ||
      hasShotInput(this.inputs?.[control.slot]) ||
      (this.ball.x < 0 ? 0 : 1) !== control.team ||
      this.ball.vx * side <= 0 ||
      (this.ball.x - player.x) * side <= this.config.blockReach + 0.22
    )
      return false;
    const coop = this.mode === 'coop' && control.team === 0;
    const exclude = coop
      ? this.players.filter((p) => !this.coopOwns(control.slot, p.id)).map((p) => p.id)
      : [];
    const next = nextReceiver(this, control.team, { currentId: player.id, exclude });
    if (next === null || next === player.id || (this.players[next].x - player.x) * side <= 0)
      return false;
    const changed = coop
      ? this.assignCoopReceiver(control.slot, next)
      : this.selectControlledPlayer(control, next);
    if (changed) {
      control.manualSerial = -1;
      if (coop) this.coopManualSerial[control.slot] = -1;
    }
    return changed;
  }
  refreshAim(action, input) {
    if (action?.comboQueued) return;
    if (this.config.dynamic && action) {
      const previous = action.aim || {};
      action.aim = aimOf(input);
      if (!input[action.kind])
        for (const key of ['soft', 'fast', 'intent', 'play']) action.aim[key] = previous[key];
    } else if (action?.aim) updateAim(action, input, true);
    if (action?.aim) {
      const player = this.players[action.playerId];
      action.aim.previousPlayerId = this.lastTouch === player?.team ? this.lastPlayer : null;
      action.aim.touchesBefore = this.lastTouch === player?.team ? this.touches[player.team] : 0;
      action.aim.tutorialAutoPass = !!this.training;
      action.aim.controlledIds = this.players
        .filter((p) => p.team === player?.team && this.humanSlot(p) !== null)
        .map((p) => p.id);
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
    if (this.training && ['serve-ready', 'whistle', 'point'].includes(type)) return;
    this.events.push({ type, time: this.time, ...data });
    if (this.events.length > 80) this.events.shift();
  }
  floorTouch() {
    if (this.ball.floorTouched) return;
    this.ball.floorTouched = true;
    this.emit('floor-touch', {
      x: this.ball.x,
      y: 0,
      speed: Math.abs(this.ball.vy),
      out: !isInside(this.ball, this.config),
      winning: ['point', 'set-end', 'finished'].includes(this.phase),
    });
  }
  label(text, duration = 1.6) {
    this.notice = text;
    this.noticeTime = duration;
  }
  updateConfig(config, sanitized = false) {
    const nextConfig = sanitized ? config : sanitizeConfig(config);
    const changedPhysics = Object.keys(nextConfig).some(
      (key) => !COSMETIC_KEYS.has(key) && nextConfig[key] !== this.config[key],
    );
    if (changedPhysics) {
      this.cpuOutForecast = null;
      this.cpuPlans = [null, null];
    }
    const previousAppearance = appearanceKey(this.config);
    this.config = nextConfig;
    if (previousAppearance !== appearanceKey(this.config))
      for (const p of this.players) p.appearance = teamAppearance(this.config, p.team, p.id % 3);
    assignPlayerArms(this.players, this.config.randomArms);
    if (
      this.challenge &&
      !this.challenge.done &&
      this.challenge.profileKey !== challengeProfileKey(this.config)
    )
      this.challenge.profileChanged = true;
  }
  reset(mode = this.mode) {
    this.tutorialNoBall = false;
    this.coopManualSerial = [-1, -1, -1];
    this.cupStage = null;
    this.coopSelected = 2;
    this.coopPrimary = 0;
    this.challenge = null;
    this.clubLocked = false;
    this.skillStats = createSkillStats();
    this.lastContact = null;
    this.passDirections = null;
    this.lastRally = null;
    this.outMarker = null;
    this.replay = new Replay();
    this.attackStyles = ['power', 'power'];
    this.playStyles = ['high', 'high'];
    this.cpuHistory = [[], []];
    this.cpuRetry = [null, null];
    this.cpuTelemetry = [0, 1].map(() => ({
      contacts: 0,
      soft: 0,
      fast: 0,
      combos: 0,
      intents: {},
    }));
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
        appearance: teamAppearance(this.config, team, i),
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
    assignPlayerArms(this.players, this.config.randomArms);
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
    for (const control of this.controls) {
      control.manualSerial = -1;
    }
    this.coopManualSerial = [-1, -1, -1];
    beginRally(this);
    this.clearControls();
    this.teamRuns = [null, null];
    this.bounces = [0, 0];
    this.headHitEligible = false;
    this.headFlyEligible = false;
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
    this.smokeTrail = [];
    this.smokeShot = null;
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
    this.lastAction = 'Готов к подаче';
    this.assistLabel = 'Помощь только в направлении паса';
    for (const p of this.players)
      Object.assign(p, {
        x: this.sign(p.team) * HOMES[p.id % TEAM_SIZE],
        homeX: this.sign(p.team) * HOMES[p.id % TEAM_SIZE],
        returnHome: false,
        returnDelay: 0,
        clearedSerial: -1,
        releaseSlow: 0,
        releaseSlowTotal: 0,
        stunned: 0,
        headFly: null,
        headDetached: false,
        bodyMotion: null,
        moveVx: 0,
        returnVx: 0,
        returnPark: null,
        wasControlled: false,
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
    this.headFlyEligible = false;
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
    this.smokeTrail = [];
    this.smokeShot = null;
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
    if (!this.config.dynamic) dt *= contactTempo(this, dt);
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
    if (input.select || press('switch') || press('jump') || press('dive'))
      cancelFeintAttack(this, control);
    this.refreshAim(control.pending, input);
    const jumpHeld = input.jumpHeld ?? input.jump;
    if (!jumpHeld) control.jumpArmed = true;
    else if (
      (control.inputPlayer !== this.controlledPlayer(control) &&
        (control.previousInput.jumpHeld ?? control.previousInput.jump)) ||
      (!this.config.dynamic &&
        (control.charge ||
          control.pending ||
          shotKinds(this.config, ['serve', 'serve-motion'].includes(this.phase)).some(
            (kind) => input[kind],
          )))
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
      control.manualSerial = this.shotSerial;
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
    ageBallSmoke(this, dt);
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
    if (this.tutorialNoBall && this.mode === 'practice') {
      for (const p of this.players) if (!p.benched) this.movePlayer(p, dt, input);
      this.controls[0].previousInput = input;
      return;
    }
    // Teammates and receivers can reposition; the server stays in the serve motion.
    if (this.phase === 'serve' || this.phase === 'serve-motion') {
      for (const p of this.players) {
        if (this.isHuman(p.team)) this.movePlayer(p, dt, input);
      }
    }
    if (this.phase === 'serve') {
      if (this.config.dynamic) Object.assign(this.ball, heldServeBall(this.serverPlayer()));
      if (!this.isHuman(this.server) && this.phaseTime > 1.3)
        this.beginServe({
          kind: chooseServeKind(this),
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
      const contact = sampleServeContact(p, a, t, this.config);
      Object.assign(this.ball, contact.ball);
      const { quality, distance } = contact;
      a.contactQuality = quality;
      const human = this.isHuman(this.server);
      const pressed =
        human &&
        shotKinds(this.config, true).some(
          (key) =>
            this.inputs[this.serverSlot()][key] &&
            !this.controls[this.serverSlot()].previousInput[key],
        );
      if (
        this.config.dynamic &&
        human &&
        !a.attempted &&
        !a.cuePlayed &&
        t >= a.contactTiming.start &&
        quality >= 1 - 1e-9
      ) {
        a.cuePlayed = true;
        this.emit('serve-hit-cue');
      }
      this.controls[this.serverSlot()].contactWindow =
        !a.attempted &&
        (this.config.dynamic
          ? quality >= 1 - 1e-9
          : Math.abs(t - a.ideal) <= a.settings.PerfectWindow);
      if (this.ball.y <= COURT.ballRadius) {
        this.floorTouch();
        this.point(1 - this.server, 'ПОДАЧА: МЯЧ НЕ УДАРЕН');
      } else if (!a.attempted && (pressed || (!human && !a.cpuMiss && t >= a.ideal))) {
        a.attempted = true;
        a.perfect = this.controls[this.serverSlot()].contactWindow;
        if (
          this.config.dynamic
            ? quality > 0
            : Math.abs(t - a.ideal) <= a.settings.HitWindow && distance <= a.settings.ContactReach
        ) {
          a.quality = this.config.dynamic ? quality : a.perfect ? 1 : a.settings.MistimePower;
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
    sampleBallSmoke(this);
    if (collideNet(this.ball, previous, this.config.restitution, this.config)) {
      this.rallyInfo.net = true;
      this.cpuOutForecast = null;
      this.emit('net');
      this.label(
        this.incomingShot === 'serve' ? 'Подача в сетку' : 'Мяч от сетки — ещё можно спасти',
      );
    }
    // Crossing through the real gap beneath the mesh loses the rally; it must
    // not rebound from an invisible extension of the net down to the floor.
    if (crossesUnderNet(this.ball, previous, this.config)) {
      this.point(1 - (this.lastTouch ?? this.server), 'МЯЧ ПОД СЕТКОЙ');
      return;
    }
    // Catch a prepared reception that crossed a small zone within this step,
    // before floor scoring or receiver selection can discard that contact.
    for (const [, slot] of this.humanControllers()) {
      const control = this.controls[slot];
      const a = control.pending || control.charge;
      const p = this.players[a?.playerId];
      if (!isZoneReceive(this, a, p) || this.canContact(p, a.kind)) continue;
      if (control.pending) this.tryPending(previous, control, dt);
      else this.tryHeldContact(previous, control, dt);
    }
    this.trail.push({ x: this.ball.x, y: this.ball.y });
    if (this.trail.length > 15) this.trail.shift();
    if (this.ball.y <= COURT.ballRadius) {
      this.ball.y = COURT.ballRadius;
      this.floorTouch();
      const bounceSide = this.ball.x < 0 ? 0 : 1;
      if (
        this.config.floorBounce &&
        isInside(this.ball, this.config) &&
        !this.bounces?.[bounceSide]
      ) {
        this.bounces ||= [0, 0];
        this.bounces[bounceSide]++;
        this.ball.vy = Math.max(5, Math.abs(this.ball.vy) * 0.65);
        resetFlight(this.ball);
        this.label('Один отскок — спасайте!');
        return;
      }
      const inside = isInside(this.ball, this.config),
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
      if (this.handoffMissedBlock(this.controls[team])) continue;
      if (this.config.dynamic && this.controls[team].manualSerial === this.shotSerial) continue;
      const next = nextReceiver(this, team, {
        keepReachable: true,
        preferCurrent:
          this.config.dynamic && this.lastTouch !== team && !!this.inputs?.[team]?.axis,
      });
      if (next === null || next === this.selected[team]) continue;
      this.selectControlledPlayer(this.controls[team], next);
      this.players[next].returnHome = false;
      this.players[next].clearLane = null;
    }
    if (this.mode !== 'test') this.updateCPU();
    this.movePlayers(dt, input);
    this.tryBlocks();
    for (const [, slot] of this.humanControllers()) {
      const control = this.controls[slot];
      if (control.pending && this.cooldown <= 0) this.tryPending(previous, control, dt);
      this.tryHeldContact(previous, control, dt);
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
        : shotKinds(this.config, ['serve', 'serve-motion'].includes(this.phase)).some((k) =>
            this.canContact(this.players[this.controlledPlayer(control)], k),
          );
      this.updatePreview(control);
    }
    this.controls[0].previousInput = input;
  }
  updateCharge(dt, input, press, control = this.controls[0]) {
    if (this.phase === 'serve' && this.server !== control.team) return;
    if (!['serve', 'rally'].includes(this.phase)) return;
    if (
      !shotKinds(this.config, ['serve', 'serve-motion'].includes(this.phase)).some(
        (kind) => input[kind],
      )
    )
      control.chargeLock = false;
    const replaceable = control.pending || control.charge;
    const replacement =
      replaceable &&
      shotKinds(this.config, ['serve', 'serve-motion'].includes(this.phase)).find(
        (kind) => kind !== replaceable.kind && press(kind),
      );
    if (replacement) {
      const p = this.players[replaceable.playerId];
      if (!p.diving && p.recovery <= 0 && p.block <= 0 && p.swingCooldown <= 0) {
        if (replaceable.comboQueued) cancelFeintAttack(this, control);
        // A fresh different key replaces an unconsumed attempt before it can hit.
        control.pending = null;
        control.chargeLock = false;
        control.charge = {
          kind: replacement,
          power: 0.08,
          age: 0,
          aim: aimOf(input),

          playerId: p.id,
        };
        p.armSwing = null;
        p.pose = 'ready-' + shotDefinition(replacement).pose;
        p.animation = 0.08;
        return;
      }
    }
    if (control.charge) {
      const a = control.charge,
        p = this.players[a.playerId];
      if (a.receiveHold && !validReceiveHold(this, a, p)) {
        cancelReceiveHold(this, control);
        return;
      }
      if (input[a.kind]) {
        const intentBefore = a.aim.intent;
        this.refreshAim(a, input);
        if (this.config.dynamic && intentBefore !== a.aim.intent && a.kind === 'drive') {
          a.feintAt = this.time;
          this.label('Смена замаха · ' + (ATTACKS[a.aim.intent] || 'удар'));
        }
      }
      a.age = (a.age || 0) + dt;
      if (input[a.kind]) {
        const strength = 1;
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
        this.phase !== 'serve' &&
        (a.power >= 1 || (!this.config.dynamic && a.age >= this.config.maxHold));
      if (!input[a.kind] || autoRelease) {
        const run = this.teamRuns[p.team];
        const queuedAim =
          a.kind === 'drive' &&
          run?.feint &&
          run.mode === 'queued' &&
          run.serial === this.shotSerial &&
          !input[a.kind] &&
          !input.buttonVector &&
          !input.axis &&
          !input.up &&
          !input.down
            ? { ...a.aim }
            : null;
        this.refreshAim(a, input);
        if (queuedAim)
          for (const key of ['axis', 'vector', 'up', 'down']) a.aim[key] = queuedAim[key];
        control.charge = null;
        p.releaseSlow = a.kind === 'back' ? 0 : this.config.releaseWindow;
        p.releaseSlowTotal = p.releaseSlow;
        if (autoRelease) control.chargeLock = true;
        if (this.phase !== 'serve')
          p.armSwing = { kind: a.kind, power: a.power, age: 0, hit: false, aim: a.aim };
        const action = { ...a, aim: { ...a.aim }, ttl: this.config.releaseWindow };
        if (this.phase === 'serve') this.beginServe(action, control);
        else {
          control.pending = action;
          queueFeintAttack(this, control, action);
          if (!this.tryPending(this.ball, control) && action.ttl <= 0) {
            control.pending = null;
            p.swingCooldown = 0.16;
            this.label('Мимо: касание только у мяча');
          }
        }
      }
    } else if (!control.pending && !control.chargeLock) {
      const kind = shotKinds(this.config, ['serve', 'serve-motion'].includes(this.phase)).find(
          press,
        ),
        p = this.players[this.controlledPlayer(control)];
      if (kind && !p.diving && p.recovery <= 0 && p.swingCooldown <= 0 && p.block <= 0) {
        this.emit('windup', { team: p.team, kind, power: 0.3 });
        control.charge = {
          kind,
          power: 0.08,
          age: 0,
          aim: aimOf(input),

          playerId: p.id,
        };
      }
    }
    const preparing = control.charge || control.pending;
    if (preparing && this.phase !== 'serve') {
      const p = this.players[preparing.playerId];
      if (!p.diving && p.block <= 0 && !(p.jumpProfile && p.jumpTime < p.jumpProfile.windup)) {
        p.pose = 'ready-' + shotDefinition(preparing.kind).pose;
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
  switchPlayer(control = this.controls[0], manual = true) {
    if (this.config.duel || this.challenge || (this.mode === 'test' && this.config.dynamic)) return;
    const current = this.controlledPlayer(control);
    for (let i = 1; i <= TEAM_SIZE; i++) {
      const next = control.team * TEAM_SIZE + ((current + i) % TEAM_SIZE);
      if (this.mode === 'coop' && !this.coopOwns(control.slot, next)) continue;
      if (
        !this.players[next].benched &&
        this.players[next].recovery <= 0 &&
        !this.players[next].diving
      ) {
        this.selectControlledPlayer(control, next);
        if (manual) {
          control.manualSerial = this.shotSerial;
          if (this.mode === 'coop') this.coopManualSerial[control.slot] = this.shotSerial;
        }
        return;
      }
    }
  }
  selectPassReceiver(passer, preferred = null) {
    const team = passer.team;
    if (this.phase !== 'rally' || this.lastTouch !== team || this.lastPlayer !== passer.id) return;
    if (this.config.dynamic && this.touches[team] >= 3) return;
    if (this.mode === 'coop' && team === 0) {
      this.autoCoopReceiver(preferred);
      if (this.config.dynamic && preferred === null) this.updateCoopReceiver();
      return;
    }
    if (!this.isHuman(team)) {
      this.autoSelect(team, preferred);
      return;
    }
    if (this.challenge || this.config.duel || this.mode === 'test') return;
    if (this.controls[team].manualSerial === this.shotSerial) return;
    const next = nextReceiver(this, team, {
      currentId: preferred ?? passer.id,
      preferCurrent: preferred !== null,
    });
    if (next !== null && next !== passer.id) {
      this.selectControlledPlayer(this.controls[team], next);
      this.players[next].returnHome = false;
      return;
    }
    if (this.config.dynamic) return;
    this.autoSelect(team, preferred);
  }
  selectOnOpponentContact(team) {
    this.autoSelect(team);
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
    if (
      this.config.dynamic &&
      this.isHuman(team) &&
      this.controls[team].manualSerial === this.shotSerial
    )
      return;
    if (this.isHuman(team) && (this.controls[team].charge || this.controls[team].pending)) return;
    if (
      preferred !== null &&
      this.players[preferred].team === team &&
      this.players[preferred].recovery <= 0 &&
      !this.players[preferred].diving
    ) {
      this.selectControlledPlayer(this.controls[team], preferred);
      this.players[preferred].returnHome = false;
      return;
    }
    const target = predictAtHeight(this.ball, 1.45, this.config),
      players = this.players.filter(
        (p) => !p.benched && p.team === team && p.recovery <= 0 && !p.diving,
      );
    if (!players.length) return;
    const receiverId = serveReceiver(this, team, players);
    if (receiverId !== null) {
      this.selectControlledPlayer(this.controls[team], receiverId);
      this.players[receiverId].returnHome = false;
      return;
    }
    players.sort(
      (a, b) =>
        Math.abs(a.x - target.x) +
        a.recovery * 4 +
        a.y -
        (Math.abs(b.x - target.x) + b.recovery * 4 + b.y),
    );
    this.selectControlledPlayer(this.controls[team], players[0].id);
    players[0].returnHome = false;
  }
  humanJump(p) {
    const adjustment = this.config.assist ? assistedJump(this.ball, p, this.config) : null;
    if (!this.jump(p)) return false;
    p.returnHome = false;
    if (adjustment) p.jumpProfile = adjustment.profile;
    p.jumpHold = !this.config.dynamic && this.config.variableJump;
    p.jumpButtonHold = null;
    this.emit('jump', { team: p.team, playerId: p.id });
    return true;
  }
  jump(p, block = false) {
    if (!grounded(p)) return false;
    p.jumpProfile = jumpProfile(this.config);
    p.jumpAssist = null;
    p.jumpHold = false;
    p.jumpButtonHold = null;
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
          grounded(p) &&
          p.blockCooldown <= 0,
      )
      .sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || a.id - b.id);
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
    const manualLock =
      this.config.dynamic &&
      (control.manualSerial === this.shotSerial ||
        (this.mode === 'coop' &&
          control.team === 0 &&
          this.coopManualSerial[control.slot] === this.shotSerial));
    if (this.isHuman(p.team) && this.controlledPlayer(control) === p.id && !manualLock)
      this.switchPlayer(control, false);
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
      if (
        p.benched ||
        p.team === this.lastTouch ||
        p.recovery > 0 ||
        p.diving ||
        p.block > 0 ||
        isFeintDecoy(this, p)
      )
        continue;
      const slot = this.humanSlot(p);
      // A requested reception protects the player even before the hands reach the ball.
      // Released shots remain prepared until their contact window expires.
      if ((slot !== null && hasShotInput(this.inputs?.[slot])) || this.actionForPlayer(p)) continue;
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
      const flyingHead = this.config.dynamic && this.headFlyEligible;
      p.headFly = flyingHead
        ? { x: p.x, y: p.y + 1.8, vx: clamp(this.ball.vx * 0.4, -7, 7), vy: 4.5, age: 0 }
        : null;
      p.headDetached = flyingHead;
      this.headHitEligible = false;
      this.headFlyEligible = false;
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
      this.selectOnOpponentContact(1 - p.team);
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
        if (p.headFly.age >= 1.2) p.headFly = null;
      }
      if (p.emotion && !p.jumpProfile && !p.diving && p.recovery <= 0) {
        p.emotion.age += dt;
        if (p.emotion.age >= p.emotion.duration) p.emotion = null;
      }
      p.animation = Math.max(0, p.animation - dt);
      p.block = Math.max(0, p.block - dt);
      p.blockCooldown = Math.max(0, p.blockCooldown - dt);
      if (!p.headDetached) p.recovery = Math.max(0, p.recovery - dt);
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
        const hold = p.jumpButtonHold;
        const jumpInput = this.inputs?.[hold?.slot];
        if (!this.config.dynamic)
          updateJumpButtonHold(
            p,
            this.phase === 'rally' &&
              hold?.slot != null &&
              this.humanSlot(p) === hold.slot &&
              !!(jumpInput?.jumpHeld ?? jumpInput?.jump),
            dt,
            this.config,
          );
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
      p.x = clamp(
        p.x,
        p.team === 0 ? -COURT.playerBackLimit : 0.65,
        p.team === 0 ? -0.65 : COURT.playerBackLimit,
      );
    }
  }
  returnPlayers(dt) {
    let returned = true;
    for (const p of this.players) {
      if (p.benched) continue;
      p.clearLane = null;
      p.returnHome = false;
      p.moveVx = 0;
      p.homeX = this.sign(p.team) * HOMES[p.id % TEAM_SIZE];
      const target =
        this.sign(p.team) *
        (p.id === this.server * TEAM_SIZE ? COURT.halfLength + 0.15 : HOMES[p.id % TEAM_SIZE]);
      if (!grounded(p) || (p.emotion && p.emotion.age < 0.75)) {
        p.returnVx = 0;
        returned = false;
        continue;
      }
      p.emotion = null;
      const distance = target - p.x;
      const speed = this.config.playerSpeed;
      p.returnVx = this.config.dynamic
        ? groundVelocity(p.returnVx || 0, clamp(distance * 8, -speed, speed), speed, dt)
        : clamp(distance / dt, -speed, speed);
      const delta =
        Math.abs(distance) < 0.01
          ? distance
          : Math.sign(p.returnVx) === Math.sign(distance)
            ? Math.sign(distance) * Math.min(Math.abs(distance), Math.abs(p.returnVx * dt))
            : 0;
      p.x += delta;
      if (Math.abs(target - p.x) <= 0.001) p.returnVx = 0;
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
      p.returnDelay = Math.max(p.returnDelay || 0, 0.3);
      p.returnVx = p.moveVx = p.vx = 0;
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
    if (this.config.dynamic) {
      let lower = p.team === 0 ? -COURT.playerBackLimit : 0.65;
      let upper = p.team === 0 ? -0.65 : COURT.playerBackLimit;
      for (const other of this.players) {
        if (other.benched || other.team !== p.team || other.id === p.id) continue;
        const gap = this.humanSlot(other) !== null ? 1.25 : 0.85;
        if (other.x < p.x || (other.x === p.x && other.id < p.id))
          lower = Math.max(lower, other.x + gap);
        else upper = Math.min(upper, other.x - gap);
      }
      if (lower > upper) return p.x;
      if (target < lower || target > upper) {
        if (Number.isFinite(p.returnPark) && p.returnPark >= lower && p.returnPark <= upper)
          return p.returnPark;
        p.returnPark =
          target < lower ? Math.min(upper, lower + 0.08) : Math.max(lower, upper - 0.08);
        return p.returnPark;
      }
      p.returnPark = null;
      return target;
    }
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
    if (this.tutorialScriptedOpponents && p.team === 1) return;
    if (
      (this.phase === 'serve' || this.phase === 'serve-motion') &&
      p.id === this.serverPlayer().id
    ) {
      p.moveVx = p.returnVx = p.vx = 0;
      p.runTime = 0;
      return;
    }
    const control = this.controls[this.humanSlot(p) ?? p.team];
    const input = this.inputs?.[control.slot] || (p.team === 0 ? raw : EMPTY_INPUT);
    const controlled = this.isHuman(p.team) && p.id === this.controlledPlayer(control);
    if (this.config.dynamic) {
      if (!controlled || !p.wasControlled) p.moveVx = 0;
      if (controlled) p.returnVx = 0;
      p.wasControlled = controlled;
    }
    const scheduledRun = this.teamRuns[p.team];
    if (stepFeintDecoy(this, p)) return;
    if (stepFeintAttack(this, p, dt)) return;
    if (
      controlled &&
      !scheduledRun?.feint &&
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
      p.moveVx = p.returnVx = 0;
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
          p.team === 0 ? -COURT.playerBackLimit : 0.65,
          p.team === 0 ? -0.65 : COURT.playerBackLimit,
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
    if (manual && !run?.feint && run?.playerId === p.id) run.cancelled = true;
    if (
      this.config.approachAssist &&
      (!this.config.dynamic || !this.isHuman(p.team) || !!this.training) &&
      run &&
      !run.feint &&
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
        !run.reception &&
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
        const distance = this.returnTarget(p) - p.x;
        if (this.config.dynamic) {
          const settling = p.armSwing && p.armSwing.age < 0.3;
          if (p.returnDelay > 0 || settling) p.returnVx = 0;
          else if (Math.abs(distance) < 0.01) {
            p.x += distance;
            p.returnVx = 0;
          } else {
            const maximum = this.config.playerSpeed * 0.75;
            const desired = clamp(distance * 8, -maximum, maximum);
            p.returnVx = groundVelocity(p.returnVx || 0, desired, maximum, dt);
            p.x +=
              Math.sign(p.returnVx) === Math.sign(distance)
                ? Math.sign(distance) * Math.min(Math.abs(distance), Math.abs(p.returnVx * dt))
                : 0;
          }
        } else if (p.returnDelay <= 0)
          p.x += clamp(distance, -this.config.playerSpeed * dt, this.config.playerSpeed * dt);
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
            : releaseMoveFactor(p, this.config)) *
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
        const homes = cpuStyle(this.config).homes;
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
    p.x = clamp(
      p.x,
      p.team === 0 ? -COURT.playerBackLimit : 0.65,
      p.team === 0 ? -0.65 : COURT.playerBackLimit,
    );
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
          p.team === 0 ? -COURT.playerBackLimit : 0.65,
          p.team === 0 ? -0.65 : COURT.playerBackLimit,
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
  tryHeldContact(previous = this.ball, control = this.controls[0], dt = FIXED_DT) {
    return tryHeldContact(this, previous, control, dt);
  }
  tryPending(previous = this.ball, control = this.controls[0], dt = FIXED_DT) {
    return tryPending(this, previous, control, dt);
  }
  recordContact(p, kind, power) {
    return recordContact(this, p, kind, power);
  }
  makeContact(p, kind, power, impulse) {
    return makeContact(this, p, kind, power, impulse);
  }
  planReadBlock(team, impulse) {
    if (!this.config.dynamic || this.isHuman(team) || this.config.duel) return;
    const style = cpuStyle(this.config);
    if (this.random() > cpuSkill(this.config).block * style.block) return;
    const profile = jumpProfile(this.config);
    const early = style.blockLead;
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
    if (
      this.isHuman(team) ||
      this.random() > cpuSkill(this.config).block * cpuStyle(this.config).block
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
    if (this.tutorialScriptedOpponents) return;
    if (this.cpuBlockPlan && this.time >= this.cpuBlockPlan.at) {
      const plan = this.cpuBlockPlan;
      this.cpuBlockPlan = null;
      if (plan.serial === this.shotSerial) this.requestBlock(plan.team);
    }
    for (const team of [0, 1]) {
      // The serving team cannot receive its own serve, including a net rebound.
      if (this.incomingShot === 'serve' && this.lastTouch === team) {
        this.cpuPlans[team] = null;
        continue;
      }
      if (this.isHuman(team) || this.cpuLeavesOut(team)) continue;
      if (this.config.dynamic && this.lastTouch === team && this.touches[team] >= 3) {
        this.cpuPlans[team] = null;
        continue;
      }
      const skill = cpuSkill(this.config);
      const retry = this.cpuRetry[team];
      if (retry?.serial === this.shotSerial && this.time < retry.at) continue;
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
          ? this.config.dynamic
            ? 'low'
            : 'back'
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
        let preparedKind = kind;
        if (!plan.proposal && this.random() < skill.decisionError) {
          const alternatives = shotKinds(this.config).filter(
            (candidate) => contactReason(future, { ...p, x: plan.targetX }, candidate) === null,
          );
          if (alternatives.length)
            preparedKind = alternatives[Math.floor(this.random() * alternatives.length)];
        }
        const shot = (plan.proposal ||= chooseCPUShot(future, { ...p, x: plan.targetX }, [
          preparedKind,
        ]));
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
          modifier: shot.impulse.cpuModifier,
          start: this.time,
        };
        this.emit('windup', { team, kind: shot.kind, power: shot.power });
      }
      const prep = plan.preparation;
      const age = this.time - prep.start;
      if (age > this.config.maxHold) {
        this.cpuRetry[team] = { serial: this.shotSerial, at: this.time + skill.retryDelay };
        p.armSwing = { kind: prep.kind, power: prep.power, age: 0, hit: false };
        plan.preparation = null;
        plan.action = null;
        plan.proposal = null;
        continue;
      }
      plan.action = {
        kind: prep.kind,
        power: Math.min(prep.power, 0.08 + age / this.config.chargeSeconds),
        age,
        playerId: p.id,
        aim: { soft: prep.modifier === 'soft', fast: prep.modifier === 'fast' },
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
      margin = netBallRadius(this.config) + 0.2;
    const { left, right } = courtLineBounds(this.config);
    return (
      b.y <= COURT.ballRadius &&
      b.x * this.sign(team) > 0 &&
      (b.x < left - margin || b.x > right + margin || b.z < -margin || b.z > COURT.width + margin)
    );
  }
  tryCPUContact(team, previous = this.ball) {
    const retry = this.cpuRetry[team];
    if (retry?.serial === this.shotSerial && this.time < retry.at) return;
    if (this.config.dynamic && this.lastTouch === team && this.touches[team] >= 3) return;
    if (this.incomingShot === 'serve' && this.lastTouch === team) return;
    if (this.possession !== team || this.cpuLeavesOut(team)) return;
    const plan = this.cpuPlans[team],
      p = this.active(team);
    if (p.diving || p.recovery > 0) return;
    if (plan && this.time < plan.reactionAt) return;
    if (plan && (!plan.action || plan.action.age < this.config.armWindup)) return;
    if (plan && this.time < plan.contactAt + (plan.timing || 0) - 0.06 && this.ball.y > 0.7) return;
    if (this.ball.vy > 1 && p.y < 0.2) return;
    const behind = (this.ball.x - p.x) * (p.facing || -this.sign(team)) < -0.25;
    let kinds = shotKinds(this.config, ['serve', 'serve-motion'].includes(this.phase)).filter(
      (kind) => this.canContact(p, kind),
    );
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
    if (this.makeContact(p, shot.kind, shot.power, shot.impulse)) {
      const intent = shot.impulse.intent || shot.kind;
      const modifier = shot.impulse.cpuModifier || 'normal';
      const recent = this.cpuHistory[team].slice(-2);
      this.cpuHistory[team].push({ intent, modifier, serial: this.shotSerial });
      if (this.cpuHistory[team].length > 12) this.cpuHistory[team].shift();
      const stats = this.cpuTelemetry[team];
      if (
        recent[0]?.intent === 'soft-receive' &&
        recent[1]?.intent === 'quick' &&
        recent[0].serial === this.shotSerial - 2 &&
        recent[1].serial === this.shotSerial - 1 &&
        shot.kind === 'drive'
      )
        stats.combos++;
      stats.contacts++;
      if (modifier !== 'normal') stats[modifier]++;
      stats.intents[intent] = (stats.intents[intent] || 0) + 1;
      if (p.armSwing) p.armSwing.aim = { soft: modifier === 'soft', fast: modifier === 'fast' };
    }
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
        Math.abs(this.ball.y - handY) < this.config.blockHeight &&
        this.ball.y > COURT.netHeight
      ) {
        const attacker = 1 - p.team,
          apex = p.jumpProfile.windup + p.jumpProfile.rise + p.jumpProfile.hang / 2;
        const perfect =
          Math.abs(p.jumpTime - apex) < this.config.blockWindow * 0.19 &&
          Math.abs(this.ball.y - handY) < this.config.blockHeight / 2;
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
        this.selectOnOpponentContact(attacker);
        this.label(blockText || (perfect ? 'ТОЧНЫЙ БЛОК!' : 'СМЯГЧЕНИЕ — розыгрыш продолжается'));
        this.emit('block', {
          team: p.team,
          kind: 'block',
          perfect,
          incomingSpeed: Math.hypot(incomingBlock.vx, incomingBlock.vy, incomingBlock.vz || 0),
          incomingVelocity: {
            x: incomingBlock.vx,
            y: incomingBlock.vy,
            z: incomingBlock.vz || 0,
          },
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
    if (this.ball.y <= COURT.ballRadius && this.ball.vy < 0) {
      const first = !this.ball.floorTouched;
      this.floorTouch();
      if (!first && this.ball.vy < -2) this.emit('floor', { speed: Math.abs(this.ball.vy) });
    }
    bounceFloor(this.ball, this.config);
    this.trail.push({ x: this.ball.x, y: this.ball.y });
    if (this.trail.length > 15) this.trail.shift();
  }
  point(winner, reason, contactPlayer = null) {
    if (this.training) {
      this.training.onPoint(reason);
      return;
    }
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
      if (p === contactPlayer) {
        // Let the faulting hit finish before the player's point reaction starts.
        p.emotion.age -= 0.3;
      } else {
        p.contact = null;
        p.armSwing = null;
        p.animation = 0;
      }
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
    this.emit('point', {
      winner,
      reason,
      contacts: this.rallyInfo.contacts,
      groundX:
        this.ball.floorTouched && this.ball.y <= COURT.ballRadius + 0.01 ? this.ball.x : null,
      out: !isInside(this.ball, this.config),
      ...result,
    });
  }
}
