// Controller ownership is explicit. Processing P2 never changes P1's input or selection.
export function createControls(emptyInput) {
  return [0, 1, 2].map((slot) => ({
    slot,
    team: slot === 2 ? 0 : slot,
    charge: null,
    pending: null,
    chargeLock: false,
    previousInput: { ...emptyInput },
    jumpArmed: true,
    inputPlayer: -1,
    aimPreview: null,
    contactWindow: false,
    manualSerial: -1,
  }));
}

export function controlledPlayer(match, control) {
  return match.mode === 'coop' && control.slot === 2
    ? match.coopSelected
    : match.selected[control.team];
}

export function selectControlledPlayer(match, control, id) {
  const player = match.players[id];
  const previousId = controlledPlayer(match, control);
  if (
    !player ||
    player.team !== control.team ||
    player.benched ||
    player.recovery > 0 ||
    player.diving
  )
    return false;
  if (
    match.mode === 'coop' &&
    control.team === 0 &&
    (!match.coopOwns(control.slot, id) || match.coopPlayer(control.slot === 2 ? 0 : 2) === id)
  )
    return false;
  if (id === previousId) return false;
  // Ownership of an in-progress shot changes in one place for manual, automatic
  // and co-op selection. A disabled transfer consumes this physical press.
  for (const key of ['charge', 'pending']) {
    const action = control[key];
    if (action?.playerId !== previousId) continue;
    if (match.config.transferShotOnSwitch !== false) {
      action.playerId = id;
      if (key === 'pending') {
        player.releaseSlow = match.players[previousId].releaseSlow;
        player.releaseSlowTotal = match.players[previousId].releaseSlowTotal;
      }
    } else {
      control[key] = null;
      control.chargeLock = true;
      control.aimPreview = null;
      const previous = match.players[previousId];
      if (previous?.armSwing && !previous.armSwing.hit) previous.armSwing = null;
      if (previous?.pose?.startsWith('ready-')) {
        previous.pose = 'idle';
        previous.animation = 0;
      }
    }
  }
  const run = match.teamRuns?.[control.team];
  if (run?.feint && run.serial === match.shotSerial && run.decoyId === id)
    run.decoyCancelled = true;
  if (match.mode === 'coop' && control.slot === 2) match.coopSelected = id;
  else {
    match.selected[control.team] = id;
    if (control.team === 0) match.coopPrimary = id;
  }
  return true;
}

export const aimOf = (i) => ({
  manualControl: true,
  soft: !!i.l2,
  fast: !!i.r2,
  axis: i.aimNeutral ? 0 : i.axis,
  up: i.up,
  down: i.down,
  vector: i.buttonVector,
  intent: i.intent,
  play: i.play === 'feint' ? undefined : i.play,
});
export const updateAim = (action, input, preserveNeutral = false) => {
  const originalIntent = action?.aim?.intent,
    originalPlay = action?.aim?.play,
    originalSoft = action?.aim?.soft,
    originalFast = action?.aim?.fast;
  const directed =
    input.buttonVector || (!input.aimNeutral && input.axis) || input.up || input.down;
  if (action && (!preserveNeutral || directed)) action.aim = aimOf(input);
  else if (action) {
    if (input.intent) action.aim.intent = input.intent;
    if (input.play) action.aim.play = input.play;
    action.aim.soft = !!input.l2;
    action.aim.fast = !!input.r2;
  }
  if (action && !input[action.kind]) {
    action.aim.intent = originalIntent;
    action.aim.play = originalPlay;
    action.aim.soft = originalSoft;
    action.aim.fast = originalFast;
  }
};
