/** Companion checks, footprint, and plant counts for a planting place. */

import { plantCropName } from './sowing.js';

/**
 * @typedef {{
 *   id?: number,
 *   name: string,
 *   companions?: string[],
 *   avoid?: string[],
 *   sqft?: number | null,
 *   spacing?: number | null,
 *   depthIn?: number | null,
 *   sun?: string,
 *   water?: string,
 *   trellis?: boolean,
 *   notes?: string,
 *   emoji?: string,
 *   icon?: string,
 * }} PlantInfo
 */

/**
 * @param {unknown} label
 */
function cropKey(label) {
  return plantCropName(label).toLowerCase();
}

/**
 * Footprint used by the size check. A crop under 1 sq ft still needs a 1 ft square.
 * @param {number} sqft
 */
export function plantSpan(sqft) {
  const area = Number(sqft);
  if (!(area > 0)) return { rowSpan: 1, colSpan: 1, perSqft: 1 };
  if (area < 1) return { rowSpan: 1, colSpan: 1, perSqft: Math.max(2, Math.round(1 / area)) };
  if (area === 1) return { rowSpan: 1, colSpan: 1, perSqft: 1 };
  const side = Math.ceil(Math.sqrt(area));
  return { rowSpan: side, colSpan: side, perSqft: 1 };
}

/**
 * How many of this crop fit in the place's area.
 * @param {number} areaSqFt
 * @param {number | null | undefined} sqft
 * @returns {{ label: string, count: number | null }}
 */
export function estimatedPlantCount(areaSqFt, sqft) {
  const area = Number(areaSqFt);
  const footprint = Number(sqft);
  if (!(area > 0) || !(footprint > 0)) return { label: '', count: null };
  if (footprint < 1) {
    const perSqft = Math.max(2, Math.round(1 / footprint));
    const count = Math.round(area * perSqft);
    return { label: `~${count} plants (${perSqft}/sq ft)`, count };
  }
  const count = Math.floor(area / footprint);
  return { label: `~${count} plants`, count };
}

/**
 * @param {unknown} plants
 * @param {PlantInfo[]} catalog
 * @returns {{ companions: string[], conflicts: string[] }}
 */
export function plantingAlerts(plants, catalog) {
  const labels = Array.isArray(plants) ? plants.filter((label) => typeof label === 'string') : [];
  const rows = Array.isArray(catalog) ? catalog : [];
  /** @type {Map<string, PlantInfo>} */
  const byKey = new Map();
  for (const plant of rows) {
    if (!plant || typeof plant !== 'object') continue;
    const key = cropKey(plant.name);
    if (key) byKey.set(key, plant);
  }
  const present = new Set(labels.map(cropKey).filter(Boolean));
  /** @type {string[]} */
  const companions = [];
  /** @type {string[]} */
  const conflicts = [];
  const seenCompanions = new Set();
  const seenConflicts = new Set();

  for (const label of labels) {
    const plant = byKey.get(cropKey(label));
    if (!plant) continue;
    const left = plantCropName(label);
    for (const other of plant.companions || []) {
      const key = cropKey(other);
      if (!key || !present.has(key)) continue;
      const pair = [cropKey(label), key].sort().join('|');
      if (seenCompanions.has(pair)) continue;
      seenCompanions.add(pair);
      companions.push(`${left} + ${plantCropName(other)}`);
    }
    for (const other of plant.avoid || []) {
      const key = cropKey(other);
      if (!key || !present.has(key)) continue;
      const pair = [cropKey(label), key].sort().join('|');
      if (seenConflicts.has(pair)) continue;
      seenConflicts.add(pair);
      conflicts.push(`${left} conflicts with ${plantCropName(other)}`);
    }
  }

  return { companions, conflicts };
}

/**
 * Names already in the bed that conflict with the crop about to be added.
 * Checks both the chosen crop's avoid list and each bed crop's avoid list.
 * @param {{ id?: number, name: string, avoid?: number[] } | null | undefined} chosen
 * @param {unknown} plants
 * @param {{ id?: number, name: string, avoid?: number[] }[]} crops
 * @returns {string[]}
 */
