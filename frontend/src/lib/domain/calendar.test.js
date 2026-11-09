import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aroundMonth,
  calendarRows,
  calendarSpanRows,
  cropMarks,
  cropYearEntries,
  dateEntries,
  dayEntries,
  entryWhere,
  selectionEntries,
  dayMarks,
  dayReading,
  harvestPeaks,
  harvestShade,
  dayWedges,
  monthName,
  storedEntryId,
  spanDays,
  spanMonths,
  yearDayCount,
  yearDays,
  yearMonths,
} from './calendar.js';
import { SAMPLE_ENTRIES } from './calendar-sample.js';

test('a catalogue crop keeps its icon and emoji for the calendar row', () => {
  assert.deepEqual(
    cropMarks([
      { id: 41, name: 'Spinach', emoji: '🥬', icon: '41.png' },
      { id: 9, name: '  Mint', emoji: '🌿', icon: '' },
      { name: 'Basil', emoji: '🌿', icon: '' },
      null,
    ]),
    {
      Spinach: { id: 41, icon: '41.png', emoji: '🥬' },
      Mint: { id: 9, icon: '', emoji: '🌿' },
    },
  );
  assert.deepEqual(cropMarks(null), {});
});

test('a saved entry is addressed by its number', () => {
  assert.equal(storedEntryId('12'), 12);
  assert.equal(storedEntryId('Tomato-2026-10-23-harvest'), null);
  assert.equal(storedEntryId(''), null);
});

test('the year grid uses the short name of the current month', () => {
  assert.equal(monthName(new Date(2026, 10, 2)), 'Nov');
  assert.equal(monthName(new Date(2026, 0, 1)), 'Jan');
  assert.equal(yearMonths(2026).some((month) => month.name === monthName(new Date(2026, 10, 2))), true);
});

test('a leap year shifts March past 29 February', () => {
  assert.equal(yearDayCount(2026), 365);
  assert.equal(yearDayCount(2028), 366);
  assert.equal(yearMonths(2026)[2].column, 60);
  assert.equal(yearMonths(2028)[2].column, 61);
  assert.equal(yearDays(2026).find((day) => day.date === '2026-10-23')?.column, 296);
});

test('four kinds meet in the middle, and fewer kinds keep that order', () => {
  assert.deepEqual(
    dayWedges(['diary', 'sowing', 'harvest', 'care']).map((wedge) => wedge.kind),
    ['sowing', 'care', 'harvest', 'diary'],
  );
  assert.equal(dayWedges(['harvest', 'diary'])[0].points, '0,0 100,0 100,100');
  assert.equal(dayWedges(['harvest', 'diary'])[1].points, '0,0 0,100 100,100');
  assert.equal(dayWedges(['sowing']).length, 1);
  assert.equal(dayWedges(['sowing'])[0].points, '0,0 100,0 100,100 0,100');
});

test('23 October tomato is harvest and diary, and a harvest filter fills the square', () => {
  const day = dayEntries(SAMPLE_ENTRIES, '2026-10-23', 'Tomato', '');
  const peak = harvestPeaks(SAMPLE_ENTRIES).get('Tomato') ?? 0;
  const marks = dayMarks(day, '', peak);
  assert.deepEqual(marks.map((mark) => mark.kind), ['harvest', 'diary']);
  assert.equal(marks[0].shade, 8);
  assert.equal(dayReading('2026-10-23', 'Tomato', marks), '23 Oct · Tomato · Harvest, Diary');

  const harvest = dayMarks(day, 'harvest');
  assert.equal(harvest.length, 1);
  assert.equal(harvest[0].points, '0,0 100,0 100,100 0,100');
  assert.equal(harvest[0].status, 'done');
});

test('five marks split the left side, care above pest', () => {
  const wedges = dayWedges(['diary', 'pest', 'sowing', 'harvest', 'care']);
  assert.deepEqual(
    wedges.map((wedge) => wedge.kind),
    ['sowing', 'care', 'pest', 'harvest', 'diary'],
  );
  assert.equal(wedges[1].points, '0,0 0,50 50,50');
  assert.equal(wedges[2].points, '0,50 0,100 50,50');
});

test('six marks also split the right side', () => {
  const wedges = dayWedges(['uproot', 'diary', 'pest', 'sowing', 'harvest', 'care']);
  assert.deepEqual(
    wedges.map((wedge) => wedge.kind),
    ['sowing', 'care', 'pest', 'harvest', 'uproot', 'diary'],
  );
  assert.equal(wedges[4].points, '100,50 100,100 50,50');
  assert.equal(wedges[5].points, '100,0 100,50 50,50');
});

