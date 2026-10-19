import { sanitizeConfig, DEFAULTS } from './config.js';
import { LEGACY_DEFAULTS } from './legacy-profile.js';
import { SHOT_DEFAULTS } from './shot-settings.js';
const knownFields = new Set([
  ...Object.keys(DEFAULTS),
  ...Object.keys(LEGACY_DEFAULTS),
  ...Object.keys(SHOT_DEFAULTS),
  'armStyle',
  'rightStickAim',
]);
export const SETTINGS_VERSION = 5;
export function exportSettings(config) {
  return JSON.stringify(
    { version: SETTINGS_VERSION, game: 'Duper Volleyball', config: sanitizeConfig(config) },
    null,
    2,
  );
}
export function importSettings(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('нужен объект настроек');
  if (data.version !== undefined && ![2, 3, 4, SETTINGS_VERSION].includes(data.version))
    throw new Error('нужны настройки версии 2, 3, 4 или 5');
  const candidate = data.config ?? data;
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate) ||
    !Object.keys(candidate).some((key) => knownFields.has(key))
  )
    throw new Error('в файле нет настроек');
  // Historical simulation is only available to explicit code-level contracts.
  // Old files retain their useful values but cannot re-enable retired controls.
  return sanitizeConfig({ ...candidate, dynamic: true });
}
