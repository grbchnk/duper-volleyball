// Historical contracts are opt-in for tests/tools. User settings always migrate
// to the current game; these fields are never exported by its settings UI.
export const LEGACY_BACK = {
  speed: [3.8, 5.8],
  angle: 65,
  air: 65,
  floor: 25,
  ceiling: 90,
  spin: 0,
  min: 0.12,
  max: 2.45,
  reach: 1.35,
};
export const LEGACY_SHOT = Object.freeze({
  key: '',
  name: 'Исторический сейв',
  pose: 'backset',
  ...LEGACY_BACK,
});
export const LEGACY_DEFAULTS = Object.freeze({
  cartoonFlight: 0,
  cartoonStart: 0.55,
  cartoonEnd: 1.35,
  cartoonRamp: 0.85,
  cartoonHang: 0.4,
  backArmMin: -75,
  backArmMax: 10,
});
export const LEGACY_LIMITS = Object.freeze({
  cartoonFlight: [0, 1],
  cartoonStart: [0.2, 1],
  cartoonEnd: [1, 1.8],
  cartoonRamp: [0.2, 1.6],
  cartoonHang: [0, 0.85],
  backArmMin: [-90, 90],
  backArmMax: [-90, 90],
});
