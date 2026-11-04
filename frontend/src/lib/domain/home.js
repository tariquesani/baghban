/** Home briefing. Pure grouping of assignments, calendar entries, and dates. */

import { aroundMonth, cropLabel, formatDay, kindLabel, markTitle } from './calendar.js';
import { actionLabel, entryDetail } from './entryForm.js';

/**
 * @typedef {{
 *   id: string,
 *   date: string,
 *   crop: string,
 *   kind: string,
 *   status: string,
 *   bedId: number | null,
 *   bed: string,
 *   weightGrams: number | null,
 *   quantity: number | null,
 *   unit: string,
 *   action: string,
 *   note?: string,
 *   problem?: string,
 *   product?: string,
 *   amount?: number | null,
 *   photoUrl?: string,
 * }} HomeEntry
 * @typedef {{
 *   id: number,
 *   bedId: number,
 *   bedName: string,
 *   name: string,
 *   emoji: string,
 *   createdOn: string,
 *   daysToMaturity: number | null,
 * }} Assignment
 * @typedef {{
 *   id: number,
 *   bedId: number,
 *   bedName: string,
 *   name: string,
 *   emoji: string,
 *   days: string,
 *   harvest: string,
 *   maturity: string,
 * }} GrowingCard
 */

/**
 * @param {Date} instant
 * @param {string} timeZone
 */
