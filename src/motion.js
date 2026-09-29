// Stylised vertical jump: quick ease-out, a tiny apex pause, then a faster fall.
// The ball retains its independent ballistic physics.
export function jumpProfile(config) {
  const natural = config.jumpSpeed / config.gravity;
  return { height: config.jumpSpeed ** 2 / (2 * config.gravity), rise: natural * .54, hang: .04, fall: natural * .45 };
}
export function sampleJump(profile, time) {
  const {height, rise, hang, fall} = profile;
  if (time < rise) {
    const u = Math.max(0, time / rise);
    return { y: height * (1 - (1-u)**2), vy: 2 * height * (1-u) / rise };
  }
  if (time < rise + hang) return {y: height, vy: 0};
  const u = Math.min(1, (time-rise-hang) / fall);
  return {y: height * (1-u*u), vy: u === 1 ? 0 : -2*height*u/fall};
}
export const jumpDuration = profile => profile.rise + profile.hang + profile.fall;
export const SERVE_WINDUP = 33 / 120;
export function serveOrigin(player, kind, config, preview = false) {
  const dir = player.team === 0 ? 1 : -1;
  const lift = preview ? (kind === 'drive' ? sampleJump(jumpProfile(config), SERVE_WINDUP).y : 0) : player.y;
  return {x: player.x + dir * (kind === 'loft' ? .2 : .5), y: lift + (kind === 'low' ? .85 : 2.05), z: 4.5};
}

// Damped wrists and a two-bone elbow. Only presentation uses these springs;
// contacts remain deterministic and never depend on the render frame rate.
export function springPoint(point, target, dt) {
  const steps = Math.max(1, Math.ceil(Math.min(dt, .1) * 120));
  const h = Math.min(dt, .1) / steps;
  for (let i=0; i<steps; i++) for (const axis of ['x','y']) {
    const velocity = axis === 'x' ? 'vx' : 'vy';
    point[velocity] += ((target[axis]-point[axis])*440 - point[velocity]*29)*h;
    point[axis] += point[velocity]*h;
  }
  return point;
}
export function elbowBetween(shoulder, wrist, bend) {
  const dx=wrist.x-shoulder.x, dy=wrist.y-shoulder.y, length=Math.max(.001,Math.hypot(dx,dy));
  const offset=Math.min(8,Math.max(2,18-length*.35))*bend;
  return {x:(shoulder.x+wrist.x)/2-dy/length*offset,y:(shoulder.y+wrist.y)/2+dx/length*offset};
}
