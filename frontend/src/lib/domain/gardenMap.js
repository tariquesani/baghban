/** Street tiles for the header thumbnail. OpenStreetMap serves the images. */

export const MAP_WIDTH = 256;
export const MAP_HEIGHT = 160;
export const MAP_ZOOM = 14;

const TILE = 256;
const MERCATOR_LIMIT = 85.05112878;

/**
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} zoom
 */
export function project(latitude, longitude, zoom) {
  const scale = TILE * 2 ** zoom;
  const clamped = Math.max(Math.min(latitude, MERCATOR_LIMIT), -MERCATOR_LIMIT);
  const rad = (clamped * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * scale,
    scale,
  };
}

/**
 * @param {number} latitude
 * @param {number} longitude
 */
export function mapTiles(latitude, longitude) {
  const { x, y } = project(latitude, longitude, MAP_ZOOM);
  const left = x - MAP_WIDTH / 2;
  const top = y - MAP_HEIGHT / 2;
  const n = 2 ** MAP_ZOOM;
  const x0 = Math.floor(left / TILE);
  const x1 = Math.floor((left + MAP_WIDTH - 1) / TILE);
  const y0 = Math.floor(top / TILE);
  const y1 = Math.floor((top + MAP_HEIGHT - 1) / TILE);
  /** @type {{ key: string, url: string, left: number, top: number }[]} */
  const tiles = [];
  for (let tileY = y0; tileY <= y1; tileY += 1) {
    if (tileY < 0 || tileY >= n) continue;
    for (let tileX = x0; tileX <= x1; tileX += 1) {
      const wrapped = ((tileX % n) + n) % n;
      tiles.push({
        key: `${MAP_ZOOM}/${wrapped}/${tileY}`,
        url: `https://tile.openstreetmap.org/${MAP_ZOOM}/${wrapped}/${tileY}.png`,
        left: tileX * TILE - left,
        top: tileY * TILE - top,
      });
    }
  }
  return tiles;
}
