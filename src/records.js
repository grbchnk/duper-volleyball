import { DEFAULTS } from './config.js';
import { SETTINGS_SCHEMA } from './settings-schema.js';

const challengeIndependent = new Set([
  'duel',
  'setsToWin',
  'targetScore',
  'scoring',
  'cpuSkill',
  'cpuStyle',
  'difficulty',
  'approachAssist',
]);
const keys = Object.keys(DEFAULTS)
  .filter((key) => SETTINGS_SCHEMA[key].scope !== 'appearance' && !challengeIndependent.has(key))
  .sort();

export function challengeProfileKey(config) {
  const changed = keys
    .filter((key) => config[key] !== DEFAULTS[key])
    .map((key) => [key, config[key]]);
  return changed.length ? 'custom:' + JSON.stringify(changed) : 'standard-2026-10-18';
}

export function sanitizeRecords(value = {}) {
  return Object.fromEntries(
    ['precision', 'serve', 'rescue'].map((id) => [
      id,
      Number.isFinite(value?.[id]) ? Math.max(0, Math.min(10000, Math.floor(value[id]))) : 0,
    ]),
  );
}

export function sanitizeRecordProfiles(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          key === 'standard-2026-10-18' || (key.startsWith('custom:') && key.length < 8192),
      )
      .slice(-50)
      .map(([key, records]) => [key, sanitizeRecords(records)]),
  );
}

export function profileRecords(progress, config, create = false) {
  const key = challengeProfileKey(config);
  if (progress.recordProfiles[key]) return progress.recordProfiles[key];
  const records = sanitizeRecords();
  if (create) progress.recordProfiles[key] = records;
  return records;
}
