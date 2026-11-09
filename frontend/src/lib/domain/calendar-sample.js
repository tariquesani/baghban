/** Fixed 2026 picture from the calendar mockup. Not the live garden. */

/**
 * @param {string} date
 * @param {string} crop
 * @param {'sowing' | 'care' | 'pest' | 'harvest' | 'diary' | 'uproot'} kind
 * @param {'planned' | 'done'} status
 * @param {{ weightGrams?: number, action?: string, bed?: string, problem?: string, product?: string, detail?: string, note?: string }} [extra]
 */
function entry(date, crop, kind, status, extra = {}) {
  return {
    id: `${crop || 'garden'}-${date}-${extra.action || kind}`,
    date,
    crop,
    kind,
    status,
    ...extra,
  };
}

export const SAMPLE_YEAR = 2026;

export const SAMPLE_SELECTION = {
  date: '2026-10-23',
  crop: 'Tomato',
};

export const SAMPLE_ENTRIES = [
  entry('2026-01-03', '', 'diary', 'done'),
  entry('2026-03-20', '', 'diary', 'done'),
  entry('2026-06-12', '', 'diary', 'done'),
  entry('2026-10-02', '', 'diary', 'done'),
  entry('2026-10-28', '', 'care', 'planned'),

  entry('2026-07-02', 'Bhindi', 'sowing', 'done'),
  entry('2026-07-18', 'Bhindi', 'care', 'done'),
  entry('2026-08-08', 'Bhindi', 'care', 'done'),
  entry('2026-08-16', 'Bhindi', 'harvest', 'done', { weightGrams: 400 }),
  entry('2026-08-28', 'Bhindi', 'harvest', 'done', { weightGrams: 900 }),
  entry('2026-09-08', 'Bhindi', 'harvest', 'done', { weightGrams: 1400 }),
  entry('2026-09-19', 'Bhindi', 'harvest', 'done', { weightGrams: 250 }),
  entry('2026-09-24', 'Bhindi', 'diary', 'done'),

  entry('2026-01-10', 'Coriander', 'harvest', 'done', { weightGrams: 80 }),
  entry('2026-01-24', 'Coriander', 'diary', 'done'),
  entry('2026-02-02', 'Coriander', 'sowing', 'done'),
  entry('2026-02-20', 'Coriander', 'harvest', 'done', { weightGrams: 60 }),
  entry('2026-09-28', 'Coriander', 'sowing', 'done'),
  entry('2026-10-06', 'Coriander', 'care', 'done'),
  entry('2026-10-10', 'Coriander', 'sowing', 'done'),
  entry('2026-10-10', 'Coriander', 'care', 'done'),
  entry('2026-10-10', 'Coriander', 'pest', 'done', {
    problem: 'Aphids in the row',
    product: 'Neem oil',
  }),
  entry('2026-10-10', 'Coriander', 'harvest', 'done', { weightGrams: 70 }),
  entry('2026-10-10', 'Coriander', 'diary', 'done'),
  entry('2026-10-12', 'Coriander', 'sowing', 'done'),
  entry('2026-10-18', 'Coriander', 'harvest', 'done', { weightGrams: 40 }),
  entry('2026-10-20', 'Coriander', 'care', 'done'),
  entry('2026-10-25', 'Coriander', 'harvest', 'done', { weightGrams: 180 }),
  entry('2026-10-25', 'Coriander', 'diary', 'done'),
  entry('2026-10-26', 'Coriander', 'sowing', 'planned'),
  entry('2026-11-09', 'Coriander', 'sowing', 'planned'),

  entry('2026-10-08', 'Methi', 'sowing', 'done'),
  entry('2026-10-15', 'Methi', 'care', 'done'),
  entry('2026-11-01', 'Methi', 'sowing', 'planned'),

  entry('2026-01-06', 'Tomato', 'harvest', 'done', { weightGrams: 460 }),
  entry('2026-01-17', 'Tomato', 'harvest', 'done', { weightGrams: 340 }),
  entry('2026-02-08', 'Tomato', 'harvest', 'done', { weightGrams: 270 }),
  entry('2026-03-01', 'Tomato', 'diary', 'done'),
  entry('2026-06-08', 'Tomato', 'sowing', 'done'),
  entry('2026-06-22', 'Tomato', 'care', 'done'),
  entry('2026-07-15', 'Tomato', 'care', 'done'),
  entry('2026-08-09', 'Tomato', 'care', 'done'),
  entry('2026-09-05', 'Tomato', 'care', 'done'),
  entry('2026-10-04', 'Tomato', 'care', 'done'),
  entry('2026-10-12', 'Tomato', 'harvest', 'done', { weightGrams: 400 }),
  entry('2026-10-16', 'Tomato', 'care', 'done'),
  entry('2026-10-16', 'Tomato', 'pest', 'done', {
    bed: 'East tomatoes',
    problem: 'Aphids on the new growth',
    product: 'Neem oil',
  }),
  entry('2026-10-16', 'Tomato', 'harvest', 'done', { weightGrams: 520 }),
  entry('2026-10-16', 'Tomato', 'diary', 'done'),
  entry('2026-10-18', 'Tomato', 'harvest', 'done', { weightGrams: 590 }),
  entry('2026-10-19', 'Tomato', 'pest', 'done', {
    bed: 'East tomatoes',
    problem: 'Aphids on the new growth',
    product: 'Neem oil',
  }),
  entry('2026-10-21', 'Tomato', 'care', 'done'),
  entry('2026-10-23', 'Tomato', 'harvest', 'done', {
    weightGrams: 840,
    bed: 'East tomatoes',
    detail: '12 fruit · 840 g',
    note: 'First ripe fruit after the rain',
  }),
  entry('2026-10-23', 'Tomato', 'diary', 'done', {
    bed: 'East tomatoes',
    note: 'First fruit split after the rain.',
  }),
  entry('2026-10-25', 'Tomato', 'harvest', 'done', { weightGrams: 650 }),
  entry('2026-10-30', 'Tomato', 'pest', 'planned', {
    bed: 'East tomatoes',
    note: 'Spray if the aphids are still there',
  }),
  entry('2026-11-02', 'Tomato', 'harvest', 'planned'),
];
