import { contactReason } from './contact-rules.js';

export function createDiagnostics(match, enabled) {
  if (!enabled) return () => {};
  const output = document.createElement('output');
  output.id = 'contact-diagnostics';
  output.className = 'micro';
  output.setAttribute('aria-live', 'polite');
  document.querySelector('.arena-toolbar').after(output);
  return () => {
    const reports = match.humanControllers().map(([, slot]) => {
      const control = match.controls[slot];
      const action = control.charge || control.pending;
      const player = match.players[action?.playerId ?? match.controlledPlayer(control)];
      const reason = contactReason(match, player, action?.kind || 'low');
      return `P${slot === 2 ? 2 : slot + 1}: ${reason || 'Геометрия контакта доступна'}${action ? ' · ' + action.kind : ''}`;
    });
    output.textContent = reports.join(' | ');
  };
}
