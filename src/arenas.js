import {
  drawStreetSky,
  drawStreetCity,
  drawStreetArchitecture,
  drawStreetForeground,
} from './street-scene.js';
import { ZONES, drawZoneBackdrop } from './zone-scene.js';
// All current locations share the courtyard's perspective and physical lane.
export const ARENAS = {
  miami: {
    name: 'Двор · закат',
    subtitle: 'Городская площадка, граффити и вечерний матч',
    court: '#e7bdad',
    edge: '#cb9da4',
    floor: '#8b9da2',
  },
  ...ZONES,
};
export function drawArenaBackdrop(c, theme = 'miami', time = 0) {
  if (Object.hasOwn(ZONES, theme)) {
    drawZoneBackdrop(c, theme, time);
    return;
  }
  drawStreetSky(c, time);
  drawStreetCity(c);
  drawStreetArchitecture(c);
  drawStreetForeground(c);
}
