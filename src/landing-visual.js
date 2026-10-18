export function drawOutCross(context, x, y) {
  x = Math.round(x);
  y = Math.round(y);
  context.fillStyle = '#fff5df';
  for (let i = -4; i <= 4; i++) {
    context.fillRect(x + i * 2 - 1, y + i * 2 - 1, 4, 4);
    context.fillRect(x + i * 2 - 1, y - i * 2 - 1, 4, 4);
  }
  context.fillStyle = '#c86455';
  for (let i = -4; i <= 4; i++) {
    context.fillRect(x + i * 2, y + i * 2, 2, 2);
    context.fillRect(x + i * 2, y - i * 2, 2, 2);
  }
}