export function civilDate(instant, timeZone) {
  const zone = timeZone || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

/**
 * @param {string} date
 * @param {number} days
 */
export function shiftDate(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const d = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Previous month, this month, and next month around a civil date.
 * @param {string} today
 * @returns {{ start: string, end: string }}
 */
export function monthWindow(today) {
  const span = aroundMonth(today);
  return { start: span.start, end: span.end };
}

/**
 * @param {number} grams
 */
export function formatWeight(grams) {
  const whole = Math.round(grams);
  if (whole < 1000) return `${whole} g`;
  return `${(whole / 1000).toFixed(1)} kg`;
}

/**
 * @param {number} count
 */
export function cropCount(count) {
  return count === 1 ? '1 crop' : `${count} crops`;
}

/**
 * Planted, empty, and total area of the beds on the plan, each to one decimal.
 * @param {{ areaSqFt?: number | null, w?: number | null, h?: number | null, plants?: string[], removed?: boolean }[]} beds
 * @returns {{ planted: string, empty: string, total: string }}
 */
export function planAreas(beds) {
  let planted = 0;
  let empty = 0;
  for (const bed of beds || []) {
    if (bed.removed) continue;
    const area = typeof bed.areaSqFt === 'number' ? bed.areaSqFt : (Number(bed.w) || 0) * (Number(bed.h) || 0);
    const hasCrop = (bed.plants || []).some((name) => String(name).trim());
    if (hasCrop) planted += area;
    else empty += area;
  }
  return {
    planted: planted.toFixed(1),
    empty: empty.toFixed(1),
    total: (planted + empty).toFixed(1),
  };
}

/**
 * @param {string} left
 * @param {string} right
 */
function daysBetween(left, right) {
  const start = Date.parse(`${left}T00:00:00Z`);
  const end = Date.parse(`${right}T00:00:00Z`);
  return Math.round((end - start) / 86400000);
}

/**
 * @param {HomeEntry} entry
 * @param {Assignment} assignment
 */
function samePlanting(entry, assignment) {
  if (entry.bedId !== assignment.bedId) return false;
  const crop = entry.crop.trim();
  if (!crop) return false;
  const labeled = assignment.emoji ? `${assignment.emoji} ${assignment.name}` : assignment.name;
  return crop === assignment.name || crop === labeled;
}

/**
 * Latest done sowing for this planting. Empty when none has been recorded.
 * @param {Assignment} assignment
 * @param {HomeEntry[]} entries
 */
function sowingDate(assignment, entries) {
  const sowings = entries.filter(
    (entry) =>
      entry.kind === 'sowing' &&
      entry.status === 'done' &&
      entry.date >= assignment.createdOn &&
      samePlanting(entry, assignment),
  );
  sowings.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  return sowings.length ? sowings[sowings.length - 1].date : '';
}

/**
 * @param {number} days
 */
function ageLabel(days) {
  if (days <= 0) return 'Sown today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/**
 * @param {HomeEntry[]} harvests
 */
function harvestLabel(harvests) {
  if (!harvests.length) return 'Nothing harvested yet';
  const weighed = harvests.filter((entry) => typeof entry.weightGrams === 'number');
  if (weighed.length) {
    const grams = weighed.reduce((sum, entry) => sum + (entry.weightGrams || 0), 0);
    return `${formatWeight(grams)} harvested`;
  }
  /** @type {Map<string, number>} */
  const totals = new Map();
  for (const entry of harvests) {
    if (typeof entry.quantity !== 'number' || !entry.unit) continue;
    totals.set(entry.unit, (totals.get(entry.unit) || 0) + entry.quantity);
  }
  if (!totals.size) return 'Nothing harvested yet';
  const parts = [...totals.entries()].map(([unit, count]) => `${count} ${unit}`);
  return `${parts.join(', ')} harvested`;
}

/**
 * @param {Assignment[]} assignments
 * @param {HomeEntry[]} entries
 * @param {string} today
 * @returns {GrowingCard[]}
 */
export function growingCards(assignments, entries, today) {
  const yearStart = `${today.slice(0, 4)}-01-01`;
  return assignments.map((assignment) => {
    const sown = sowingDate(assignment, entries);
    const age = sown ? daysBetween(sown, today) : 0;
    const harvests = entries.filter(
      (entry) =>
        entry.kind === 'harvest' &&
        entry.status === 'done' &&
        entry.date >= yearStart &&
        entry.date <= today &&
        samePlanting(entry, assignment),
    );
    const maturity =
      sown && typeof assignment.daysToMaturity === 'number'
        ? `Day ${Math.max(age, 0)} of ${assignment.daysToMaturity}`
        : '';
    return {
      id: assignment.id,
      bedId: assignment.bedId,
      bedName: assignment.bedName,
      name: assignment.name,
      emoji: assignment.emoji,
      days: sown ? ageLabel(age) : '',
      harvest: harvestLabel(harvests),
      maturity,
    };
  });
}

/**
 * @param {HomeEntry[]} entries
 * @param {string} today
 * @returns {HomeEntry[]}
 */
export function overdueEntries(entries, today) {
  return entries
    .filter((entry) => entry.status === 'planned' && entry.date < today)
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

/**
 * @param {HomeEntry[]} entries
 * @param {string} today
 */
export function todayEntries(entries, today) {
  return entries
    .filter((entry) => entry.status === 'planned' && entry.date === today)
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Planned entries from tomorrow through the fourteenth day.
 * @param {HomeEntry[]} entries
 * @param {string} today
 */
export function comingEntries(entries, today) {
  const start = shiftDate(today, 1);
  const end = shiftDate(today, 14);
  return entries
    .filter((entry) => entry.status === 'planned' && entry.date >= start && entry.date <= end)
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

/**
 * @param {HomeEntry[]} entries
 */
export function recentEntries(entries) {
  return entries
    .filter((entry) => entry.status === 'done')
    .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))
    .slice(0, 4);
}

/**
 * Every calendar photo, newest first. Planned and done both count.
 * The same day keeps the later-saved entry first.
 * @param {HomeEntry[]} entries
 * @returns {{
 *   id: string,
 *   photoUrl: string,
 *   alt: string,
 *   date: string,
 *   crop: string,
 *   kind: string,
 *   status: string,
 *   bed: string,
 *   action: string,
 *   problem: string,
 *   product: string,
 *   detail: string,
 *   note: string,
 * }[]}
 */
export function galleryPhotos(entries) {
  return entries
    .filter((entry) => typeof entry.photoUrl === 'string' && entry.photoUrl.trim() !== '')
    .sort((left, right) => right.date.localeCompare(left.date) || compareIdDesc(left.id, right.id))
    .map((entry) => ({
      id: entry.id,
      photoUrl: entry.photoUrl.trim(),
      alt: galleryAlt(entry),
      date: formatDay(entry.date),
      crop: cropLabel(entry.crop),
      kind: markTitle(entry.kind),
      status: entry.status === 'planned' ? 'Planned' : 'Done',
      bed: (entry.bed || '').trim(),
      action: actionLabel(entry.action || ''),
      problem: (entry.problem || '').trim(),
      product: (entry.product || '').trim(),
      detail: entryDetail(entry),
      note: (entry.note || '').trim(),
    }));
}

/**
 * @param {string} left
 * @param {string} right
 */
function compareIdDesc(left, right) {
  const leftNum = /^\d+$/.test(left) ? Number(left) : null;
  const rightNum = /^\d+$/.test(right) ? Number(right) : null;
  if (leftNum !== null && rightNum !== null) return rightNum - leftNum;
  return right.localeCompare(left);
}

/**
 * @param {HomeEntry} entry
 */
function galleryAlt(entry) {
  const day = formatDay(entry.date);
  const crop = (entry.crop || '').trim();
  return crop ? `${day}, ${crop}` : day;
}

/**
 * @param {HomeEntry} entry
 */
export function entryTitle(entry) {
  const kind = kindLabel(entry.kind);
  const crop = entry.crop ? ` · ${entry.crop}` : '';
  const bed = entry.bed ? ` · ${entry.bed}` : '';
  return `${kind}${crop}${bed}`;
}

/**
 * @param {number | null | undefined} amount
 * @param {string} [unit]
 */
function measure(amount, unit) {
  if (typeof amount !== 'number') return '';
  return unit ? `${amount} ${unit}` : String(amount);
}

/**
 * The activity phrase on a Lately note. The date and bed are set apart in the row.
 * @param {HomeEntry} entry
 */
function latelyText(entry) {
  if (entry.kind === 'care') {
    const label = actionLabel(entry.action) || 'Care';
    if (entry.action === 'watering') {
      const amount = measure(entry.amount, entry.unit);
      return amount ? `${label} · ${amount}` : label;
    }
    const product = (entry.product || '').trim();
    if (product) return `${label} · ${product}`;
    const amount = measure(entry.amount, entry.unit);
    return amount ? `${label} · ${amount}` : label;
  }
  if (entry.kind === 'diary') {
    const note = (entry.note || '').trim();
    const subject = note || entry.crop;
    return subject ? `Diary · ${subject}` : 'Diary';
  }
  const parts = [kindLabel(entry.kind)];
  if (entry.crop) parts.push(entry.crop);
  if (entry.kind === 'harvest' && typeof entry.weightGrams === 'number') parts.push(formatWeight(entry.weightGrams));
  else if (entry.kind === 'harvest' && typeof entry.quantity === 'number' && entry.unit) {
    parts.push(`${entry.quantity} ${entry.unit}`);
  }
  return parts.join(' · ');
}

/**
 * One Lately row: a bold date, the activity, and the bed in muted type.
 * @param {HomeEntry} entry
 * @returns {{ date: string, text: string, bed: string }}
 */
export function latelyNote(entry) {
  return {
    date: formatDay(entry.date),
    text: latelyText(entry),
    bed: entry.bed || '',
  };
}

/**
 * Done harvest weight from 1 January through today.
 * @param {HomeEntry[]} entries
 * @param {string} today
 */
export function seasonWeight(entries, today) {
  const start = `${today.slice(0, 4)}-01-01`;
  const grams = entries.reduce((sum, entry) => {
    if (entry.kind !== 'harvest' || entry.status !== 'done') return sum;
    if (entry.date < start || entry.date > today) return sum;
    if (typeof entry.weightGrams !== 'number') return sum;
    return sum + entry.weightGrams;
  }, 0);
  return formatWeight(grams);
}

/**
 * @param {HomeEntry[]} entries
 * @param {string} today
 * @returns {{ crop: string, grams: number, label: string, width: number }[]}
 */
export function harvestByCrop(entries, today) {
  const start = `${today.slice(0, 4)}-01-01`;
  /** @type {Map<string, number>} */
  const totals = new Map();
  for (const entry of entries) {
    if (entry.kind !== 'harvest' || entry.status !== 'done') continue;
    if (entry.date < start || entry.date > today) continue;
    if (typeof entry.weightGrams !== 'number' || !entry.crop) continue;
    totals.set(entry.crop, (totals.get(entry.crop) || 0) + entry.weightGrams);
  }
  const rows = [...totals.entries()]
    .map(([crop, grams]) => ({ crop, grams }))
    .sort((left, right) => right.grams - left.grams || left.crop.localeCompare(right.crop));
  const peak = rows[0]?.grams || 1;
  return rows.map((row) => ({
    ...row,
    label: formatWeight(row.grams),
    width: Math.max(2, Math.round((row.grams / peak) * 100)),
  }));
}