test('a pest treatment is its own kind', () => {
  const day = dayEntries(SAMPLE_ENTRIES, '2026-10-19', 'Tomato', '');
  assert.equal(day[0].kind, 'pest');
  assert.equal(day[0].problem, 'Aphids on the new growth');
  const marks = dayMarks(day, '');
  assert.equal(marks.length, 1);
  assert.equal(marks[0].kind, 'pest');
  assert.equal(marks[0].status, 'done');
  assert.equal(marks[0].points, '0,0 100,0 100,100 0,100');
  assert.equal(dayMarks(day, 'care').length, 0);
  assert.equal(dayMarks(day, 'pest')[0].kind, 'pest');
});

test('10 October coriander splits care and pest on the left', () => {
  const day = dayEntries(SAMPLE_ENTRIES, '2026-10-10', 'Coriander', '');
  const marks = dayMarks(day, '');
  assert.deepEqual(
    marks.map((mark) => mark.kind),
    ['sowing', 'care', 'pest', 'harvest', 'diary'],
  );
  assert.equal(marks[1].points, '0,0 0,50 50,50');
  assert.equal(marks[2].points, '0,50 0,100 50,50');
  assert.deepEqual(dayMarks(day, 'care').map((mark) => mark.kind), ['care']);
  assert.deepEqual(dayMarks(day, 'pest').map((mark) => mark.kind), ['pest']);
});

test('a planned pest treatment stays hollow', () => {
  const marks = dayMarks(dayEntries(SAMPLE_ENTRIES, '2026-10-30', 'Tomato', 'pest'), '');
  assert.equal(marks[0].kind, 'pest');
  assert.equal(marks[0].status, 'planned');
  assert.equal(marks[0].shade, null);
});

test('a planned sowing stays hollow', () => {
  const day = dayEntries(SAMPLE_ENTRIES, '2026-10-26', 'Coriander', '');
  const marks = dayMarks(day, '');
  assert.equal(marks[0].kind, 'sowing');
  assert.equal(marks[0].status, 'planned');
  assert.equal(marks[0].shade, null);
});

test('harvest shade is an eighth of the heaviest day', () => {
  assert.equal(harvestShade(1010, 1010), 8);
  assert.equal(harvestShade(1000, 1010), 8);
  assert.equal(harvestShade(10, 10000), 1);
  assert.equal(harvestShade(1250, 10000), 2);
  assert.equal(harvestShade(1249, 10000), 1);

  const tomato = harvestPeaks(SAMPLE_ENTRIES).get('Tomato');
  assert.equal(tomato, 840);
  const light = dayMarks(dayEntries(SAMPLE_ENTRIES, '2026-02-08', 'Tomato', ''), '', tomato);
  assert.equal(light[0].shade, 3);

  const counted = dayMarks(
    [{ id: 'c', date: '2026-05-01', crop: 'Tomato', kind: 'harvest', status: 'done', weightGrams: null }],
    '',
    tomato,
  );
  assert.equal(counted[0].shade, 1);
  assert.equal(
    dayMarks(
      [{ id: 'c', date: '2026-05-01', crop: 'Tomato', kind: 'harvest', status: 'done', weightGrams: null }],
      '',
      0,
    )[0].shade,
    null,
  );

  const bhindi = [
    { id: 'a', date: '2026-08-01', crop: 'Bhindi', kind: 'harvest', status: 'done', weightGrams: 400 },
    { id: 'b', date: '2026-08-01', crop: 'Bhindi', kind: 'harvest', status: 'done', weightGrams: 500 },
    { id: 'c', date: '2026-08-20', crop: 'Bhindi', kind: 'harvest', status: 'done', weightGrams: 200 },
  ];
  assert.equal(harvestPeaks(bhindi).get('Bhindi'), 900);
  assert.equal(dayMarks(bhindi.filter((entry) => entry.date === '2026-08-01'), '', 900)[0].shade, 8);
  assert.equal(dayMarks(bhindi.filter((entry) => entry.date === '2026-08-20'), '', 900)[0].shade, 2);
});

test('the calendar keeps the previous month, this month, and the next', () => {
  assert.deepEqual(aroundMonth('2026-11-03'), {
    start: '2026-10-01',
    end: '2026-12-31',
    focus: '2026-11-01',
  });
  assert.deepEqual(aroundMonth('2026-01-15'), {
    start: '2025-12-01',
    end: '2026-02-28',
    focus: '2026-01-01',
  });
  assert.equal(aroundMonth('2028-01-02').end, '2028-02-29');
});

test('a span keeps crops recorded in it, and plantings that overlap it', () => {
  const beds = [
    { name: 'Radish', createdOn: '2026-11-01', archivedOn: null },
    { name: 'Basil', createdOn: '2026-08-01', archivedOn: '2026-09-01' },
    { name: 'Mint', createdOn: '2027-02-01', archivedOn: null },
  ];
  assert.deepEqual(calendarSpanRows(SAMPLE_ENTRIES, '2026-10-01', '2026-12-31', beds), [
    '',
    'Coriander',
    'Methi',
    'Radish',
    'Tomato',
  ]);
});

