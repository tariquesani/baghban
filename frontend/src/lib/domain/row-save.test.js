import assert from 'node:assert/strict';
import test from 'node:test';
import { SAVE_QUIET_MS, createSaveQueue, sceneFromPlan, stampStandIn } from './row-save.js';

const TRIANGLE = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 0, y: 3 },
];

function garden() {
  return { width: 20, height: 18, scale: 'dimensions', widthText: '20', heightText: '18' };
}

function plan(parts = {}) {
  return {
    garden: parts.garden || garden(),
    plot: Object.hasOwn(parts, 'plot') ? parts.plot : null,
    beds: parts.beds || [],
    obstacles: parts.obstacles || [],
  };
}

function bed(overrides = {}) {
  return {
    id: -1,
    name: 'New Bed',
    type: 'bed',
    x: 2,
    y: 2,
    w: 4,
    h: 8,
    color: '#2d6a30',
    plants: [],
    notes: '',
    ...overrides,
  };
}

function paths(requests) {
  return requests.map((request) => `${request.method} ${request.path}`);
}

test('a new bed is inserted once, without its stand-in id', () => {
  const queue = createSaveQueue();
  queue.baseline(plan());
  queue.observe(plan({ beds: [bed({ x: 2 })] }), 0);
  queue.observe(plan({ beds: [bed({ x: 6, name: 'Herbs' })] }), 10);

  const ready = queue.take(10);
  assert.deepEqual(paths(ready), ['PUT /beds']);
  assert.equal('id' in ready[0].body, false);
  assert.equal(ready[0].body.kind, 'bed');
  assert.equal(ready[0].body.x, 6);
  assert.equal(ready[0].body.name, 'Herbs');
  assert.equal(ready[0].body.outline, null);
  assert.equal('plantGrid' in ready[0].body, false);
  assert.equal('plants' in ready[0].body, false);
  assert.equal(queue.take(10).length, 0);
});

test('an edit waits on the insert, then saves that id after a quiet period', () => {
  const queue = createSaveQueue();
  queue.baseline(plan());
  queue.observe(plan({ beds: [bed()] }), 0);
  const [insert] = queue.take(0);
  queue.observe(plan({ beds: [bed({ x: 6 })] }), 100);
  assert.equal(queue.take(100).length, 0);

  const outcome = queue.succeeded(insert, { id: 5 }, 100);
  assert.deepEqual(outcome.stamp, { type: 'bed', from: -1, to: 5 });
  assert.equal(outcome.alert, false);
  assert.equal(queue.take(100).length, 0);

  const [update] = queue.take(100 + SAVE_QUIET_MS);
  assert.equal(update.method, 'PUT');
  assert.equal(update.path, '/beds/5');
  assert.equal(update.body.id, 5);
  assert.equal(update.body.x, 6);
});

test('a second new bed is not blocked by the first insert', () => {
  const queue = createSaveQueue();
  queue.baseline(plan());
  queue.observe(plan({ beds: [bed({ id: -1 })] }), 0);
  const first = queue.take(0);
  assert.equal(first.length, 1);
  queue.observe(plan({
    beds: [bed({ id: -1 }), bed({ id: -2, name: 'Planter', type: 'planter', w: 3, h: 1 })],
  }), 20);
  const second = queue.take(20);
  assert.deepEqual(paths(second), ['PUT /beds']);
  assert.equal(second[0].body.kind, 'planter');
  assert.equal('diam' in second[0].body, false);
});

test('a pot sends diam and a traced bed sends its outline', () => {
  const queue = createSaveQueue();
  queue.baseline(plan());
  queue.observe(plan({
    beds: [
      bed({ id: -1, type: 'pot', name: 'Pot', diam: 1, w: 1, h: 1, color: '#c1440e' }),
      bed({ id: -3, type: 'tree', name: 'Tree', diam: 2, w: 2, h: 2, color: '#3d8f45' }),
      bed({
        id: -2,
        shape: 'polygon',
        points: TRIANGLE,
        pivot: { x: 1, y: 1 },
      }),
    ],
  }), 0);
  const ready = queue.take(0);
  const pot = ready.find((request) => request.body.kind === 'pot');
  const tree = ready.find((request) => request.body.kind === 'tree');
  const traced = ready.find((request) => request.body.outline);
  assert.equal(pot.body.diam, 1);
  assert.equal('id' in pot.body, false);
  assert.equal(tree.body.diam, 2);
  assert.equal(tree.body.color, '#3d8f45');
  assert.deepEqual(traced.body.outline, { points: TRIANGLE, pivot: { x: 1, y: 1 } });
  assert.equal('shape' in traced.body, false);
});

