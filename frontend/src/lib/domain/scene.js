const BED_COLOR = '#2d6a30';
const POT_COLOR = '#c1440e';
const PLANTER_COLOR = '#9c6644';
const OBSTACLE_COLOR = '#888';

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function finite(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

/**
 * @param {unknown} value
 * @param {number} fallback
 */
function numberOr(value, fallback) {
  const number = finite(value);
  return number === null ? fallback : number;
}

/**
 * @param {unknown} value
 */
function text(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * @param {unknown} value
 * @returns {{ x: number, y: number } | null}
 */
function point(value) {
  if (!value || typeof value !== 'object') return null;
  const spot = /** @type {{ x?: unknown, y?: unknown }} */ (value);
  const x = finite(spot.x);
  const y = finite(spot.y);
  if (x === null || y === null) return null;
  return { x, y };
}

/**
 * @param {Record<string, any>} row
 */
function bedKind(row) {
  const kind = row.type || row.kind;
  if (kind === 'pot' || kind === 'planter' || kind === 'bed') return kind;
  return 'bed';
}

/**
 * @param {'bed' | 'planter' | 'pot'} kind
 */
function bedColor(kind) {
  if (kind === 'pot') return POT_COLOR;
  if (kind === 'planter') return PLANTER_COLOR;
  return BED_COLOR;
}

/**
 * @param {Record<string, any>} row
 * @returns {{ shape: 'polygon', points: { x: number, y: number }[], pivot: { x: number, y: number } | null } | null}
 */
function polygonOf(row) {
  const outline = row.outline && typeof row.outline === 'object' ? row.outline : null;
  const source = Array.isArray(row.points) ? row.points : outline?.points;
  if (!Array.isArray(source) || source.length < 3) return null;
  const points = source.map(point).filter((spot) => spot !== null);
  if (points.length < 3) return null;
  const pivotSource = row.pivot || outline?.pivot;
  return { shape: 'polygon', points, pivot: point(pivotSource) };
}

/**
 * @param {Record<string, any>} row
 */
function bedForCanvas(row) {
  const kind = bedKind(row);
  const polygon = polygonOf(row);
  const color = text(row.color);
  /** @type {Record<string, any>} */
  const bed = {
    id: row.id,
    name: text(row.name),
    x: numberOr(row.x, 0),
    y: numberOr(row.y, 0),
    w: numberOr(row.w, 0),
    h: numberOr(row.h, 0),
    rotation: numberOr(row.rotation, 0),
    color: color || bedColor(kind),
    type: kind,
    plants: Array.isArray(row.plants) ? [...row.plants] : [],
    notes: text(row.notes),
  };
  if (kind === 'pot') bed.diam = numberOr(row.diam, bed.w);
  if (polygon) {
    bed.shape = polygon.shape;
    bed.points = polygon.points;
    if (polygon.pivot) bed.pivot = polygon.pivot;
  }
  return bed;
}

/**
 * @param {Record<string, any>} row
 */
function obstacleForCanvas(row) {
  const color = text(row.color);
  return {
    id: row.id,
    name: text(row.name),
    x: numberOr(row.x, 0),
    y: numberOr(row.y, 0),
    w: numberOr(row.w, 0),
    h: numberOr(row.h, 0),
    rotation: numberOr(row.rotation, 0),
    color: color || OBSTACLE_COLOR,
  };
}

/**
 * @param {unknown} plot
 */
function plotForCanvas(plot) {
  const source = plot && typeof plot === 'object' ? /** @type {Record<string, any>} */ (plot) : {};
  /** @type {Record<string, any>} */
  const scene = {
    plotId: text(source.plotId) || null,
    widthPx: numberOr(source.widthPx, 0),
    heightPx: numberOr(source.heightPx, 0),
    calibration: source.calibration && typeof source.calibration === 'object'
      ? { ...source.calibration }
      : null,
    feetPerPixel: numberOr(source.feetPerPixel, 0),
    photoUrl: text(source.photoUrl) || null,
  };
  if (source.imageDataUrl) scene.imageDataUrl = source.imageDataUrl;
  if (source.photoOnServer) scene.photoOnServer = true;
  return scene;
}

/**
 * Turn one GET /api/garden body into the beds, obstacles, garden, and plot
 * the canvas draws. Bed and obstacle ids stay the integers from the response.
 * Plant names stay on each bed. An empty plot comes back with empty fields.
 * The result has no nextId.
 * @param {Record<string, any> | null | undefined} payload
 */
export function gardenScene(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const garden = source.garden && typeof source.garden === 'object' ? source.garden : {};
  const beds = Array.isArray(source.beds) ? source.beds : [];
  const obstacles = Array.isArray(source.obstacles) ? source.obstacles : [];
  return {
    garden: {
      width: numberOr(garden.width, 20),
      height: numberOr(garden.height, 18),
      scale: text(garden.scale) || null,
      widthText: text(garden.widthText),
      heightText: text(garden.heightText),
    },
    beds: beds
      .filter((bed) => bed && bed.removed !== true)
      .map(bedForCanvas),
    obstacles: obstacles.filter(Boolean).map(obstacleForCanvas),
    plot: plotForCanvas(source.plot),
  };
}
