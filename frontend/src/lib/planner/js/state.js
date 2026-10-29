// ─── Config ──────────────────────────────────────────────────────────────────
const SCALE = 36; // px per foot
const GRID  = 0.5; // snap resolution in feet

let garden   = { width: 20, height: 18, scale: null, widthText: '', heightText: '' };
let pendingCalib = null;
let plot = { plotId: null, widthPx: 0, heightPx: 0, calibration: null, feetPerPixel: 0, photoUrl: null };
let plotImage = null;
let plotDataUrl = null;
let tool = 'select';
let calibClicks = [];
let calibHover = null;
let calibDrag = null;
let draftPoints = [];
let draftCursor = null;
let lastDrawTap = 0;
let dragMode = null;
let dragVertex = -1;
let selectedVertex = -1;
let dragOriginPoints = null;
let dragOriginPivot = null;
let dragStartFeet = null;
let selectedObj = null;
let dragging   = null;
let dragOff    = { x: 0, y: 0 };
let isRotating      = false;
let rotateStartAngle = 0;
let rotateStartRot   = 0;
let nextId     = -1;

function takeStandInId() {
  const id = nextId;
  nextId -= 1;
  return id;
}

// ─── Viewport (zoom / pan) ────────────────────────────────────────────────────
let viewX = 0, viewY = 0, viewZoom = 1;
let isPanning = false, panStart = null;

function screenToWorld(sx, sy) {
  return { x: (sx - viewX) / viewZoom, y: (sy - viewY) / viewZoom };
}

// ─── Undo History ─────────────────────────────────────────────────────────────
const MAX_HISTORY = 50;
const undoStack   = [];
let   _propHistorySaved = false; // prevents saving on every keystroke in text fields

function saveHistory() {
  undoStack.push({
    beds:      JSON.parse(JSON.stringify(beds)),
    obstacles: JSON.parse(JSON.stringify(obstacles)),
    garden:    { ...garden },
    plot: {
      plotId: plot.plotId,
      widthPx: plot.widthPx,
      heightPx: plot.heightPx,
      calibration: plot.calibration ? { ...plot.calibration } : null,
      feetPerPixel: plot.feetPerPixel || 0,
      photoUrl: plot.photoUrl || null,
    },
  });
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
}

function undoLast() {
  if (!undoStack.length) return;
  const snap = undoStack.pop();
  beds      = snap.beds;
  obstacles = snap.obstacles;
  garden    = { ...snap.garden };
  if (snap.plot) restorePlotMeta(snap.plot);
  _propHistorySaved = false;
  publishScale();
  // If the previously selected item no longer exists, deselect it
  if (!getSelected()) select(null);
  else syncPanel();
  updateCalibReadout();
  renderLists(); draw();
}
// ─── Data ────────────────────────────────────────────────────────────────────
let obstacles = [];

let beds = [];

function gardenReady() {
  return garden.scale === 'dimensions' || garden.scale === 'plan';
}

function publishScale() {
  document.dispatchEvent(new CustomEvent('scalechange', {
    detail: {
      scale: garden.scale || null,
      width: garden.width,
      height: garden.height,
      widthText: garden.widthText || '',
      heightText: garden.heightText || '',
    },
  }));
}

const BED_COLORS = ['#2d6a30','#1f5c28','#3d8b40','#245c32','#4a9a4c','#1a4d24','#386a20'];
let colorIdx = 0;

