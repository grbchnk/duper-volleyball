import { LEGACY_SHOT } from './legacy-profile.js';
import { SERVE_BASES } from './serve-settings.js';
import { SHOT_BASES } from './shot-settings.js';
import { manualImpulse } from './manual-impulse.js';
import { profileImpulse } from './profile-impulse.js';
import { assistManualShot } from './manual-assistance.js';
export { manualImpulse } from './manual-impulse.js';

// Physics defaults have one source; UI metadata preserves the public shot IDs.
export const SHOTS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      low: { key: 'S', name: 'Приём снизу', pose: 'bump' },
      loft: { key: 'W', name: 'Верхний пас', pose: 'set' },
      drive: { key: 'D', name: 'Направленный удар', pose: 'spike' },
    }).map(([kind, metadata]) => [kind, { ...SHOT_BASES[kind], ...metadata }]),
  ),
);
export const shotDefinition = (kind) => SHOTS[kind] || (kind === 'back' ? LEGACY_SHOT : undefined);
export const shotKinds = (config, serving = false) =>
  serving || !config.dynamic ? ['low', 'back', 'loft', 'drive'] : Object.keys(SHOTS);
export const SERVES = Object.freeze(SERVE_BASES);

// Human direction and automatic/serve profiles are distinct models with an explicit dispatch.
export function shotImpulse(ball, player, kind, power, aim, players, config, serving = false) {
  const source = { ...ball, attackGravity: 0 };
  const impulse =
    !serving && config.dynamic && aim.manualControl
      ? assistManualShot(
          source,
          player,
          kind,
          manualImpulse(source, player, kind, power, aim, config),
          aim,
          players,
          config,
        )
      : profileImpulse(source, player, kind, power, aim, players, config, serving);
  return { attackGravity: 0, ...impulse };
}
