import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDays,
  careRecipesPayload,
  instantiateCareRecipes,
  offerableCareRecipes,
} from './careRecipe.js';

test('addDays stays on the calendar day', () => {
  assert.equal(addDays('2026-11-21', 14), '2026-12-05');
  assert.equal(addDays('2026-11-21', 0), '2026-11-21');
});

test('offerable recipes drop inactive rows and keep sort order', () => {
  const rows = offerableCareRecipes({
    careRecipes: [
      { id: 2, sort: 2, action: 'weeding', active: true },
      { id: 1, sort: 1, action: 'thinning', active: false },
      { id: 3, sort: 0, action: 'mulching', active: true },
    ],
  });
  assert.deepEqual(
    rows.map((row) => row.id),
    [3, 2],
  );
});

test('once recipes become one-day daily care rules', () => {
  const bodies = instantiateCareRecipes(
    [
      {
        id: 9,
        label: 'Thin seedlings',
        action: 'thinning',
        note: 'One per hole',
        freq: 'once',
        offsetDays: 14,
        active: true,
      },
    ],
    { plantDate: '2026-11-21', bedId: 49, cropId: 58, selectedIds: [9] },
  );
  assert.equal(bodies.length, 1);
  assert.deepEqual(bodies[0], {
    bedId: 49,
    cropId: 58,
    action: 'thinning',
    product: '',
    amount: null,
    unit: '',
    note: 'Thin seedlings. One per hole',
    freq: 'daily',
    interval: 1,
    weekdays: [],
    anchorDate: '2026-12-05',
    endsOn: '2026-12-05',
    active: true,
  });
});

test('weekly recipes keep weekdays and end offset', () => {
  const [body] = instantiateCareRecipes(
    [
      {
        id: 1,
        action: 'weeding',
        freq: 'weekly',
        interval: 1,
        weekdays: [6],
        offsetDays: 7,
        endsOffsetDays: 55,
        active: true,
      },
    ],
    { plantDate: '2026-11-21', bedId: 49, cropId: 58 },
  );
  assert.equal(body.freq, 'weekly');
  assert.deepEqual(body.weekdays, [6]);
  assert.equal(body.anchorDate, '2026-11-28');
  assert.equal(body.endsOn, '2027-01-15');
});

test('careRecipesPayload strips client keys', () => {
  const rows = careRecipesPayload([
    {
      id: 3,
      localKey: 'id-3',
      label: ' Compost ',
      action: 'fertilising',
      product: 'Compost',
      note: '500 g per sq ft',
      freq: 'once',
      interval: 1,
      weekdays: [],
      offsetDays: 21,
      endsOffsetDays: null,
      active: true,
    },
  ]);
  assert.deepEqual(rows, [
    {
      sort: 0,
      label: 'Compost',
      action: 'fertilising',
      product: 'Compost',
      amount: null,
      unit: '',
      note: '500 g per sq ft',
      freq: 'once',
      interval: 1,
      weekdays: [],
      offsetDays: 21,
      endsOffsetDays: null,
      active: true,
    },
  ]);
});
