import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { openBrowserGame } from './settings-helpers.mjs';

test('ball squash follows incoming speed at hand and floor impacts, then recovers', async (t) => {
  const { page } = await openBrowserGame(t);
  await mkdir('.cache', { recursive: true });
  const result = await page.evaluate(async () => {
    const { Match } = await import('/src/engine.js');
    const { Renderer } = await import('/src/renderer.js');
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const renderer = new Renderer(canvas, { scene: false });
    const match = new Match();
    renderer.effect(
      {
        type: 'hit',
        incomingSpeed: 4,
        incomingVelocity: { x: -4, y: 0 },
      },
      match,
    );
    const softSquash = renderer.ballSquash.amount;
    renderer.ballSquash = null;
    renderer.effect(
      {
        type: 'hit',
        incomingSpeed: 22,
        incomingVelocity: { x: 0, y: -22 },
      },
      match,
    );
    const hardSquash = renderer.ballSquash.amount,
      handAngle = renderer.ballSquash.angle;
    const scales = [];
    const scale = renderer.ctx.scale.bind(renderer.ctx);
    renderer.ctx.scale = (x, y) => {
      scales.push([x, y]);
      scale(x, y);
    };
    renderer.drawBall(match);
    const renderedSquash = scales.some(([x, y]) => x < 1 && y > 1);
    renderer.drawParticles(0.1);
    const recovers = Math.abs(renderer.ballSquash?.life - 0.18) < 1e-9;
    renderer.drawParticles(0.08);
    scales.length = 0;
    renderer.drawBall(match);
    const elasticRecovery = scales.some(([x, y]) => x > 1 && y < 1 && Math.abs(x * y - 1) < 1e-9);
    renderer.drawParticles(0.11);
    const expires = renderer.ballSquash === null;
    renderer.effect({ type: 'floor-touch', speed: 14 }, match);
    const floorAxis = renderer.ballSquash.angle === Math.PI / 2;
    const floorStrength = renderer.ballSquash.amount > softSquash;
    renderer.effect({ type: 'floor', speed: 6 }, match);
    const repeatedBounce = renderer.ballSquash.floor && renderer.ballSquash.amount > 0;
    renderer.effect({ type: 'hit', incomingSpeed: 4, incomingVelocity: { x: -4, y: 0 } }, match);
    const freshContactOwnsAxis =
      !renderer.ballSquash.floor && renderer.ballSquash.angle === -Math.PI;
    // Check the actual pixels at the normal 1.2x ball size, including the game's pixel grid.
    const { pixelPresent } = await import('/src/display.js');
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = normalCanvas.height = 192;
    const normalRenderer = new Renderer(normalCanvas, { scene: false });
    normalRenderer.project = () => ({ x: 96, y: 96 });
    const normalMatch = new Match();
    normalMatch.mode = 'demo';
    normalMatch.phase = 'rally';
    normalMatch.config = { ...normalMatch.config, ballSize: 1.2, ballFire: false };
    Object.assign(normalMatch.ball, { x: 3, y: 2, vx: 20, vy: 0, angle: 0 });
    let visibleAtNormalSize = true;
    for (const pixel of [false, true])
      for (const floor of [false, true])
        for (const age of [0, 0.04, 0.09]) {
          normalRenderer.pixelGraphics = pixel;
          normalRenderer.effect(
            floor
              ? { type: 'floor-touch', speed: 22 }
              : { type: 'hit', incomingSpeed: 22, incomingVelocity: { x: -22, y: 0 } },
            normalMatch,
          );
          normalRenderer.ballSquash.life = 0.28 - age;
          normalRenderer.ctx.fillStyle = '#101820';
          normalRenderer.ctx.fillRect(0, 0, 192, 192);
          normalRenderer.drawBall(normalMatch);
          pixelPresent(normalCanvas, pixel, 2);
          const rgba = normalRenderer.ctx.getImageData(0, 0, 192, 192).data;
          let minX = 192,
            maxX = 0,
            minY = 192,
            maxY = 0;
          for (let y = 0; y < 192; y++)
            for (let x = 0; x < 192; x++) {
              const i = (y * 192 + x) * 4;
              if (
                Math.abs(rgba[i] - 16) + Math.abs(rgba[i + 1] - 24) + Math.abs(rgba[i + 2] - 32) <
                40
              )
                continue;
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
          const width = maxX - minX + 1,
            height = maxY - minY + 1;
          visibleAtNormalSize &&=
            (floor ? width / height : height / width) >= (age < 0.05 ? 2 : 1.4);
        }
    const sheet = document.createElement('canvas');
    sheet.id = 'ball-impact-gallery';
    sheet.width = 940;
    sheet.height = 984;
    sheet.style.cssText = 'display:block;width:940px;height:984px;max-width:none';
    document.body.append(sheet);
    const output = sheet.getContext('2d');
    output.fillStyle = '#f7edda';
    output.fillRect(0, 0, sheet.width, sheet.height);
    const ages = [0, 0.04, 0.09, 0.2, 0.29];
    output.font = '14px sans-serif';
    output.fillStyle = '#40594c';
    ages.forEach((age, i) =>
      output.fillText(i ? `${Math.round(age * 1000)} мс` : 'Контакт', 182 + i * 160, 28),
    );
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 160;
    sampleCanvas.height = 150;
    const sampleRenderer = new Renderer(sampleCanvas, { scene: false });
    sampleRenderer.project = () => ({ x: 80, y: 84 });
    const sampleMatch = new Match();
    sampleMatch.mode = 'demo';
    sampleMatch.phase = 'rally';
    sampleMatch.config = { ...sampleMatch.config, ballSize: 2.5, ballFire: false };
    Object.assign(sampleMatch.ball, { x: 3, y: 1, vx: 0, vy: 0, angle: 0 });
    for (let row = 0; row < 6; row++) {
      const floor = row < 3;
      const speed = [4, 14, 26][row % 3];
      output.fillStyle = '#40594c';
      output.fillText(`${floor ? 'Пол' : 'Руки'} · ${speed} м/с`, 12, 126 + row * 156);
      for (let column = 0; column < ages.length; column++) {
        sampleRenderer.effect(
          floor
            ? { type: 'floor-touch', speed }
            : { type: 'hit', incomingSpeed: speed, incomingVelocity: { x: -speed, y: 0 } },
          sampleMatch,
        );
        if (ages[column] >= 0.28) sampleRenderer.ballSquash = null;
        else sampleRenderer.ballSquash.life = 0.28 - ages[column];
        sampleRenderer.ctx.fillStyle = '#f7edda';
        sampleRenderer.ctx.fillRect(0, 0, 160, 150);
        if (floor) sampleRenderer.rect(15, 114, 130, 1, '#b8a78c');
        sampleRenderer.drawBall(sampleMatch);
        output.drawImage(sampleCanvas, 140 + column * 160, 42 + row * 156);
      }
    }
    return {
      speedScalesSquash: hardSquash > softSquash,
      renderedSquash,
      handAxis: Math.abs(handAngle - Math.PI / 2) < 1e-9,
      recovers,
      elasticRecovery,
      expires,
      floorAxis,
      floorStrength,
      repeatedBounce,
      freshContactOwnsAxis,
      visibleAtNormalSize,
    };
  });
  for (const [name, value] of Object.entries(result)) assert.equal(value, true, name);
  await page.locator('#ball-impact-gallery').screenshot({ path: '.cache/ball-impact-squash.png' });
});
