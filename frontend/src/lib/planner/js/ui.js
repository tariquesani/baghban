// ─── Selection ────────────────────────────────────────────────────────────────
function markDetailsOpen(open) {
  document.querySelector('.app')?.classList.toggle('panel-open', open);
}

function select(id, type, openPanel = true) {
  if (id !== selectedId) selectedVertex = -1;
  selectedId = id;
  const panel = document.getElementById('rightPanel');
  if (id && openPanel) { panel.classList.add('open'); syncPanel(); }
  else if (!id)        { panel.classList.remove('open'); publishDetails(); }
  markDetailsOpen(panel.classList.contains('open'));
  draw(); renderLists();
}

function getSelected() {
  return beds.find(b => b.id === selectedId) || obstacles.find(o => o.id === selectedId);
}

function isBedSelected() {
  return beds.some(b => b.id === selectedId);
}

function syncPanel() {
  const item = getSelected();
  if (!item) return;
  _propHistorySaved = false; // reset so next edit on this item saves a fresh snapshot
  const isBed = isBedSelected();

  const isPot     = isBed && item.type === 'pot';
  const isPlanter = isBed && item.type === 'planter';
  const poly      = isBed && isPolygon(item);
  document.getElementById('panelTitle').textContent =
    isPlanter ? '🍱 Planter' : isPot ? '🪴 Pot' : isBed ? '🌿 Bed Details' : '⬛ Obstacle Details';
  const _vp = visualPos(item);
  document.getElementById('propX').value    = Math.round(_vp.x * 10) / 10;
  document.getElementById('propY').value    = Math.round(_vp.y * 10) / 10;

  document.getElementById('polySection').style.display    = poly ? '' : 'none';
  if (poly) updatePolyPanel();
  if (isPlanter) {
    document.getElementById('propPlanterL').value = Math.round(item.w * 12);
    document.getElementById('propPlanterW').value = Math.round(item.h * 12);
    syncPlanterPreset();
  }
  if (!isPot) document.getElementById('propRot').value = rotationDegrees(item.rotation);

  if (isBed) {
    if (isPot) document.getElementById('propDiam').value = item.diam || 1;
    renderPlantTags(item);
  }
  publishDetails();
}

let focusDetailsName = false;

