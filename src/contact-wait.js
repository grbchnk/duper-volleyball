import { variantSettings } from './shot-settings.js';

export function contactWaitTime(config, kind, aim = {}) {
  return config.dynamic && ['low', 'loft', 'drive'].includes(kind)
    ? variantSettings(config, kind, aim).ReceiveHoldTime || 0
    : 0;
}