export function addCropConflicts(chosen, plants, crops) {
  if (!chosen || typeof chosen !== 'object' || !chosen.name) return [];
  const rows = Array.isArray(crops) ? crops : [];
  /** @type {Map<number, { id: number, name: string, avoid: number[] }>} */
  const byId = new Map();
  /** @type {Map<string, { id: number, name: string, avoid: number[] }>} */
  const byKey = new Map();
  for (const crop of rows) {
    if (!crop || typeof crop !== 'object' || typeof crop.id !== 'number') continue;
    const row = {
      id: crop.id,
      name: typeof crop.name === 'string' ? crop.name : '',
      avoid: Array.isArray(crop.avoid)
        ? crop.avoid.filter((id) => typeof id === 'number')
        : [],
    };
    if (!row.name) continue;
    byId.set(row.id, row);
    byKey.set(cropKey(row.name), row);
  }

  const chosenKey = cropKey(chosen.name);
  const chosenRow = typeof chosen.id === 'number' ? byId.get(chosen.id) : byKey.get(chosenKey);
  if (!chosenRow) return [];

  const chosenAvoid = new Set(
    Array.isArray(chosen.avoid)
      ? chosen.avoid.filter((id) => typeof id === 'number')
      : chosenRow.avoid,
  );

  /** @type {string[]} */
  const conflicts = [];
  const seen = new Set();
  const labels = Array.isArray(plants) ? plants : [];
  for (const label of labels) {
    const bedCrop = byKey.get(cropKey(label));
    if (!bedCrop || bedCrop.id === chosenRow.id) continue;
    const avoided =
      chosenAvoid.has(bedCrop.id) || (bedCrop.avoid || []).includes(chosenRow.id);
    if (!avoided || seen.has(bedCrop.id)) continue;
    seen.add(bedCrop.id);
    conflicts.push(bedCrop.name);
  }
  return conflicts;
}

/**
 * Detail rows for crops currently in a place.
 * @param {unknown} plants
 * @param {PlantInfo[]} catalog
 * @param {number} areaSqFt
 * @param {{ showSoilDepth?: boolean }} [options]
 */
export function plantDetailRows(plants, catalog, areaSqFt, options = {}) {
  const showSoilDepth = options.showSoilDepth !== false;
  const labels = Array.isArray(plants) ? plants.filter((label) => typeof label === 'string') : [];
  const rows = Array.isArray(catalog) ? catalog : [];
  /** @type {Map<string, PlantInfo>} */
  const byKey = new Map();
  for (const plant of rows) {
    if (!plant || typeof plant !== 'object') continue;
    const key = cropKey(plant.name);
    if (key) byKey.set(key, plant);
  }

  const present = new Set(labels.map(cropKey).filter(Boolean));
  /** @type {string[]} */
  const seen = [];
  /** @type {ReturnType<typeof detailRow>[]} */
  const details = [];

  for (const label of labels) {
    const key = cropKey(label);
    if (!key || seen.includes(key)) continue;
    seen.push(key);
    const plant = byKey.get(key);
    details.push(detailRow(label, plant, areaSqFt, present, showSoilDepth));
  }
  return details;
}

/**
 * @param {string} label
 * @param {PlantInfo | undefined} plant
 * @param {number} areaSqFt
 * @param {Set<string>} present
 * @param {boolean} showSoilDepth
 */
function detailRow(label, plant, areaSqFt, present, showSoilDepth) {
  const name = plantCropName(label);
  if (!plant) {
    return {
      key: name.toLowerCase(),
      id: 0,
      name,
      emoji: '',
      icon: '',
      pills: [],
      companions: [],
      conflicts: [],
      countLabel: '',
      notes: '',
    };
  }

  const footprint = Number(plant.sqft);
  const perSqft = footprint > 0 && footprint < 1 ? Math.max(2, Math.round(1 / footprint)) : null;
  /** @type {string[]} */
  const pills = [];
  if (footprint > 0) {
    pills.push(perSqft ? `${perSqft}/sq ft` : `${footprint} sq ft/plant`);
  }
  if (typeof plant.spacing === 'number' && Number.isFinite(plant.spacing)) {
    pills.push(`${plant.spacing}" apart`);
  }
  if (showSoilDepth && typeof plant.depthIn === 'number' && Number.isFinite(plant.depthIn)) {
    pills.push(`${plant.depthIn}" soil`);
  }
  if (plant.sun) pills.push(plant.sun);
  if (plant.water) pills.push(plant.water);
  if (plant.trellis) pills.push('Trellis needed');

  const companions = (plant.companions || [])
    .filter((other) => present.has(cropKey(other)))
    .map((other) => plantCropName(other));
  const conflicts = (plant.avoid || [])
    .filter((other) => present.has(cropKey(other)))
    .map((other) => plantCropName(other));

  return {
    key: name.toLowerCase(),
    id: typeof plant.id === 'number' ? plant.id : 0,
    name,
    emoji: plant.emoji || '',
    icon: plant.icon || '',
    pills,
    companions,
    conflicts,
    countLabel: estimatedPlantCount(areaSqFt, plant.sqft).label,
    notes: typeof plant.notes === 'string' ? plant.notes : '',
  };
}
