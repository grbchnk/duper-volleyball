import { LEGACY_DEFAULTS } from '../../src/legacy-profile.js';
import { SHOT_DEFAULTS } from '../../src/shot-settings.js';
// Explicit v2 physics profile for inherited regression contracts.
// Controller contracts are migrated to v3; dynamic-mechanics tests use real v3 defaults.
import { Match as CoreMatch, EMPTY_INPUT } from '../../src/engine.js';
import { DEFAULTS as CURRENT } from '../../src/config.js';
export { EMPTY_INPUT };
export const DEFAULTS = {
  ...CURRENT,
  ...SHOT_DEFAULTS,
  ...LEGACY_DEFAULTS,
  gravity: 9.81,
  ballSpeed: 1,
  backSpeedMax: 5.8,
  chargeSeconds: 0.41,
  maxHold: 0.56,
  chargeMove: 0.65,
  dynamic: false,
  approachAssist: false,
  setsToWin: 3,
  gameSpeed: 0.7,
  scoring: 'sideout',
  targetScore: 15,
  trajectory: true,
  releaseWindow: 0.06,
};
export class Match extends CoreMatch {
  get charge() {
    return this.controls[0].charge;
  }
  set charge(value) {
    this.controls[0].charge = value;
  }
  get pending() {
    return this.controls[0].pending;
  }
  set pending(value) {
    this.controls[0].pending = value;
  }
  get chargeLock() {
    return this.controls[0].chargeLock;
  }
  set chargeLock(value) {
    this.controls[0].chargeLock = value;
  }
  get previousInput() {
    return this.controls[0].previousInput;
  }
  set previousInput(value) {
    this.controls[0].previousInput = value;
  }
  get jumpArmed() {
    return this.controls[0].jumpArmed;
  }
  set jumpArmed(value) {
    this.controls[0].jumpArmed = value;
  }
  get inputPlayer() {
    return this.controls[0].inputPlayer;
  }
  set inputPlayer(value) {
    this.controls[0].inputPlayer = value;
  }
  get aimPreview() {
    return this.controls[0].aimPreview;
  }
  set aimPreview(value) {
    this.controls[0].aimPreview = value;
  }
  get contactWindow() {
    return this.controls[0].contactWindow;
  }
  set contactWindow(value) {
    this.controls[0].contactWindow = value;
  }
  constructor(config = DEFAULTS, seed = 2026) {
    super({ ...DEFAULTS, ...config }, seed);
  }
}
