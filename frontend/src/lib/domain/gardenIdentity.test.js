import assert from 'node:assert/strict';
import test from 'node:test';
import {
  identityFields,
  nameFields,
  nameProblem,
  placeBody,
} from './gardenIdentity.js';

test('a missing garden is a blank identity', () => {
  assert.deepEqual(identityFields(null), {
    name: '',
    subtitle: '',
    latitude: '',
    longitude: '',
    timezone: '',
  });
});

test('stored coordinates come back as text', () => {
  assert.equal(identityFields({ latitude: 0, longitude: 88.25 }).latitude, '0');
  assert.equal(identityFields({ latitude: 0, longitude: 88.25 }).longitude, '88.25');
});

test('a name is trimmed and limited', () => {
  assert.equal(nameProblem('  Plot  ', ''), '');
  assert.deepEqual(nameFields('  Plot  ', '  Home  '), { name: 'Plot', subtitle: 'Home' });
  assert.equal(nameProblem('a'.repeat(81), ''), 'The garden name needs to be 80 characters or fewer.');
});

test('an empty place clears and a partial place does not save', () => {
  assert.deepEqual(placeBody(' ', ''), {
    body: { latitude: null, longitude: null },
  });
  assert.equal(
    placeBody('22.5', '').error,
    'A place needs a latitude and a longitude.',
  );
});

test('a place accepts the equator and rejects a latitude past the pole', () => {
  assert.deepEqual(placeBody('0', '0').body, {
    latitude: 0,
    longitude: 0,
  });
  assert.equal(placeBody('91', '0').error, 'Latitude needs to be between -90 and 90.');
});
