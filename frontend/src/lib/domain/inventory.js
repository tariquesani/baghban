/**
 * @typedef {{
 *   id: number,
 *   name: string,
 *   description: string,
 *   quantity: number,
 *   manufacturer: string,
 *   modelNumber: string,
 *   purchaseFrom: string,
 *   purchasePrice: number | null,
 *   purchaseDate: string | null,
 *   locationPath: string,
 *   tags: string[],
 *   archived: boolean,
 *   notes: string,
 * }} InventoryItem
 */

/** @returns {InventoryItem} */
export function emptyInventoryItem() {
  return {
    id: 0,
    name: '',
    description: '',
    quantity: 1,
    manufacturer: '',
    modelNumber: '',
    purchaseFrom: '',
    purchasePrice: null,
    purchaseDate: '',
    locationPath: '',
    tags: [],
    archived: false,
    notes: '',
  };
}

/**
 * @param {InventoryItem | Record<string, unknown>} item
 * @returns {InventoryItem}
 */
export function cloneInventoryItem(item) {
  return {
    id: typeof item.id === 'number' ? item.id : 0,
    name: typeof item.name === 'string' ? item.name : '',
    description: typeof item.description === 'string' ? item.description : '',
    quantity: typeof item.quantity === 'number' ? item.quantity : 1,
    manufacturer: typeof item.manufacturer === 'string' ? item.manufacturer : '',
    modelNumber: typeof item.modelNumber === 'string' ? item.modelNumber : '',
    purchaseFrom: typeof item.purchaseFrom === 'string' ? item.purchaseFrom : '',
    purchasePrice: typeof item.purchasePrice === 'number' ? item.purchasePrice : null,
    purchaseDate: typeof item.purchaseDate === 'string' ? item.purchaseDate : '',
    locationPath: typeof item.locationPath === 'string' ? item.locationPath : '',
    tags: Array.isArray(item.tags)
      ? item.tags.filter((tag) => typeof tag === 'string')
      : [],
    archived: item.archived === true,
    notes: typeof item.notes === 'string' ? item.notes : '',
  };
}

/**
 * @param {InventoryItem} item
 */
export function inventoryPayload(item) {
  return {
    name: item.name.trim(),
    description: item.description,
    quantity: item.quantity,
    manufacturer: item.manufacturer.trim(),
    modelNumber: item.modelNumber.trim(),
    purchaseFrom: item.purchaseFrom.trim(),
    purchasePrice: item.purchasePrice,
    purchaseDate:
      typeof item.purchaseDate === 'string' && item.purchaseDate.trim()
        ? item.purchaseDate.trim()
        : null,
    locationPath: item.locationPath.trim(),
    tags: item.tags,
    archived: item.archived === true,
    notes: item.notes,
  };
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function tagsFromText(text) {
  const seen = new Set();
  const tags = [];
  for (const part of text.split(',')) {
    const tag = part.trim();
    if (!tag) continue;
    const folded = tag.toLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    tags.push(tag);
  }
  return tags;
}

/**
 * @param {string[]} tags
 */
export function tagsToText(tags) {
  return (tags || []).join(', ');
}

/**
 * @param {InventoryItem[]} items
 * @returns {string[]}
 */
export function filterTagNames(items) {
  const seen = new Map();
  for (const item of items) {
    for (const tag of item.tags || []) {
      const folded = tag.toLowerCase();
      if (!seen.has(folded)) seen.set(folded, tag);
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

/**
 * @param {InventoryItem} item
 * @param {string[]} selectedTags
 */
export function itemMatchesTags(item, selectedTags) {
  if (!selectedTags.length) return true;
  const have = new Set((item.tags || []).map((tag) => tag.toLowerCase()));
  return selectedTags.every((tag) => have.has(tag.toLowerCase()));
}

/**
 * @param {InventoryItem[]} items
 * @param {string[]} selectedTags
 */
export function filterItems(items, selectedTags) {
  return items.filter((item) => itemMatchesTags(item, selectedTags));
}
