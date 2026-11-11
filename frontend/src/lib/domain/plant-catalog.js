/**
 * Turn Crops API rows into the planner catalogue shape.
 * `name`, `companions`, and `avoid` are the labels stored on a bed.
 * @param {unknown} crops
 */
export function plantCatalogFromCrops(crops) {
  const rows = Array.isArray(crops) ? crops : [];
  /** @type {Map<number, string>} */
  const labels = new Map();
  for (const crop of rows) {
    if (!crop || typeof crop !== 'object') continue;
    const id = /** @type {{ id?: unknown }} */ (crop).id;
    if (typeof id !== 'number') continue;
    labels.set(id, canvasLabel(crop));
  }
  return rows
    .filter((crop) => crop && typeof crop === 'object' && canvasLabel(crop))
    .map((crop) => ({
      id: typeof crop.id === 'number' ? crop.id : 0,
      name: canvasLabel(crop),
      category: text(crop.category),
      emoji: text(crop.emoji),
      icon: iconUrl(crop),
      sqft: numberOr(crop.sqft, 1),
      spacing: finite(crop.spacing),
      depthIn: finite(crop.depthIn),
      sun: text(crop.sun),
      water: text(crop.water),
      trellis: Boolean(crop.trellis),
      notes: text(crop.notes),
      companions: linkLabels(crop.companions, labels),
      avoid: linkLabels(crop.avoid, labels),
    }));
}

/**
 * @param {object} crop
 */
function iconUrl(crop) {
  const file = text(crop.icon);
  const id = crop.id;
  if (!file || typeof id !== 'number') return '';
  return `/api/crops/${id}/icon`;
}

/**
 * @param {object} crop
 */
function canvasLabel(crop) {
  const name = text(crop.name);
  const emoji = text(crop.emoji);
  if (!name) return '';
  return emoji ? `${emoji} ${name}` : name;
}

/**
 * @param {unknown} ids
 * @param {Map<number, string>} labels
 */
function linkLabels(ids, labels) {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => labels.get(id)).filter((label) => Boolean(label));
}

/**
 * @param {unknown} value
 */
function text(value) {
  return typeof value === 'string' ? value : '';
}

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
