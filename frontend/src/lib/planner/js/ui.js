// ─── Selection ────────────────────────────────────────────────────────────────
function markDetailsOpen(open) {
  if (pickOnly) return;
  document.querySelector('.app')?.classList.toggle('panel-open', open);
}

let detailsOpen = false;

function select(id, type, openPanel = true) {
  const clearing = id == null;
  const same = clearing ? selectedObj == null : isSelected(selectedObj, type, id);
  if (!same) selectedVertex = -1;
  selectedObj = clearing ? null : { type, id };
  if (!clearing && openPanel) {
    detailsOpen = true;
    syncPanel();
  } else if (clearing) {
    detailsOpen = false;
    publishDetails();
  }
  markDetailsOpen(detailsOpen);
  draw(); renderLists();
}

function selectedBed() {
  if (!selectedObj || selectedObj.type !== 'bed') return null;
  return beds.find(b => isSelected(selectedObj, 'bed', b.id)) || null;
}

function getSelected() {
  if (!selectedObj) return null;
  if (selectedObj.type === 'obstacle') {
    return obstacles.find(o => isSelected(selectedObj, 'obstacle', o.id)) || null;
  }
  if (selectedObj.type === 'bed') return selectedBed();
  return null;
}

function isBedSelected() {
  return !!selectedBed();
}

function syncPanel() {
  const item = getSelected();
  if (!item) return;
  _propHistorySaved = false; // reset so next edit on this item saves a fresh snapshot
  publishDetails();
}

let focusDetailsName = false;

function publishDetails() {
  if (pickOnly) return;
  const item = getSelected();
  const focusName = focusDetailsName;
  focusDetailsName = false;
  if (!item) {
    document.dispatchEvent(new CustomEvent('selectiondetails', { detail: null }));
    return;
  }
  const isBed = isBedSelected();
  const isPot = isBed && item.type === 'pot';
  const isTree = isBed && item.type === 'tree';
  const isCircle = isPot || isTree;
  const isPlanter = isBed && item.type === 'planter';
  const poly = isBed && isPolygon(item);
  const pos = visualPos(item);
  const summary = poly ? polygonSummary(item) : null;
  document.dispatchEvent(new CustomEvent('selectiondetails', {
    detail: {
      id: item.id,
      title: isTree ? 'Tree' : isPlanter ? 'Planter' : isPot ? 'Pot' : isBed ? 'Bed' : 'Obstacle',
      name: item.name,
      width: item.w,
      length: item.h,
      notes: item.notes || '',
      x: Math.round(pos.x * 10) / 10,
      y: Math.round(pos.y * 10) / 10,
      rotation: isPot ? 0 : rotationDegrees(item.rotation),
      diameter: isCircle ? (item.diam || 1) : 0,
      areaSqFt: isBed ? Math.round(bedArea(item) * 10) / 10 : 0,
      planterLength: isPlanter ? Math.round(item.w * 12) : 0,
      planterWidth: isPlanter ? Math.round(item.h * 12) : 0,
      plants: isBed ? [...(item.plants || [])] : [],
      polyStats: summary ? summary.stats : '',
      neighborNote: summary ? summary.neighbor : '',
      plantWarn,
      showSize: !(isCircle || isPlanter || poly),
      showNotes: isBed,
      showPot: isPot,
      showTree: isTree,
      showPlanter: isPlanter,
      showRotation: !isPot,
      showPosition: !poly,
      showPlants: isBed,
      showPoly: poly,
      focusName,
    },
  }));
}

function rotationDegrees(rot) {
  let deg = ((rot || 0) * 180 / Math.PI) % 360;
  if (deg < 0) deg += 360;
  if (deg >= 359.5) deg = 0;
  return Math.round(deg);
}

function syncRotationField() {
  if (detailsOpen) publishDetails();
}

function updateRotation(deg) {
  const item = getSelected();
  if (!item || item.type === 'pot') return;
  const n = Number(deg);
  if (!Number.isFinite(n)) return;
  if (!_propHistorySaved) { saveHistory(); _propHistorySaved = true; }
  const wrapped = ((n % 360) + 360) % 360;
  if (isPolygon(item)) lockPolygonPivot(item);
  let radians = wrapped * Math.PI / 180;
  if (isPolygon(item)) radians = rotationInsideGarden(item, radians, item.rotation || 0);
  item.rotation = radians;
  if (isPolygon(item)) syncRotationField();
  else syncPositionFields();
  draw(); renderLists();
}

