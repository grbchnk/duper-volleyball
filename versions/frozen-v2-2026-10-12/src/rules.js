export function awardRally(state, winner, config) {
  const rallyScoring = config.scoring === 'rally' || state.sets[0] + state.sets[1] === 4;
  const scored = rallyScoring || state.server === winner;
  if (scored) state.score[winner]++;
  state.server = winner;
  const a = state.score[winner],
    b = state.score[1 - winner];
  const setWon = scored && a >= config.targetScore && (a - b >= 2 || a >= config.targetScore + 2);
  if (setWon) state.sets[winner]++;
  return { scored, setWon, matchWon: setWon && state.sets[winner] >= 3 };
}
