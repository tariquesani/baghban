/** Care schedule form helpers. Weekdays use dateutil numbers: 0 Mon … 6 Sun. */

export const WEEKDAYS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];

export const REPEAT_CHOICES = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every N days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'yearly', label: 'Yearly' },
];

export const WEEKLY_INTERVALS = [
  { value: '1', label: 'Every week' },
  { value: '2', label: 'Every 2nd week' },
  { value: '3', label: 'Every 3rd week' },
];

/**
 * @param {{
 *   repeat: string,
 *   interval: string,
 *   weekdays: number[],
 *   endsOn: string,
 *   crop: string,
 *   cropId?: number | null,
 *   date: string,
 *   bedId: string,
 *   note: string,
 *   action?: string,
 *   product?: string,
 *   amount?: string,
 *   unit?: string,
 *   entryId?: number | null,
 * }} draft
 * @param {{ id: number, name: string }[]} crops
 * @param {(kind: string, draft: object, crops?: object[]) =>
 *   { ok: true, body: Record<string, unknown> } | { ok: false, field: string, message: string }} entryRequest
 */
export function careRuleRequest(draft, crops, entryRequest) {
  if (draft.repeat === 'none') {
    return { ok: false, field: 'repeat', message: 'Choose how often this care repeats.' };
  }
  const entry = entryRequest(
    'care',
    {
      crop: draft.crop,
      cropId: draft.cropId,
      date: draft.date,
      status: 'planned',
      bedId: draft.bedId,
      note: draft.note,
      action: draft.action,
      product: draft.product,
      amount: draft.amount,
      unit: draft.unit,
    },
    crops,
  );
  if (!entry.ok) return entry;

  const freq = draft.repeat;
  let interval = 1;
  /** @type {number[]} */
  let weekdays = [];
  if (freq === 'daily') {
    const parsed = Number(draft.interval);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { ok: false, field: 'interval', message: 'Enter how many days between cares.' };
    }
    interval = parsed;
  } else if (freq === 'weekly') {
    const parsed = Number(draft.interval);
    if (![1, 2, 3].includes(parsed)) {
      return { ok: false, field: 'interval', message: 'Choose every week, 2nd week, or 3rd week.' };
    }
    interval = parsed;
    weekdays = [...draft.weekdays].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
    if (weekdays.length === 0) {
      return { ok: false, field: 'weekdays', message: 'Choose at least one weekday.' };
    }
  } else if (freq === 'yearly') {
    interval = 1;
  } else {
    return { ok: false, field: 'repeat', message: 'Choose how often this care repeats.' };
  }

  const endsOn = draft.endsOn.trim();
  if (endsOn && !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    return { ok: false, field: 'endsOn', message: 'Pick an end date.' };
  }
  if (endsOn && endsOn < draft.date) {
    return { ok: false, field: 'endsOn', message: 'End date must be on or after the start date.' };
  }

  const body = entry.body;
  /** @type {Record<string, unknown>} */
  const request = {
    bedId: body.bedId ?? null,
    cropId: body.cropId ?? null,
    action: body.action,
    product: body.product ?? '',
    amount: body.amount ?? null,
    unit: body.unit ?? '',
    note: body.note ?? '',
    freq,
    interval,
    weekdays,
    anchorDate: body.date,
    endsOn: endsOn || null,
    active: true,
  };
  if (typeof draft.entryId === 'number' && Number.isInteger(draft.entryId) && draft.entryId > 0) {
    request.entryId = draft.entryId;
  }
  return { ok: true, body: request };
}
