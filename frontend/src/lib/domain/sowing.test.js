import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarSowing,
  formatSowingDate,
  localDate,
  matchingCropName,
  photoProblem,
  bedsHoldingCrop,
  bedsWithCrops,
  bedCropNames,
  cropsForNames,
  cropsNotInBed,
  plantCropName,
  sowingBedChoices,
  sowingCropChoices,
  sowingDraft,
  sowingRequest,
  statusForSowingDate,
} from './sowing.js';

const crops = [
  { id: 2, name: 'Tomatoes', emoji: '🍅', archived: false },
  { id: 1, name: 'Basil', emoji: '🌿', archived: false },
  { id: 3, name: 'Mint', emoji: '', archived: true },
];

test('a sowing date reads day/month/year', () => {
  assert.equal(formatSowingDate('2026-10-23'), '23/10/2026');
  assert.equal(formatSowingDate('2026-01-05'), '05/01/2026');
  assert.equal(formatSowingDate(''), '');
});

test('a future sowing starts planned, and today starts done', () => {
  assert.equal(localDate(new Date(2026, 9, 30)), '2026-10-30');
  assert.equal(statusForSowingDate('2026-11-02', '2026-10-30'), 'planned');
  assert.equal(statusForSowingDate('2026-10-30', '2026-10-30'), 'done');
  assert.equal(statusForSowingDate('2026-10-23', '2026-10-30'), 'done');
});

test('the draft uses the selected day and a catalogue crop', () => {
  const draft = sowingDraft({
    date: '2026-10-23',
    crop: 'tomatoes',
    today: '2026-10-30',
    crops: sowingCropChoices(crops),
  });
  assert.deepEqual(draft, {
    date: '2026-10-23',
    crop: 'Tomatoes',
    status: 'done',
    bedId: 'none',
    note: '',
  });
  assert.equal(matchingCropName(sowingCropChoices(crops), 'Tomato'), '');
  assert.deepEqual(
    sowingCropChoices(crops).map((crop) => crop.name),
    ['Basil', 'Tomatoes'],
  );
});

test('an empty selection starts on today with no crop', () => {
  const draft = sowingDraft({
    date: '',
    crop: '',
    today: '2026-10-30',
    crops: [],
  });
  assert.equal(draft.date, '2026-10-30');
  assert.equal(draft.crop, '');
  assert.equal(draft.status, 'done');
});

test('a sowing request needs a crop and a date', () => {
  assert.deepEqual(
    sowingRequest({ crop: ' ', date: '2026-10-23', status: 'done', bedId: 'none', note: '  ' }),
    { ok: false, field: 'crop', message: 'Choose a crop.' },
  );
  assert.equal(
    sowingRequest({ crop: 'Basil', date: '', status: 'done', bedId: 'none', note: '' }).ok,
    false,
  );
  assert.deepEqual(
    sowingRequest({ crop: 'Basil', date: '2026-11-02', status: 'planned', bedId: '4', note: ' Tray ' }),
    {
      ok: true,
      body: {
        kind: 'sowing',
        date: '2026-11-02',
        bedId: 4,
        crop: 'Basil',
        status: 'planned',
        note: 'Tray',
        photoUrl: '',
      },
    },
  );
});

test('care beds are the ones growing that crop', () => {
  assert.equal(plantCropName('🍅 Tomatoes'), 'Tomatoes');
  assert.equal(plantCropName('Cherry Tomatoes'), 'Cherry Tomatoes');
  const beds = bedsWithCrops(
    [
      { id: 2, name: 'East', removed: false },
      { id: 1, name: 'Gone', removed: true },
      { id: 3, name: 'Herbs', removed: false },
      { id: 4, name: 'North', removed: false },
    ],
    [
      { id: 2, plants: ['🍅 Tomatoes', '🌿 Basil'] },
      { id: 3, plants: ['Basil'] },
      { id: 4, plants: [] },
      { id: 1, plants: ['Tomatoes'] },
    ],
  );
  assert.deepEqual(bedsHoldingCrop(beds, 'Tomatoes'), [{ id: 2, name: 'East' }]);
  assert.deepEqual(
    bedsHoldingCrop(beds, 'basil').map((bed) => bed.name),
    ['East', 'Herbs'],
  );
  assert.deepEqual(bedsHoldingCrop(beds, ''), []);
});

test('removed beds stay out of the list, and a photo must be a small image', () => {
  assert.deepEqual(
    sowingBedChoices([
      { id: 2, name: 'East', removed: false },
      { id: 1, name: 'Gone', removed: true },
      { id: 3, name: 'Herbs', removed: false },
    ]),
    [
      { id: 2, name: 'East' },
      { id: 3, name: 'Herbs' },
    ],
  );
  assert.equal(photoProblem(null), '');
  assert.equal(photoProblem({ type: 'image/gif', size: 10 }), 'Use a JPEG, PNG, or WebP.');
  assert.equal(photoProblem({ type: 'image/jpeg', size: 16 * 1024 * 1024 }), 'Photo is larger than 15 MB.');
  assert.equal(photoProblem({ type: 'image/png', size: 100 }), '');
});

test('a bed lists each crop once, and the catalogue hides crops already there', () => {
  assert.deepEqual(bedCropNames(['🍅 Tomatoes', 'Tomatoes', 'Basil']), ['Tomatoes', 'Basil']);
  assert.deepEqual(
    cropsNotInBed(
      [
        { id: 2, name: 'Tomatoes', emoji: '🍅', aliases: ['tomato'] },
        { id: 1, name: 'Basil', emoji: '🌿', aliases: [] },
        { id: 4, name: 'Lettuce', emoji: '🥬', aliases: ['salad'] },
      ],
      ['🍅 Tomatoes'],
    ).map((crop) => crop.name),
    ['Basil', 'Lettuce'],
  );
});

test('a bed entry offers only the crops in that bed', () => {
  const catalogue = sowingCropChoices(crops);
  assert.equal(cropsForNames(catalogue, null), catalogue);
  assert.deepEqual(
    cropsForNames(catalogue, ['basil', 'Fenugreek']).map((crop) => crop.name),
    ['Basil', 'Fenugreek'],
  );
});

test('a saved sowing becomes a calendar row', () => {
  assert.deepEqual(
    calendarSowing(
      {
        id: 12,
        date: '2026-10-23',
        crop: 'Tomatoes',
        status: 'done',
        note: 'Tray',
        photoUrl: '/api/photos/sowing-1',
        bedId: 4,
      },
      'East',
    ),
    {
      id: '12',
      date: '2026-10-23',
      crop: 'Tomatoes',
      kind: 'sowing',
      status: 'done',
      note: 'Tray',
      bed: 'East',
      bedId: 4,
      photoUrl: '/api/photos/sowing-1',
    },
  );
});
