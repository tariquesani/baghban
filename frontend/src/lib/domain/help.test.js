import assert from 'node:assert/strict';
import test from 'node:test';
import { helpForPath } from './help.js';

test('each screen has its own tips', () => {
  const paths = ['/', '/calendar', '/crops', '/planner', '/settings'];
  const titles = paths.map((path) => helpForPath(path).title);
  assert.deepEqual(titles, ['Dashboard', 'Calendar', 'Crops', 'Planner', 'Settings']);
  const tipLists = paths.map((path) => helpForPath(path).tips.join('\n'));
  assert.equal(new Set(tipLists).size, paths.length);
  for (const tips of paths.map((path) => helpForPath(path).tips)) {
    assert.ok(tips.length >= 5);
  }
});

test('an unknown path still has tips', () => {
  const help = helpForPath('/missing');
  assert.equal(help.title, 'Baghban');
  assert.ok(help.tips.length > 0);
});
