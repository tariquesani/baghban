import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCropConflicts,
  estimatedPlantCount,
  plantDetailRows,
  plantingAlerts,
  plantSpan,
} from './planting.js';

const catalog = [
  {
    name: '🍅 Tomatoes',
    sqft: 2,
    spacing: 18,
    depthIn: 12,
    sun: 'Full sun',
    water: 'Regular',
    trellis: true,
    notes: 'Stake early.',
    companions: ['🌿 Basil'],
    avoid: ['🌽 Corn'],
  },
  {
    name: '🌿 Basil',
    sqft: 0.5,
    spacing: 8,
    depthIn: 6,
    sun: 'Full sun',
    water: 'Regular',
    trellis: false,
    notes: '',
    companions: ['🍅 Tomatoes'],
    avoid: [],
  },
  {
    name: '🌽 Corn',
    sqft: 1,
    spacing: 12,
    depthIn: 8,
    sun: 'Full sun',
    water: 'Regular',
    trellis: false,
    notes: '',
    companions: [],
    avoid: ['🍅 Tomatoes'],
  },
];

test('plant span needs a 1 ft square for dense crops', () => {
  assert.deepEqual(plantSpan(0.25), { rowSpan: 1, colSpan: 1, perSqft: 4 });
  assert.deepEqual(plantSpan(1), { rowSpan: 1, colSpan: 1, perSqft: 1 });
  assert.deepEqual(plantSpan(4), { rowSpan: 2, colSpan: 2, perSqft: 1 });
});

test('estimated plant count uses area and footprint', () => {
  assert.equal(estimatedPlantCount(10, 2).label, '~5 plants');
  assert.equal(estimatedPlantCount(10, 0.5).label, '~20 plants (2/sq ft)');
  assert.equal(estimatedPlantCount(0, 2).label, '');
});

test('planting alerts report companions and conflicts once', () => {
  const alerts = plantingAlerts(['🍅 Tomatoes', '🌿 Basil', '🌽 Corn'], catalog);
  assert.deepEqual(alerts.companions, ['Tomatoes + Basil']);
  assert.deepEqual(alerts.conflicts, ['Tomatoes conflicts with Corn']);
});

test('add crop conflicts check both avoid lists', () => {
  const crops = [
    { id: 1, name: 'Tomatoes', avoid: [3] },
    { id: 2, name: 'Basil', avoid: [] },
    { id: 3, name: 'Corn', avoid: [1] },
  ];
  assert.deepEqual(
    addCropConflicts({ id: 3, name: 'Corn', avoid: [1] }, ['🍅 Tomatoes', '🌿 Basil'], crops),
    ['Tomatoes'],
  );
  assert.deepEqual(
    addCropConflicts({ id: 2, name: 'Basil', avoid: [] }, ['🍅 Tomatoes'], crops),
    [],
  );
});

test('plant detail rows carry meta and counts', () => {
  const rows = plantDetailRows(['🍅 Tomatoes', '🌿 Basil'], catalog, 8, {
    showSoilDepth: true,
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, 'Tomatoes');
  assert.ok(rows[0].pills.includes('2 sq ft/plant'));
  assert.ok(rows[0].pills.includes('Trellis needed'));
  assert.equal(rows[0].countLabel, '~4 plants');
  assert.deepEqual(rows[0].companions, ['Basil']);
  assert.equal(rows[1].countLabel, '~16 plants (2/sq ft)');
});
