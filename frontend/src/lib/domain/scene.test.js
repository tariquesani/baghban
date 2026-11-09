import assert from 'node:assert/strict';
import test from 'node:test';
import { gardenScene } from './scene.js';

const CALIBRATION = { x1: 10, y1: 20, x2: 110, y2: 20, lengthFt: 8 };
const TRIANGLE = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 0, y: 3 },
];
test('an assembled garden keeps integer ids, names, size, and plot', () => {
  const scene = gardenScene({
    garden: {
      width: 40,
      height: 22,
      scale: 'dimensions',
      widthText: '40',
      heightText: '22 ft',
    },
    plot: {
      plotId: 'plot-9',
      photoUrl: '/api/photos/plot-9',
      widthPx: 1200,
      heightPx: 800,
      feetPerPixel: 0.25,
      calibration: CALIBRATION,
    },
    beds: [{
      id: 4,
      name: 'Herbs',
      kind: 'bed',
      x: 1,
      y: 2,
      w: 4,
      h: 8,
      diam: null,
      rotation: 0,
      color: '#2d6a30',
      notes: 'Morning sun',
      areaSqFt: 32,
      outline: null,
      removed: false,
      plants: ['Tomato', 'Basil'],
    }],
    obstacles: [{
      id: 4,
      name: 'Shed',
      x: 4,
      y: 4.5,
      w: 4,
      h: 3,
      rotation: 1.25,
      color: '#888',
    }],
    nextId: 9,
  });

  assert.equal('nextId' in scene, false);
  assert.deepEqual(scene.garden, {
    width: 40,
    height: 22,
    scale: 'dimensions',
    widthText: '40',
    heightText: '22 ft',
  });
  assert.equal(scene.plot.plotId, 'plot-9');
  assert.equal(scene.plot.photoUrl, '/api/photos/plot-9');
  assert.equal(scene.plot.widthPx, 1200);
  assert.equal(scene.plot.heightPx, 800);
  assert.equal(scene.plot.feetPerPixel, 0.25);
  assert.deepEqual(scene.plot.calibration, CALIBRATION);
  assert.equal(scene.beds.length, 1);
  assert.equal(scene.beds[0].id, 4);
  assert.equal(typeof scene.beds[0].id, 'number');
  assert.equal(scene.beds[0].type, 'bed');
  assert.equal(scene.beds[0].name, 'Herbs');
  assert.deepEqual(scene.beds[0].plants, ['Tomato', 'Basil']);
  assert.equal(scene.beds[0].notes, 'Morning sun');
  assert.equal(scene.beds[0].kind, undefined);
  assert.equal(scene.beds[0].outline, undefined);
  assert.equal(scene.beds[0].shape, undefined);
  assert.equal('plantGrid' in scene.beds[0], false);
  assert.equal(scene.obstacles[0].id, 4);
  assert.equal(typeof scene.obstacles[0].id, 'number');
  assert.equal(scene.obstacles[0].name, 'Shed');
  assert.equal(scene.obstacles[0].rotation, 1.25);
  assert.notStrictEqual(scene.beds[0], scene.obstacles[0]);
});

test('a polygon outline and a pot become canvas shapes', () => {
  const scene = gardenScene({
    garden: {
      width: 20,
      height: 18,
      scale: 'plan',
      widthText: '',
      heightText: '',
    },
    plot: {
      plotId: null,
      photoUrl: null,
      widthPx: null,
      heightPx: null,
      feetPerPixel: null,
      calibration: null,
    },
    plants: {},
    beds: [
      {
        id: 2,
        name: 'Patch',
        kind: 'bed',
        x: 0,
        y: 0,
        w: 4,
        h: 3,
        color: '',
        outline: { points: TRIANGLE, pivot: { x: 1, y: 1 } },
        plants: [],
      },
      {
        id: 3,
        name: 'Patio',
        kind: 'pot',
        x: 8,
        y: 1,
        w: 1.5,
        h: 1.5,
        diam: 1.5,
        color: '#c1440e',
        plants: [],
      },
      {
        id: 4,
        name: 'Mango',
        kind: 'tree',
        x: 12,
        y: 2,
        w: 2,
        h: 2,
        diam: 2,
        color: '',
        plants: [],
      },
    ],
    obstacles: [],
  });

  assert.equal(scene.plot.plotId, null);
  assert.equal(scene.plot.photoUrl, null);
  assert.equal(scene.plot.widthPx, 0);
  assert.equal(scene.plot.heightPx, 0);
  assert.equal(scene.plot.feetPerPixel, 0);
  assert.equal(scene.plot.calibration, null);
  assert.equal(scene.beds[0].shape, 'polygon');
  assert.deepEqual(scene.beds[0].points, TRIANGLE);
  assert.deepEqual(scene.beds[0].pivot, { x: 1, y: 1 });
  assert.equal(scene.beds[0].color, '#2d6a30');
  assert.equal(scene.beds[0].outline, undefined);
  assert.equal(scene.beds[1].type, 'pot');
  assert.equal(scene.beds[1].diam, 1.5);
  assert.equal(scene.beds[1].shape, undefined);
  assert.equal(scene.beds[2].type, 'tree');
  assert.equal(scene.beds[2].diam, 2);
  assert.equal(scene.beds[2].color, '#3d8f45');
});

