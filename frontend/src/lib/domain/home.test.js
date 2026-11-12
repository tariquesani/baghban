import assert from 'node:assert/strict';
import test from 'node:test';
import {
  civilDate,
  comingEntries,
  cropCount,
  formatWeight,
  growingCards,
  growingFootNote,
  galleryPhotos,
  plantingAreas,
  uniqueCrops,
  harvestByCrop,
  latelyNote,
  monthWindow,
  overdueEntries,
  planAreas,
  recentEntries,
  seasonWeight,
  shiftDate,
  todayEntries,
} from './home.js';

const tomato = {
  id: 1,
  bedId: 4,
  bedName: 'East bed',
  name: 'Tomato',
  emoji: '🍅',
  createdOn: '2026-06-08',
  daysToMaturity: 75,
};

/** @param {Partial<import('./home.js').HomeEntry>} extra */
function entry(extra) {
  return {
    id: '1',
    date: '2026-11-01',
    crop: 'Tomato',
    kind: 'sowing',
    status: 'done',
    bedId: 4,
    bed: 'East bed',
    weightGrams: null,
    quantity: null,
    unit: '',
    action: '',
    ...extra,
  };
}

test('a civil date follows the garden timezone', () => {
  const instant = new Date('2026-10-31T20:30:00Z');
  assert.equal(civilDate(instant, 'Asia/Kolkata'), '2026-11-01');
  assert.equal(civilDate(instant, 'UTC'), '2026-10-31');
});

test('the month window keeps the previous month, this month, and the next', () => {
  assert.deepEqual(monthWindow('2026-11-01'), { start: '2026-10-01', end: '2026-12-31' });
  assert.deepEqual(monthWindow('2026-01-15'), { start: '2025-12-01', end: '2026-02-28' });
  assert.deepEqual(monthWindow('2026-12-02'), { start: '2026-11-01', end: '2027-01-31' });
  assert.equal(shiftDate('2026-11-01', 14), '2026-11-15');
});

test('weight uses grams under a kilogram and one decimal above', () => {
  assert.equal(formatWeight(840), '840 g');
  assert.equal(formatWeight(1000), '1.0 kg');
  assert.equal(formatWeight(11400), '11.4 kg');
  assert.equal(cropCount(1), '1 crop');
  assert.equal(cropCount(5), '5 crops');
  assert.equal(plantingAreas(1), '1 planting area');
  assert.equal(plantingAreas(3), '3 planting areas');
});

test('growing footer counts unique crops and planting areas', () => {
  const westTomato = { ...tomato, id: 2, bedId: 5, bedName: 'West bed', cropId: 9 };
  const eastTomato = { ...tomato, cropId: 9 };
  const lettuce = {
    id: 3,
    bedId: 6,
    bedName: 'North bed',
    cropId: 12,
    name: 'Lettuce',
    emoji: '🥬',
    createdOn: '2026-07-01',
    daysToMaturity: 45,
  };
  const cards = growingCards([eastTomato, westTomato, lettuce], [], '2026-11-01');
  assert.equal(uniqueCrops(cards), 2);
  assert.equal(cards.length, 3);
  assert.equal(growingFootNote(cards, '1.4 kg'), '2 crops in 3 planting areas, total harvest 1.4 kg');
  assert.equal(growingFootNote([cards[0]], '840 g'), '1 crop in 1 planting area, total harvest 840 g');
});

test('a growing card uses the latest done sowing and this year of harvests', () => {
  const cards = growingCards(
    [tomato],
    [
      entry({ id: 's1', date: '2026-06-01', kind: 'sowing' }),
      entry({ id: 's2', date: '2026-06-08', kind: 'sowing' }),
      entry({ id: 'early', date: '2026-01-15', kind: 'harvest', weightGrams: 600 }),
      entry({ id: 'lastYear', date: '2025-12-20', kind: 'harvest', weightGrams: 5000 }),
      entry({ id: 'h1', date: '2026-10-12', kind: 'harvest', weightGrams: 10200 }),
      entry({ id: 'h2', date: '2026-10-31', kind: 'harvest', weightGrams: 1200 }),
      entry({ id: 'p', date: '2026-11-12', kind: 'harvest', status: 'planned', weightGrams: 500 }),
    ],
    '2026-11-01',
  );
  assert.equal(cards[0].days, '146 days');
  assert.equal(cards[0].harvest, '12.0 kg harvested');
  assert.equal(cards[0].maturity, 'Day 146 of 75');
});

test('without a done sowing the card skips days and still counts this year', () => {
  const cards = growingCards(
    [tomato],
    [
      entry({ id: 'plan', date: '2026-06-01', kind: 'sowing', status: 'planned' }),
      entry({ id: 'h', date: '2026-03-01', kind: 'harvest', quantity: 4, unit: 'bunches' }),
    ],
    '2026-11-01',
  );
  assert.equal(cards[0].days, '');
  assert.equal(cards[0].harvest, '4 bunches harvested');
  assert.equal(cards[0].maturity, '');
});

test('a sowing today keeps its own words', () => {
  const cards = growingCards(
    [{ ...tomato, createdOn: '2026-11-01', daysToMaturity: null }],
    [entry({ id: 's', date: '2026-11-01', kind: 'sowing' })],
    '2026-11-01',
  );
  assert.equal(cards[0].days, 'Sown today');
  assert.equal(cards[0].harvest, 'Nothing harvested yet');
  assert.equal(cards[0].maturity, '');
});

