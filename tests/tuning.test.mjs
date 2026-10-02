import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT, sanitizeConfig } from '../src/config.js';
import { sampleJump, blockWindow } from '../src/motion.js';
import { ARM_STYLES } from '../src/arms.js';
const ticks = (m, n, input = {}) => {
  for (let i = 0; i < n; i++) m.tick(FIXED_DT, input);
};
function incoming(config = {}) {
  const m = new Match({ ...DEFAULTS, ...config });
  m.phase = 'rally';
  m.lastTouch = 1;
  m.lastPlayer = 3;
  m.players[0].x = -7;
  Object.assign(m.ball, { x: -4, y: 1.1, vx: 0, vy: 0 });
  return m;
}
function atBlock(offset = 0) {
  const m = incoming();
  m.incomingShot = 'drive';
  const p = m.players[2];
  m.jump(p, true);
  p.jumpTime = p.jumpProfile.windup + p.jumpProfile.rise + p.jumpProfile.hang / 2 + offset;
  Object.assign(p, sampleJump(p.jumpProfile, p.jumpTime));
  Object.assign(m.ball, { x: p.x + 0.22, y: p.y + 2.05, vx: -10, vy: -1 });
  return { m, p };
}

test('exactly three players per team; 1/2/3 and cycling select the intended role', () => {
  const m = incoming();
  assert.equal(m.players.length, 6);
  assert.deepEqual(
    m.players.slice(0, 3).map((p) => p.role),
    ['receiver', 'setter', 'open'],
  );
  m.tick(FIXED_DT, { select: 3 });
  assert.equal(m.active().role, 'open');
  m.tick(FIXED_DT, { select: 2 });
  assert.equal(m.active().role, 'setter');
  m.tick(FIXED_DT, { select: 1 });
  assert.equal(m.active().role, 'receiver');
  for (let i = 0; i < 3; i++) m.switchPlayer();
  assert.equal(m.selected[0], 0);
});
test('overholding cancels the preparation; changing held shot buttons cannot bypass the lock', () => {
  const m = incoming();
  m.ball.y = 20;
  ticks(m, 80, { low: true, axis: 1 });
  assert.equal(m.charge, null);
  assert.equal(m.pending, null);
  assert.equal(m.chargeLock, true);
  assert.equal(m.contacts, 0);
  ticks(m, 40, { drive: true });
  assert.equal(m.charge, null);
  m.tick();
  m.tick(FIXED_DT, { drive: true });
  assert.ok(m.charge);
  assert.equal(m.charge.kind, 'drive');
});
test('release grace is configurable: zero is strict; short grace expires; longer grace catches a later arrival', () => {
  for (const [window, delay, hits] of [
    [0, 1, 0],
    [0.06, 2, 1],
    [0.06, 12, 0],
    [0.2, 12, 1],
  ]) {
    const m = incoming({ releaseWindow: window });
    m.tick(FIXED_DT, { low: true });
    m.tick();
    ticks(m, delay);
    Object.assign(m.ball, { x: -7, y: 1.1, vy: 0 });
    m.tick();
    assert.equal(m.contacts, hits, `${window}s ${delay}ticks`);
  }
});
test('jump windup keeps feet planted, rejects a second jump, and is tunable', () => {
  const m = incoming();
  m.ball.y = 10;
  const p = m.active(),
    x = p.x;
  m.tick(FIXED_DT, { jump: true });
  ticks(m, 6, { axis: 1 });
  assert.equal(p.y, 0);
  assert.equal(p.pose, 'crouch');
  assert.equal(p.x, x);
  const time = p.jumpTime;
  assert.equal(m.jump(p), false);
  assert.equal(p.jumpTime, time);
  ticks(m, 8);
  assert.ok(p.y > 0);
  const fast = incoming({ jumpWindup: 0 });
  fast.tick(FIXED_DT, { jump: true });
  fast.tick();
  assert.ok(fast.active().y > 0);
});
test('blocks work only near the apex, soften at the edges, and cannot hit twice per jump', () => {
  const early = atBlock(-0.14);
  assert.equal(blockWindow(early.p, early.m.config), false);
  assert.equal(early.m.tryBlocks(), false);
  const perfect = atBlock();
  assert.equal(perfect.m.tryBlocks(), true);
  assert.equal(perfect.m.stats.softBlocks[0], 0);
  assert.ok(perfect.m.ball.vy < 0);
  perfect.m.lastTouch = 1;
  perfect.m.cooldown = 0;
  assert.equal(perfect.m.tryBlocks(), false);
  const soft = atBlock(0.05);
  assert.equal(soft.m.tryBlocks(), true);
  assert.equal(soft.m.stats.softBlocks[0], 1);
  assert.ok(soft.m.ball.vy > 0);
  const miss = atBlock();
  miss.m.ball.x += 0.6;
  assert.equal(miss.m.tryBlocks(), false);
});
test('a blocked rally still allows a new human reception and the blocker must recover', () => {
  const { m, p } = atBlock();
  assert.equal(m.tryBlocks(), true);
  ticks(m, 45);
  assert.ok(p.blockCooldown > 0);
  assert.equal(m.requestBlock(0), false);
});
test('front-player selection, windup and manual spike complete the new drill', () => {
  const m = new Match();
  m.reset('practice');
  m.startDrill('spike');
  m.tick(FIXED_DT, { select: 3 });
  ticks(m, 29);
  m.tick(FIXED_DT, { jump: true });
  ticks(m, 7);
  ticks(m, 30, { drive: true, axis: 1 });
  m.tick(FIXED_DT, { axis: 1 });
  assert.equal(m.stats.attacks[0], 1);
  assert.equal(m.players[2].contact.kind, 'drive');
  assert.ok(m.ball.vx > 0);
  assert.ok(m.ball.vy < 0);
  assert.equal(m.touches[0], 3);
});
test('all arm choices and physics controls survive JSON roundtrip and validation', () => {
  for (const armStyle of Object.keys(ARM_STYLES)) {
    const config = sanitizeConfig(
      JSON.parse(
        JSON.stringify({
          ...DEFAULTS,
          armStyle,
          releaseWindow: 0.2,
          jumpWindup: 0.12,
          armScale: 0.75,
          blockWindow: 0.09,
        }),
      ),
    );
    assert.equal(config.armStyle, armStyle);
    assert.equal(config.releaseWindow, 0.2);
    assert.equal(config.jumpWindup, 0.12);
    assert.equal(config.armScale, 0.75);
    assert.equal(config.blockWindow, 0.09);
  }
  assert.equal(sanitizeConfig({ armStyle: 'unknown' }).armStyle, 'whip');
  assert.equal(sanitizeConfig({ releaseWindow: -5 }).releaseWindow, 0);
  const capped = sanitizeConfig({ chargeSeconds: 0.9, maxHold: 0.2 });
  assert.ok(capped.maxHold >= 0.9 * 0.92 + 0.05);
});
