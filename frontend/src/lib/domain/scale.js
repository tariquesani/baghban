const EDGE = 0.01;

/**
 * @param {number} value
 */
export function cleanFeet(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return String(Math.round(number * 1000) / 1000);
}

/**
 * Keep the gardener's text when it is a real length from 1 to 500 ft.
 * @param {string} text
 * @returns {{ text: string, value: number } | null}
 */
export function parseDimension(text) {
  const trimmed = String(text ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (value < 1 || value > 500) return null;
  return { text: trimmed, value };
}

/**
 * @param {number} value
 */
export function formatFeet(value) {
  const rounded = Math.round(Number(value) * 10) / 10;
  if (!Number.isFinite(rounded)) return '';
  return rounded.toFixed(1);
}

/**
 * @param {string} widthText
 * @param {string} heightText
 */
export function formatEnteredSize(widthText, heightText) {
  return `${widthText} × ${heightText} ft`;
}

/**
 * @param {number} width
 * @param {number} height
 */
export function formatPlanSize(width, height) {
  return `${formatFeet(width)} × ${formatFeet(height)} ft`;
}

/**
 * @param {{ scale?: string, width?: number, height?: number, widthText?: string, heightText?: string } | null | undefined} garden
 */
export function gardenSizeLabel(garden) {
  if (!garden) return '';
  if (garden.scale === 'dimensions' && garden.widthText && garden.heightText) {
    return formatEnteredSize(garden.widthText, garden.heightText);
  }
  if (garden.scale === 'plan') return formatPlanSize(garden.width, garden.height);
  return '';
}

/**
 * A blank default garden stays unconfirmed. A saved calibration wins over beds.
 * @param {{ scale?: string, width?: number, height?: number, widthText?: string, heightText?: string } | null | undefined} garden
 * @param {{ feetPerPixel?: number, calibration?: object | null } | null | undefined} plot
 * @param {unknown[] | null | undefined} beds
 * @param {unknown[] | null | undefined} obstacles
 */
export function inferScale(garden, plot, beds, obstacles) {
  if (garden?.scale === 'dimensions' || garden?.scale === 'plan') {
    return {
      scale: garden.scale,
      widthText: garden.widthText || '',
      heightText: garden.heightText || '',
    };
  }
  const calibrated = !!(plot && (Number(plot.feetPerPixel) > 0 || plot.calibration));
  if (calibrated) return { scale: 'plan', widthText: '', heightText: '' };
  if ((beds && beds.length) || (obstacles && obstacles.length)) {
    return {
      scale: 'dimensions',
      widthText: cleanFeet(garden?.width),
      heightText: cleanFeet(garden?.height),
    };
  }
  return { scale: null, widthText: '', heightText: '' };
}

/**
 * @param {{ x: number, y: number }[]} points
 */
function centroid(points) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    const cross = points[index].x * next.y - next.x * points[index].y;
    area += cross;
    cx += (points[index].x + next.x) * cross;
    cy += (points[index].y + next.y) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-9) {
    const average = points.reduce((sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }), { x: 0, y: 0 });
    return { x: average.x / points.length, y: average.y / points.length };
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

/**
 * @param {{ x: number, y: number }} point
 * @param {{ x: number, y: number }} pivot
 * @param {number} rotation
 */
function rotate(point, pivot, rotation) {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return {
    x: pivot.x + dx * c - dy * s,
    y: pivot.y + dx * s + dy * c,
  };
}

/**
 * @param {Record<string, any>} item
 * @returns {{ x: number, y: number }[]}
 */
function footprint(item) {
  const points = Array.isArray(item.points) ? item.points : [];
  if (item.shape === 'polygon' && points.length >= 3) {
    const rotation = item.rotation || 0;
    if (!rotation) return points;
    const pivot = item.pivot || centroid(points);
    return points.map((point) => rotate(point, pivot, rotation));
  }
  const circular = item.type === 'pot' || item.type === 'tree';
  const width = circular ? (item.diam || item.w || 0) : (item.w || 0);
  const height = circular ? (item.diam || item.h || 0) : (item.h || 0);
  const originX = item.x || 0;
  const originY = item.y || 0;
  const corners = [
    { x: originX, y: originY },
    { x: originX + width, y: originY },
    { x: originX + width, y: originY + height },
    { x: originX, y: originY + height },
  ];
  const rotation = item.rotation || 0;
  if (!rotation) return corners;
  const pivot = { x: originX + width / 2, y: originY + height / 2 };
  return corners.map((point) => rotate(point, pivot, rotation));
}

/**
 * @param {Record<string, any>} item
 * @param {number} width
 * @param {number} height
 */
function fallsOutside(item, width, height) {
  return footprint(item).some((point) => (
    point.x < -EDGE || point.y < -EDGE || point.x > width + EDGE || point.y > height + EDGE
  ));
}

/**
 * @param {Record<string, any>[] | null | undefined} beds
 * @param {Record<string, any>[] | null | undefined} obstacles
 * @param {number} width
 * @param {number} height
 * @returns {{ id: string, name: string }[]}
 */
export function itemsOutside(beds, obstacles, width, height) {
  return [...(beds || []), ...(obstacles || [])]
    .filter((item) => item && fallsOutside(item, width, height))
    .map((item) => ({ id: String(item.id), name: item.name || 'Untitled' }));
}