// Convert between raw anchor (b.x/b.y = unrotated top-left) and
// visual edge (left/top of the rotated AABB) so position fields
// always show 0 when the item is at the garden wall.
function visualPos(item) {
  const rot = item.rotation || 0;
  const ac = Math.abs(Math.cos(rot)), as = Math.abs(Math.sin(rot));
  const hw = (item.w / 2) * ac + (item.h / 2) * as; // AABB half-width in ft
  const hh = (item.w / 2) * as + (item.h / 2) * ac; // AABB half-height in ft
  return { x: item.x + item.w / 2 - hw, y: item.y + item.h / 2 - hh };
}
function applyVisualPos(item, vx, vy) {
  const rot = item.rotation || 0;
  const ac = Math.abs(Math.cos(rot)), as = Math.abs(Math.sin(rot));
  const hw = (item.w / 2) * ac + (item.h / 2) * as;
  const hh = (item.w / 2) * as + (item.h / 2) * ac;
  item.x = vx - item.w / 2 + hw;
  item.y = vy - item.h / 2 + hh;
}

function syncPositionFields() {
  if (detailsOpen) publishDetails();
}

function updateProp(field, value) {
  const item = getSelected();
  if (!item) return;
  // Save history once per editing session (reset when panel re-opens via syncPanel)
  if (!_propHistorySaved) { saveHistory(); _propHistorySaved = true; }
  if (field === 'x') { applyVisualPos(item, value, visualPos(item).y); }
  else if (field === 'y') { applyVisualPos(item, visualPos(item).x, value); }
  else { item[field] = value; }
  draw(); renderLists();
  publishDetails();
}

// ─── Plants ───────────────────────────────────────────────────────────────────
let plantWarn = '';
let plantWarnTimer = 0;

function addPlant(name) {
  const p = String(name || '').trim();
  if (!p) return false;
  const bed = selectedBed(); if (!bed) return false;

  const pd = PLANT_DATA[p];
  if (pd && bed.type !== 'planter') {
    const { rowSpan, colSpan } = getPlantSpan(pd.sqft);
    const L = Math.floor(bed.h), W = Math.floor(bed.w);
    if (L < rowSpan || W < colSpan) {
      showPlantWarn(`This bed (${bed.w}×${bed.h} ft) is too small for ${p} — needs at least ${colSpan}×${rowSpan} ft.`);
      return false;
    }
  }

  plantWarn = '';
  clearTimeout(plantWarnTimer);
  if (!bed.plants.includes(p)) {
    saveHistory();
    bed.plants.push(p);
    draw();
    notePlanChanged();
  }
  publishDetails();
  return true;
}

function showPlantWarn(msg) {
  plantWarn = msg;
  if (detailsOpen) publishDetails();
  clearTimeout(plantWarnTimer);
  plantWarnTimer = setTimeout(() => {
    plantWarn = '';
    if (detailsOpen) publishDetails();
  }, 4000);
}

function plantLabelName(label) {
  const text = String(label || '').trim();
  const space = text.indexOf(' ');
  if (space <= 0) return text;
  const head = text.slice(0, space);
  if (/^\p{L}/u.test(head)) return text;
  return text.slice(space + 1).trim();
}

function removePlant(plant) {
  const bed = selectedBed(); if (!bed) return;
  const wanted = plantLabelName(plant).toLowerCase();
  if (!wanted) return;
  const next = (bed.plants || []).filter(
    (label) => plantLabelName(label).toLowerCase() !== wanted,
  );
  if (next.length === (bed.plants || []).length) return;
  saveHistory();
  bed.plants = next;
  draw();
  notePlanChanged();
  publishDetails();
}

// ─── Add / Remove ─────────────────────────────────────────────────────────────
function addBed() {
  if (!gardenReady()) return;
  saveHistory();
  const id = takeStandInId();
  const color = BED_COLORS[colorIdx++ % BED_COLORS.length];
  beds.push({ id, name:'New Bed', x:2, y:2, w:4, h:8, color, type:'bed', plants:[], notes:'' });
  renderLists(); draw(); select(id, 'bed');
}

function addPot() {
  if (!gardenReady()) return;
  saveHistory();
  const id = takeStandInId();
  beds.push({ id, name:'Pot', x:2, y:2, diam:1, w:1, h:1, color:'#c1440e', type:'pot', plants:[], notes:'' });
  select(id, 'bed'); renderLists(); draw();
}

function addTree() {
  if (!gardenReady()) return;
  saveHistory();
  const id = takeStandInId();
  beds.push({ id, name:'Tree', x:2, y:2, diam:1, w:1, h:1, color:'#3d8f45', type:'tree', plants:[], notes:'' });
  select(id, 'bed'); renderLists(); draw();
}

function addPlanter() {
  if (!gardenReady()) return;
  saveHistory();
  const id = takeStandInId();
  beds.push({ id, name:'Planter', x:2, y:2, w:3, h:1, color:'#9c6644', type:'planter', plants:[], notes:'' });
  focusDetailsName = true;
  select(id, 'bed'); renderLists(); draw();
}

function updatePlanterInches(axis, inches) {
  const bed = selectedBed();
  if (!bed || bed.type !== 'planter' || (axis !== 'w' && axis !== 'h')) return;
  const n = Number(inches);
  if (!Number.isFinite(n) || n < 4 || n > 240) return;
  if (!_propHistorySaved) { saveHistory(); _propHistorySaved = true; }
  bed[axis] = n / 12;
  draw(); renderLists();
  publishDetails();
}

