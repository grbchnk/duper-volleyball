import { mkdir, writeFile } from 'node:fs/promises';
import { Match } from '../src/engine.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { CPU_STYLES } from '../src/cpu-styles.js';

// Both opponents use production planning, input timing and physics. Only their
// style/skill configurations differ; no positions or ball impulses are injected.
class Duel extends Match {
  constructor(left, right, seed) {
    super({ ...DEFAULTS, targetScore: 5 }, seed);
    this.profiles = [left, right];
    this.reset('demo');
  }
  as(team, fn) {
    const before = this.config;
    this.config = { ...before, ...this.profiles[team] };
    try {
      return fn();
    } finally {
      this.config = before;
    }
  }
  tick(...args) {
    return this.as(this.server, () => super.tick(...args));
  }
  updateCPU() {
    const human = this.isHuman;
    const own = Object.hasOwn(this, 'isHuman');
    try {
      for (const team of [0, 1]) {
        this.isHuman = (other) => other !== team;
        this.as(team, () => super.updateCPU());
      }
    } finally {
      if (own) this.isHuman = human;
      else delete this.isHuman;
    }
  }
  movePlayer(p, ...args) {
    return this.as(p.team, () => super.movePlayer(p, ...args));
  }
  tryCPUContact(team, ...args) {
    return this.as(team, () => super.tryCPUContact(team, ...args));
  }
  planReadBlock(team, ...args) {
    return this.as(team, () => super.planReadBlock(team, ...args));
  }
  scheduleCPUBlock(team, ...args) {
    return this.as(team, () => super.scheduleCPUBlock(team, ...args));
  }
  beginServe(...args) {
    return this.as(this.server, () => super.beginServe(...args));
  }
}

const ladder = process.argv.includes('--ladder');
const ids = ladder
  ? ['adaptive']
  : process.argv.includes('--smoke')
    ? ['quick', 'adaptive']
    : Object.keys(CPU_STYLES);
const games = [];
for (const id of ids) {
  for (const level of ladder ? [0, 50, 100] : [100]) {
    for (const side of [0, 1]) {
      const profiles = [
        { cpuStyle: 'balanced', cpuSkill: 75 },
        { cpuStyle: 'balanced', cpuSkill: 75 },
      ];
      profiles[side] = { cpuStyle: id, cpuSkill: level };
      const m = new Duel(...profiles, 17023 + side * 711);
      let faults = 0;
      for (let step = 0; step < 24000 && m.phase !== 'finished'; step++) {
        m.tick(FIXED_DT);
        faults += m.events.filter(
          (e) => e.type === 'point' && ['ЧЕТВЁРТОЕ КАСАНИЕ', 'МЯЧ ПОД СЕТКОЙ'].includes(e.reason),
        ).length;
        m.events = [];
        if (!Number.isFinite(m.ball.x + m.ball.y + m.ball.vx + m.ball.vy))
          throw Error('Non-finite physics');
      }
      const game = {
        style: id,
        skill: level,
        side,
        finished: m.phase === 'finished',
        score: m.score,
        points: m.score[side],
        conceded: m.score[1 - side],
        seconds: Math.round(m.time),
        contacts: m.contacts,
        faults,
        telemetry: m.cpuTelemetry[side],
      };
      games.push(game);
      console.log(JSON.stringify(game));
    }
  }
}
const ranking = [...new Set(games.map((g) => `${g.style}/${g.skill}`))]
  .map((key) => {
    const [id, skill] = key.split('/');
    const rows = games.filter((g) => g.style === id && g.skill === Number(skill));
    const points = rows.reduce((n, g) => n + g.points, 0);
    const conceded = rows.reduce((n, g) => n + g.conceded, 0);
    return {
      style: id,
      skill: Number(skill),
      points,
      conceded,
      rate: points / Math.max(1, points + conceded),
    };
  })
  .sort((a, b) => a.rate - b.rate);
await mkdir('docs', { recursive: true });
await writeFile(
  ladder
    ? 'docs/CPU-SKILL-AUDIT-2026-10-20.json'
    : process.argv.includes('--smoke')
      ? '.cache/cpu-smoke.json'
      : 'docs/CPU-AUDIT-2026-10-20.json',
  JSON.stringify(
    {
      protocol:
        'Style/skill profiles vs balanced 75, mirrored sides, seeded full simulation, 5 points or 200 game seconds. Small diagnostic sample, not a proof of invincibility.',
      games,
      ranking,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ ranking }));
