// A shared raster grid for bodies, limbs, ball, effects and canvas lettering.
export function pixelPresent(canvas, enabled, scale = 2) {
  // Keep the original canvas pixels crisp at CSS sizes in both modes.
  // The toggle only controls the additional shared raster grid below.
  canvas.style.imageRendering = 'pixelated';
  if (!enabled) return;
  const buffer = (canvas._pixelBuffer ||= document.createElement('canvas'));
  const width = Math.ceil(canvas.width / scale),
    height = Math.ceil(canvas.height / scale);
  if (buffer.width !== width || buffer.height !== height) {
    buffer.width = width;
    buffer.height = height;
  }
  const small = buffer.getContext('2d');
  small.imageSmoothingEnabled = false;
  small.drawImage(canvas, 0, 0, width, height);
  const c = canvas.getContext('2d');
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = false;
  c.drawImage(buffer, 0, 0, canvas.width, canvas.height);
  c.restore();
}
const ballSprites = new Map();
export function drawBallDesign(c, skin = 'classic', pixel = false) {
  const palette = {
    classic: ['#fff6df', '#e5ae43'],
    ocean: ['#ecf9ff', '#2987be'],
    neon: ['#dcfa83', '#7445ac'],
    mono: ['#ffffff', '#293f4c'],
    plain: ['#fff3d1', '#fff3d1'],
  };
  const [base, ink] = palette[skin] || palette.classic;
  if (pixel) {
    let sprite = ballSprites.get(skin);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = sprite.height = 22;
      const p = sprite.getContext('2d');
      for (let y = -10; y <= 10; y++)
        for (let x = -10; x <= 10; x++) {
          const radius = Math.hypot(x, y);
          if (radius > 10) continue;
          const angle = Math.atan2(y, x);
          let mark = false;
          if (skin === 'ocean') mark = Math.sin(angle * 3 + radius * 0.24) > -0.08;
          else if (skin === 'mono')
            mark = (Math.floor((x + 12) / 5) + Math.floor((y + 12) / 5)) % 2 === 0;
          else if (skin === 'neon') mark = radius < 4.8 + 2.8 * Math.cos(5 * (angle + Math.PI / 2));
          else if (skin !== 'plain') mark = Math.sin(angle * 3 + radius * 0.16) > 0.35;
          const oceanInk = angle > -0.8 && angle < 1.3 ? '#319f87' : ink;
          p.fillStyle =
            radius > 8.8 ? '#304b50' : mark ? (skin === 'ocean' ? oceanInk : ink) : base;
          p.fillRect(x + 11, y + 11, 1, 1);
        }
      ballSprites.set(skin, sprite);
    }
    c.save();
    c.imageSmoothingEnabled = false;
    c.drawImage(sprite, -11, -11);
    c.restore();
    return;
  }
  c.fillStyle = '#304b50';
  c.beginPath();
  c.arc(0, 0, 10, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.beginPath();
  c.arc(0, 0, 8.5, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = base;
  c.fillRect(-10, -10, 20, 20);
  c.strokeStyle = ink;
  c.lineWidth = 2;
  if (skin === 'ocean') {
    for (let i = 0; i < 3; i++) {
      c.save();
      c.rotate((i * Math.PI * 2) / 3 - 0.3);
      c.fillStyle = i === 1 ? '#319f87' : ink;
      c.beginPath();
      c.moveTo(-2, -9);
      c.bezierCurveTo(-8, -3, -5, 4, 7, 9);
      c.lineTo(11, 4);
      c.bezierCurveTo(2, 3, -1, -2, 2, -10);
      c.closePath();
      c.fill();
      c.restore();
    }
  } else if (skin === 'neon') {
    c.fillStyle = ink;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2,
        r = i % 2 ? 3 : 8;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
  } else if (skin === 'mono') {
    c.fillStyle = ink;
    for (let y = -12; y < 12; y += 6)
      for (let x = -12; x < 12; x += 6) if (((x + y) / 6) % 2 === 0) c.fillRect(x, y, 6, 6);
  } else if (skin !== 'plain') {
    for (let i = 0; i < 3; i++) {
      c.save();
      c.rotate((i * Math.PI * 2) / 3);
      c.fillStyle = ink;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(2, -7, 8, -9);
      c.lineTo(12, -4);
      c.quadraticCurveTo(6, -6, 0, 0);
      c.fill();
      c.strokeStyle = '#687571';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(-4, -4, -2, -10);
      c.stroke();
      c.restore();
    }
  }
  c.restore();
}

// Remove fractional coverage BEFORE compositing over the park; disabling image
// smoothing alone does not disable Canvas path antialiasing.
export function compositePixels(
  destination,
  layer,
  enabled,
  width = layer.width,
  height = layer.height,
) {
  if (enabled) {
    const c = layer.getContext('2d');
    const image = c.getImageData(0, 0, layer.width, layer.height);
    hardPixelAlpha(image.data);
    c.putImageData(image, 0, 0);
  }
  destination.save();
  destination.imageSmoothingEnabled = false;
  destination.drawImage(layer, 0, 0, width, height);
  destination.restore();
}
export function hardPixelAlpha(data) {
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 110 ? 255 : 0;
  return data;
}
