// Physical key codes: Russian/English keyboard layouts have identical controls.
export class InputBuffer {
  constructor(
    getGamepads = () => globalThis.navigator?.getGamepads?.() ?? [],
    now = () => performance.now(),
    slot = 0,
  ) {
    this.slot = slot;
    this.padIndex = null;
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
    this.lastDirectionTap = null;
    this.divePulse = 0;
    this.held.clear();
    this.pressed.clear();
    for (const button of this.padButtonsHeld) this.blockedPadButtons.add(button);
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
    this.leftAim = radius >= 0.22 ? { x: px / radius, y: -py / radius || 0 } : null;
    const padDirection =
      Number(this.padButton(15)) - Number(this.padButton(14)) ||
      (Math.abs(px) > (this.previousPadDirection === Math.sign(px) ? 0.3 : 0.65) &&
      Math.abs(px) > Math.abs(py)
        ? Math.sign(px)
        : 0);
    if (padDirection && padDirection !== this.previousPadDirection) this.directionTap(padDirection);
    this.previousPadDirection = padDirection;
    this.pausePressed = rawButton(9) && !this.previousPause;
    this.previousPause = rawButton(9);
    this.confirmPressed = rawButton(0) && !this.previousConfirm;
    this.previousConfirm = rawButton(0);
    const stickX = this.gamepad?.axes?.[0] ?? 0;
    this.stickX =
      Math.abs(stickX) < 0.18 ? 0 : (Math.sign(stickX) * (Math.abs(stickX) - 0.18)) / 0.82;
    // Right stick axes and click are deliberately unbound.
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
    const modifier = has('ShiftLeft', 'ShiftRight');
    const l2 = button(6) || has('KeyZ');
    const r2 = button(7) || has('KeyC');
    const square = button(2),
      triangle = button(3),
      circle = button(1);
    const digitalX = Number(has('ArrowRight') || padRight) - Number(has('ArrowLeft') || padLeft);
    const digitalShots = {
      low: has('KeyS', 'KeyX') || square,
      loft: has('KeyW') || triangle,
      drive: has('KeyD') || circle,
    };
    return {
      intent: l2 ? 'soft' : r2 ? 'fast' : 'normal',
      play: undefined,
      jumpVariant: 'normal',
      l2,
      r2,
      replayHeld: button(8),
      retryHeld: false,
      axis: Math.max(-1, Math.min(1, digitalX + this.stickX)),
      up: modifier && (has('ArrowUp') || padUp),
      down: modifier && (has('ArrowDown') || padDown),
      low: digitalShots.low && !(['serve', 'serve-motion'].includes(phase) && l2),
      // The fourth serve remains available as the soft lower serve.
      back: ['serve', 'serve-motion'].includes(phase) && l2 && digitalShots.low,
      loft: digitalShots.loft,
      drive: digitalShots.drive,
      buttonVector: (() => {
        const x = digitalX;
        const y = Number(has('ArrowUp') || padUp) - Number(has('ArrowDown') || padDown);
        const length = Math.hypot(x, y);
        return length ? { x: x / length, y: y / length } : this.leftAim;
      })(),
      aimNeutral: !digitalX && !this.leftAim && !has('ArrowUp', 'ArrowDown') && !padUp && !padDown,
      block: has('KeyF') || button(5),
      jump: button(0) || has('Space') || (!modifier && has('ArrowUp')),
      jumpHeld: button(0) || has('Space', 'ArrowUp'),
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
  'KeyZ',
  'KeyC',
  'KeyW',
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
