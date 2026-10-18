import { COURT } from './config.js';
import { shotSettings } from './shot-settings.js';
import { diveHands } from './dive-pose.js';

export function contactReason(match, player, kind) {
  if (!player || player.benched) return 'Игрок недоступен';
  if (match.phase !== 'rally') return 'Сейчас нет розыгрыша';
  if (player.recovery > 0) return 'Игрок поднимается';
  if (player.block > 0) return 'Игрок выполняет блок';
  if (match.cooldown > 0) return 'Еще действует пауза между касаниями';
  if (player.jumpProfile && player.jumpTime < player.jumpProfile.windup)
    return 'Еще идет подготовка прыжка';
  const ball = match.ball;
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
  const settings = shotSettings(match.config, kind);
  const grounded = player.y <= 0 && player.vy <= 0 && !player.jumpProfile;
  const offset = grounded ? (player.crouchAmount || 0) * 0.4 : 0;
  if (Math.abs(ball.x - player.x) > settings.Reach) return 'Мяч слишком далеко';
  if (ball.y < Math.max(0.12, settings.ContactMin + player.y - offset)) return 'Мяч слишком низко';
  if (ball.y > settings.ContactMax + player.y - offset) return 'Мяч слишком высоко';
  return null;
}
