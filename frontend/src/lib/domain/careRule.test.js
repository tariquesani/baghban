import assert from 'node:assert/strict';
import test from 'node:test';
import { careRuleRequest } from './careRule.js';
import { entryRequest } from './entryForm.js';

const crops = [{ id: 7, name: 'Tomatoes' }];

test('a daily care rule keeps the care fields and interval', () => {
  const request = careRuleRequest(
    {
      repeat: 'daily',
      interval: '3',
      weekdays: [],
      endsOn: '',
      crop: 'Tomatoes',
      date: '2026-11-06',
      bedId: '4',
      note: '',
      action: 'watering',
      product: '',
      amount: '10',
      unit: 'L',
    },
    crops,
    entryRequest,
  );
  assert.equal(request.ok, true);
  if (!request.ok) return;
  assert.deepEqual(request.body, {
    bedId: 4,
    cropId: 7,
    action: 'watering',
    product: '',
    amount: 10,
    unit: 'L',
    note: '',
    freq: 'daily',
    interval: 3,
    weekdays: [],
    anchorDate: '2026-11-06',
    endsOn: null,
    active: true,
  });
});

test('a convert request can name the one-off entry', () => {
  const request = careRuleRequest(
    {
      repeat: 'yearly',
      interval: '1',
      weekdays: [],
      endsOn: '',
      crop: 'Tomatoes',
      date: '2026-03-01',
      bedId: '4',
      note: '',
      action: 'pruning',
      product: '',
      amount: '',
      unit: '',
      entryId: 42,
    },
    crops,
    entryRequest,
  );
  assert.equal(request.ok, true);
  if (!request.ok) return;
  assert.equal(request.body.entryId, 42);
  assert.equal(request.body.freq, 'yearly');
});

test('a weekly rule needs weekdays', () => {
  const request = careRuleRequest(
    {
      repeat: 'weekly',
      interval: '2',
      weekdays: [],
      endsOn: '',
      crop: 'Tomatoes',
      date: '2026-11-06',
      bedId: '4',
      note: '',
      action: 'watering',
      product: '',
      amount: '',
      unit: '',
    },
    crops,
    entryRequest,
  );
  assert.equal(request.ok, false);
  if (request.ok) return;
  assert.equal(request.field, 'weekdays');
});
