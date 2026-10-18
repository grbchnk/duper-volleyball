import { shotSettings } from './shot-settings.js';

export function createSkillStats() {
  return {
    aces: [0, 0],
    winners: [0, 0],
    saves: [0, 0],
    errors: [0, 0],
    clean: [0, 0],
    longestRally: 0,
    totalContacts: [0, 0],
    combinations: [0, 0],
  };
}
export function beginRally(m) {
  m.rallyInfo = { start: m.time, contacts: 0, net: false, last: null };
  m.combinations = [null, null];
  m.visualCombo = null;
}
export function observeContact(m, p, kind, power, serve = false) {
  const speed = Math.hypot(m.ball.vx, m.ball.vy) * 3.6;
  const angle = Math.round((Math.atan2(m.ball.vy, Math.abs(m.ball.vx)) * 180) / Math.PI);
  const height = m.ball.y - p.y;
  const clean =
    kind === 'drive' &&
    !serve &&
    height >= 1.75 &&
    height <= 2.55 &&
    Math.abs(m.ball.x - p.x) < 0.65;
  const save = !!p.diving;
  const label = serve
    ? m.serveAction?.perfect
      ? 'Идеальная подача'
      : 'Подача'
    : save
      ? 'Спасение в броске'
      : clean
        ? 'Чистый контакт'
        : kind === 'drive'
          ? m.ball.y < 2.43
            ? 'Удар ниже сетки'
            : 'Атака'
          : kind === 'loft'
            ? 'Верхняя передача'
            : 'Приём';
  const contact = {
    time: m.time,
    team: p.team,
    kind,
    power,
    speed,
    angle,
    clean,
    save,
    serve,
    height: m.ball.y,
    label,
  };
  m.lastContact = contact;
  if (!serve) {
    const count = m.touches[p.team];
    const previous = m.combinations?.[p.team];
    m.combinations ||= [null, null];
    m.combinations[1 - p.team] = null;
    let sequence = null;
    const centred = Math.abs(m.ball.x - p.x) <= shotSettings(m.config, kind).Reach * 0.85;
    if (count === 1 && ['low', 'back'].includes(kind) && centred)
      sequence = { stage: 1, playerId: p.id, at: m.time };
    else if (
      count === 2 &&
      previous?.stage === 1 &&
      previous.playerId !== p.id &&
      kind === 'loft' &&
      m.ball.vy > 1 &&
      centred
    )
      sequence = { stage: 2, playerId: p.id, at: m.time };
    else if (
      count === 3 &&
      previous?.stage === 2 &&
      previous.playerId !== p.id &&
      clean &&
      m.ball.vx * (p.team === 0 ? 1 : -1) > 0
    ) {
      sequence = { stage: 3, playerId: p.id, at: m.time };
      m.visualCombo = { team: p.team, at: m.time };
      m.skillStats.combinations[p.team]++;
      m.emit('combination', { team: p.team, x: m.ball.x, y: m.ball.y });
    }
    m.combinations[p.team] = sequence;
    contact.comboStage = sequence?.stage || 0;
  }
  m.rallyInfo.last = contact;
  m.rallyInfo.contacts++;
  m.skillStats.totalContacts[p.team]++;
  if (clean) m.skillStats.clean[p.team]++;
  if (save) m.skillStats.saves[p.team]++;
  if (m.challenge && p.team === 0) {
    m.challenge.contacted = true;
    m.challenge.perfectServe = !!m.serveAction?.perfect;
    if (save) {
      m.challenge.saved = true;
      m.challenge.saveHeight = m.ball.y;
    }
  }
  return contact;
}
export function summarizeRally(m, winner, reason) {
  const r = m.rallyInfo;
  const last = r.last;
  const duration = Math.max(0, m.time - r.start);
  m.skillStats.longestRally = Math.max(m.skillStats.longestRally, r.contacts);
  let headline = reason;
  let hint = 'Ищи свободную зону и меняй силу удара.';
  if (last?.team === winner && reason === 'МЯЧ КОСНУЛСЯ ПЛОЩАДКИ') {
    if (last.serve && r.contacts === 1) {
      m.skillStats.aces[winner]++;
      headline = 'ЭЙС · ПОДАЧА НАВЫЛЕТ';
    } else {
      m.skillStats.winners[winner]++;
      headline = last.save ? 'СПАСЕНИЕ ПРИНЕСЛО ОЧКО' : 'МЯЧ В СВОБОДНУЮ ЗОНУ';
    }
    hint =
      last.kind === 'drive'
        ? 'Удачный выбор направления и момента атаки.'
        : 'Точность важнее максимальной силы.';
  } else if (last?.team === 1 - winner) {
    m.skillStats.errors[1 - winner]++;
    if (reason.includes('АУТ'))
      hint = 'Сократи заряд или направь мяч выше: сильный плоский удар легко уходит за линию.';
    else if (r.net)
      hint = 'Мяч задел сетку. Поднимай точку контакта прыжком или добавь угол вверх.';
    else if (reason.includes('КАСАН')) hint = 'Передай партнёру: доступны три командных касания.';
  } else if (!last) hint = 'Подача требует второго нажатия после подброса.';
  const summary = { headline, hint, contacts: r.contacts, duration, winner, reason };
  m.lastRally = summary;
  return summary;
}
