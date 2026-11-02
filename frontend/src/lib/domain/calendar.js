/** Year grid for sowing, care, pest, harvest, and diary. */

export const CALENDAR_KINDS = ['sowing', 'care', 'pest', 'harvest', 'diary'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short month name used on the year grid. Defaults to today. */
export function monthName(date = new Date()) {
  return MONTHS[date.getMonth()];
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
 * @property {string} [action] Care action, watering or fertilising.
 * @property {number | null} [amount]
 * @property {string} [unit]
 * @property {number | null} [quantity]
 * @property {number | null} [weightGrams]
 * @property {number} [intensity] Done harvest strength, from 0 to 1.
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
 * @property {number | null} intensity
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
 * @param {string[]} kinds
 * @returns {{ kind: string, points: string }[]}
 */
export function dayWedges(kinds) {
  const present = CALENDAR_KINDS.filter((kind) => kinds.includes(kind));
  const points = WEDGES[present.length] ?? [];
  return present.map((kind, index) => ({ kind, points: points[index] ?? '' }));
}

/**
 * @param {CalendarEntry[]} entries
 * @param {string} kindFilter Empty shows every kind.
 * @returns {DayMark[]}
 */
export function dayMarks(entries, kindFilter) {
  const kinds = CALENDAR_KINDS.filter((kind) => {
    if (kindFilter && kind !== kindFilter) return false;
    return entries.some((entry) => markKind(entry) === kind);
  });
  return dayWedges(kinds).map((wedge) => {
    const ofKind = entries.filter((entry) => markKind(entry) === wedge.kind);
    const done = ofKind.some((entry) => entry.status === 'done');
    let intensity = null;
    if (wedge.kind === 'harvest' && done) {
      intensity = ofKind.reduce((strongest, entry) => {
        if (entry.status !== 'done') return strongest;
        return Math.max(strongest, entry.intensity ?? 1);
      }, 0);
    }
    return {
      kind: wedge.kind,
      points: wedge.points,
      status: done ? 'done' : 'planned',
      intensity,
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
  const created = assignment.createdOn;
  if (typeof created !== 'string' || !ISO_DATE.test(created)) return false;
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
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
  const names = [...crops].sort((left, right) => left.localeCompare(right));
  if (garden || names.length === 0) return ['', ...names];
  return names;
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
 * @param {CalendarEntry[]} entries
 * @param {string} date
 * @param {string} crop
 * @param {string} kindFilter
 * @returns {CalendarEntry[]}
 */
export function dayEntries(entries, date, crop, kindFilter) {
  return entries
    .filter((entry) => entry.date === date && entry.crop === crop)
    .filter((entry) => !kindFilter || markKind(entry) === kindFilter)
    .sort((left, right) => CALENDAR_KINDS.indexOf(markKind(left)) - CALENDAR_KINDS.indexOf(markKind(right)));
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
