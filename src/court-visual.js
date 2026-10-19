import { COURT } from './config.js';

// Actors occupy one fixed depth lane inside the decorative perspective court.
export const COURT_VIEW = Object.freeze({ center: 480, floor: 465, scaleX: 40, scaleY: 42 });
export function projectCourt(x, y = 0) {
  return {
    x: COURT_VIEW.center + x * COURT_VIEW.scaleX,
    y: COURT_VIEW.floor - y * COURT_VIEW.scaleY,
  };
}
export const NET_BOTTOM = COURT.netHeight - COURT.netDepth;

export const STREET_COURT = Object.freeze({
  backY: 408,
  frontY: 496,
  backLeft: 102,
  backRight: 859,
  frontLeft: 33,
  frontRight: 929,
});
export function projectStreetNet(depth, height) {
  const span = STREET_COURT.frontY - STREET_COURT.backY;
  const lane = (COURT_VIEW.floor - STREET_COURT.backY) / span;
  return {
    x: COURT_VIEW.center + (depth - lane) * 22,
    y: STREET_COURT.backY + depth * span - height * COURT_VIEW.scaleY,
  };
}
export const usesPerspectiveCourt = (theme) =>
  ['miami', 'beach', 'gym', 'farm', 'alpine', 'sky', 'championship'].includes(theme);
export function courtLineBounds(config = null) {
  if (!usesPerspectiveCourt(config?.arenaTheme))
    return { left: -COURT.halfLength, right: COURT.halfLength };
  // Jump height does not change the lane: intersect each painted end line
  // with the floor beneath the actors, never with the airborne ball's screen y.
  const t = (COURT_VIEW.floor - STREET_COURT.backY) / (STREET_COURT.frontY - STREET_COURT.backY);
  const left = STREET_COURT.backLeft + (STREET_COURT.frontLeft - STREET_COURT.backLeft) * t;
  const right = STREET_COURT.backRight + (STREET_COURT.frontRight - STREET_COURT.backRight) * t;
  return {
    left: (left - COURT_VIEW.center) / COURT_VIEW.scaleX,
    right: (right - COURT_VIEW.center) / COURT_VIEW.scaleX,
  };
}
