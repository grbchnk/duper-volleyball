const transient = new Set(['replay', 'events', 'inputs', 'receiverForecast']);
const sceneKeys = [
  'ball',
  'players',
  'trail',
  'smokeTrail',
  'selected',
  'touches',
  'teamPhases',
  'server',
  'phase',
  'time',
  'phaseTime',
  'mode',
  'cupStage',
  'notice',
  'noticeTime',
  'pointReason',
  'pointWinner',
  'score',
  'sets',
  'prediction',
  'serveAction',
  'testNext',
  'challenge',
  'shotSerial',
  'coopSelected',
  'coopPrimary',
  'coopRotationCount',
  'controls',
  'outMarker',
  'combinations',
  'visualCombo',
];
// Retry stores simulation state once; playback stores only what the scene consumes.
export function capture(match) {
  return structuredClone(
    Object.fromEntries(Object.entries(match).filter(([key]) => !transient.has(key))),
  );
}
export function restore(match, snapshot) {
  for (const key of Object.keys(match))
    if (!transient.has(key) && !Object.hasOwn(snapshot, key)) delete match[key];
  Object.assign(match, structuredClone(snapshot));
  match.events = [];
  match.receiverForecast = null;
  match.clearControls();
}
export function captureScene(match, config = Object.freeze({ ...match.config })) {
  const scene = structuredClone(Object.fromEntries(sceneKeys.map((key) => [key, match[key]])));
  scene.config = config;
  scene.cpuPlans = match.cpuPlans?.map((plan) =>
    plan ? { serial: plan.serial, action: structuredClone(plan.action) } : null,
  );
  return scene;
}
export class Replay {
  constructor() {
    this.frames = [];
    this.last = [];
    this.start = null;
    this.lastStart = null;
    this.at = -1;
    this.sourceConfig = null;
    this.sceneConfig = null;
  }
  record(match) {
    if (match.phase === 'rally') {
      if (!this.start) this.start = capture(match);
      if (match.time - this.at < 1 / 20) return;
      this.at = match.time;
      if (this.sourceConfig !== match.config) {
        this.sourceConfig = match.config;
        this.sceneConfig = Object.freeze({ ...match.config });
      }
      this.frames.push(captureScene(match, this.sceneConfig));
      if (this.frames.length > 300) this.frames.shift();
    } else if (this.frames.length) {
      this.last = this.frames;
      this.lastStart = this.start;
      this.frames = [];
      this.start = null;
    }
  }
  retry(match) {
    const state = this.lastStart || this.start;
    if (!state) return false;
    restore(match, state);
    this.frames = [];
    this.start = null;
    this.at = -1;
    return true;
  }
  view(match, index) {
    const frame = this.last[Math.min(this.last.length - 1, Math.max(0, index))];
    return frame
      ? Object.assign(Object.create(Object.getPrototypeOf(match)), frame, { events: [] })
      : match;
  }
}
