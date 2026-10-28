import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatEnteredSize,
  formatPlanSize,
  inferScale,
  itemsOutside,
  parseDimension,
} from './scale.js';

test('a blank garden has no scale', () => {
  const inferred = inferScale({ width: 20, height: 18 }, null, [], []);
  assert.equal(inferred.scale, null);
});

test('a calibration line confirms a plan scale', () => {
  const inferred = inferScale(
    { width: 82.46, height: 68.51 },
    { feetPerPixel: 0.2, calibration: { lengthFt: 10 } },
    [{ id: 'bed1' }],
    [],
  );
  assert.deepEqual(inferred, { scale: 'plan', widthText: '', heightText: '' });
});

test('beds without a calibration confirm dimensions', () => {
  const inferred = inferScale({ width: 20, height: 18.5 }, null, [{ id: 'bed1' }], []);
  assert.deepEqual(inferred, { scale: 'dimensions', widthText: '20', heightText: '18.5' });
});

test('a stored scale is kept', () => {
  const inferred = inferScale(
    { scale: 'dimensions', widthText: '24', heightText: '16', width: 24, height: 16 },
    { feetPerPixel: 0.2, calibration: { lengthFt: 10 } },
    [],
    [],
  );
  assert.equal(inferred.scale, 'dimensions');
  assert.equal(inferred.widthText, '24');
});

test('entered sizes stay as typed and plan sizes round to one decimal', () => {
  assert.equal(formatEnteredSize('24', '16'), '24 × 16 ft');
  assert.equal(formatPlanSize(82.46, 68.51), '82.5 × 68.5 ft');
});

test('dimensions accept feet from 1 to 500', () => {
  assert.deepEqual(parseDimension(' 24 '), { text: '24', value: 24 });
  assert.deepEqual(parseDimension('24.5'), { text: '24.5', value: 24.5 });
  assert.equal(parseDimension(''), null);
  assert.equal(parseDimension('0'), null);
  assert.equal(parseDimension('501'), null);
  assert.equal(parseDimension('24 ft'), null);
});

test('reports beds and obstacles that leave the plot', () => {
  const beds = [
    { id: 'inside', name: 'Herbs', x: 1, y: 1, w: 4, h: 8 },
    { id: 'past', name: 'Tomatoes', x: 10, y: 1, w: 4, h: 2 },
    { id: 'pot', name: 'Basil', type: 'pot', x: 11, y: 0, diam: 2, w: 2, h: 2 },
  ];
  const obstacles = [{ id: 'shed', name: 'Shed', x: 0, y: 8, w: 3, h: 3 }];
  assert.deepEqual(itemsOutside(beds, obstacles, 12, 10), [
    { id: 'past', name: 'Tomatoes' },
    { id: 'pot', name: 'Basil' },
    { id: 'shed', name: 'Shed' },
  ]);
});

test('a traced corner outside the plot is reported', () => {
  const beds = [{
    id: 'poly',
    name: 'Edge',
    shape: 'polygon',
    points: [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 12 }],
  }];
  assert.deepEqual(itemsOutside(beds, [], 10, 10), [{ id: 'poly', name: 'Edge' }]);
});
