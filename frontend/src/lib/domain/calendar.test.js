import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarRows,
  dayEntries,
  dayMarks,
  dayReading,
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
  const marks = dayMarks(day, '');
  assert.deepEqual(marks.map((mark) => mark.kind), ['harvest', 'diary']);
  assert.equal(marks[0].intensity, 1);
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
  assert.equal(marks[0].intensity, null);
});

test('a planned sowing stays hollow', () => {
  const day = dayEntries(SAMPLE_ENTRIES, '2026-10-26', 'Coriander', '');
  const marks = dayMarks(day, '');
  assert.equal(marks[0].kind, 'sowing');
  assert.equal(marks[0].status, 'planned');
  assert.equal(marks[0].intensity, null);
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
