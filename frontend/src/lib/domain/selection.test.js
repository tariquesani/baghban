import assert from 'node:assert/strict';
import test from 'node:test';
import { isSelected } from './selection.js';

test('bed 2 is not obstacle 2', () => {
  const bed = { type: 'bed', id: 2 };
  const obstacle = { type: 'obstacle', id: 2 };
  assert.equal(isSelected(bed, 'bed', 2), true);
  assert.equal(isSelected(bed, 'obstacle', 2), false);
  assert.equal(isSelected(obstacle, 'obstacle', 2), true);
  assert.equal(isSelected(obstacle, 'bed', 2), false);
});

test('a pot or planter is selected as a bed', () => {
  const pot = { type: 'bed', id: 2 };
  assert.equal(isSelected(pot, 'bed', 2), true);
  assert.equal(isSelected({ type: 'pot', id: 2 }, 'bed', 2), false);
});

test('an empty selection matches nothing', () => {
  assert.equal(isSelected(null, 'bed', 2), false);
  assert.equal(isSelected(undefined, 'obstacle', 2), false);
  assert.equal(isSelected({ type: 'bed', id: 2 }, 'bed', null), false);
});
