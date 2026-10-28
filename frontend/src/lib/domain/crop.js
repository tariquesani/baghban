export const CROP_CATEGORIES = ['Vegetables', 'Herbs', 'Flowers', 'Fruit'];

export const SUNS = [
  { value: '', label: 'Not set' },
  { value: 'Full', label: 'Full' },
  { value: 'Full/Part', label: 'Full or part' },
];

export const WATERS = [
  { value: '', label: 'Not set' },
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
];

/**
 * Stable id from a display name. Matches the seed slug in the API.
 * @param {string} name
 */
export function cropSlug(name) {
  const parts = [];
  let current = '';
  for (const char of String(name).toLowerCase()) {
    if (/[a-z0-9]/.test(char)) current += char;
    else if (current) {
      parts.push(current);
      current = '';
    }
  }
  if (current) parts.push(current);
  return parts.join('-');
}

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
 * @param {ReturnType<typeof emptyCrop>} draft
 * @param {string} id
 */
export function cropPayload(draft, id) {
  return {
    id,
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
