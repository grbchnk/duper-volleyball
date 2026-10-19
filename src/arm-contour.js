const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Reconcile independently sprung joints with the current wrist. A control
// point behind the wrist used to fold the forearm back against its hand.
export function armContour(
  shoulder,
  hint,
  wrist,
  width,
  serveBend = 0,
  buffer = null,
  elbowHeight = 0,
) {
  const dx = wrist.x - shoulder.x;
  const dy = wrist.y - shoulder.y;
  const distance = Math.hypot(dx, dy);
  const nx = distance > 0.001 ? -dy / distance : 1;
  const ny = distance > 0.001 ? dx / distance : 0;
  // Preserve the height control even for a vertical arm. The old midpoint
  // projection discarded movement along the arm, making that slider inert.
  const along =
    distance > 0.001 ? clamp(0.5 - (elbowHeight * dy) / (distance * distance), 0.2, 0.8) : 0.5;
  const mid = { x: shoulder.x + dx * along, y: shoulder.y + dy * along };
  const bend = clamp(
    (hint.x - mid.x) * nx + (hint.y - mid.y) * ny,
    -distance * 0.8,
    distance * 0.8,
  );
  const adjusted = { x: mid.x + nx * bend, y: mid.y + ny * bend };
  // Serving deliberately folds the elbow behind the hand (palm under the
  // toss, lower swing and overhead windup). Preserve that authored curve;
  // projecting it onto the generic reach plane reversed its wrist tangent.
  const amount = clamp(serveBend, 0, 1);
  const elbow = {
    x: adjusted.x + (hint.x - adjusted.x) * amount,
    y: adjusted.y + (hint.y - adjusted.y) * amount,
  };
  const contour = buffer || { left: [], right: [], elbow: {} };
  const { left, right } = contour;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20,
      u = 1 - t;
    const x = u * u * shoulder.x + 2 * u * t * elbow.x + t * t * wrist.x;
    const y = u * u * shoulder.y + 2 * u * t * elbow.y + t * t * wrist.y;
    const tx = u * (elbow.x - shoulder.x) + t * (wrist.x - elbow.x);
    const ty = u * (elbow.y - shoulder.y) + t * (wrist.y - elbow.y);
    const length = Math.hypot(tx, ty) || 1;
    const ox = ((-ty / length) * width) / 2,
      oy = ((tx / length) * width) / 2;
    const l = (left[i] ||= {}),
      r = (right[i] ||= {});
    l.x = x + ox;
    l.y = y + oy;
    r.x = x - ox;
    r.y = y - oy;
  }
  Object.assign(contour.elbow, elbow);
  contour.handAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x) + Math.PI / 2;
  return contour;
}

export function blendAngle(from, to, weight) {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * weight;
}

// Fill the ribbon, then stroke only its sides. There is deliberately no cap
// across the shoulder: the open cross-section can meet skin or a fabric sleeve.
export function drawOpenArm(c, contour, width, skin, outline, sleeve = null, sleeveLength = 0.32) {
  const { left, right } = contour;
  const ribbon = (end) => {
    c.moveTo(left[0].x, left[0].y);
    for (let i = 1; i <= end; i++) c.lineTo(left[i].x, left[i].y);
    for (let i = end; i >= 0; i--) c.lineTo(right[i].x, right[i].y);
  };
  c.fillStyle = skin;
  c.beginPath();
  ribbon(left.length - 1);
  c.closePath();
  c.fill();
  if (sleeve) {
    const end = Math.round((left.length - 1) * sleeveLength);
    c.fillStyle = sleeve;
    c.beginPath();
    ribbon(end);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = outline;
  c.lineWidth = Math.min(1, width / 3);
  c.lineCap = 'butt';
  c.lineJoin = 'round';
  c.beginPath();
  // Move each border half a stroke inward to preserve the original outer width.
  const inset = c.lineWidth / width;
  const side = (a, b) => {
    for (let i = 0; i < a.length; i++) {
      const x = a[i].x + ((b[i].x - a[i].x) * inset) / 2;
      const y = a[i].y + ((b[i].y - a[i].y) * inset) / 2;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
  };
  side(left, right);
  side(right, left);
  c.stroke();
}
