export { CROP_CATEGORIES, SUNS, WATERS } from './catalogue.js';

/**
 * @param {string} text
 * @returns {number | null}
 */
export function optionalNumber(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function emptyCrop() {
  return {
    id: '',
    name: '',
    category: '',
    emoji: '',
    sqft: null,
    spacing: null,
    depthIn: null,
    sowingDepthMm: null,
    daysToMaturity: null,
    sun: '',
    water: '',
    trellis: false,
    notes: '',
    archived: false,
    aliases: [],
    companions: [],
    avoid: [],
  };
}

/**
 * @param {Record<string, any>} crop
 */
export function cloneCrop(crop) {
  return {
    ...crop,
    aliases: [...(crop.aliases || [])],
    companions: [...(crop.companions || [])],
    avoid: [...(crop.avoid || [])],
  };
}

/**
 * Body for create or update. The server assigns the id, so a new draft omits it.
 * @param {ReturnType<typeof emptyCrop>} draft
 */
export function cropPayload(draft) {
  return {
    ...(typeof draft.id === 'number' ? { id: draft.id } : {}),
    name: draft.name.trim(),
    category: draft.category,
    emoji: draft.emoji.trim(),
    sqft: draft.sqft,
    spacing: draft.spacing,
    depthIn: draft.depthIn,
    sowingDepthMm: draft.sowingDepthMm,
    daysToMaturity: draft.daysToMaturity,
    sun: draft.sun,
    water: draft.water,
    trellis: Boolean(draft.trellis),
    notes: draft.notes,
    archived: Boolean(draft.archived),
    aliases: draft.aliases.map((alias) => alias.trim()).filter(Boolean),
    companions: [...draft.companions],
    avoid: [...draft.avoid],
  };
}