test('a three month span starts its columns at the first day', () => {
  const days = spanDays('2026-10-01', '2026-12-31');
  assert.equal(days.length, 92);
  assert.equal(days[0].date, '2026-10-01');
  assert.equal(days.find((day) => day.date === '2026-11-02')?.column, 33);
  assert.deepEqual(
    spanMonths('2026-10-01', '2026-12-31').map((month) => [month.name, month.days]),
    [
      ['Oct', 31],
      ['Nov', 30],
      ['Dec', 31],
    ],
  );
});

test('a date lists every crop, and the garden lane leads', () => {
  const entries = [
    { id: 'tomato', date: '2026-10-02', crop: 'Tomato', kind: 'harvest', status: 'done' },
    { id: 'garden', date: '2026-10-02', crop: '', kind: 'diary', status: 'done' },
    { id: 'bhindi', date: '2026-10-02', crop: 'Bhindi', kind: 'care', status: 'done' },
    { id: 'next', date: '2026-10-03', crop: 'Tomato', kind: 'care', status: 'done' },
  ];
  assert.deepEqual(dateEntries(entries, '2026-10-02', '').map((entry) => entry.id), ['garden', 'bhindi', 'tomato']);
  assert.deepEqual(dateEntries(entries, '2026-10-02', 'harvest').map((entry) => entry.id), ['tomato']);
  assert.equal(entryWhere(entries[1], 'day'), 'Garden');
  assert.equal(entryWhere({ ...entries[0], bed: 'Bed 1' }, 'day'), 'Tomato · Bed 1');
});

test('a crop lists the displayed year in date order', () => {
  const entries = [
    { id: 'late', date: '2026-10-23', crop: 'Tomato', kind: 'diary', status: 'done' },
    { id: 'early', date: '2026-02-08', crop: 'Tomato', kind: 'harvest', status: 'done' },
    { id: 'same', date: '2026-02-08', crop: 'Tomato', kind: 'care', status: 'done', bed: 'Bed 2' },
    { id: 'other-year', date: '2025-08-01', crop: 'Tomato', kind: 'care', status: 'done' },
    { id: 'other-crop', date: '2026-02-08', crop: 'Bhindi', kind: 'care', status: 'done' },
  ];
  assert.deepEqual(cropYearEntries(entries, 2026, 'Tomato', '').map((entry) => entry.id), ['same', 'early', 'late']);
  assert.deepEqual(cropYearEntries(entries, 2026, 'Tomato', 'diary').map((entry) => entry.id), ['late']);
  assert.deepEqual(
    selectionEntries(entries, { scope: 'crop', crop: 'Tomato' }, 2025, '').map((entry) => entry.id),
    ['other-year'],
  );
  assert.deepEqual(selectionEntries(entries, null, 2026, ''), []);
  assert.equal(entryWhere(entries[2], 'crop'), '8 Feb · Bed 2');
  assert.equal(entryWhere(entries[0], 'cell'), '');
});

test('rows put the garden first, then crops by name', () => {
  assert.deepEqual(calendarRows(SAMPLE_ENTRIES, 2026), ['', 'Bhindi', 'Coriander', 'Methi', 'Tomato']);
  assert.deepEqual(calendarRows(SAMPLE_ENTRIES, 2025), ['']);
});

test('a crop in a bed keeps a lane through the years it occupies', () => {
  const beds = [
    { name: 'Radish', createdOn: '2026-11-01', archivedOn: null },
    { name: 'Tomato', createdOn: '2024-03-01', archivedOn: null },
    { name: '  Fenugreek  ', createdOn: '2026-01-02', archivedOn: '2026-04-01' },
    { name: 'Basil', createdOn: '2025-05-01', archivedOn: '2025-09-01' },
    { name: 'Mint', createdOn: '2027-02-01', archivedOn: null },
  ];
  assert.deepEqual(calendarRows([], 2026, beds), ['Fenugreek', 'Radish', 'Tomato']);
  assert.deepEqual(calendarRows([], 2025, beds), ['Basil', 'Tomato']);
  assert.deepEqual(calendarRows([], 2024, beds), ['Tomato']);
  assert.deepEqual(calendarRows([], 2023, beds), ['']);
  assert.deepEqual(calendarRows(SAMPLE_ENTRIES, 2026, beds), [
    '',
    'Bhindi',
    'Coriander',
    'Fenugreek',
    'Methi',
    'Radish',
    'Tomato',
  ]);
});