function publishDetails() {
  const item = getSelected();
  const focusName = focusDetailsName;
  focusDetailsName = false;
  if (!item) {
    document.dispatchEvent(new CustomEvent('selectiondetails', { detail: null }));
    return;
  }
  const isBed = isBedSelected();
  const isPot = isBed && item.type === 'pot';
  const isPlanter = isBed && item.type === 'planter';
  const poly = isBed && isPolygon(item);
  document.dispatchEvent(new CustomEvent('selectiondetails', {
    detail: {
      name: item.name,
      width: item.w,
      length: item.h,
      notes: item.notes || '',
      showSize: !(isPot || isPlanter || poly),
      showNotes: isBed,
      showPot: isPot,
      showPlanter: isPlanter,
      showRotation: !isPot,
      showPosition: !poly,
      showPlants: isBed,
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
  const item = getSelected();
  const el = document.getElementById('propRot');
  if (!item || !el || item.type === 'pot') return;
  el.value = rotationDegrees(item.rotation);
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
  const item = getSelected();
  if (!item) return;
  const vp = visualPos(item);
  document.getElementById('propX').value = Math.round(vp.x * 10) / 10;
  document.getElementById('propY').value = Math.round(vp.y * 10) / 10;
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
function renderPlantTags(bed) {
  const c = document.getElementById('plantTags');
  c.innerHTML = '';
  (bed.plants || []).forEach(p => {
    const s = document.createElement('span');
    s.className = 'plant-tag';
    s.innerHTML = `${p}<span class="rm" onclick="removePlant('${p}')"> ×</span>`;
    c.appendChild(s);
  });
}

function addPlant() {
  const sel = document.getElementById('plantSelect');
  const p = sel.value; if (!p) return;
  const bed = beds.find(b => b.id === selectedId); if (!bed) return;

  const pd = PLANT_DATA[p];
  if (pd && bed.type !== 'planter') {
    const { rowSpan, colSpan } = getPlantSpan(pd.sqft);
    const L = Math.floor(bed.h), W = Math.floor(bed.w);
    if (L < rowSpan || W < colSpan) {
      showPlantWarn(`This bed (${bed.w}×${bed.h} ft) is too small for ${p} — needs at least ${colSpan}×${rowSpan} ft.`);
      sel.value = '';
      return;
    }
  }

  if (!bed.plants.includes(p)) {
    saveHistory();
    bed.plants.push(p);
    if (bed.type !== 'planter') addPlantToGrid(bed, p);
    renderPlantTags(bed); draw();
    notePlanChanged();
  }
  sel.value = '';
}

function showPlantWarn(msg) {
  let el = document.getElementById('plantAddWarn');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function removePlant(plant) {
  const bed = beds.find(b => b.id === selectedId); if (!bed) return;
  saveHistory();
  removePlantFromGrid(bed, plant);
  bed.plants = bed.plants.filter(p => p !== plant);
  renderPlantTags(bed); draw();
  notePlanChanged();
}

// ─── Add / Remove ─────────────────────────────────────────────────────────────
function addBed() {
  if (!gardenReady()) return;
  saveHistory();
  const id = 'bed' + nextId++;
  const color = BED_COLORS[colorIdx++ % BED_COLORS.length];
  beds.push({ id, name:'New Bed', x:2, y:2, w:4, h:8, color, type:'bed', plants:[], notes:'' });
  renderLists(); draw(); select(id, 'bed');
}

function addPot() {
  if (!gardenReady()) return;
  saveHistory();
  const id = 'pot' + nextId++;
  beds.push({ id, name:'Pot', x:2, y:2, diam:1, w:1, h:1, color:'#c1440e', type:'pot', plants:[], notes:'' });
  select(id, 'bed'); renderLists(); draw();
}

function addPlanter() {
  if (!gardenReady()) return;
  saveHistory();
  const id = 'planter' + nextId++;
  beds.push({ id, name:'Planter', x:2, y:2, w:3, h:1, color:'#9c6644', type:'planter', plants:[], notes:'' });
  focusDetailsName = true;
  select(id, 'bed'); renderLists(); draw();
}

function updatePlanterInches(axis, inches) {
  const bed = beds.find(b => b.id === selectedId);
  if (!bed || bed.type !== 'planter' || (axis !== 'w' && axis !== 'h')) return;
  const n = Number(inches);
  if (!Number.isFinite(n) || n < 4 || n > 240) return;
  if (!_propHistorySaved) { saveHistory(); _propHistorySaved = true; }
  bed[axis] = n / 12;
  syncPlanterPreset();
  draw(); renderLists();
}

function applyPlanterPreset(lengthIn, widthIn) {
  const bed = beds.find(b => b.id === selectedId);
  if (!bed || bed.type !== 'planter') return;
  if (!_propHistorySaved) { saveHistory(); _propHistorySaved = true; }
  bed.w = lengthIn / 12;
  bed.h = widthIn / 12;
  document.getElementById('propPlanterL').value = lengthIn;
  document.getElementById('propPlanterW').value = widthIn;
  syncPlanterPreset();
  draw(); renderLists();
}

function syncPlanterPreset() {
  const bed = getSelected();
  if (!bed || bed.type !== 'planter') return;
  const lengthIn = Math.round(bed.w * 12);
  const widthIn = Math.round(bed.h * 12);
  document.querySelectorAll('.planter-preset').forEach(btn => {
    const on = +btn.dataset.l === lengthIn && +btn.dataset.w === widthIn;
    btn.classList.toggle('btn-primary', on);
    btn.classList.toggle('btn-secondary', !on);
  });
}

function updatePotDiam(val) {
  const bed = beds.find(b => b.id === selectedId);
  if (!bed || bed.type !== 'pot') return;
  saveHistory();
  bed.diam = val; bed.w = val; bed.h = val;
  draw(); renderLists();
}

function addObstacle() {
  if (!gardenReady()) return;
  saveHistory();
  const id = 'obs' + nextId++;
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
  if (!selectedId) return;
  saveHistory();
  const isBed = beds.find(b => b.id === selectedId);
  const isObs = obstacles.find(o => o.id === selectedId);
  if (isBed) {
    const orig = beds.find(b => b.id === selectedId);
    const newId = (orig.type === 'planter' ? 'planter' : orig.type === 'pot' ? 'pot' : 'bed') + nextId++;
    const copy = { ...orig, id: newId, x: orig.x + 1, y: orig.y + 1,
                   plants: [...(orig.plants || [])], notes: orig.notes || '', plantGrid: null };
    if (orig.points) {
      copy.points = orig.points.map(p => ({ x: p.x + 1, y: p.y + 1 }));
      if (orig.pivot) copy.pivot = { x: orig.pivot.x + 1, y: orig.pivot.y + 1 };
      syncPolygonBounds(copy);
    }
    beds.push(copy);
    select(newId, 'bed');
  } else if (isObs) {
    const orig = obstacles.find(o => o.id === selectedId);
    const newId = 'obs' + nextId++;
    const copy = { ...orig, id: newId, x: orig.x + 1, y: orig.y + 1 };
    obstacles.push(copy);
    select(newId, 'obstacle');
  }
  renderLists(); draw();
}

function deleteSelected() {
  if (!selectedId) return;
  if (!confirm('Remove this item?')) return;
  saveHistory();
  beds      = beds.filter(b => b.id !== selectedId);
  obstacles = obstacles.filter(o => o.id !== selectedId);
  select(null);
  renderLists(); draw();
}

// ─── Sidebar lists ────────────────────────────────────────────────────────────
function bedListSize(b) {
  if (b.type === 'pot') return `${b.diam * 12}" pot`;
  if (b.type === 'planter') return `${Math.round(b.w * 12)}×${Math.round(b.h * 12)}" planter`;
  if (isPolygon(b)) return `${bedArea(b).toFixed(1)} sq ft · ${b.points.length} sides`;
  return `${b.w}×${b.h} ft`;
}

function currentLists() {
  return { beds, obstacles, selectedId };
}

function renderLists() {
  document.dispatchEvent(new CustomEvent('listschange', { detail: currentLists() }));
  notePlanChanged();
}
