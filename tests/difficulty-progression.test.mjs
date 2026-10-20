import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { cpuSkill, planReception } from '../src/cpu.js';
import { TOUR } from '../src/club.js';
import { ARENAS } from '../src/arenas.js';
import { COURT } from '../src/config.js';
import { traceBall } from '../src/physics.js';

test('a missed human serve bounces with the falling toss momentum and one floor event', () => {
  for (const kind of ['low', 'loft', 'drive']) {
    const m = new Match();
    m.reset('versus');
    m.beginServe({ kind, power: 0.6, aim: {} });
    for (let n = 0; n < 600 && m.phase === 'serve-motion'; n++) m.tick();
    assert.equal(m.phase, 'point');
    assert.equal(m.ball.y, COURT.ballRadius);
    assert.ok(m.ball.vy > 1, `${kind}: the missed toss must bounce upward`);
    const height = m.ball.y;
    m.tick();
    assert.ok(m.ball.y > height);
    assert.equal(m.events.filter((e) => e.type === 'floor-touch').length, 1);
    assert.deepEqual(m.score, [0, 1]);
  }
});

test('the difficulty range increases movement and accuracy while reducing reaction delay', () => {
  let previous;
  for (let cpuSkillValue = 0; cpuSkillValue <= 100; cpuSkillValue++) {
    const skill = cpuSkill({ cpuSkill: cpuSkillValue });
    if (previous) {
      assert.ok(skill.speed > previous.speed);
      assert.ok(skill.reaction < previous.reaction);
      assert.ok(skill.error < previous.error);
      assert.ok(skill.serveMiss <= previous.serveMiss);
    }
    previous = skill;
  }
  const easy = cpuSkill({ cpuSkill: 0 });
  assert.ok(easy.speed >= 0.9 && easy.reaction < 0.3 && easy.error <= 0.6);
  assert.ok(easy.decisionError > 0 && easy.passError > 0 && easy.timingError > 0);
  assert.equal(previous.error, 0);
  assert.equal(previous.serveMiss, 0);
});

test('beginner serves include missed tosses and legal serves; professionals serve legally on both sides', () => {
  for (const level of [0, 100]) {
    let misses = 0,
      legal = 0;
    for (let seed = 1; seed <= 36; seed++) {
      const m = new Match({ cpuSkill: level }, seed * 100003);
      m.reset('demo');
      m.server = seed % 2;
      m.startServe();
      const kind = ['low', 'loft', 'drive'][seed % 3];
      m.beginServe({ kind, power: 0.54, aim: {} });
      for (let n = 0; n < 600 && m.phase === 'serve-motion'; n++) m.tick();
      if (!m.stats.serves[m.server]) {
        misses++;
        assert.equal(m.phase, 'point');
        assert.ok(m.ball.vy > 0, 'a bot missed toss also bounces');
      } else {
        const landing = traceBall(m.ball, m.config, 12).at(-1);
        if (landing.x * m.sign(m.server) < -1 && Math.abs(landing.x) < 9) legal++;
      }
    }
    if (level === 0) {
      assert.ok(misses >= 2 && misses <= 12, `beginner missed ${misses}/36 tosses`);
      assert.ok(legal > 5 && legal < 36, `beginner legal serves: ${legal}/36`);
    } else {
      assert.equal(misses, 0);
      assert.equal(legal, 36);
    }
  }
});

test('both levels read a routine ball, while a professional reacts earlier and aims more accurately', () => {
  const plans = [0, 100].map((cpuSkillValue) => {
    const m = new Match({ cpuSkill: cpuSkillValue }, 1234);
    m.phase = 'rally';
    m.lastTouch = 0;
    Object.assign(m.ball, { x: 4.5, y: 3, vx: 3, vy: -2 });
    return planReception(m, 1);
  });
  assert.ok(plans[1].reactionAt < plans[1].contactAt);
  assert.ok(plans[0].reactionAt < plans[0].contactAt);
  assert.ok(plans[0].reactionAt > plans[1].reactionAt);
  assert.ok(Math.abs(plans[0].error) > Math.abs(plans[1].error));
});

test('all tournament stages use distinct supported arenas and strictly increasing difficulty to 100', () => {
  assert.equal(new Set(TOUR.map((s) => s.arena)).size, TOUR.length);
  for (let i = 0; i < TOUR.length; i++) {
    assert.ok(ARENAS[TOUR[i].arena]);
    if (i) assert.ok(TOUR[i].skill > TOUR[i - 1].skill);
  }
  assert.equal(TOUR[0].skill, 0);
  assert.equal(TOUR.at(-1).skill, 100);
});
