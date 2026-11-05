import assert from 'node:assert/strict';
import test from 'node:test';
import { cropPayload, emptyCrop } from './crop.js';

test('saving a crop leaves the icon file alone', () => {
  const draft = { ...emptyCrop(), id: 4, name: ' Mint ', category: 'Herbs', icon: '4.png' };
  const body = cropPayload(draft);
  assert.equal(body.name, 'Mint');
  assert.equal(Object.hasOwn(body, 'icon'), false);
});
