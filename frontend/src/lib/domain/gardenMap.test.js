import assert from 'node:assert/strict';
import test from 'node:test';
import { MAP_HEIGHT, MAP_WIDTH, MAP_ZOOM, mapTiles } from './gardenMap.js';

test('the saved point sits in the middle of the thumbnail', () => {
  const tiles = mapTiles(21.15, 79.09);
  assert.ok(tiles.length >= 1);
  const hit = tiles.some(
    (tile) =>
      MAP_WIDTH / 2 >= tile.left &&
      MAP_WIDTH / 2 < tile.left + 256 &&
      MAP_HEIGHT / 2 >= tile.top &&
      MAP_HEIGHT / 2 < tile.top + 256,
  );
  assert.equal(hit, true);
  assert.match(tiles[0].url, new RegExp(`^https://tile.openstreetmap.org/${MAP_ZOOM}/`));
});

test('a polar latitude still produces tiles', () => {
  assert.ok(mapTiles(90, 0).length >= 1);
  assert.ok(mapTiles(0, -179.9).every((tile) => tile.url.includes(`/${MAP_ZOOM}/`)));
});
