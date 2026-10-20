import { COURT } from './config.js';
import { sampleServeMotion, serveOrigin } from './motion.js';
import { serveContactQuality } from './serve-settings.js';

// Both the live strike and its visual timing use the same toss and hand distance.
export function sampleServeContact(player, action, time, config) {
  const ball = sampleServeMotion(player, action, time);
  const hand = serveOrigin(player, action.kind, config);
  const distance = Math.hypot(ball.x - hand.x, ball.y - hand.y);
  return {
    ball,
    distance,
    quality: serveContactQuality(action.settings, time - action.ideal, distance),
  };
}

export function serveContactWindow(player, action, config) {
  const inside = (time) => {
    const { ball, quality } = sampleServeContact({ ...player }, { ...action }, time, config);
    return ball.y > COURT.ballRadius && quality >= 1 - 1e-9;
  };
  const limit = Math.min(action.settings.PerfectWindow, action.settings.HitWindow);
  const boundary = (outside) => {
    if (inside(outside)) return outside;
    let within = action.ideal;
    for (let i = 0; i < 32; i++) {
      const middle = (outside + within) / 2;
      if (inside(middle)) within = middle;
      else outside = middle;
    }
    return within;
  };
  return {
    start: boundary(Math.max(action.tossDelay || 0, action.ideal - limit)),
    end: boundary(action.ideal + limit),
  };
}
