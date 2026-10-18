import { COURT } from './config.js';
import { clamp, resetFlight } from './physics.js';
import { challengeProfileKey } from './records.js';

export const CHALLENGES = Object.freeze({
  precision: {
    name: 'Снайпер',
    subtitle: '10 мячей · сила и направление',
    hint: 'Space — прыжок, D / ○ — удар. Меняй силу и угол, чтобы попасть в золотую зону. Z / L2 — мягкая скидка.',
    thresholds: [500, 1100, 1800],
  },
  serve: {
    name: 'Мастер подачи',
    subtitle: '10 подач · точность и ритм',
    hint: 'Зажми S / □, отпусти для подброса и нажми ещё раз у мигающего мяча. Сила определяет дальность.',
    thresholds: [450, 1000, 1700],
  },
  rescue: {
    name: 'Последний шанс',
    subtitle: '10 спасений · реакция и позиция',
    hint: 'Дождись низкого мяча! Q / E — бросок влево / вправо. На геймпаде — три быстрых нажатия направления. Ранний контакт не засчитывается.',
    thresholds: [500, 1200, 2000],
  },
});

// Fixed sequences make personal bests comparable. No randomness or stat bonuses.
const TARGETS = [6.8, 2.6, 7.8, 4.5, 1.6, 6, 3.3, 8.1, 2.2, 5.2];
const RESCUES = [1, -1, 1, 1, -1, -1, 1, -1, 1, -1];
export function challengeStars(id, score) {
  return (CHALLENGES[id]?.thresholds || []).filter((n) => score >= n).length;
}
export function targetResult(x, target, width = 2.4) {
  if (!Number.isFinite(x) || x < 0 || x > COURT.halfLength)
    return { hit: false, bullseye: false, accuracy: 0 };
  const distance = Math.abs(x - target);
  return {
    hit: distance <= width / 2,
    bullseye: distance <= 0.3,
    accuracy: clamp(1 - distance / (width / 2), 0, 1),
  };
}
export function startChallenge(match, id) {
  if (!CHALLENGES[id]) throw new Error('Неизвестное испытание');
  match.challenge = {
    profileKey: challengeProfileKey(match.config),
    profileChanged: false,
    id,
    attempt: 0,
    total: 10,
    score: 0,
    hits: 0,
    bullseyes: 0,
    combo: 0,
    bestCombo: 0,
    results: [],
    waiting: 0,
    done: false,
  };
  nextChallengeBall(match);
  match.challenge.ready = 3;
  match.challenge.readyPhase = match.phase;
  match.phase = 'challenge-ready';
}
export function nextChallengeBall(m) {
  const c = m.challenge;
  m.startServe();
  c.attempt++;
  c.waiting = 0;
  c.elapsed = 0;
  c.contacted = false;
  c.perfectServe = false;
  c.target = TARGETS[c.attempt - 1];
  c.width = c.attempt > 6 ? 1.8 : 2.4;
  m.players.forEach((p) => (p.benched = p.id !== 0));
  m.selected = [0, 3];
  if (c.id !== 'serve') {
    m.phase = 'rally';
    m.lastTouch = 1;
    m.lastPlayer = 3;
    m.incomingShot = 'loft';
    m.teamPhases = ['attack', 'defense'];
    const p = m.active();
    p.x = c.id === 'rescue' ? -5 : -1.5;
    Object.assign(m.ball, { x: p.x, y: 5.1, vx: 0, vy: 0, spin: 0 });
    if (c.id === 'rescue') {
      c.direction = RESCUES[c.attempt - 1];
      Object.assign(m.ball, {
        x: p.x + c.direction * (2.4 + (c.attempt % 3) * 0.25),
        y: 2.3,
        vx: -c.direction * 0.55,
        vy: -0.5,
      });
      m.teamPhases[0] = 'defense';
    }
    resetFlight(m.ball);
  }
  m.label(`${CHALLENGES[c.id].name} · мяч ${c.attempt} / ${c.total}`, 1.1);
  m.emit('challenge-feed', { attempt: c.attempt });
}
export function resolveChallenge(m, reason = '') {
  const c = m.challenge;
  if (!c || c.waiting || c.done) return;
  const rescue = c.id === 'rescue';
  const result = rescue
    ? {
        hit: !!c.saved && c.saveHeight <= 1.35,
        bullseye: !!c.saved && c.saveHeight < 0.65,
        accuracy: c.saved ? 1 : 0,
      }
    : c.contacted && m.ball.y <= COURT.ballRadius + 0.01
      ? targetResult(m.ball.x, c.target, c.width)
      : { hit: false, bullseye: false, accuracy: 0 };
  c.combo = result.hit ? c.combo + 1 : 0;
  c.bestCombo = Math.max(c.bestCombo, c.combo);
  const multiplier = Math.min(3, 1 + Math.floor(Math.max(0, c.combo - 1) / 3));
  const points = result.hit
    ? Math.round(
        (100 + result.accuracy * 50 + (result.bullseye ? 50 : 0) + (c.perfectServe ? 30 : 0)) *
          multiplier,
      )
    : 0;
  c.score += points;
  c.hits += Number(result.hit);
  c.bullseyes += Number(result.bullseye);
  c.results.push({ ...result, points, x: m.ball.x, reason });
  c.message = result.hit
    ? `${result.bullseye ? 'В ЯБЛОЧКО!' : rescue ? 'СПАСЕНО!' : 'В ЦЕЛЬ!'} +${points}`
    : rescue && c.saved
      ? 'РАНО · ЖДИ НИЗКИЙ МЯЧ'
      : c.contacted
        ? 'МИМО ЦЕЛИ'
        : 'МЯЧ УПУЩЕН';
  c.waiting = 1.25;
  c.saved = false;
  m.clearControls();
  m.phase = 'challenge-result';
  m.phaseTime = 0;
  m.label(c.message, 1.25);
  m.emit('challenge-result', { hit: result.hit, bullseye: result.bullseye, points });
}
export function advanceChallenge(m, dt) {
  const c = m.challenge;
  if (!c || c.done) return false;
  if (c.ready > 0) {
    m.time += dt;
    c.ready = Math.max(0, c.ready - dt);
    if (!c.ready) {
      m.phase = c.readyPhase;
      m.clearControls();
    }
    return true;
  }
  if (c.waiting > 0) {
    m.time += dt;
    m.animatePlayers(dt);
    m.stepDeadBall(dt);
    c.waiting = Math.max(0, c.waiting - dt);
    if (!c.waiting) {
      if (c.attempt === c.total) {
        c.done = true;
        c.stars = challengeStars(c.id, c.score);
        m.phase = 'finished';
        m.emit('challenge-finished', { id: c.id, score: c.score, stars: c.stars });
      } else nextChallengeBall(m);
    }
    return true;
  }
  c.elapsed += dt;
  if (c.elapsed > (c.id === 'serve' ? 14 : 7)) {
    resolveChallenge(m, 'ВРЕМЯ ВЫШЛО');
    return true;
  }
  return false;
}
