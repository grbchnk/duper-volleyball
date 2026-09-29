import { DEFAULTS, COURT, FIXED_DT, sanitizeConfig } from './config.js';
import { integrateBall, launchTo, predictAtHeight, collideNet, isInside, clamp } from './physics.js';
import { ATTACKS, SERVES, receptionChoice, setChoice, serveChoice } from './moves.js';
import { awardRally } from './rules.js';

const HOME = { receiver: 7, setter: 0.95, quick: 1.85, open: 3.15 };
const ROLES = Object.keys(HOME);
const EMPTY_INPUT = Object.freeze({ axis: 0, a: false, b: false, up: false, down: false });

export class Match {
  constructor(config = DEFAULTS, seed = 1991) {
    this.config = sanitizeConfig(config);
    this.seed = seed;
    this.mode = 'match';
    this.events = [];
    this.reset();
  }
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  emit(type, data = {}) { this.events.push({ type, time: this.time, ...data }); if (this.events.length > 80) this.events.shift(); }
  reset(mode = this.mode) {
    this.mode = mode;
    this.score = [0, 0]; this.sets = [0, 0]; this.server = 0;
    this.time = 0; this.rallies = 0; this.contacts = 0; this.specialUsed = [false, false];
    this.stats = { serves: [0, 0], attacks: [0, 0], blocks: [0, 0] };
    this.players = [0, 1].flatMap(team => ROLES.map((role, index) => ({
      team, role, number: index + 1, x: (team ? 1 : -1) * HOME[role], z: 4.5,
      y: 0, vy: 0, vx: 0, pose: 'idle', animation: 0, block: 0, stun: 0,
    })));
    this.previousInput = { ...EMPTY_INPUT };
    this.notice = 'Подача вашей команды'; this.noticeTime = 2;
    this.startServe();
  }
  player(team, role) { return this.players.find(p => p.team === team && p.role === role); }
  sign(team) { return team === 0 ? -1 : 1; }
  isHuman(team) { return team === 0 && this.mode !== 'demo'; }
  startServe() {
    this.phase = 'serve'; this.phaseTime = 0;
    this.possession = this.server; this.touches = 0; this.lastTouch = this.server;
    this.lastPlayer = null; this.cooldown = 0; this.attack = 'normal';
    this.setModifier = false; this.dumpRequested = false; this.incomingShot = 'serve';
    this.contactWindow = false; this.trail = []; this.aBuffer = 0;
    for (const p of this.players) Object.assign(p, { x: this.sign(p.team) * HOME[p.role], y: 0, vy: 0, vx: 0, block: 0, stun: 0, pose: 'idle' });
    const server = this.player(this.server, 'receiver'); server.x = this.sign(this.server) * 9.45;
    this.ball = { x: server.x, y: 1.8, z: 4.5, vx: 0, vy: 0, vz: 0, spin: 0, angle: 0 };
    this.activeRole = 'receiver';
    this.emit('serve-ready', { team: this.server });
  }
  updateConfig(config) { this.config = sanitizeConfig(config); }
  tick(dt = FIXED_DT, rawInput = EMPTY_INPUT) {
    const input = { ...EMPTY_INPUT, ...rawInput };
    input.aPressed = input.a && !this.previousInput.a;
    input.bPressed = input.b && !this.previousInput.b;
    this.previousInput = { ...input };
    if (this.phase === 'finished') return;
    this.time += dt; this.phaseTime += dt;
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.aBuffer = input.aPressed ? 0.2 : Math.max(0, this.aBuffer - dt);
    this.contactWindow = false;
    this.animatePlayers(dt);
    if (this.phase === 'point' || this.phase === 'set-end') {
      if (this.phaseTime > (this.phase === 'set-end' ? 3.5 : 2.2)) {
        if (this.phase === 'set-end') { this.score = [0, 0]; this.specialUsed = [false, false]; }
        this.startServe();
      }
      return;
    }
    if (this.phase === 'serve') {
      if ((this.isHuman(this.server) && input.aPressed) || (!this.isHuman(this.server) && this.phaseTime > 1)) this.toss(input);
      return;
    }
    if (this.phase === 'toss') { this.updateToss(dt, input); return; }

    const oldBall = { ...this.ball };
    integrateBall(this.ball, dt, this.config);
    // Explicit arcade move hook: the special serve dives after clearing the net.
    // Isolated here so real ballistic flight is not silently bent for ordinary shots.
    if (this.ball.special === 'thunder' && this.ball.x * this.sign(this.server) < -0.25) {
      launchTo(this.ball, { x: -this.sign(this.server) * 6.8, y: 0.15, z: 4.5 }, 0.45, this.config, 2.5);
      this.ball.special = null;
      this.emit('hit', { kind: 'super', team: this.server });
    }
    if (collideNet(this.ball, oldBall, this.config.restitution)) {
      this.emit('net'); this.label('СЕТКА');
    }
    this.trail.push({ x: this.ball.x, y: this.ball.y }); if (this.trail.length > 18) this.trail.shift();
    if (this.ball.y <= COURT.ballRadius) {
      this.ball.y = COURT.ballRadius;
      const inside = isInside(this.ball);
      const side = this.ball.x < 0 ? 0 : 1;
      this.point(inside ? 1 - side : 1 - this.lastTouch, inside ? 'МЯЧ НА ПОЛУ' : this.incomingShot === 'block' ? 'ONE TOUCH · АУТ ОТ БЛОКА' : 'АУТ');
      return;
    }
    if (Math.abs(this.ball.x) > 15 || this.ball.y > 30) { this.point(1 - this.lastTouch, 'АУТ'); return; }

    // Crossing the centre changes reception responsibility; block contacts are separate.
    const ballSide = this.ball.x < 0 ? 0 : 1;
    if (ballSide !== this.possession && Math.abs(this.ball.x) > 0.22) {
      this.possession = ballSide; this.touches = 0; this.lastPlayer = null;
      this.phase = 'receive'; this.phaseTime = 0; this.activeRole = 'receiver';
      this.setModifier = false; this.dumpRequested = false;
    }
    const team = this.possession;
    const human = this.isHuman(team);
    const control = human ? input : this.cpuInput(team);
    if (this.phase === 'set') {
      if (control.bPressed || (!human && control.b)) this.setModifier = true;
      if ((this.attack === 'open' || this.attack === 'back') && control.a && control.axis * -this.sign(team) > 0) this.dumpRequested = true;
    }
    this.positionPlayers(dt, input);
    this.updateBlocks(input);
    this.tryBlock();
    if (this.cooldown > 0) return;
    if (this.phase === 'receive') this.tryReceive(team, control);
    else if (this.phase === 'set') this.trySet(team);
    else if (this.phase === 'attack') this.tryAttack(team, control);
  }
  label(text, seconds = 1.2) { this.notice = text; this.noticeTime = seconds; }
  animatePlayers(dt) {
    for (const p of this.players) {
      p.animation = Math.max(0, p.animation - dt); p.block = Math.max(0, p.block - dt); p.stun = Math.max(0, p.stun - dt);
      if (p.y > 0 || p.vy > 0) { p.y = Math.max(0, p.y + p.vy * dt - 0.5 * this.config.gravity * dt * dt); p.vy -= this.config.gravity * dt; if (p.y === 0) p.vy = 0; }
      if (!p.animation && !p.block && !p.stun) p.pose = p.y > 0 ? 'jump' : Math.abs(p.vx) > 0.1 ? 'run' : 'idle';
    }
  }
  jump(p, pose = 'jump') {
    if (p.y < 0.02 && p.stun <= 0) { p.vy = this.config.jumpSpeed; p.pose = pose; p.animation = 0.7; }
  }
  toss(input) {
    const cpu = !this.isHuman(this.server);
    const control = cpu ? { axis: this.random() > 0.5 ? -this.sign(this.server) : 0, up: false } : input;
    this.serveKind = serveChoice(control, -this.sign(this.server));
    this.specialArmed = !cpu && input.up && input.b && !this.specialUsed[this.server];
    this.phase = 'toss'; this.phaseTime = 0;
    this.ball.vy = SERVES[this.serveKind].toss;
    this.label('ПОДБРОС · УДАРЬТЕ, КОГДА МЯЧ КРАСНЫЙ', 2);
    this.emit('toss');
  }
  updateToss(dt, input) {
    integrateBall(this.ball, dt, { ...this.config, drag: 0 });
    const serve = SERVES[this.serveKind];
    const server = this.player(this.server, 'receiver');
    const ideal = this.serveKind === 'jump' ? 0.59 : this.serveKind === 'over' ? 0.57 : this.serveKind === 'under' ? 0.63 : 0.77;
    const scale = Math.sqrt(9.81 / this.config.gravity);
    const targetTime = ideal * scale;
    if (this.serveKind === 'jump' && this.phaseTime > targetTime - 0.34) this.jump(server, 'spike');
    this.contactWindow = Math.abs(this.phaseTime - targetTime) < 0.15;
    const human = this.isHuman(this.server);
    if ((human && (input.aPressed || this.aBuffer > 0) && this.phaseTime > 0.2) || (!human && this.phaseTime >= targetTime)) {
      const quality = clamp(1 - Math.abs(this.phaseTime - targetTime) * 2.3, 0.2, 1);
      let kind = this.serveKind;
      if (this.specialArmed && input.b && (input.up || input.down) && this.contactWindow) {
        kind = input.down ? 'thunder' : 'sky'; this.specialUsed[this.server] = true;
      }
      const chosen = SERVES[kind];
      // A mistimed contact changes the trajectory, rather than teleporting to a keyframe.
      const target = { x: -this.sign(this.server) * (5.3 + (1 - quality) * 5 + (input.axis || 0) * 0.7), y: 0.15, z: 4.5 };
      const minFlight = Math.abs(this.ball.x) > 8 && this.ball.y < 1.8 ? Math.max(1.95, chosen.flight) : chosen.flight;
      launchTo(this.ball, target, minFlight / this.config.hitPower, this.config, kind === 'thunder' ? 2 : 0);
      this.ball.special = kind === 'thunder' ? 'thunder' : null;
      server.pose = 'spike'; server.animation = 0.32;
      this.phase = 'receive'; this.phaseTime = 0; this.cooldown = 0.35;
      this.lastTouch = this.server; this.stats.serves[this.server]++;
      this.label(chosen.name.toUpperCase()); this.emit('hit', { kind, quality, team: this.server });
      this.aBuffer = 0;
    } else if (this.ball.y < 0.6 || this.phaseTime > 2) this.point(1 - this.server, 'ОШИБКА ПОДАЧИ');
  }
  cpuInput(team) {
    const difficulty = this.config.difficulty;
    return { a: true, b: false, aPressed: false, bPressed: false, axis: 0, up: false, down: false, difficulty };
  }
  positionPlayers(dt, input) {
    const team = this.possession;
    const prediction = predictAtHeight(this.ball, this.phase === 'attack' ? 3.1 : 1.5, this.config);
    this.prediction = prediction;
    for (const p of this.players) {
      const s = this.sign(p.team);
      let target = s * HOME[p.role];
      if (p.team === team) {
        if (this.phase === 'receive' && p.role === 'receiver') target = clamp(prediction.x, s < 0 ? -10.3 : 0.5, s < 0 ? -0.5 : 10.3);
        if (this.phase === 'set' && p.role === 'setter') target = s * 0.95;
        if (this.phase === 'attack' && p.role === ATTACKS[this.attack].role) {
          target = s * ATTACKS[this.attack].x;
          const hitTime = predictAtHeight(this.ball, ATTACKS[this.attack].height, this.config).time;
          if (hitTime < 0.33 && this.ball.vy < 2) this.jump(p, 'spike');
        }
      } else if (p.role === 'quick' || p.role === 'open') target = s * (p.role === 'quick' ? 0.5 : 1.15);
      if (p.team === 0 && this.mode !== 'demo' && p.role === 'receiver' && this.phase === 'receive') {
        if (input.axis) target = p.x + input.axis * 10;
        else if (!this.config.assist) target = p.x;
      }
      const old = p.x;
      const speed = this.config.playerSpeed * (p.role === 'receiver' ? 1.25 : 1);
      if (p.stun <= 0) p.x += clamp(target - p.x, -speed * dt, speed * dt);
      p.x = clamp(p.x, s < 0 ? -10.4 : 0.32, s < 0 ? -0.32 : 10.4);
      p.vx = (p.x - old) / dt;
    }
  }
  contact(p, height, radius = 1.15) {
    return Math.abs(this.ball.x - p.x) < radius && this.ball.y >= 0.55 && this.ball.y < height && this.ball.vy < 0.6 && p.stun <= 0;
  }
  recordTouch(team, role) {
    const id = `${team}:${role}`;
    if (this.lastPlayer === id) { this.point(1 - team, 'ДВОЙНОЕ КАСАНИЕ'); return false; }
    this.touches++; this.contacts++;
    if (this.touches > 3) { this.point(1 - team, 'ЧЕТЫРЕ КАСАНИЯ'); return false; }
    this.lastPlayer = id; this.lastTouch = team; this.cooldown = 0.2;
    return true;
  }
  tryReceive(team, input) {
    // A ball still travelling away from its server must not be received by them.
    if (this.lastTouch === team && this.touches === 0 && this.ball.vx * this.sign(team) < 0) return;
    const p = this.player(team, 'receiver'); this.activeRole = 'receiver';
    const ready = this.contact(p, 1.8);
    if (team === 0 && this.isHuman(team)) this.contactWindow = ready;
    if (!ready || !(input.a || this.isHuman(team) && this.aBuffer > 0)) return;
    if (!this.recordTouch(team, p.role)) return;
    this.attack = this.isHuman(team) ? receptionChoice(input) : ['normal', 'quick', 'open'][Math.floor(this.random() * 3)];
    this.setModifier = false;
    const setter = this.player(team, 'setter');
    launchTo(this.ball, { x: setter.x, y: 2.1, z: 4.5 }, 1.15, this.config);
    p.pose = 'receive'; p.animation = 0.38;
    this.phase = 'set'; this.phaseTime = 0; this.aBuffer = 0;
    this.label(`ПРИЁМ → ${ATTACKS[this.attack].name.toUpperCase()}`);
    this.emit('hit', { kind: 'receive', team });
  }
  trySet(team) {
    const p = this.player(team, 'setter'); this.activeRole = 'setter';
    if (this.dumpRequested && this.ball.vy < 1.5) this.jump(p, 'set');
    if (!this.contact(p, this.dumpRequested ? 3.1 : 2.3, 0.95)) return;
    if (!this.recordTouch(team, p.role)) return;
    p.pose = 'set'; p.animation = 0.4;
    if (this.dumpRequested) {
      launchTo(this.ball, { x: -this.sign(team) * 2.5, y: 0.15, z: 4.5 }, 1.15, this.config);
      this.phase = 'receive'; this.phaseTime = 0; this.incomingShot = 'dump';
      this.label('СКИДКА СО ВТОРОГО КАСАНИЯ'); this.emit('hit', { kind: 'dump', team }); return;
    }
    this.attack = setChoice(this.attack, this.setModifier);
    const attack = ATTACKS[this.attack];
    launchTo(this.ball, { x: this.sign(team) * attack.x, y: attack.height, z: 4.5 }, attack.flight, this.config);
    this.phase = 'attack'; this.phaseTime = 0; this.aBuffer = 0;
    this.label(attack.name.toUpperCase()); this.emit('hit', { kind: 'set', team, attack: this.attack });
  }
  tryAttack(team, input) {
    const attack = ATTACKS[this.attack];
    const p = this.player(team, attack.role); this.activeRole = attack.role;
    const ready = this.contact(p, p.y + 2.65, 1.2) && this.ball.y > 2.05;
    if (team === 0 && this.isHuman(team)) this.contactWindow = ready;
    if (!ready || !(input.a || this.isHuman(team) && this.aBuffer > 0)) return;
    if (!this.recordTouch(team, p.role)) return;
    const kind = input.up ? 'dink' : input.down && input.b ? 'super' : this.attack;
    const s = this.sign(team);
    let targetX = 6.3 + (this.random() - 0.5) * 3;
    if (input.axis) targetX = input.axis * -s > 0 ? 8.5 : 3.3;
    if (kind === 'dink') targetX = 1.8;
    const power = (ATTACKS[kind].power || 1) * this.config.hitPower;
    let duration = kind === 'dink' ? 0.92 : (0.9 + attack.x * 0.085) / power;
    // Give the ballistic arc sufficient net clearance for the chosen launch point.
    let target = { x: -s * targetX, y: 0.15, z: 4.5 };
    for (let n = 0; n < 8; n++) {
      launchTo(this.ball, target, duration, this.config, kind === 'super' ? 2 : 0.35);
      const test = { ...this.ball }; let clearance = 9;
      for (let i = 0; i < Math.ceil(duration * 120); i++) {
        const old = test.x; integrateBall(test, FIXED_DT, this.config);
        if (old * test.x <= 0) { clearance = test.y; break; }
      }
      if (clearance > COURT.netHeight + 0.14) break;
      duration += 0.08;
    }
    p.pose = kind === 'dink' ? 'set' : 'spike'; p.animation = 0.32;
    this.stats.attacks[team]++; this.incomingShot = kind;
    this.phase = 'receive'; this.phaseTime = 0; this.cooldown = 0.22; this.aBuffer = 0;
    this.label(ATTACKS[kind].name.toUpperCase()); this.emit('hit', { kind, team });
  }
  updateBlocks(input) {
    for (const team of [0, 1]) {
      if (team === this.possession) continue;
      const human = this.isHuman(team);
      const ballApproaching = this.ball.vx * this.sign(team) > 0;
      const timeToNet = Math.abs(this.ball.x / (this.ball.vx || 0.01));
      const cpuTiming = this.config.difficulty === 'easy' ? 0.2 : this.config.difficulty === 'hard' ? 0.39 : 0.32;
      const go = human ? input.bPressed : ballApproaching && timeToNet < cpuTiming && this.ball.y > 2.4 && this.incomingShot !== 'serve';
      if (go) for (const role of ['quick', 'open']) { const p = this.player(team, role); if (p.y <= 0.02) { this.jump(p, 'block'); p.block = 0.85; } }
    }
  }
  tryBlock() {
    if (this.cooldown > 0 || Math.abs(this.ball.x) > 1.2 || this.incomingShot === 'serve') return;
    for (const p of this.players) {
      if (p.team === this.lastTouch || p.block <= 0 || p.y < 0.12) continue;
      if (Math.abs(this.ball.x - p.x) < 0.7 && this.ball.y > 2.1 && this.ball.y < p.y + 2.65) {
        this.ball.vx = -this.sign(p.team) * Math.max(3.5, Math.abs(this.ball.vx) * 0.63);
        this.ball.vy = Math.min(this.ball.vy, -1.2);
        this.lastTouch = p.team; this.lastPlayer = null; this.touches = 0;
        this.cooldown = 0.23; this.stats.blocks[p.team]++; this.incomingShot = 'block';
        this.emit('block', { team: p.team }); this.label('БЛОК!'); return;
      }
    }
  }
  point(winner, reason) {
    if (['point', 'set-end', 'finished'].includes(this.phase)) return;
    this.rallies++;
    const result = awardRally(this, winner, this.config);
    this.phase = result.matchWon ? 'finished' : result.setWon ? 'set-end' : 'point';
    this.phaseTime = 0; this.pointWinner = winner;
    this.ball.vx = this.ball.vy = this.ball.vz = 0;
    this.contactWindow = false;
    this.pointReason = reason;
    this.label(result.matchWon ? 'МАТЧ ЗАВЕРШЁН' : result.setWon ? 'СЕТ ЗАВЕРШЁН' : result.scored ? 'ОЧКО' : 'ПЕРЕХОД ПОДАЧИ', 3);
    this.emit('point', { winner, reason, ...result });
  }
}
