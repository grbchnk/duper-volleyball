import { COURT } from './config.js';

export function constrainWorldHand(point, player, ball, allowOver = false) {
  if (allowOver && ball?.y > COURT.netHeight && point.y > COURT.netHeight + 0.1) return point;
  const side = player.team === 0 ? -1 : 1;
  return { ...point, x: side * Math.max(0.13, point.x * side) };
}

// Bound the final sprung geometry too: an old contact or spring overshoot can cross the net.
export function constrainRenderedJoint(joint, transform, project, team, ball, allowOver = false) {
  if (typeof transform.transformPoint !== 'function') return;
  const screen = transform.transformPoint(joint);
  const net = project(0, COURT.netHeight + 0.1);
  if (allowOver && ball?.y > COURT.netHeight && screen.y < net.y) return;
  const side = team === 0 ? -1 : 1;
  if ((screen.x - net.x) * side >= 5) return;
  const point = transform.inverse().transformPoint({ x: net.x + side * 5, y: screen.y });
  Object.assign(joint, { x: point.x, y: point.y, vx: 0, vy: 0 });
}
