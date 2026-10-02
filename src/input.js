// Physical key codes: Russian/English keyboard layouts have identical controls.
export class InputBuffer {
  constructor(getGamepads = () => globalThis.navigator?.getGamepads?.() ?? []) {
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
    this.held.add(code);
    if (!repeat) this.pressed.add(code);
  }
  up(code) {
    this.held.delete(code);
  }
  clear() {
    this.held.clear();
    this.pressed.clear();
    for (const button of this.padButtonsHeld) this.blockedPadButtons.add(button);
  }
  poll() {
    this.gamepad =
      Array.from(this.getGamepads() ?? []).find((p) => p?.connected && p.mapping === 'standard') ??
      null;
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
    this.pausePressed = rawButton(9) && !this.previousPause;
    this.previousPause = rawButton(9);
    this.confirmPressed = rawButton(0) && !this.previousConfirm;
    this.previousConfirm = rawButton(0);
    const stickX = this.gamepad?.axes?.[0] ?? 0;
    this.stickX =
      Math.abs(stickX) < 0.18 ? 0 : (Math.sign(stickX) * (Math.abs(stickX) - 0.18)) / 0.82;
  }
  padButton(index) {
    return this.padButtonsHeld.has(index) && !this.blockedPadButtons.has(index);
  }
  read() {
    const has = (...keys) => keys.some((k) => this.held.has(k) || this.pressed.has(k));
    const button = (index) => this.padButton(index);
    const padUp = button(12),
      padDown = button(13),
      padLeft = button(14),
      padRight = button(15);
    const modifier = has('ShiftLeft', 'ShiftRight') || button(6);
    const digitalX = Number(has('ArrowRight') || padRight) - Number(has('ArrowLeft') || padLeft);
    return {
      axis: Math.max(-1, Math.min(1, digitalX + this.stickX)),
      up: modifier && (has('ArrowUp') || padUp),
      down: modifier && (has('ArrowDown') || padDown),
      low: has('KeyA') || button(2),
      loft: has('KeyW') || button(3),
      drive: has('KeyD') || button(1),
      block: has('KeyS') || button(5),
      jump: has('Space') || button(0) || (!modifier && (has('ArrowUp') || padUp)),
      dive: !modifier && (has('ArrowDown') || padDown),
      switch: has('Tab', 'KeyQ') || button(4),
      select: has('Digit3', 'KeyE') ? 3 : has('Digit2') ? 2 : has('Digit1') ? 1 : 0,
      pausePressed: this.pausePressed,
      confirmPressed: this.confirmPressed,
    };
  }
  consume() {
    this.pressed.clear();
  }
}
export const GAME_KEYS = [
  'KeyW',
  'KeyA',
  'KeyS',
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
