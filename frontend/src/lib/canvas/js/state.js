// ─── Config ──────────────────────────────────────────────────────────────────
const SCALE = 36; // px per foot
const GRID  = 0.5; // snap resolution in feet

let garden   = { width: 20, height: 18 };
let plot = { plotId: null, widthPx: 0, heightPx: 0, calibration: null, feetPerPixel: 0 };
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
let selectedId = null;
let dragging   = null;
let dragOff    = { x: 0, y: 0 };
let isRotating      = false;
let rotateStartAngle = 0;
let rotateStartRot   = 0;
let nextId     = 1;

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
    },
    nextId,
  });
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
}

function undoLast() {
  if (!undoStack.length) return;
  const snap = undoStack.pop();
  beds      = snap.beds;
  obstacles = snap.obstacles;
  garden    = { ...snap.garden };
  nextId    = snap.nextId;
  if (snap.plot) restorePlotMeta(snap.plot);
  document.getElementById('gardenWidth').value  = Math.round(garden.width * 10) / 10;
  document.getElementById('gardenHeight').value = Math.round(garden.height * 10) / 10;
  _propHistorySaved = false;
  // If the previously selected item no longer exists, deselect it
  const stillExists = beds.find(b => b.id === selectedId) || obstacles.find(o => o.id === selectedId);
  if (!stillExists) select(null);
  else syncPanel();
  updateCalibReadout();
  renderLists(); draw();
}
// ─── Data ────────────────────────────────────────────────────────────────────
let obstacles = [];

let beds = [];

const BED_COLORS = ['#8B5E3C','#6B4226','#7A5230','#5C3D1E','#9B6B3C','#4A3020','#A0522D'];
let colorIdx = 0;