test('overdue, today, and the next fortnight split planned entries', () => {
  const entries = [
    entry({ id: 'a', date: '2026-10-30', status: 'planned', kind: 'pest' }),
    entry({ id: 'b', date: '2026-11-01', status: 'planned', kind: 'care' }),
    entry({ id: 'c', date: '2026-11-02', status: 'planned', kind: 'sowing', crop: 'Radish' }),
    entry({ id: 'd', date: '2026-11-16', status: 'planned', kind: 'harvest' }),
    entry({ id: 'e', date: '2026-11-02', status: 'done', kind: 'diary' }),
  ];
  assert.deepEqual(overdueEntries(entries, '2026-11-01').map((item) => item.id), ['a']);
  assert.deepEqual(todayEntries(entries, '2026-11-01').map((item) => item.id), ['b']);
  assert.deepEqual(comingEntries(entries, '2026-11-01').map((item) => item.id), ['c']);
});

test('the plan line sums planted and empty bed area', () => {
  assert.deepEqual(
    planAreas([
      { areaSqFt: 32, plants: ['🍅 Tomato'] },
      { areaSqFt: 8.25, plants: [] },
      { w: 2, h: 3, plants: [' '] },
      { areaSqFt: 100, plants: ['Basil'], removed: true },
    ]),
    { planted: '32.0', empty: '14.3', total: '46.3' },
  );
});

test('lately keeps the four newest done entries and the season sums weighed harvests', () => {
  const entries = [
    entry({
      id: '1',
      date: '2026-10-26',
      kind: 'care',
      action: 'fertilising',
      crop: '',
      product: 'vermicompost',
    }),
    entry({
      id: '2',
      date: '2026-10-28',
      kind: 'care',
      action: 'watering',
      crop: '',
      bedId: null,
      bed: '',
      amount: 40,
      unit: 'L',
    }),
    entry({
      id: '3',
      date: '2026-10-30',
      kind: 'diary',
      crop: 'Coriander',
      bed: '',
      note: 'Thinned the coriander',
    }),
    entry({ id: '4', date: '2026-10-31', kind: 'harvest', weightGrams: 1200 }),
    entry({ id: '5', date: '2026-01-02', kind: 'harvest', weightGrams: 200, crop: 'Methi' }),
    entry({ id: '6', date: '2025-12-31', kind: 'harvest', weightGrams: 9000 }),
  ];
  assert.deepEqual(recentEntries(entries).map((item) => item.id), ['4', '3', '2', '1']);
  assert.deepEqual(latelyNote(entries[3]), {
    date: '31 Oct',
    text: 'Harvest · Tomato · 1.2 kg',
    bed: 'East bed',
  });
  assert.deepEqual(latelyNote(entries[2]), {
    date: '30 Oct',
    text: 'Diary · Thinned the coriander',
    bed: '',
  });
  assert.deepEqual(latelyNote(entries[1]), {
    date: '28 Oct',
    text: 'Watering · 40 L',
    bed: '',
  });
  assert.deepEqual(latelyNote(entries[0]), {
    date: '26 Oct',
    text: 'Fertilising · vermicompost',
    bed: 'East bed',
  });
  assert.equal(
    latelyNote(entry({ id: '7', date: '2026-10-20', kind: 'care', action: 'pruning', product: '' })).text,
    'Pruning',
  );
  assert.equal(
    latelyNote(
      entry({ id: '8', date: '2026-10-20', kind: 'care', action: 'mulching', product: 'straw', amount: 2, unit: 'bags' }),
    ).text,
    'Mulching · straw',
  );
  assert.equal(seasonWeight(entries, '2026-11-01'), '1.4 kg');
  assert.deepEqual(
    harvestByCrop(entries, '2026-11-01').map((row) => row.crop),
    ['Tomato', 'Methi'],
  );
});

test('gallery lists every photo newest first', () => {
  const photos = Array.from({ length: 10 }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return entry({
      id: String(index + 1),
      date: `2026-10-${day}`,
      photoUrl: `/api/photos/shot-${index + 1}`,
    });
  });
  const entries = [
    ...photos,
    entry({ id: 'blank', date: '2026-11-03', photoUrl: '  ' }),
    entry({ id: 'none', date: '2026-11-03' }),
    entry({
      id: '12',
      date: '2026-10-10',
      status: 'planned',
      crop: '',
      photoUrl: '/api/photos/later',
    }),
    entry({
      id: '11',
      date: '2026-10-10',
      kind: 'harvest',
      crop: 'Methi',
      quantity: 4,
      unit: 'bunches',
      weightGrams: 1200,
      note: 'First cut',
      photoUrl: '/api/photos/earlier',
    }),
  ];
  const gallery = galleryPhotos(entries);
  assert.equal(gallery.length, 12);
  assert.deepEqual(
    gallery.map((photo) => photo.id),
    ['12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
  );
  assert.equal(gallery[0].photoUrl, '/api/photos/later');
  assert.equal(gallery[0].date, '10 Oct');
  assert.equal(gallery[0].crop, 'Garden');
  assert.equal(gallery[0].kind, 'Sowing');
  assert.equal(gallery[0].status, 'Planned');
  assert.equal(gallery[0].detail, '');
  assert.equal(gallery[0].alt, '10 Oct');
  assert.equal(gallery[1].alt, '10 Oct, Methi');
  assert.equal(gallery[1].kind, 'Harvest');
  assert.equal(gallery[1].status, 'Done');
  assert.equal(gallery[1].bed, 'East bed');
  assert.equal(gallery[1].detail, '4 bunches · 1200 g');
  assert.equal(gallery[1].note, 'First cut');
  assert.equal(galleryPhotos([]).length, 0);
});
