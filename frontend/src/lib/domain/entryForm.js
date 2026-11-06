/** Draft and request for recording any calendar kind. */

import { CARE_ACTIONS } from './catalogue.js';
import { sowingDraft, sowingRequest } from './sowing.js';

export { CARE_ACTIONS };

export const ENTRY_KINDS = ['sowing', 'care', 'pest', 'harvest', 'diary'];

/**
 * @param {string} kind
 * @returns {kind is 'sowing' | 'care' | 'pest' | 'harvest' | 'diary'}
 */
export function isEntryKind(kind) {
  return ENTRY_KINDS.includes(kind);
}

/**
 * The catalogue label, or the stored word when a retired action is still on a row.
 * @param {string} action
 */
export function actionLabel(action) {
  if (!action) return '';
  return CARE_ACTIONS.find((choice) => choice.value === action)?.label ?? action;
}

/** @param {string} kind */
export function entryCopy(kind) {
  const copies = {
    sowing: {
      addTitle: 'Add sowing',
      editTitle: 'Edit sowing',
      description: 'Planned is a reminder. Done means the seed went in.',
      bedHint: 'Not in a bed keeps this sowing off the plan.',
      saveError: 'Could not save the sowing.',
    },
    care: {
      addTitle: 'Add care',
      editTitle: 'Edit care',
      description: 'Planned is a reminder. Done means the care happened.',
      bedHint: 'Not in a bed keeps this care off the plan.',
      saveError: 'Could not save the care.',
    },
    pest: {
      addTitle: 'Add pest control',
      editTitle: 'Edit pest control',
      description: 'Planned is a reminder. Done means the treatment happened.',
      bedHint: 'Not in a bed keeps this treatment off the plan.',
      saveError: 'Could not save the pest control.',
    },
    harvest: {
      addTitle: 'Add harvest',
      editTitle: 'Edit harvest',
      description: 'Planned is a reminder. Done means the crop was picked.',
      bedHint: 'Not in a bed keeps this harvest off the plan.',
      saveError: 'Could not save the harvest.',
    },
    diary: {
      addTitle: 'Add diary note',
      editTitle: 'Edit diary note',
      description: 'A diary note is recorded as done.',
      bedHint: 'Not in a bed keeps this note off the plan.',
      saveError: 'Could not save the diary note.',
    },
  };
  return copies[kind] ?? copies.sowing;
}

/**
 * @param {string} kind
 * @param {{ date: string, crop: string, today: string, crops: { name: string }[] }} input
 */
export function entryDraft(kind, input) {
  const draft = sowingDraft(input);
  if (kind === 'diary') draft.status = 'done';
  return {
    ...draft,
    action: '',
    problem: '',
    product: '',
    amount: '',
    unit: '',
    quantity: '',
    weightGrams: '',
  };
}

/**
 * @param {string} text
 * @param {string} field
 * @param {string} message
 * @param {boolean} whole
 * @returns {{ ok: true, value: number | null } | { ok: false, field: string, message: string }}
 */
function counted(text, field, message, whole) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { ok: true, value: null };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || (whole && !Number.isInteger(value))) {
    return { ok: false, field, message };
  }
  return { ok: true, value };
}

/**
 * @param {string} kind
 * @param {{
 *   crop: string,
 *   cropId?: number | null,
 *   date: string,
 *   status: 'planned' | 'done',
 *   bedId: string,
 *   note: string,
 *   action?: string,
 *   problem?: string,
 *   product?: string,
 *   amount?: string,
 *   unit?: string,
 *   quantity?: string,
 *   weightGrams?: string,
 * }} draft
 * @param {{ id: number, name: string }[]} [crops]
 */
