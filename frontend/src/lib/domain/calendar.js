/** Year grid for sowing, care, pest, harvest, and diary. */

export const CALENDAR_KINDS = ['sowing', 'care', 'pest', 'harvest', 'diary'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short month name used on the year grid. Defaults to today. */
export function monthName(date = new Date()) {
  return MONTHS[date.getMonth()];
}

/** Short month name from a `YYYY-MM-DD` date. */
export function monthNameFromIso(date) {
  return MONTHS[Number(String(date).slice(5, 7)) - 1] ?? '';
}

/**
 * First day of the month `offset` months from this date.
 * @param {string} date
 * @param {number} offset
 */
export function shiftMonth(date, offset) {
  const [year, month] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + offset, 1));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/**
 * Previous, current, and next month around a date.
 * @param {string} date
 * @returns {{ start: string, end: string, focus: string }}
 */
export function aroundMonth(date) {
  const focus = shiftMonth(date, 0);
  const start = shiftMonth(focus, -1);
  const [year, month] = shiftMonth(focus, 1).split('-').map(Number);
  const endDate = new Date(Date.UTC(year, month, 0));
  const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`;
  return { start, end, focus };
}

export const KIND_LABEL = {
  sowing: 'Sowing',
  care: 'Care',
  pest: 'Pest',
  harvest: 'Harvest',
  diary: 'Diary',
};

/**
 * Wedges in sowing, care, pest, harvest, diary order.
 * Five marks keep the four corners and split the left side: care above, pest below.
 */
const WEDGES = [
  [],
  ['0,0 100,0 100,100 0,100'],
  ['0,0 100,0 100,100', '0,0 0,100 100,100'],
  ['0,0 100,0 100,100', '0,0 0,100 50,50', '0,100 100,100 50,50'],
  ['0,0 100,0 50,50', '0,0 0,100 50,50', '0,100 100,100 50,50', '100,0 100,100 50,50'],
  [
    '0,0 100,0 50,50',
    '0,0 0,50 50,50',
    '0,50 0,100 50,50',
    '0,100 100,100 50,50',
    '100,0 100,100 50,50',
  ],
];

/**
 * @typedef {Object} CalendarEntry
 * @property {string} id
 * @property {string} date
 * @property {string} crop Empty when the entry is for the whole garden.
 * @property {'sowing' | 'care' | 'pest' | 'harvest' | 'diary'} kind
 * @property {'planned' | 'done'} status
 * @property {string} [action] Care action from the shared catalogue. A retired value is kept.
 * @property {number | null} [amount]
 * @property {string} [unit]
 * @property {number | null} [quantity]
 * @property {number | null} [weightGrams]
 * @property {string} [bed]
 * @property {string} [problem]
 * @property {string} [product]
 * @property {string} [detail]
 * @property {string} [note]
 * @property {string} [photoUrl]
 * @property {number | null} [bedId]
 */

/**
 * Sample rows use a made-up id. A saved entry's id is the database number.
 * @param {string} id
 * @returns {number | null}
 */
export function storedEntryId(id) {
  if (!/^\d+$/.test(id)) return null;
  const value = Number(id);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * @typedef {Object} DayMark
 * @property {string} kind
 * @property {string} points
 * @property {'planned' | 'done'} status
 * @property {number | null} shade Done harvest green, 1 lightest through 8 darkest. Null keeps the plain harvest green.
 */

/**
 * @param {number} year
 * @param {number} month 1–12
 */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * @param {number} year
 * @returns {{ name: string, column: number, days: number }[]}
 */
export function yearMonths(year) {
  let column = 1;
  return MONTHS.map((name, index) => {
    const days = daysInMonth(year, index + 1);
    const month = { name, column, days };
    column += days;
    return month;
  });
}

/** @param {number} year */
export function yearDayCount(year) {
  const february = daysInMonth(year, 2);
  return february === 29 ? 366 : 365;
}

/**
 * @param {number} year
 * @returns {{ date: string, column: number }[]}
 */
export function yearDays(year) {
  /** @type {{ date: string, column: number }[]} */
  const days = [];
  let column = 1;
  for (let month = 1; month <= 12; month += 1) {
    const count = daysInMonth(year, month);
    for (let day = 1; day <= count; day += 1) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ date, column });
      column += 1;
    }
  }
  return days;
}

/** @param {string} date YYYY-MM-DD */
export function formatDay(date) {
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

/** @param {string} kind */
export function kindLabel(kind) {
  return KIND_LABEL[kind] ?? kind;
}

/** Panel title. The chip and the day square keep the short name. */
export function markTitle(kind) {
  if (kind === 'pest') return 'Pest and disease';
  return kindLabel(kind);
}

/**
 * The mark is the entry's kind. Pest is its own kind.
 * @param {CalendarEntry} entry
 */
export function markKind(entry) {
  return entry.kind;
}

/** @param {string} crop */
export function cropLabel(crop) {
  return crop || 'Garden';
}

/**
 * Icon and emoji for each catalogue name, so a calendar row can show a mark.
 * The dashboard grid does not use this. Archived crops stay when they are in
 * the list, so an older row can still match.
 * @param {unknown} crops
 * @returns {Record<string, { id: number, icon: string, emoji: string }>}
 */
export function cropMarks(crops) {
  /** @type {Record<string, { id: number, icon: string, emoji: string }>} */
  const marks = {};
  if (!Array.isArray(crops)) return marks;
  for (const crop of crops) {
    if (!crop || typeof crop !== 'object' || typeof crop.name !== 'string') continue;
    const name = crop.name.trim();
    if (!name || typeof crop.id !== 'number') continue;
    marks[name] = {
      id: crop.id,
      icon: typeof crop.icon === 'string' ? crop.icon : '',
      emoji: typeof crop.emoji === 'string' ? crop.emoji : '',
    };
  }
  return marks;
}

/**
 * @param {string[]} kinds
 * @returns {{ kind: string, points: string }[]}
 */
export function dayWedges(kinds) {
  const present = CALENDAR_KINDS.filter((kind) => kinds.includes(kind));
  const points = WEDGES[present.length] ?? [];
  return present.map((kind, index) => ({ kind, points: points[index] ?? '' }));
}

/** Done harvest greens. The heaviest day is 8. */
export const HARVEST_SHADES = 8;

/**
 * Grams from done harvests. A count with no weight adds nothing.
 * @param {CalendarEntry[]} entries
 */
export function harvestGrams(entries) {
  let grams = 0;
  for (const entry of entries) {
    if (entry.kind !== 'harvest' || entry.status !== 'done') continue;
    if (typeof entry.weightGrams === 'number' && entry.weightGrams > 0) grams += entry.weightGrams;
  }
  return grams;
}

/**
 * Which eighth of the heaviest day this weight reaches.
 * A few grams beside a heavy day is 1. The heaviest day is 8.
 * 1,000 g and 1,010 g share a shade when the peak is 1,010 g.
 * @param {number} grams
 * @param {number} peak
 * @returns {number | null}
 */
export function harvestShade(grams, peak) {
  if (!(grams > 0) || !(peak > 0)) return null;
  const band = Math.floor((grams / peak) * HARVEST_SHADES) + 1;
  return Math.min(HARVEST_SHADES, Math.max(1, band));
}

/**
 * Heaviest done harvest day for each crop, in grams.
 * Two pickings on one day are added first.
 * @param {CalendarEntry[]} entries
 * @returns {Map<string, number>}
 */
export function harvestPeaks(entries) {
  /** @type {Map<string, Map<string, number>>} */
  const byCrop = new Map();
  for (const entry of entries) {
    if (entry.kind !== 'harvest' || entry.status !== 'done') continue;
    if (typeof entry.weightGrams !== 'number' || !(entry.weightGrams > 0)) continue;
    let days = byCrop.get(entry.crop);
    if (!days) {
      days = new Map();
      byCrop.set(entry.crop, days);
    }
    days.set(entry.date, (days.get(entry.date) || 0) + entry.weightGrams);
  }
  /** @type {Map<string, number>} */
  const peaks = new Map();
  for (const [crop, days] of byCrop) {
    let peak = 0;
    for (const grams of days.values()) peak = Math.max(peak, grams);
    peaks.set(crop, peak);
  }
  return peaks;
}

/**
 * @param {CalendarEntry[]} entries
 * @param {string} kindFilter Empty shows every kind.
 * @param {number} [harvestPeak] Heaviest day for this crop, in grams. Zero means this day stands alone.
 * @returns {DayMark[]}
 */
export function dayMarks(entries, kindFilter, harvestPeak = 0) {
  const kinds = CALENDAR_KINDS.filter((kind) => {
    if (kindFilter && kind !== kindFilter) return false;
    return entries.some((entry) => markKind(entry) === kind);
  });
  return dayWedges(kinds).map((wedge) => {
    const ofKind = entries.filter((entry) => markKind(entry) === wedge.kind);
    const done = ofKind.some((entry) => entry.status === 'done');
    let shade = null;
    if (wedge.kind === 'harvest' && done) {
      const grams = harvestGrams(ofKind);
      const peak = harvestPeak > 0 ? harvestPeak : grams;
      if (grams > 0) shade = harvestShade(grams, peak);
      else if (harvestPeak > 0) shade = 1;
    }
    return {
      kind: wedge.kind,
      points: wedge.points,
      status: done ? 'done' : 'planned',
      shade,
    };
  });
}

/**
 * A crop placed in a bed. `archivedOn` is empty while it is still there.
 * @typedef {Object} BedCrop
 * @property {string} name Catalogue name, the same text an entry stores.
 * @property {string} createdOn The day it was placed, `YYYY-MM-DD`.
 * @property {string | null} [archivedOn] The day it left the bed.
 */

/**
 * Crop rows for these entries. The garden row leads when an entry has no crop,
 * and it is the only row when nothing was recorded.
 * @param {CalendarEntry[]} entries
 * @returns {string[]}
 */
export function entryRows(entries) {
  /** @type {Set<string>} */
  const crops = new Set();
  let garden = false;
  for (const entry of entries) {
    if (entry.crop) crops.add(entry.crop);
    else garden = true;
  }
  return namedRows(crops, garden);
}

/**
 * @param {Set<string>} crops
 * @param {boolean} garden
 */
function namedRows(crops, garden) {
  const names = [...crops].sort((left, right) => left.localeCompare(right));
  if (garden || names.length === 0) return ['', ...names];
  return names;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The assignment overlaps this year when it was placed on or before the last
 * day, and it had not already left before the first day.
 * @param {BedCrop} assignment
 * @param {number} year
 */
function occupiesYear(assignment, year) {
  return occupiesSpan(assignment, `${year}-01-01`, `${year}-12-31`);
}

/**
 * The assignment overlaps the span when it was placed on or before the last
 * day, and it had not already left before the first day.
 * @param {BedCrop} assignment
 * @param {string} start
 * @param {string} end
 */
function occupiesSpan(assignment, start, end) {
  const created = assignment.createdOn;
  if (typeof created !== 'string' || !ISO_DATE.test(created)) return false;
  if (created > end) return false;
  const archived = assignment.archivedOn;
  return !(typeof archived === 'string' && ISO_DATE.test(archived) && archived < start);
}

/**
 * Crop lanes for one year. A lane comes from an entry dated in that year, or
 * from a bed assignment that overlaps the year. The same catalogue name is
 * one lane. The garden lane leads when an entry has no crop, and it is the
 * only lane when the year has neither.
 * @param {CalendarEntry[]} entries
 * @param {number} year
 * @param {BedCrop[]} [assignments]
 * @returns {string[]}
 */
export function calendarRows(entries, year, assignments = []) {
  const prefix = `${year}-`;
  /** @type {Set<string>} */
  const crops = new Set();
  let garden = false;
  for (const entry of entries) {
    if (!entry.date.startsWith(prefix)) continue;
    if (entry.crop) crops.add(entry.crop);
    else garden = true;
  }
  for (const assignment of assignments) {
    const name = typeof assignment.name === 'string' ? assignment.name.trim() : '';
    if (!name || !occupiesYear(assignment, year)) continue;
    crops.add(name);
  }
  return namedRows(crops, garden);
}

/**
 * Crop lanes for a date span. A lane comes from an entry in the span, or from
 * a bed assignment that overlaps it.
 * @param {CalendarEntry[]} entries
 * @param {string} start
 * @param {string} end
 * @param {BedCrop[]} [assignments]
 * @returns {string[]}
 */
export function calendarSpanRows(entries, start, end, assignments = []) {
  /** @type {Set<string>} */
  const crops = new Set();
  let garden = false;
  for (const entry of entries) {
    if (entry.date < start || entry.date > end) continue;
    if (entry.crop) crops.add(entry.crop);
    else garden = true;
  }
  for (const assignment of assignments) {
    const name = typeof assignment.name === 'string' ? assignment.name.trim() : '';
    if (!name || !occupiesSpan(assignment, start, end)) continue;
    crops.add(name);
  }
  return namedRows(crops, garden);
}

/**
 * @param {string} date
 * @param {number} days
 */
function shiftDate(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const d = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Inclusive day columns for a calendar span. Column 1 is `start`.
 * @param {string} start
 * @param {string} end
 * @returns {{ date: string, column: number }[]}
 */
export function spanDays(start, end) {
  /** @type {{ date: string, column: number }[]} */
  const days = [];
  let column = 1;
  let cursor = start;
  while (cursor <= end && column <= 400) {
    days.push({ date: cursor, column });
    cursor = shiftDate(cursor, 1);
    column += 1;
  }
  return days;
}

/**
 * Month headings for a span, in the same shape as a year.
 * @param {string} start
 * @param {string} end
 * @returns {{ name: string, column: number, days: number }[]}
 */
export function spanMonths(start, end) {
  /** @type {{ name: string, column: number, days: number }[]} */
  const months = [];
  for (const day of spanDays(start, end)) {
    const name = MONTHS[Number(day.date.slice(5, 7)) - 1];
    const last = months[months.length - 1];
    if (!last || last.name !== name) months.push({ name, column: day.column, days: 1 });
    else last.days += 1;
  }
  return months;
}

/**
 * One open panel on the calendar.
 * A cell is one crop on one day. A day is every crop on that date.
 * A crop is that crop across the year on screen.
 * @typedef {Object} CellSelection
 * @property {'cell'} scope
 * @property {string} date
 * @property {string} crop
 */

/**
 * @typedef {Object} DaySelection
 * @property {'day'} scope
 * @property {string} date
 */

/**
 * @typedef {Object} CropSelection
 * @property {'crop'} scope
 * @property {string} crop
 */

/** @typedef {CellSelection | DaySelection | CropSelection} CalendarSelection */

/**
 * @param {CalendarEntry} entry
 * @param {string} kindFilter
 */
function matchesKind(entry, kindFilter) {
  return !kindFilter || markKind(entry) === kindFilter;
}

/** @param {CalendarEntry} entry */
function kindRank(entry) {
  return CALENDAR_KINDS.indexOf(markKind(entry));
}

/**
 * @param {CalendarEntry[]} entries
 * @param {string} date
 * @param {string} crop
 * @param {string} kindFilter
 * @returns {CalendarEntry[]}
 */
export function dayEntries(entries, date, crop, kindFilter) {
  return entries
    .filter((entry) => entry.date === date && entry.crop === crop && matchesKind(entry, kindFilter))
    .sort((left, right) => kindRank(left) - kindRank(right));
}

/**
 * Every crop on one date. The garden lane leads, then crops by name.
 * @param {CalendarEntry[]} entries
 * @param {string} date
 * @param {string} kindFilter
 * @returns {CalendarEntry[]}
 */
export function dateEntries(entries, date, kindFilter) {
  return entries
    .filter((entry) => entry.date === date && matchesKind(entry, kindFilter))
    .sort((left, right) => {
      if (!left.crop && right.crop) return -1;
      if (left.crop && !right.crop) return 1;
      const crop = left.crop.localeCompare(right.crop);
      return crop || kindRank(left) - kindRank(right);
    });
}

/**
 * One crop across the displayed year, earliest day first.
 * @param {CalendarEntry[]} entries
 * @param {number} year
 * @param {string} crop
 * @param {string} kindFilter
 * @returns {CalendarEntry[]}
 */
export function cropYearEntries(entries, year, crop, kindFilter) {
  const prefix = `${year}-`;
  return entries
    .filter((entry) => entry.crop === crop && entry.date.startsWith(prefix) && matchesKind(entry, kindFilter))
    .sort((left, right) => {
      if (left.date !== right.date) return left.date < right.date ? -1 : 1;
      return kindRank(left) - kindRank(right);
    });
}

/**
 * @param {CalendarEntry[]} entries
 * @param {CalendarSelection | null} selection
 * @param {number} year
 * @param {string} kindFilter
 * @returns {CalendarEntry[]}
 */
export function selectionEntries(entries, selection, year, kindFilter) {
  if (!selection) return [];
  if (selection.scope === 'day') return dateEntries(entries, selection.date, kindFilter);
  if (selection.scope === 'crop') return cropYearEntries(entries, year, selection.crop, kindFilter);
  return dayEntries(entries, selection.date, selection.crop, kindFilter);
}

/**
 * The line that says which crop or day a row belongs to.
 * A single cell already says both in the heading.
 * @param {CalendarEntry} entry
 * @param {'cell' | 'day' | 'crop' | ''} scope
 */
export function entryWhere(entry, scope) {
  if (scope === 'day') {
    return entry.bed ? `${cropLabel(entry.crop)} · ${entry.bed}` : cropLabel(entry.crop);
  }
  if (scope === 'crop') {
    return entry.bed ? `${formatDay(entry.date)} · ${entry.bed}` : formatDay(entry.date);
  }
  return '';
}

/**
 * @param {string} date
 * @param {string} crop
 * @param {DayMark[]} marks
 */
export function dayReading(date, crop, marks) {
  const label = `${formatDay(date)} · ${cropLabel(crop)}`;
  if (!marks.length) return label;
  return `${label} · ${marks.map((mark) => kindLabel(mark.kind)).join(', ')}`;
}

/** @param {CalendarEntry[]} entries */
export function dayBed(entries) {
  return entries.find((entry) => entry.bed)?.bed ?? '';
}
