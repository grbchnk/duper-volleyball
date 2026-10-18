import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { DEFAULTS, COURT } from '../src/config.js';
import { traceBall } from '../src/physics.js';

test('CPU leaves clearly outgoing opponent balls but plays in-court and line balls', () => {
  for (const [x, vx, shouldHit] of [
    [8.8, 5, false],
    [8.8, 0, true],
    [9.05, 0, true],
  ]) {
    const m = new Match();
    m.phase = 'rally';
    m.lastTouch = 0;
    m.lastPlayer = 0;
    m.possession = 1;
    m.selected[1] = 3;
    m.players[3].x = x;
    Object.assign(m.ball, { x, y: 1, vx, vy: -0.8, vz: 0 });
    assert.equal(m.cpuLeavesOut(1), !shouldHit);
    m.tryCPUContact(1);
    assert.equal(m.contacts, shouldHit ? 1 : 0);
    if (!shouldHit) {
      m.lastTouch = 1;
      assert.equal(m.cpuLeavesOut(1), false, 'own deflections still need rescuing');
    }
  }
});

test('CPU serves all three types into court on either side with changed flight settings', () => {
  for (const config of [
    {},
    { cartoonFlight: 1, ballSpeed: 1.4 },
    { gravity: 16, drag: 0.055 },
    { gravity: 5, jumpSpeed: 3 },
    { gravity: 5, jumpSpeed: 5.2 },
    {
      gravity: 5,
      jumpSpeed: 3,
      drag: 0.1,
      ballSpeed: 0.6,
      cartoonFlight: 1,
      cartoonStart: 0.2,
      cartoonEnd: 1.8,
      cartoonRamp: 1.6,
      cartoonHang: 0.85,
    },
    { gravity: 16, jumpSpeed: 3, ballSpeed: 1.4, cartoonFlight: 1, cartoonHang: 0.85 },
  ])
    for (const team of [0, 1])
      for (const kind of ['low', 'loft', 'drive']) {
        const m = new Match({ ...DEFAULTS, ...config });
        m.reset('demo');
        m.server = team;
        m.startServe();
        m.beginServe({ kind, power: 0.54, aim: { axis: -m.sign(team) } });
        for (let n = 0; n < 500 && m.phase === 'serve-motion'; n++) m.tick();
        assert.equal(m.phase, 'rally', `${team} ${kind} ${JSON.stringify(config)}`);
        assert.equal(m.stats.serves[team], 1);
        const path = traceBall(m.ball, m.config, 12),
          landing = path.at(-1);
        const index = path.findIndex((b) => b.x * m.sign(team) <= 0);
        assert.ok(index > 0, `${kind} must cross the net`);
        const before = path[index - 1],
          after = path[index];
        const y = before.y + (after.y - before.y) * (-before.x / (after.x - before.x));
        assert.ok(y >= COURT.netHeight + COURT.ballRadius + 0.24, `${kind} clearance=${y}`);
        assert.ok(landing.x * m.sign(team) < -1);
        assert.ok(Math.abs(landing.x) < 9);
      }
});

test('opponent serves clear the net in live ticks at low gravity and low jump height', () => {
  for (const kind of ['low', 'loft', 'drive']) {
    const m = new Match({ ...DEFAULTS, gravity: 5, jumpSpeed: 3 });
    m.server = 1;
    m.startServe();
    m.beginServe({ kind, power: 0.54, aim: { axis: -1 } });
    let net = false,
      crossed = false;
    for (let n = 0; n < 1500 && !['point', 'set-end', 'finished'].includes(m.phase); n++) {
      m.tick();
      crossed ||= m.ball.x < -0.2;
      net ||= m.events.some((e) => e.type === 'net');
      m.events.length = 0;
    }
    assert.equal(net, false, kind);
    assert.ok(crossed, kind);
    assert.equal(m.stats.serves[1], 1);
    assert.ok(m.ball.x < 0 && m.ball.x > -9, kind);
  }
});

test('CPU starts receiving before the crossing and receives each standard human serve', () => {
  for (const kind of ['low', 'loft', 'drive']) {
    const m = new Match({ ...DEFAULTS, difficulty: 'hard' });
    m.beginServe({ kind, power: 0.5, aim: { axis: 1 } });
    while (m.phaseTime < m.serveAction.ideal - 1 / 120) m.tick();
    m.tick(1 / 120, { [kind]: true });
    assert.equal(m.phase, 'rally');
    const positions = new Map(m.players.filter((p) => p.team === 1).map((p) => [p.id, p.x]));
    for (let n = 0; n < 12; n++) m.tick();
    assert.ok(m.ball.x < 0);
    assert.notEqual(m.active(1).x, positions.get(m.active(1).id), kind);
    for (let n = 0; n < 500 && m.phase === 'rally' && m.lastTouch === 0; n++) m.tick();
    assert.equal(m.lastTouch, 1, kind);
    assert.equal(m.stats.passes[1], 1);
  }
});