export function entryRequest(kind, draft, crops = []) {
  const status = kind === 'diary' ? 'done' : draft.status;
  const shared = sowingRequest(
    {
      crop: draft.crop,
      cropId: draft.cropId,
      date: draft.date,
      status,
      bedId: draft.bedId,
      note: draft.note,
    },
    crops,
  );
  if (!shared.ok) return shared;
  if (kind === 'sowing' || kind === 'diary') {
    return { ok: true, body: { ...shared.body, kind, status } };
  }
  if (kind === 'care') {
    if (!CARE_ACTIONS.some((choice) => choice.value === draft.action)) {
      return { ok: false, field: 'action', message: 'Choose a care action.' };
    }
    const amount = counted(draft.amount ?? '', 'amount', 'Enter a number.', false);
    if (!amount.ok) return amount;
    return {
      ok: true,
      body: {
        ...shared.body,
        kind: 'care',
        action: draft.action,
        product: (draft.product ?? '').trim(),
        amount: amount.value,
        unit: (draft.unit ?? '').trim(),
      },
    };
  }
  if (kind === 'pest') {
    const amount = counted(draft.amount ?? '', 'amount', 'Enter a number.', false);
    if (!amount.ok) return amount;
    return {
      ok: true,
      body: {
        ...shared.body,
        kind: 'pest',
        problem: (draft.problem ?? '').trim(),
        product: (draft.product ?? '').trim(),
        amount: amount.value,
        unit: (draft.unit ?? '').trim(),
      },
    };
  }
  if (kind === 'harvest') {
    const quantity = counted(draft.quantity ?? '', 'quantity', 'Enter a number.', false);
    if (!quantity.ok) return quantity;
    const weight = counted(draft.weightGrams ?? '', 'weight', 'Enter a whole number of grams.', true);
    if (!weight.ok) return weight;
    return {
      ok: true,
      body: {
        ...shared.body,
        kind: 'harvest',
        quantity: quantity.value,
        unit: (draft.unit ?? '').trim(),
        weightGrams: weight.value,
      },
    };
  }
  return { ok: false, field: 'crop', message: 'Choose a crop.' };
}

/**
 * A short line for the day panel. Care and pest show the amount. Harvest shows count and weight.
 * @param {{
 *   kind: string,
 *   amount?: number | null,
 *   unit?: string,
 *   quantity?: number | null,
 *   weightGrams?: number | null,
 * }} entry
 */
export function entryDetail(entry) {
  if (entry.kind === 'harvest') {
    const parts = [];
    if (typeof entry.quantity === 'number') {
      parts.push(entry.unit ? `${entry.quantity} ${entry.unit}` : String(entry.quantity));
    }
    if (typeof entry.weightGrams === 'number') parts.push(`${entry.weightGrams} g`);
    return parts.join(' · ');
  }
  if ((entry.kind === 'care' || entry.kind === 'pest') && typeof entry.amount === 'number') {
    return entry.unit ? `${entry.amount} ${entry.unit}` : String(entry.amount);
  }
  return '';
}

/**
 * @param {Record<string, unknown>} saved
 * @param {string} bedName
 * @returns {import('./calendar.js').CalendarEntry}
 */
export function calendarRecord(saved, bedName) {
  const kind = typeof saved.kind === 'string' && isEntryKind(saved.kind) ? saved.kind : 'sowing';
  const action = typeof saved.action === 'string' ? saved.action : '';
  const status = saved.status === 'planned' ? 'planned' : 'done';
  /** @type {import('./calendar.js').CalendarEntry} */
  const record = {
    id: String(saved.id),
    date: typeof saved.date === 'string' ? saved.date : '',
    crop: typeof saved.crop === 'string' ? saved.crop : '',
    cropId: typeof saved.cropId === 'number' ? saved.cropId : null,
    kind,
    status,
    note: typeof saved.note === 'string' ? saved.note : '',
    bed: bedName || '',
    bedId: typeof saved.bedId === 'number' ? saved.bedId : null,
    photoUrl: typeof saved.photoUrl === 'string' ? saved.photoUrl : '',
    action,
    problem: typeof saved.problem === 'string' ? saved.problem : '',
    product: typeof saved.product === 'string' ? saved.product : '',
    amount: typeof saved.amount === 'number' ? saved.amount : null,
    unit: typeof saved.unit === 'string' ? saved.unit : '',
    quantity: typeof saved.quantity === 'number' ? saved.quantity : null,
    weightGrams: typeof saved.weightGrams === 'number' ? saved.weightGrams : null,
    ruleId: typeof saved.ruleId === 'number' ? saved.ruleId : null,
    ruleActive:
      saved.ruleActive === true || saved.ruleActive === 1
        ? true
        : saved.ruleActive === false || saved.ruleActive === 0
          ? false
          : null,
  };
  record.detail = entryDetail(record);
  return record;
}

/** @param {import('./calendar.js').CalendarEntry} entry */
export function formFields(entry) {
  return {
    action: entry.action ?? '',
    problem: entry.problem ?? '',
    product: entry.product ?? '',
    amount: typeof entry.amount === 'number' ? String(entry.amount) : '',
    unit: entry.unit ?? '',
    quantity: typeof entry.quantity === 'number' ? String(entry.quantity) : '',
    weightGrams: typeof entry.weightGrams === 'number' ? String(entry.weightGrams) : '',
  };
}
