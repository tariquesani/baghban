/** Crop care recipes: relative schedules that become care_rule rows at plant time. */

import { CARE_ACTIONS } from './catalogue.js';
import { WEEKDAYS } from './careRule.js';
import { actionLabel } from './entryForm.js';

export const RECIPE_FREQS = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Every N days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'yearly', label: 'Yearly' },
];

/**
 * @param {string} isoDate YYYY-MM-DD
 * @param {number} days
 */
export function addDays(isoDate, days) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function emptyCareRecipe() {
  return {
    id: null,
    localKey: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sort: 0,
    label: '',
    action: '',
    product: '',
    amount: null,
    unit: '',
    note: '',
    freq: 'once',
    interval: 1,
    weekdays: [],
    offsetDays: 0,
    endsOffsetDays: null,
    active: true,
  };
}

/**
 * @param {Record<string, any>} recipe
 */
export function cloneCareRecipe(recipe) {
  return {
    ...recipe,
    id: typeof recipe.id === 'number' ? recipe.id : null,
    localKey:
      recipe.localKey ||
      (typeof recipe.id === 'number' ? `id-${recipe.id}` : emptyCareRecipe().localKey),
    weekdays: [...(recipe.weekdays || [])],
    amount: recipe.amount ?? null,
    endsOffsetDays: recipe.endsOffsetDays ?? null,
    active: recipe.active !== false,
  };
}

/**
 * Active recipes offered when placing a crop on a bed.
 * @param {Record<string, any> | null | undefined} crop
 */
export function offerableCareRecipes(crop) {
  const rows = Array.isArray(crop?.careRecipes) ? crop.careRecipes : [];
  return rows
    .filter((recipe) => recipe && recipe.active !== false)
    .slice()
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.id ?? 0) - (b.id ?? 0));
}

/**
 * @param {Record<string, any>} recipe
 */
export function careRecipeTitle(recipe) {
  const label = String(recipe.label || '').trim();
  if (label) return label;
  return actionLabel(recipe.action || '') || 'Care';
}

/**
 * @param {Record<string, any>} recipe
 */
export function careRecipeTiming(recipe) {
  const offset = Number(recipe.offsetDays) || 0;
  const day = offset === 0 ? 'Planting day' : `Day ${offset}`;
  const freq = recipe.freq || 'once';
  if (freq === 'once') return day;
  if (freq === 'daily') {
    const every = Number(recipe.interval) || 1;
    const span =
      recipe.endsOffsetDays == null
        ? 'ongoing'
        : `through day ${recipe.endsOffsetDays}`;
    return every === 1 ? `${day}, daily (${span})` : `${day}, every ${every} days (${span})`;
  }
  if (freq === 'weekly') {
    const names = (recipe.weekdays || [])
      .map((value) => WEEKDAYS.find((dayChoice) => dayChoice.value === value)?.label || String(value))
      .join(', ');
    const every = Number(recipe.interval) || 1;
    const week = every === 1 ? 'weekly' : `every ${every} weeks`;
    const span =
      recipe.endsOffsetDays == null
        ? 'ongoing'
        : `through day ${recipe.endsOffsetDays}`;
    return `${day}, ${week} on ${names || '…'} (${span})`;
  }
  if (freq === 'yearly') {
    return `${day}, yearly`;
  }
  return day;
}

/**
 * @param {string} isoDate
 * @param {number} offsetDays
 * @param {number | null | undefined} endsOffsetDays
 * @param {string} freq
 */
function scheduleDates(isoDate, offsetDays, endsOffsetDays, freq) {
  const anchorDate = addDays(isoDate, offsetDays);
  if (freq === 'once') {
    return { anchorDate, endsOn: anchorDate };
  }
  if (endsOffsetDays == null || endsOffsetDays === '') {
    return { anchorDate, endsOn: null };
  }
  return { anchorDate, endsOn: addDays(isoDate, Number(endsOffsetDays)) };
}

/**
 * Map selected recipes to care-rule POST bodies.
 * @param {Record<string, any>[]} recipes
 * @param {{
 *   plantDate: string,
 *   bedId: number,
 *   cropId: number,
 *   selectedIds?: Iterable<number | string>,
 * }} options
 */
export function instantiateCareRecipes(recipes, options) {
  const plantDate = options.plantDate;
  const bedId = options.bedId;
  const cropId = options.cropId;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(plantDate || ''))) {
    throw new Error('plantDate must be YYYY-MM-DD');
  }
  if (!Number.isInteger(bedId) || bedId < 1) {
    throw new Error('bedId is required');
  }
  if (!Number.isInteger(cropId) || cropId < 1) {
    throw new Error('cropId is required');
  }

  const selected = options.selectedIds == null ? null : new Set([...options.selectedIds].map(String));
  const bodies = [];
  for (const recipe of recipes) {
    if (!recipe || recipe.active === false) continue;
    const key = String(recipe.id ?? recipe.localKey ?? '');
    if (selected && !selected.has(String(recipe.id)) && !selected.has(key)) continue;
    if (!CARE_ACTIONS.some((choice) => choice.value === recipe.action)) continue;

    const freq = recipe.freq || 'once';
    const offsetDays = Number(recipe.offsetDays) || 0;
    const { anchorDate, endsOn } = scheduleDates(
      plantDate,
      offsetDays,
      recipe.endsOffsetDays,
      freq,
    );

    let ruleFreq = freq;
    let interval = Number(recipe.interval) || 1;
    let weekdays = [...(recipe.weekdays || [])];
    if (freq === 'once') {
      ruleFreq = 'daily';
      interval = 1;
      weekdays = [];
    } else if (freq === 'yearly') {
      interval = 1;
      weekdays = [];
    } else if (freq === 'daily') {
      weekdays = [];
    }

    const title = careRecipeTitle(recipe);
    const note = String(recipe.note || '').trim();
    const combined =
      note && title && !note.toLowerCase().startsWith(title.toLowerCase())
        ? `${title}. ${note}`
        : note || title;

    bodies.push({
      bedId,
      cropId,
      action: recipe.action,
      product: String(recipe.product || '').trim(),
      amount: recipe.amount ?? null,
      unit: String(recipe.unit || '').trim(),
      note: combined,
      freq: ruleFreq,
      interval,
      weekdays,
      anchorDate,
      endsOn,
      active: true,
    });
  }
  return bodies;
}

/**
 * API body rows for crop create/update.
 * @param {Record<string, any>[]} recipes
 */
export function careRecipesPayload(recipes) {
  return (recipes || []).map((recipe, index) => ({
    sort: index,
    label: String(recipe.label || '').trim(),
    action: recipe.action,
    product: String(recipe.product || '').trim(),
    amount: recipe.amount ?? null,
    unit: String(recipe.unit || '').trim(),
    note: String(recipe.note || ''),
    freq: recipe.freq || 'once',
    interval: Number(recipe.interval) || 1,
    weekdays: [...(recipe.weekdays || [])],
    offsetDays: Number(recipe.offsetDays) || 0,
    endsOffsetDays:
      recipe.endsOffsetDays == null || recipe.endsOffsetDays === ''
        ? null
        : Number(recipe.endsOffsetDays),
    active: recipe.active !== false,
  }));
}
