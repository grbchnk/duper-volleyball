// Physical key codes: Russian/English keyboard layouts have identical controls.
export class InputBuffer {
  constructor(
    getGamepads = () => globalThis.navigator?.getGamepads?.() ?? [],
    now = () => performance.now(),
    slot = 0,
  ) {
    this.slot = slot;
    this.rightStickAim = false;
    this.rightGesture = null;
    this.previousDiveClick = false;
    this.padIndex = null;
    this.aimMagnitude = 0;
    this.aimReleasing = false;
    this.aimRestUntil = 0;
    this.leftAim = null;
    this.now = now;
    this.lastDirectionTap = null;
    this.previousPadDirection = 0;
    this.divePulse = 0;
    this.held = new Set();
    this.pressed = new Set();
    this.getGamepads = getGamepads;
    this.gamepad = null;
    this.padButtonsHeld = new Set();
    this.blockedPadButtons = new Set();
    this.previousPause = false;
    this.pausePressed = false;
    this.previousConfirm = false;
    this.confirmPressed = false;
    this.stickX = 0;
    this.shotStick = null;
    this.shotStrength = 0;
    this.shotAxis = null;
    this.shotVector = null;
    this.blockedShotStick = false;
  }
  down(code, repeat = false) {
    if (!repeat && !this.held.has(code) && ['ArrowLeft', 'ArrowRight'].includes(code))
      this.directionTap(code === 'ArrowLeft' ? -1 : 1);
    this.held.add(code);
    if (!repeat) this.pressed.add(code);
  }
  up(code) {
    this.held.delete(code);
  }
  clear() {
    this.rightGesture = null;
    this.lastDirectionTap = null;
    this.divePulse = 0;
    this.held.clear();
    this.pressed.clear();
    for (const button of this.padButtonsHeld) this.blockedPadButtons.add(button);
    if (this.shotStick) this.blockedShotStick = true;
    this.shotStick = null;
    this.shotStrength = 0;
    this.shotAxis = null;
    this.shotVector = null;
  }
  poll() {
    const pads = Array.from(this.getGamepads() ?? []);
    if (this.padIndex === null) {
      const available = pads
        .map((pad, index) => ({ pad, index }))
        .filter(({ pad }) => pad?.connected && pad.mapping === 'standard');
      this.padIndex = available[this.slot]?.index ?? null;
    }
    const assigned = this.padIndex === null ? null : pads[this.padIndex];
    this.gamepad = assigned?.connected ? assigned : null;
    const rawButton = (index) => {
      const button = this.gamepad?.buttons?.[index];
      return !!button && (button.pressed || (button.value ?? 0) >= 0.5);
    };
    const rawButtons = new Set(
      Array.from({ length: this.gamepad?.buttons?.length ?? 0 }, (_, index) => index).filter(
        rawButton,
      ),
    );
    for (const index of this.blockedPadButtons)
      if (!rawButtons.has(index)) this.blockedPadButtons.delete(index);
    this.padButtonsHeld = rawButtons;
    const px = this.gamepad?.axes?.[0] ?? 0,
      py = this.gamepad?.axes?.[1] ?? 0;
    const radius = Math.hypot(px, py);
    if (radius < this.aimMagnitude - 0.1) this.aimReleasing = true;
    if (radius < 0.22 && this.aimMagnitude >= 0.22) this.aimRestUntil = this.now() + 100;
    if (radius >= 0.55 && radius > this.aimMagnitude + 0.1 && this.now() >= this.aimRestUntil)
      this.aimReleasing = false;
    this.leftAim =
      radius >= 0.4 && !this.aimReleasing && this.now() >= this.aimRestUntil
        ? { x: px / radius, y: -py / radius || 0 }
        : null;
    this.aimMagnitude = radius;
    const padDirection =
      Number(this.padButton(15)) - Number(this.padButton(14)) ||
      (Math.abs(px) > (this.previousPadDirection === Math.sign(px) ? 0.3 : 0.65) &&
      Math.abs(px) > Math.abs(py)
        ? Math.sign(px)
        : 0);
    if (padDirection && padDirection !== this.previousPadDirection) this.directionTap(padDirection);
    this.previousPadDirection = padDirection;
    const diveClick = this.padButton(11);
    if (diveClick && !this.previousDiveClick) this.divePulse = Math.sign(px) || padDirection || 1;
    this.previousDiveClick = diveClick;
    this.pausePressed = rawButton(9) && !this.previousPause;
    this.previousPause = rawButton(9);
    this.confirmPressed = rawButton(0) && !this.previousConfirm;
    this.previousConfirm = rawButton(0);
    const stickX = this.gamepad?.axes?.[0] ?? 0;
    this.stickX =
      Math.abs(stickX) < 0.18 ? 0 : (Math.sign(stickX) * (Math.abs(stickX) - 0.18)) / 0.82;
    const finiteAxis = (index) => {
      const value = this.gamepad?.axes?.[index] ?? 0;
      return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    };
    const x = finiteAxis(2),
      y = finiteAxis(3),
      magnitude = Math.min(1, Math.hypot(x, y));
    if (this.rightStickAim && !this.blockedShotStick) {
      const now = this.now();
      let gesture = this.rightGesture;
      if (!gesture && magnitude >= 0.25 && now >= (this.rightRestUntil || 0)) {
        const scores = { back: -x, drive: x, low: y, loft: -y };
        const kind = Object.keys(scores).reduce((a, b) => (scores[a] > scores[b] ? a : b));
        gesture = this.rightGesture = {
          kind,
          vector: { x: x / Math.hypot(x, y), y: -y / Math.hypot(x, y) },
          magnitude,
          releaseAt: null,
        };
      }
      if (gesture) {
        const falling = magnitude < gesture.magnitude - 0.08;
        if (magnitude < 0.22 && gesture.releaseAt === null) gesture.releaseAt = now;
        // A strong deliberate new pull can cross the centre; weak spring recoil
        // cannot overwrite the last intentional vector or start a new gesture.
        const deliberate = magnitude >= 0.55 && (!falling || magnitude >= 0.85);
        if (deliberate) {
          gesture.vector = { x: x / Math.hypot(x, y), y: -y / Math.hypot(x, y) };
          gesture.releaseAt = null;
        }
        if (gesture.releaseAt !== null && now - gesture.releaseAt >= 40) {
          this.rightGesture = null;
          this.shotStick = null;
          this.shotVector = null;
          this.shotStrength = 0;
          this.shotAxis = null;
          this.rightRestUntil = now + 60;
        } else {
          this.shotStick = gesture.kind;
          this.shotVector = gesture.vector;
          this.shotAxis = Math.sign(gesture.vector.x);
          this.shotStrength =
            gesture.releaseAt !== null || falling ? 0 : Math.max(0.08, (magnitude - 0.18) / 0.82);
          gesture.magnitude = magnitude;
        }
      } else {
        this.shotStick = null;
        this.shotVector = null;
        this.shotStrength = 0;
        this.shotAxis = null;
      }
      return;
    }
    if (magnitude <= 0.18) this.blockedShotStick = false;
    if (this.blockedShotStick || magnitude < (this.shotStick ? 0.18 : 0.25)) {
      this.shotStick = null;
      this.shotStrength = 0;
      this.shotAxis = null;
      this.shotVector = null;
    } else {
      // Change sectors immediately; a small angular margin prevents diagonal jitter.
      const scores = { back: -x, drive: x, low: y, loft: -y };
      const candidate = Object.keys(scores).reduce((a, b) => (scores[a] > scores[b] ? a : b));
      if (
        !this.shotStick ||
        (!this.rightStickAim && scores[candidate] > scores[this.shotStick] + magnitude * 0.16)
      )
        this.shotStick = candidate;
      this.shotStrength = Math.max(0.08, (magnitude - 0.18) / 0.82);
      this.shotAxis = Math.sign(x);
      this.shotVector = { x: x / Math.hypot(x, y), y: -y / Math.hypot(x, y) };
    }
  }
  padButton(index) {
    return this.padButtonsHeld.has(index) && !this.blockedPadButtons.has(index);
  }
  directionTap(direction) {
    const at = this.now();
    if (this.lastDirectionTap?.direction === direction && at - this.lastDirectionTap.at <= 280) {
      const count = this.lastDirectionTap.count + 1;
      this.divePulse = count === 3 ? direction : 0;
      this.lastDirectionTap = count === 3 ? null : { direction, at, count };
    } else this.lastDirectionTap = { direction, at, count: 1 };
  }
  read(phase = 'rally') {
    const has = (...keys) => keys.some((k) => this.held.has(k) || this.pressed.has(k));
    const button = (index) => this.padButton(index);
    const padUp = button(12),
      padDown = button(13),
      padLeft = button(14),
      padRight = button(15);
    const leftY = this.gamepad?.axes?.[1] ?? 0;
    const leftStickUp = leftY < -0.7 && Math.abs(this.gamepad?.axes?.[0] ?? 0) < -leftY * 0.45;
    const modifier = has('ShiftLeft', 'ShiftRight') || button(6);
    const digitalX = Number(has('ArrowRight') || padRight) - Number(has('ArrowLeft') || padLeft);
    const digitalShots = {
      low: has('KeyS', 'KeyX') || button(0),
      back: has('KeyA') || button(2),
      loft: has('KeyW') || button(3),
      drive: has('KeyD') || button(1),
    };
    const stickShot = Object.values(digitalShots).some(Boolean) ? null : this.shotStick;
    return {
      axis: Math.max(-1, Math.min(1, digitalX + this.stickX)),
      up: modifier && (has('ArrowUp') || padUp),
      down: modifier && (has('ArrowDown') || padDown),
      low: digitalShots.low || stickShot === 'low',
      back: digitalShots.back || stickShot === 'back',
      loft: digitalShots.loft || stickShot === 'loft',
      drive: digitalShots.drive || stickShot === 'drive',
      stickShot,
      stickStrength: stickShot ? this.shotStrength : 0,
      shotAxis: stickShot ? this.shotAxis : null,
      shotVector: stickShot ? this.shotVector : null,
      buttonVector: (() => {
        if (this.rightStickAim && stickShot) return this.shotVector;
        const x = digitalX;
        const y = Number(has('ArrowUp') || padUp) - Number(has('ArrowDown') || padDown);
        const length = Math.hypot(x, y);
        return length ? { x: x / length, y: y / length } : this.leftAim;
      })(),
      aimNeutral: !digitalX && !this.leftAim && !has('ArrowUp', 'ArrowDown') && !padUp && !padDown,
      block: has('KeyF') || button(5),
      jump: has('Space') || (!modifier && (has('ArrowUp') || padUp || leftStickUp)),
      jumpHeld: has('Space', 'ArrowUp') || padUp || leftY < -0.18,
      crouch:
        !modifier &&
        (has('ArrowDown') ||
          padDown ||
          (leftY > 0.65 && Math.abs(this.gamepad?.axes?.[0] ?? 0) < leftY * 0.6)),
      dive: !!this.divePulse || this.pressed.has('KeyQ') || this.pressed.has('KeyE'),
      diveAxis: this.pressed.has('KeyQ') ? -1 : this.pressed.has('KeyE') ? 1 : this.divePulse,
      switch: has('Tab') || button(4),
      select: has('Digit3') ? 3 : has('Digit2') ? 2 : has('Digit1') ? 1 : 0,
      pausePressed: this.pausePressed,
      confirmPressed: this.confirmPressed,
    };
  }
  consume() {
    this.pressed.clear();
    this.divePulse = 0;
  }
}
export const GAME_KEYS = [
  'KeyW',
  'KeyA',
  'KeyX',
  'KeyS',
  'KeyF',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'ShiftLeft',
  'ShiftRight',
  'Tab',
  'KeyQ',
  'Digit1',
  'Digit2',
  'Digit3',
  'KeyE',
];