test('a bent side keeps its bulge and drops a straight side', () => {
  const scene = gardenScene({
    garden: { width: 20, height: 18, scale: 'plan', widthText: '', heightText: '' },
    plot: null,
    beds: [{
      id: 2,
      name: 'Patch',
      kind: 'bed',
      shape: 'polygon',
      points: [
        { x: 0, y: 0, bulge: 1.5 },
        { x: 4, y: 0, bulge: 0 },
        { x: 0, y: 3 },
      ],
    }],
    obstacles: [],
  });

  assert.deepEqual(scene.beds[0].points, [
    { x: 0, y: 0, bulge: 1.5 },
    { x: 4, y: 0 },
    { x: 0, y: 3 },
  ]);
});

test('a removed bed stays off the map and a blank garden keeps the canvas size', () => {
  const scene = gardenScene({
    garden: {
      width: null,
      height: null,
      scale: null,
      widthText: '',
      heightText: '',
    },
    plot: null,
    beds: [
      { id: 1, name: 'Gone', kind: 'bed', removed: true, plants: ['Mint'] },
      { id: 5, name: 'Box', kind: 'planter', x: 2, y: 2, w: 3, h: 1, plants: [] },
    ],
    obstacles: [],
  });

  assert.deepEqual(scene.garden, {
    width: 20,
    height: 18,
    scale: null,
    widthText: '',
    heightText: '',
  });
  assert.deepEqual(scene.beds.map((bed) => bed.id), [5]);
  assert.equal(scene.beds[0].type, 'planter');
  assert.equal(scene.beds[0].color, '#9c6644');
  assert.equal(scene.plot.plotId, null);
  assert.equal(scene.plot.photoUrl, null);
});

test('a saved canvas file still loads and nextId is ignored', () => {
  const scene = gardenScene({
    version: 2,
    garden: {
      width: 24,
      height: 16,
      scale: 'dimensions',
      widthText: '24',
      heightText: '16',
    },
    beds: [{
      id: 'bed1',
      name: 'New Bed',
      x: 2,
      y: 2,
      w: 4,
      h: 8,
      color: '#2d6a30',
      type: 'bed',
      plants: ['🌿 Basil'],
      notes: '',
      shape: 'polygon',
      points: TRIANGLE,
      pivot: { x: 1, y: 1 },
    }],
    obstacles: [{ id: 'obs2', name: 'Shed', x: 1, y: 1, w: 2, h: 2, color: '#888' }],
    plot: null,
    nextId: 4,
  });

  assert.equal(scene.beds[0].id, 'bed1');
  assert.equal(scene.beds[0].type, 'bed');
  assert.equal(scene.beds[0].shape, 'polygon');
  assert.deepEqual(scene.beds[0].points, TRIANGLE);
  assert.equal(scene.obstacles[0].id, 'obs2');
  assert.equal('nextId' in scene, false);
});

test('reading a scene twice keeps the same beds, names, and plot', () => {
  const once = gardenScene({
    garden: { width: 40, height: 22, scale: 'dimensions', widthText: '40', heightText: '22 ft' },
    plot: {
      plotId: 'plot-9',
      photoUrl: '/api/photos/plot-9',
      widthPx: 1200,
      heightPx: 800,
      feetPerPixel: 0.25,
      calibration: CALIBRATION,
    },
    beds: [{
      id: 4,
      name: 'Herbs',
      kind: 'bed',
      x: 1,
      y: 2,
      w: 4,
      h: 8,
      color: '#2d6a30',
      notes: 'Morning sun',
      outline: { points: TRIANGLE, pivot: { x: 1, y: 1 } },
      plants: ['Tomato', 'Basil'],
    }],
    obstacles: [{ id: 4, name: 'Shed', x: 4, y: 4, w: 4, h: 3, rotation: 0.5, color: '#888' }],
  });
  const twice = gardenScene(once);
  assert.deepEqual(twice, once);
});