function applyPlanterPreset(lengthIn, widthIn) {
  const bed = selectedBed();
  if (!bed || bed.type !== 'planter') return;
  if (!_propHistorySaved) { saveHistory(); _propHistorySaved = true; }
  bed.w = lengthIn / 12;
  bed.h = widthIn / 12;
  draw(); renderLists();
  publishDetails();
}

function updatePotDiam(val) {
  const bed = selectedBed();
  if (!bed || (bed.type !== 'pot' && bed.type !== 'tree')) return;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0.5 || n > 100) return;
  if (!_propHistorySaved) { saveHistory(); _propHistorySaved = true; }
  bed.diam = n; bed.w = n; bed.h = n;
  draw(); renderLists();
  publishDetails();
}

function addObstacle() {
  if (!gardenReady()) return;
  saveHistory();
  const id = takeStandInId();
  obstacles.push({ id, name: '⬛ Obstacle', x: 4, y: 4, w: 4, h: 4, color: '#888' });
  renderLists(); draw(); select(id, 'obstacle');
}

const SIDEBAR_KEY = 'sidebar-collapsed';
const sidebarWideQuery = window.matchMedia('(min-width: 801px)');

function isSidebarWide() {
  return sidebarWideQuery.matches;
}

function applySidebarCollapsed(collapsed) {
  const app = document.querySelector('.app');
  app.classList.toggle('is-collapsed', collapsed);
  const toggle = document.getElementById('sidebarToggle');
  if (!toggle) return;
  const open = !collapsed;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Collapse sidebar' : 'Expand sidebar');
  toggle.title = open ? 'Collapse sidebar' : 'Expand sidebar';
}

function toggleSidebar() {
  if (!isSidebarWide()) {
    closeSidebar();
    return;
  }
  const app = document.querySelector('.app');
  const next = !app.classList.contains('is-collapsed');
  applySidebarCollapsed(next);
  localStorage.setItem(SIDEBAR_KEY, String(next));
}

function openSidebar() {
  document.dispatchEvent(new CustomEvent('sidebaropen'));
}

function closeSidebar() {
  document.querySelector('.app').classList.remove('is-drawer');
}

function initSidebar() {
  if (window.lucide) lucide.createIcons();
}

function duplicateSelected() {
  const orig = getSelected();
  if (!orig) return;
  saveHistory();
  if (selectedObj.type === 'bed') {
    const newId = takeStandInId();
    const copy = { ...orig, id: newId, x: orig.x + 1, y: orig.y + 1,
                   plants: [...(orig.plants || [])], notes: orig.notes || '' };
    if (orig.points) {
      copy.points = orig.points.map(p => copyGardenPoint(p, 1, 1));
      if (orig.pivot) copy.pivot = { x: orig.pivot.x + 1, y: orig.pivot.y + 1 };
      syncPolygonBounds(copy);
    }
    beds.push(copy);
    select(newId, 'bed');
  } else if (selectedObj.type === 'obstacle') {
    const newId = takeStandInId();
    const copy = { ...orig, id: newId, x: orig.x + 1, y: orig.y + 1 };
    obstacles.push(copy);
    select(newId, 'obstacle');
  }
  renderLists(); draw();
}

function deleteSelected() {
  const item = getSelected();
  if (!item) return;
  if (selectedObj.type === 'bed' && isPolygon(item)
      && selectedVertex >= 0 && selectedVertex < item.points.length) {
    deletePolygonCorner(item, selectedVertex);
    return;
  }
  if (!confirm('Remove this item?')) return;
  saveHistory();
  if (selectedObj.type === 'bed') beds = beds.filter(b => !isSelected(selectedObj, 'bed', b.id));
  else obstacles = obstacles.filter(o => !isSelected(selectedObj, 'obstacle', o.id));
  select(null);
  renderLists(); draw();
}

// ─── Sidebar lists ────────────────────────────────────────────────────────────
function bedListSize(b) {
  if (b.type === 'pot') return `${b.diam * 12}" pot`;
  if (b.type === 'tree') {
    const area = Math.round(bedArea(b) * 10) / 10;
    return `${b.diam} ft · ${area} sq ft tree`;
  }
  if (b.type === 'planter') return `${Math.round(b.w * 12)}×${Math.round(b.h * 12)}" planter`;
  if (isPolygon(b)) return `${bedArea(b).toFixed(1)} sq ft · ${b.points.length} sides`;
  return `${b.w}×${b.h} ft`;
}

function currentLists() {
  return { beds, obstacles, selectedObj };
}

function publishLists() {
  if (pickOnly) return;
  document.dispatchEvent(new CustomEvent('listschange', { detail: currentLists() }));
}

function renderLists() {
  publishLists();
  notePlanChanged();
}

function adoptRowId(type, from, to) {
  const holder = { beds, obstacles, selectedObj, undo: undoStack };
  stampStandIn(holder, type, from, to);
  selectedObj = holder.selectedObj;
  publishLists();
  draw();
}
