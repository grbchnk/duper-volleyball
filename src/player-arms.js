import { LIMITS } from './config.js';

export const ARM_PARAMETER_STEPS = Object.freeze({
  armBend: 0.05,
  elbowHeight: 0.5,
});

// Cosmetic randomness never advances the match's deterministic random stream.
export function randomArmProfile(random = Math.random) {
  return Object.fromEntries(
    Object.entries(ARM_PARAMETER_STEPS).map(([key, step]) => {
      const [min, max] = LIMITS[key];
      const count = Math.round((max - min) / step);
      const index = Math.min(count, Math.floor(Math.max(0, random()) * (count + 1)));
      return [key, Number((min + index * step).toFixed(3))];
    }),
  );
}

export function assignPlayerArms(players, enabled) {
  if (enabled) for (const player of players) player.armProfile ||= randomArmProfile();
}

export function playerArmConfig(player, config) {
  if (config.dynamic || !config.randomArms || !player?.armProfile) return config;
  const overrides = Object.fromEntries(
    Object.keys(ARM_PARAMETER_STEPS).map((key) => [key, player.armProfile[key] ?? config[key]]),
  );
  return { ...config, ...overrides };
}
