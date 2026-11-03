import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarPhotoId } from './photoId.js';

const PHOTO_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;

test('a photo id uses randomUUID when the browser provides it', () => {
  const source = {
    randomUUID: () => '11111111-2222-4333-8444-555555555555',
    getRandomValues: () => {
      throw new Error('getRandomValues should not run');
    },
  };
  assert.equal(calendarPhotoId('harvest', source), 'harvest-11111111-2222-4333-8444-555555555555');
});

test('a photo id still works when randomUUID is missing', () => {
  const source = {
    getRandomValues(bytes) {
      bytes.set([
        0x10, 0x32, 0x54, 0x76, 0x98, 0xba, 0xdc, 0xfe,
        0x10, 0x32, 0x54, 0x76, 0x98, 0xba, 0xdc, 0xfe,
      ]);
      return bytes;
    },
  };
  const id = calendarPhotoId('sowing', source);
  assert.equal(id, 'sowing-10325476-98ba-4cfe-9032-547698badcfe');
  assert.match(id, PHOTO_ID);
});