test('a bent side keeps its bulge on the outline', () => {
  const queue = createSaveQueue();
  queue.baseline(plan());
  queue.observe(plan({
    beds: [bed({
      id: -2,
      shape: 'polygon',
      points: [
        { x: 0, y: 0, bulge: 1.5 },
        { x: 4, y: 0, bulge: 0 },
        { x: 0, y: 3 },
      ],
      pivot: { x: 1, y: 1 },
    })],
  }), 0);
  const [traced] = queue.take(0);
  assert.deepEqual(traced.body.outline, {
    points: [
      { x: 0, y: 0, bulge: 1.5 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ],
    pivot: { x: 1, y: 1 },
  });
});

test('plant names wait for a stand-in, then the new crop is assigned', () => {
  const queue = createSaveQueue();
  const saved = bed({ id: 4, name: 'Herbs', plants: ['Mint'] });
  queue.baseline(plan({ beds: [saved] }));
  queue.observe(plan({ beds: [bed({ id: -1, plants: ['Basil'] }), { ...saved }] }), 0);
  const [insert] = queue.take(0);
  assert.equal(queue.take(SAVE_QUIET_MS).length, 0);

  queue.succeeded(insert, { id: 8 }, 50);
  assert.equal(queue.take(50).length, 0);
  const named = queue.take(SAVE_QUIET_MS);
  assert.deepEqual(paths(named), ['PUT /beds/8/crops']);
  assert.deepEqual(named[0].body, { name: 'Basil' });

  queue.succeeded(named[0], {}, SAVE_QUIET_MS);
  queue.observe(plan({
    beds: [
      bed({ id: 8, plants: ['Basil'], notes: 'Sunny' }),
      saved,
    ],
  }), 1000);
  assert.equal(queue.take(1000).length, 0);
  const edits = queue.take(1000 + SAVE_QUIET_MS);
  assert.deepEqual(paths(edits), ['PUT /beds/8']);
  assert.equal(edits[0].body.notes, 'Sunny');
  assert.equal(edits.some((request) => String(request.path).includes('/crops')), false);
});

test('adding names assigns each crop, and removing one archives it', () => {
  const queue = createSaveQueue();
  queue.baseline(plan({ beds: [bed({ id: 4, plants: [] })] }));
  queue.observe(plan({ beds: [bed({ id: 4, plants: ['Tomato', 'Basil'] })] }), 0);
  const ready = queue.take(SAVE_QUIET_MS);
  assert.deepEqual(paths(ready), ['PUT /beds/4/crops', 'PUT /beds/4/crops']);
  assert.deepEqual(ready.map((request) => request.body), [{ name: 'Tomato' }, { name: 'Basil' }]);
  for (const request of ready) queue.succeeded(request, {}, SAVE_QUIET_MS);

  queue.observe(plan({ beds: [bed({ id: 4, plants: ['Basil'] })] }), 2000);
  const archived = queue.take(2000 + SAVE_QUIET_MS);
  assert.deepEqual(paths(archived), ['PUT /beds/4/crops/archive']);
  assert.deepEqual(archived[0].body, { name: 'Tomato' });
});

test('garden size and plot fields save settings, not the scene', () => {
  const queue = createSaveQueue();
  queue.baseline(plan());
  queue.observe(plan({
    garden: { width: 24, height: 16, scale: 'dimensions', widthText: '24', heightText: '16' },
    plot: {
      plotId: 'plot-1',
      photoUrl: '/api/photos/plot-1',
      widthPx: 800,
      heightPx: 600,
      feetPerPixel: 0.2,
      calibration: { lengthFt: 10 },
    },
  }), 0);
  assert.equal(queue.take(0).length, 0);
  const [settings] = queue.take(SAVE_QUIET_MS);
  assert.equal(settings.path, '/garden');
  assert.deepEqual(Object.keys(settings.body), ['garden', 'plot']);
  assert.equal(settings.body.garden.width, 24);
  assert.equal(settings.body.garden.widthText, '24');
  assert.equal(settings.body.plot.plotId, 'plot-1');
  assert.equal(settings.body.plot.photoUrl, '/api/photos/plot-1');
  assert.deepEqual(settings.body.plot.calibration, { lengthFt: 10 });
  assert.equal(settings.body.beds, undefined);
  assert.equal(settings.body.nextId, undefined);
});

test('undo before the delete is sent leaves the row alone', () => {
  const queue = createSaveQueue();
  const herbs = bed({ id: 4, name: 'Herbs' });
  queue.baseline(plan({ beds: [herbs] }));
  queue.observe(plan(), 0);
  queue.observe(plan({ beds: [herbs] }), 5);
  assert.equal(queue.take(5).length, 0);
});

test('undoing a delete puts the bed and its crops back', () => {
  const queue = createSaveQueue();
  const herbs = bed({ id: 4, name: 'Herbs', plants: ['Basil'] });
  queue.baseline(plan({ beds: [herbs] }));
  queue.observe(plan(), 0);
  const [removal] = queue.take(0);
  assert.equal(removal.method, 'DELETE');
  queue.observe(plan({ beds: [herbs] }), 10);
  assert.equal(queue.take(10).length, 0);
  queue.succeeded(removal, {}, 20);
  const [restored] = queue.take(20);
  assert.equal(restored.path, '/beds/4');
  assert.equal(restored.body.name, 'Herbs');
  queue.succeeded(restored, { id: 4 }, 30);
  const [crop] = queue.take(30 + SAVE_QUIET_MS);
  assert.equal(crop.path, '/beds/4/crops');
  assert.equal(crop.body.name, 'Basil');
});

test('undo after the delete has finished still restores the bed', () => {
  const queue = createSaveQueue();
  const herbs = bed({ id: 4, name: 'Herbs' });
  queue.baseline(plan({ beds: [herbs] }));
  queue.observe(plan(), 0);
  const [removal] = queue.take(0);
  queue.succeeded(removal, {}, 10);
  assert.equal(queue.take(10).length, 0);
  queue.observe(plan({ beds: [herbs] }), 20);
  const [restored] = queue.take(20);
  assert.equal(restored.method, 'PUT');
  assert.equal(restored.path, '/beds/4');
  assert.equal(restored.body.name, 'Herbs');
});

test('undoing a deleted obstacle inserts it again', () => {
  const queue = createSaveQueue();
  const shed = { id: 2, name: 'Shed', x: 1, y: 1, w: 2, h: 2, color: '#888' };
  queue.baseline(plan({ obstacles: [shed] }));
  queue.observe(plan(), 0);
  const [removal] = queue.take(0);
  queue.succeeded(removal, {}, 10);
  queue.observe(plan({ obstacles: [shed] }), 20);
  const [insert] = queue.take(20);
  assert.equal(insert.method, 'PUT');
  assert.equal(insert.path, '/obstacles');
  assert.equal('id' in insert.body, false);
  assert.equal(insert.body.name, 'Shed');
  const outcome = queue.succeeded(insert, { id: 9 }, 30);
  assert.deepEqual(outcome.stamp, { type: 'obstacle', from: 2, to: 9 });
});

test('removing a saved bed or obstacle deletes that row', () => {
  const queue = createSaveQueue();
  queue.baseline(plan({
    beds: [bed({ id: 4 })],
    obstacles: [{ id: 2, name: 'Shed', x: 4, y: 4, w: 4, h: 4, color: '#888' }],
  }));
  queue.observe(plan({
    obstacles: [{ id: 2, name: 'Shed', x: 4, y: 4, w: 4, h: 4, color: '#888' }],
  }), 0);
  assert.deepEqual(paths(queue.take(0)), ['DELETE /beds/4']);

  queue.observe(plan(), 10);
  assert.deepEqual(paths(queue.take(10)), ['DELETE /obstacles/2']);
});

test('a stand-in removed before the insert is sent never reaches the server', () => {
  const queue = createSaveQueue();
  queue.baseline(plan());
  queue.observe(plan({ beds: [bed()] }), 0);
  queue.observe(plan(), 20);
  assert.equal(queue.take(20).length, 0);
});

test('a stand-in removed while the insert is in flight is deleted after the id returns', () => {
  const queue = createSaveQueue();
  queue.baseline(plan());
  queue.observe(plan({ beds: [bed()] }), 0);
  const [insert] = queue.take(0);
  queue.observe(plan(), 30);
  assert.equal(queue.take(30).length, 0);
  const outcome = queue.succeeded(insert, { id: 6 }, 40);
  assert.deepEqual(outcome.stamp, { type: 'bed', from: -1, to: 6 });
  assert.deepEqual(paths(queue.take(40)), ['DELETE /beds/6']);
});

test('an unchanged note does not restart the quiet period', () => {
  const queue = createSaveQueue();
  queue.baseline(plan({ beds: [bed({ id: 3, x: 1 })] }));
  queue.observe(plan({ beds: [bed({ id: 3, x: 5 })] }), 0);
  assert.equal(queue.nextDelay(0), SAVE_QUIET_MS);
  queue.observe(plan({ beds: [bed({ id: 3, x: 5 })] }), 500);
  assert.equal(queue.nextDelay(500), 300);
  assert.equal(queue.take(500).length, 0);
});

test('leaving flushes a row that is still in its quiet period', () => {
  const queue = createSaveQueue();
  queue.baseline(plan({ beds: [bed({ id: 3, name: 'Herbs' })] }));
  queue.observe(plan({ beds: [bed({ id: 3, name: 'Mint' })] }), 0);
  assert.equal(queue.take(0).length, 0);
  queue.flush(50);
  const [update] = queue.take(50);
  assert.equal(update.path, '/beds/3');
  assert.equal(update.body.name, 'Mint');
});

test('one failed request raises one alert and does not send itself again', () => {
  const queue = createSaveQueue();
  queue.baseline(plan());
  queue.observe(plan({ beds: [bed()] }), 0);
  const [insert] = queue.take(0);
  assert.equal(queue.failed(insert), true);
  assert.equal(queue.failed(insert), false);
  assert.equal(queue.take(0).length, 0);

  queue.observe(plan({ beds: [bed({ x: 9 })] }), 20);
  const [again] = queue.take(20);
  assert.equal(again.body.x, 9);
  assert.equal(queue.failed(again), true);
});

test('bed 2 is not retargeted when obstacle 2 changes', () => {
  const queue = createSaveQueue();
  queue.baseline(plan({
    beds: [bed({ id: 2, name: 'Herbs' })],
    obstacles: [{ id: 2, name: 'Shed', x: 1, y: 1, w: 3, h: 3, color: '#888' }],
  }));
  queue.observe(plan({
    beds: [bed({ id: 2, name: 'Herbs' })],
    obstacles: [{ id: 2, name: 'Shed', x: 5, y: 1, w: 3, h: 3, color: '#888' }],
  }), 0);
  queue.flush(0);
  const ready = queue.take(0);
  assert.deepEqual(paths(ready), ['PUT /obstacles/2']);
  assert.equal(ready[0].body.x, 5);
});

test('stamping a stand-in updates that row, the selection, and undo snapshots', () => {
  const holder = {
    beds: [{ id: -1, name: 'New Bed' }],
    obstacles: [{ id: -1, name: 'Shed' }],
    selectedObj: { type: 'bed', id: -1 },
    undo: [
      { beds: [{ id: -1, name: 'New Bed' }], obstacles: [{ id: -1, name: 'Shed' }] },
      { beds: [], obstacles: [] },
    ],
  };
  stampStandIn(holder, 'bed', -1, 5);
  assert.equal(holder.beds[0].id, 5);
  assert.equal(holder.obstacles[0].id, -1);
  assert.deepEqual(holder.selectedObj, { type: 'bed', id: 5 });
  assert.equal(holder.undo[0].beds[0].id, 5);
  assert.equal(holder.undo[0].obstacles[0].id, -1);

  holder.selectedObj = { type: 'obstacle', id: -1 };
  stampStandIn(holder, 'obstacle', -1, 5);
  assert.equal(holder.obstacles[0].id, 5);
  assert.deepEqual(holder.selectedObj, { type: 'obstacle', id: 5 });
  assert.equal(holder.beds[0].id, 5);
});

test('loading a scene does not schedule a save', () => {
  const loaded = plan({
    beds: [bed({ id: 4, name: 'Herbs', plants: ['Basil'] })],
    obstacles: [{ id: 2, name: 'Shed', x: 4, y: 4, w: 4, h: 4, rotation: 0, color: '#888' }],
  });
  const queue = createSaveQueue();
  queue.baseline(loaded);
  queue.observe(sceneFromPlan(loaded), 0);
  assert.equal(queue.take(SAVE_QUIET_MS).length, 0);
});
