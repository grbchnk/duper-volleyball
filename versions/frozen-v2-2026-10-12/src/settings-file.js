import { sanitizeConfig, DEFAULTS } from './config.js';
export function exportSettings(config) {
  return JSON.stringify(
    { version: 2, game: 'Duper Volleyball', config: sanitizeConfig(config) },
    null,
    2,
  );
}
export function importSettings(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('нужен объект настроек');
  if (data.version !== undefined && data.version !== 2) throw new Error('нужны настройки версии 2');
  const candidate = data.config ?? data;
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate) ||
    !Object.keys(DEFAULTS).some((k) => k in candidate)
  )
    throw new Error('в файле нет настроек');
  return sanitizeConfig(candidate);
}
