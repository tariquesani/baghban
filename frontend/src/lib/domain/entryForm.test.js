import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarRecord,
  actionLabel,
  entryDetail,
  entryDraft,
  entryRequest,
  formFields,
} from './entryForm.js';
import { sowingCropChoices } from './sowing.js';

const crops = sowingCropChoices([
  { id: 1, name: 'Basil', emoji: '🌿', archived: false },
  { id: 2, name: 'Tomatoes', emoji: '🍅', archived: false },
]);

const shared = {
  crop: 'Basil',
  date: '2026-11-02',
  status: 'planned',
  bedId: 'none',
  note: ' After rain ',
};

test('a diary note is done, and a future care stays planned', () => {
  const diary = entryDraft('diary', {
    date: '2026-11-02',
    crop: 'basil',
    today: '2026-10-30',
    crops,
  });
  assert.equal(diary.status, 'done');
  assert.equal(diary.crop, 'Basil');
  const care = entryDraft('care', {
    date: '2026-11-02',
    crop: '',
    today: '2026-10-30',
    crops,
  });
  assert.equal(care.status, 'planned');
  assert.equal(care.action, '');
});

test('care needs an action, and blank measures stay empty', () => {
  assert.equal(entryRequest('care', { ...shared, action: '' }).ok, false);
  assert.deepEqual(entryRequest('care', { ...shared, action: 'watering', amount: '10', unit: 'L' }), {
    ok: true,
    body: {
      kind: 'care',
      date: '2026-11-02',
      bedId: null,
      crop: 'Basil',
      status: 'planned',
      note: 'After rain',
      photoUrl: '',
      action: 'watering',
      product: '',
      amount: 10,
      unit: 'L',
    },
  });
  assert.equal(
    entryRequest('care', { ...shared, action: 'fertilising', amount: 'lots' }).field,
    'amount',
  );
  assert.equal(entryRequest('care', { ...shared, action: 'spraying' }).field, 'action');
  const retired = calendarRecord(
    {
      id: 9,
      kind: 'care',
      date: '2026-10-23',
      crop: 'Tomatoes',
      status: 'done',
      note: '',
      action: 'rest',
    },
    '',
  );
  assert.equal(retired.action, 'rest');
  assert.equal(actionLabel('rest'), 'rest');
  assert.equal(actionLabel('pruning'), 'Pruning');
  const pruned = entryRequest('care', { ...shared, action: 'pruning' });
  assert.equal(pruned.ok, true);
  if (pruned.ok) {
    assert.equal(pruned.body.action, 'pruning');
    assert.equal(pruned.body.amount, null);
  }
});

test('pest and harvest measures are optional', () => {
  const pest = entryRequest('pest', { ...shared, problem: ' Whitefly ', product: 'Neem oil' });
  assert.equal(pest.ok, true);
  if (pest.ok) {
    assert.equal(pest.body.problem, 'Whitefly');
    assert.equal(pest.body.amount, null);
  }
  assert.equal(entryRequest('harvest', { ...shared, weightGrams: '840.5' }).field, 'weight');
  const picked = entryRequest('harvest', {
    ...shared,
    status: 'done',
    quantity: '12',
    unit: 'fruit',
    weightGrams: '840',
  });
  assert.equal(picked.ok, true);
  if (picked.ok) {
    assert.equal(picked.body.quantity, 12);
    assert.equal(picked.body.weightGrams, 840);
  }
});

test('a diary request stays done even when the draft says planned', () => {
  const noted = entryRequest('diary', { ...shared, status: 'planned' });
  assert.equal(noted.ok, true);
  if (noted.ok) assert.equal(noted.body.status, 'done');
  assert.equal(noted.ok && noted.body.kind, 'diary');
});

test('a saved care row keeps its measure for the day panel and the form', () => {
  const record = calendarRecord(
    {
      id: 4,
      kind: 'care',
      date: '2026-10-23',
      crop: 'Tomatoes',
      status: 'done',
      note: '',
      photoUrl: '',
      bedId: 2,
      action: 'watering',
      product: '',
      amount: 10,
      unit: 'L',
    },
    'East',
  );
  assert.equal(record.bed, 'East');
  assert.equal(entryDetail(record), '10 L');
  assert.deepEqual(formFields(record), {
    action: 'watering',
    problem: '',
    product: '',
    amount: '10',
    unit: 'L',
    quantity: '',
    weightGrams: '',
  });
  assert.equal(
    entryDetail({ kind: 'harvest', quantity: 12, unit: 'fruit', weightGrams: 840 }),
    '12 fruit · 840 g',
  );
});
