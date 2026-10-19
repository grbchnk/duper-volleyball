import { COURT } from './config.js';
import { shotSettings } from './shot-settings.js';
import { diveHands } from './dive-pose.js';
import { isFeintDecoy } from './feint-play.js';

export function contactBounds(player, kind, config) {
  const settings = shotSettings(config, kind);
  const grounded = player.y <= 0 && player.vy <= 0 && !player.jumpProfile;
  const offset = grounded ? (player.crouchAmount || 0) * 0.4 : 0;
  return {
    minX: Math.max(player.x - settings.Reach, player.team === 1 ? -0.08 : -Infinity),
    maxX: Math.min(player.x + settings.Reach, player.team === 0 ? 0.08 : Infinity),
    minY: Math.max(0.12, settings.ContactMin + player.y - offset),
    maxY: settings.ContactMax + player.y - offset,
  };
}

export function contactReason(match, player, kind, ball = match.ball) {
  if (kind === 'back' && match.config.dynamic) return 'Используйте мягкий нижний приём';
  if (!player || player.benched) return 'Игрок недоступен';
  if (isFeintDecoy(match, player)) return 'Ложный прыжок — без касания мяча';
  const run = match.teamRuns?.[player.team];
  if (
    run?.feint &&
    run.mode === 'queued' &&
    run.attackQueued &&
    !run.attackCancelled &&
    run.serial === match.shotSerial &&
    run.playerId === player.id &&
    kind === 'drive' &&
    match.time < run.at - 0.04
  )
    return 'Ожидание навеса для атаки';
  if (match.phase !== 'rally') return 'Сейчас нет розыгрыша';
  if (player.recovery > 0) return 'Игрок поднимается';
  if (player.block > 0) return 'Игрок выполняет блок';
  if (match.cooldown > 0) return 'Еще действует пауза между касаниями';
  if (player.jumpProfile && player.jumpTime < player.jumpProfile.windup)
    return 'Еще идет подготовка прыжка';
  if ((ball.x < -0.08 && player.team !== 0) || (ball.x > 0.08 && player.team !== 1))
    return 'Мяч на другой стороне сетки';
  if (!match.config.duel && match.lastPlayer === player.id && match.lastTouch === player.team)
    return 'Нельзя два касания подряд одним игроком';
  if (player.diving) {
    if (kind !== 'low') return 'В броске доступен нижний прием';
    const hands = diveHands(player, ball, match.config);
    return ball.y >= 0.12 &&
      Math.hypot(ball.x - hands.x, ball.y - hands.y) <= COURT.ballRadius + 0.25
      ? null
      : 'Мяч вне досягаемости рук в броске';
  }
  const bounds = contactBounds(player, kind, match.config);
  if (ball.x < bounds.minX || ball.x > bounds.maxX) return 'Мяч слишком далеко';
  if (ball.y < bounds.minY) return 'Мяч слишком низко';
  if (ball.y > bounds.maxY) return 'Мяч слишком высоко';
  return null;
}
