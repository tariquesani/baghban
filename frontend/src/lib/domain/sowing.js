/** Draft and request for recording a sowing. */

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/**
 * @param {Date} [now]
 * @returns {string}
 */
export function localDate(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** @param {string} date YYYY-MM-DD */
export function formatSowingDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * A future date is a reminder. Today and earlier record the sowing as done.
 * @param {string} date
 * @param {string} today
 * @returns {'planned' | 'done'}
 */
export function statusForSowingDate(date, today) {
  if (date > today) return 'planned';
  return 'done';
}

/**
 * @param {unknown} crops
 * @returns {{ id: number, name: string, emoji: string, icon: string, iconRev: number | null }[]}
 */
export function sowingCropChoices(crops) {
  if (!Array.isArray(crops)) return [];
  return crops
    .filter((crop) => crop && typeof crop === 'object' && !crop.archived && typeof crop.name === 'string' && crop.name.trim())
    .map((crop) => ({
      id: typeof crop.id === 'number' ? crop.id : 0,
      name: crop.name.trim(),
      emoji: typeof crop.emoji === 'string' ? crop.emoji : '',
      icon: typeof crop.icon === 'string' ? crop.icon : '',
      iconRev: typeof crop.iconRev === 'number' ? crop.iconRev : null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * @param {unknown} beds
 * @returns {{ id: number, name: string }[]}
 */
export function sowingBedChoices(beds) {
  if (!Array.isArray(beds)) return [];
  return beds
    .filter((bed) => bed && typeof bed === 'object' && !bed.removed && typeof bed.id === 'number' && typeof bed.name === 'string' && bed.name.trim())
    .map((bed) => ({ id: bed.id, name: bed.name.trim() }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * The catalogue name on a bed. Plants are stored as "Tomatoes" or "🍅 Tomatoes".
 * @param {unknown} label
 */
export function plantCropName(label) {
  if (typeof label !== 'string') return '';
  const text = label.trim();
  const space = text.indexOf(' ');
  if (space <= 0) return text;
  const head = text.slice(0, space);
  if (/^\p{L}/u.test(head)) return text;
  return text.slice(space + 1).trim();
}

/**
 * Attach the crops currently growing in each bed. `planted` is the garden's beds.
 * @param {unknown} beds
 * @param {unknown} planted
 * @returns {{ id: number, name: string, plants: string[] }[]}
 */
export function bedsWithCrops(beds, planted) {
  /** @type {Map<number, string[]>} */
  const plants = new Map();
  if (Array.isArray(planted)) {
    for (const bed of planted) {
      if (!bed || typeof bed !== 'object' || typeof bed.id !== 'number') continue;
      const names = Array.isArray(bed.plants)
        ? bed.plants.filter((name) => typeof name === 'string')
        : [];
      plants.set(bed.id, names);
    }
  }
  return sowingBedChoices(beds).map((bed) => ({
    id: bed.id,
    name: bed.name,
    plants: plants.get(bed.id) ?? [],
  }));
}

/**
 * Beds that currently hold this crop, by catalogue name.
 * @param {{ plants?: unknown }[]} beds
 * @param {string} crop
 * @returns {{ id: number, name: string }[]}
 */
export function bedsHoldingCrop(beds, crop) {
  const wanted = crop.trim().toLowerCase();
  if (!wanted || !Array.isArray(beds)) return [];
  return sowingBedChoices(beds).filter((bed) => {
    const source = beds.find((row) => row && typeof row === 'object' && row.id === bed.id);
    const plants = source && Array.isArray(source.plants) ? source.plants : [];
    return plants.some((label) => plantCropName(label).toLowerCase() === wanted);
  });
}

/**
 * @param {{ name: string }[]} crops
 * @param {string} selected
 */
export function matchingCropName(crops, selected) {
  const wanted = selected.trim().toLowerCase();
  if (!wanted) return '';
  const found = crops.find((crop) => crop.name.toLowerCase() === wanted);
  return found ? found.name : '';
}

/**
 * Catalogue names of the crops in one bed. Emoji labels become the name after the emoji.
 * @param {unknown} plants
 * @returns {string[]}
 */
export function bedCropNames(plants) {
  if (!Array.isArray(plants)) return [];
  /** @type {string[]} */
  const names = [];
  const seen = new Set();
  for (const label of plants) {
    const name = plantCropName(label);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/**
 * Catalogue crops that are not already growing in the bed.
 * @param {unknown} crops
 * @param {unknown} planted
 * @returns {{ id: number, name: string, emoji: string, icon: string, iconRev: number | null, aliases: string[] }[]}
 */
export function cropsNotInBed(crops, planted) {
  if (!Array.isArray(crops)) return [];
  const taken = new Set(bedCropNames(planted).map((name) => name.toLowerCase()));
  return crops
    .filter((crop) => {
      if (!crop || typeof crop !== 'object' || crop.archived) return false;
      if (typeof crop.name !== 'string' || !crop.name.trim()) return false;
      return !taken.has(crop.name.trim().toLowerCase());
    })
    .map((crop) => ({
      id: typeof crop.id === 'number' ? crop.id : 0,
      name: crop.name.trim(),
      emoji: typeof crop.emoji === 'string' ? crop.emoji : '',
      icon: typeof crop.icon === 'string' ? crop.icon : '',
      iconRev: typeof crop.iconRev === 'number' ? crop.iconRev : null,
      aliases: Array.isArray(crop.aliases)
        ? crop.aliases.filter((alias) => typeof alias === 'string')
        : [],
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Crops the combobox may offer. `null` keeps the whole catalogue.
 * A name that is not in the catalogue stays, so a bed crop can still be chosen.
 * @param {{ id: number, name: string, emoji: string, icon?: string }[]} crops
 * @param {string[] | null | undefined} names
 */
export function cropsForNames(crops, names) {
  if (names == null) return crops;
  if (!Array.isArray(crops)) return [];
  /** @type {{ text: string, key: string }[]} */
  const wanted = [];
  const seen = new Set();
  for (const name of names) {
    const text = typeof name === 'string' ? name.trim() : '';
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    wanted.push({ text, key });
  }
  /** @type {{ id: number, name: string, emoji: string, icon?: string }[]} */
  const matched = [];
  const used = new Set();
  for (const crop of crops) {
    if (!crop || typeof crop.name !== 'string') continue;
    const key = crop.name.toLowerCase();
    if (!wanted.some((name) => name.key === key) || used.has(key)) continue;
    matched.push(crop);
    used.add(key);
  }
  const missing = wanted
    .filter((name) => !used.has(name.key))
    .map((name) => ({ id: 0, name: name.text, emoji: '', icon: '', iconRev: null }));
  return [...matched, ...missing];
}

/**
 * @param {{ date: string, crop: string, today: string, crops: { name: string }[] }} input
 */
export function sowingDraft(input) {
  const date = input.date || input.today;
  return {
    date,
    crop: matchingCropName(input.crops, input.crop),
    status: statusForSowingDate(date, input.today),
    bedId: 'none',
    note: '',
  };
}

/**
 * @param {{ type?: string, size?: number } | null | undefined} file
 */
export function photoProblem(file) {
  if (!file) return '';
  if (!file.type || !PHOTO_TYPES.has(file.type)) return 'Use a JPEG, PNG, or WebP.';
  if (typeof file.size === 'number' && file.size > MAX_PHOTO_BYTES) return 'Photo is larger than 15 MB.';
  return '';
}

/**
 * @param {{
 *   crop: string,
 *   cropId?: number | null,
 *   date: string,
 *   status: 'planned' | 'done',
 *   bedId: string,
 *   note: string,
 * }} draft
 * @param {{ id: number, name: string }[]} [crops]
 * @returns {{ ok: true, body: {
 *   kind: 'sowing',
 *   date: string,
 *   bedId: number | null,
 *   cropId: number,
 *   status: 'planned' | 'done',
 *   note: string,
 *   photoUrl: string,
 * }} | { ok: false, field: 'crop' | 'date' | 'bed', message: string }}
 */
export function sowingRequest(draft, crops = []) {
  const crop = draft.crop.trim();
  if (!crop && draft.cropId == null) return { ok: false, field: 'crop', message: 'Choose a crop.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
    return { ok: false, field: 'date', message: 'Choose a date.' };
  }
  const bedId = draft.bedId === 'none' || draft.bedId === '' ? null : Number(draft.bedId);
  if (bedId !== null && !Number.isInteger(bedId)) {
    return { ok: false, field: 'bed', message: 'Choose a bed.' };
  }
  let cropId = typeof draft.cropId === 'number' ? draft.cropId : null;
  if (cropId == null) {
    const wanted = crop.toLowerCase();
    const found = crops.find((item) => item.name.toLowerCase() === wanted);
    if (found && typeof found.id === 'number' && found.id > 0) cropId = found.id;
  }
  if (cropId == null || !Number.isInteger(cropId) || cropId < 1) {
    return { ok: false, field: 'crop', message: 'Choose a crop.' };
  }
  return {
    ok: true,
    body: {
      kind: 'sowing',
      date: draft.date,
      bedId,
      cropId,
      status: draft.status,
      note: draft.note.trim(),
      photoUrl: '',
    },
  };
}

/**
 * @param {{ id: number, date: string, crop: string, cropId?: number | null, status: 'planned' | 'done', note?: string, photoUrl?: string, bedId?: number | null }} saved
 * @param {string} bedName
 * @returns {import('./calendar.js').CalendarEntry}
 */
export function calendarSowing(saved, bedName) {
  return {
    id: String(saved.id),
    date: saved.date,
    crop: saved.crop,
    cropId: typeof saved.cropId === 'number' ? saved.cropId : null,
    kind: 'sowing',
    status: saved.status,
    note: saved.note || '',
    bed: bedName || '',
    bedId: typeof saved.bedId === 'number' ? saved.bedId : null,
    photoUrl: saved.photoUrl || '',
  };
}
