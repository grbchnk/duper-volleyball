import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { COURT, FIXED_DT } from '../src/config.js';

test('receivers can move during serve preparation and toss without moving the server', () => {
  for (const mode of ['single', 'versus', 'coop']) {
    for (const server of mode === 'versus' ? [0, 1] : [1]) {
      for (const tossing of [false, true]) {
        const m = new Match();
        m.reset(mode);
        m.server = server;
        m.startServe();
        if (tossing) m.beginServe({ kind: 'loft', power: 0.54, aim: { axis: 0 } });
        const phase = m.phase;
        const receiver = m.active(1 - server);
        const partner = mode === 'coop' ? m.players[m.coopSelected] : null;
        const before = receiver.x;
        const partnerBefore = partner?.x;
        const servingPlayer = m.serverPlayer();
        const servingX = servingPlayer.x;
        const input = { axis: m.sign(server) };
        for (let i = 0; i < 12; i++)
          m.tick(FIXED_DT, server === 1 ? input : {}, server === 0 || partner ? input : {});
        assert.equal(m.phase, phase);
        assert.ok((receiver.x - before) * input.axis > 0, `${mode}/${server}/${phase}`);
        if (partner) assert.ok((partner.x - partnerBefore) * input.axis > 0);
        assert.equal(servingPlayer.x, servingX);
        assert.equal(m.contacts, 0);
      }
    }
  }
});

test('coop partner can reposition but the server stays planted on either role rotation', () => {
  for (const rotation of [0, 1]) {
    for (const tossing of [false, true]) {
      const m = new Match();
      m.reset('coop');
      m.coopRotationCount = rotation;
      m.server = 0;
      m.startServe();
      if (tossing) m.beginServe({ kind: 'loft', power: 0.54, aim: { axis: 1 } });
      const phase = m.phase;
      const players = [m.players[m.coopPlayer(0)], m.players[m.coopPlayer(2)]];
      const before = players.map((p) => p.x);
      for (let i = 0; i < 12; i++) m.tick(FIXED_DT, { axis: 1 }, { axis: 1 });
      assert.equal(m.phase, phase);
      players.forEach((p, i) => {
        if (p.id === m.serverPlayer().id) assert.equal(p.x, before[i]);
        else assert.ok(p.x > before[i], `${rotation}/${phase}/${i}`);
      });
      assert.equal(m.contacts, 0);
      assert.equal(m.controls[m.serverSlot() === 0 ? 2 : 0].charge, null);
    }
  }
});

test('manual movement cannot shift any serve during charging or alter its authored runup', () => {
  for (const team of [0, 1])
    for (const kind of ['low', 'back', 'loft', 'drive']) {
      const m = new Match();
      m.reset('versus');
      m.server = team;
      m.startServe();
      const p = m.serverPlayer();
      const startX = p.x;
      p.moveVx = 3;
      const step = (input) => m.tick(FIXED_DT, team === 0 ? input : {}, team === 1 ? input : {});
      for (let i = 0; i < 24; i++) {
        step({ [kind]: true, axis: i < 12 ? -1 : 1 });
        assert.equal(p.x, startX, `${team}/${kind}/charge`);
        assert.equal(p.moveVx, 0, 'no residual movement builds up');
      }
      assert.ok(m.controls[team].charge.power > 0.08);
      step({ axis: 1 });
      assert.equal(m.phase, 'serve-motion');
      const neutral = new Match();
      neutral.reset('versus');
      neutral.server = team;
      neutral.startServe();
      neutral.beginServe({ kind, power: m.serveAction.power, aim: {} });
      const ideal = m.serveAction.ideal;
      for (let i = 0; m.phaseTime < ideal - 2 * FIXED_DT; i++) {
        step({ axis: i % 2 ? -1 : 1 });
        neutral.tick(FIXED_DT);
        assert.equal(p.x, neutral.serverPlayer().x, `${team}/${kind}/toss`);
        assert.equal(p.y, neutral.serverPlayer().y, 'the jump remains intact');
        assert.equal(p.moveVx, 0);
      }
      if (kind === 'drive') assert.notEqual(p.x, startX, 'the serve still has its own runup');
      else assert.equal(p.x, startX);
    }
});

test('the server can move again immediately after striking the serve', () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.reset('versus');
    m.server = team;
    m.startServe();
    const p = m.serverPlayer();
    m.beginServe({ kind: 'low', power: 0.6, aim: {} });
    m.phaseTime = m.serveAction.ideal - FIXED_DT;
    m.tick(FIXED_DT, team === 0 ? { low: true } : {}, team === 1 ? { low: true } : {});
    assert.equal(m.phase, 'rally');
    const before = p.x;
    const input = { axis: -m.sign(team) };
    for (let i = 0; i < 12; i++) m.tick(FIXED_DT, team === 0 ? input : {}, team === 1 ? input : {});
    assert.ok((p.x - before) * input.axis > 0);
  }
});

test('players can retreat behind the baseline, jump there and receive a teammate return', () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.reset('versus');
    m.phase = 'rally';
    m.inputs = [{}, {}];
    m.inputs[team] = { axis: m.sign(team) };
    const p = m.active(team);
    for (let i = 0; i < 240; i++) {
      m.animatePlayers(FIXED_DT);
      m.movePlayers(FIXED_DT, {});
    }
    assert.equal(p.x, m.sign(team) * COURT.playerBackLimit);
    assert.ok(Math.abs(p.x) > 10.5);
    m.humanJump(p);
    for (let i = 0; i < 20; i++) {
      m.animatePlayers(FIXED_DT);
      m.movePlayers(FIXED_DT, {});
      assert.equal(p.x, m.sign(team) * COURT.playerBackLimit);
    }
    assert.ok(p.y > 0);
    m.inputs[team] = {};
    for (let i = 0; i < 300; i++) m.animatePlayers(FIXED_DT);
    m.incomingShot = 'loft';
    m.lastTouch = team;
    m.lastPlayer = team * 3 + 1;
    m.cooldown = 0;
    Object.assign(m.ball, {
      x: p.x,
      y: (m.config.lowContactMin + m.config.lowContactMax) / 2,
      vx: 0,
      vy: -1,
    });
    assert.equal(m.canContact(p, 'low'), true);
    assert.equal(m.makeContact(p, 'low', 0.5, { vx: -m.sign(team) * 5, vy: 5, vz: 0 }), true);
    assert.equal(m.phase, 'rally');
  }
});
