// The result screen has one DOM owner; game modes provide presentation data.
export function createFinishScreen() {
  const get = (id) => document.getElementById(id);
  return {
    reset() {
      get('finish-overlay').hidden = true;
      get('club-next').hidden = true;
      get('club-finish-stats').textContent = '';
      get('rematch').textContent = 'Ещё один матч ↗';
    },
    render(result) {
      get('finish-overlay').hidden = false;
      get('winner-label').textContent = result.label;
      get('final-score').textContent = result.score;
      get('final-detail').textContent = result.detail;
      get('club-finish-stats').textContent = result.stats || '';
      get('club-next').hidden = !result.nextLabel;
      get('club-next').textContent = result.nextLabel || '';
      get('rematch').textContent = result.rematchLabel || 'Ещё один матч ↗';
    },
  };
}
