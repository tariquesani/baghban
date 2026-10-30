// ─── Export / Print ───────────────────────────────────────────────────────────
function exportImg() {
  // Render at full 1:1 scale into a temporary canvas for a clean export
  const oc = document.createElement('canvas');
  oc.width  = ft(garden.width);
  oc.height = ft(garden.height);
  const savedCtx = canvas.getContext('2d');
  // Temporarily redirect drawing to oc by swapping viewX/Y/Zoom
  const [svX, svY, svZ] = [viewX, viewY, viewZoom];
  const [sw, sh] = [canvas.width, canvas.height];
  canvas.width  = oc.width;
  canvas.height = oc.height;
  viewX = 0; viewY = 0; viewZoom = 1;
  draw();
  const a = document.createElement('a');
  a.download = 'garden-layout.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
  canvas.width  = sw;
  canvas.height = sh;
  viewX = svX; viewY = svY; viewZoom = svZ;
  draw();
}

function printPlan() {
  const img = canvas.toDataURL('image/png');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Garden Plan</title>
  <style>
    body { font-family: sans-serif; padding: 24px; color: #222; }
    h1 { color: #2d6a30; margin-bottom: 4px; }
    img { max-width: 100%; border: 1px solid #ccc; border-radius: 4px; margin: 16px 0; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #ccc; padding: 7px 10px; text-align: left; font-size: 13px; }
    th { background: #e8f4e8; font-weight: 600; }
    tr:nth-child(even) td { background: #f8fdf8; }
    .footer { margin-top: 24px; font-size: 11px; color: #888; }
  </style></head><body>
  <h1>🌱 Garden Layout Plan</h1>
  <p style="color:#555;font-size:13px">Garden: <strong>${garden.width} ft × ${garden.height} ft</strong></p>
  <img src="${img}">
  <h2 style="font-size:15px;margin-bottom:8px">Bed Summary</h2>
  <table>
    <tr><th>Bed</th><th>Size</th><th>Position (from top-left)</th><th>Plants</th><th>Notes</th></tr>
    ${beds.map(b => `<tr>
      <td><strong>${b.name}</strong></td>
      <td>${b.w} × ${b.h} ft</td>
      <td>x = ${b.x} ft, y = ${b.y} ft</td>
      <td>${(b.plants||[]).join(', ') || '—'}</td>
      <td style="font-size:11px">${b.notes || '—'}</td>
    </tr>`).join('')}
  </table>
  <div class="footer">Generated with 🌱 Garden Layout Planner</div>
  </body></html>`);
  win.print();
}
// ─── Save / Load JSON ─────────────────────────────────────────────────────────
let applyingPlan = false;

function currentPlan() {
  return {
    version: 2,
    garden: { ...garden },
    beds: beds.map(b => ({
      ...b,
      plants: [...(b.plants || [])],
      points: b.points ? b.points.map(p => ({ x: p.x, y: p.y })) : undefined,
    })),
    obstacles: obstacles.map(o => ({ ...o })),
    plot: plot.plotId ? {
      plotId: plot.plotId,
      widthPx: plot.widthPx,
      heightPx: plot.heightPx,
      calibration: plot.calibration ? { ...plot.calibration } : null,
      feetPerPixel: plot.feetPerPixel || 0,
      photoUrl: plot.photoUrl || null,
    } : null,
    savedAt: new Date().toISOString(),
  };
}

function notePlanChanged() {
  if (!visitOpen || applyingPlan) return;
  document.dispatchEvent(new CustomEvent('planchange'));
}

function applyPlan(plan) {
  if (!visitOpen) return;
  if (!plan || typeof plan !== 'object') throw new Error('Could not read plan');
  const scene = gardenScene(plan);
  applyingPlan = true;
  try {
    garden = { ...scene.garden };
    beds = scene.beds;
    obstacles = scene.obstacles;
    plot = {
      plotId: scene.plot.plotId || null,
      widthPx: scene.plot.widthPx || 0,
      heightPx: scene.plot.heightPx || 0,
      calibration: scene.plot.calibration ? { ...scene.plot.calibration } : null,
      feetPerPixel: scene.plot.feetPerPixel || 0,
      photoUrl: scene.plot.photoUrl || null,
    };
    if (scene.plot.imageDataUrl) {
      adoptPlotDataUrl(scene.plot.imageDataUrl, {
        preserveCalibration: true,
        keepId: true,
        quiet: !!scene.plot.photoOnServer,
      });
    } else if (scene.plot.photoUrl) {
      adoptPlotDataUrl(scene.plot.photoUrl, { preserveCalibration: true, keepId: true, quiet: true });
    } else if (scene.plot.plotId) {
      idbGet(scene.plot.plotId).then(url => {
        if (!visitOpen) return;
        if (url) adoptPlotDataUrl(url, { preserveCalibration: true, keepId: true });
        else alert('This plan’s plot photo is not on this computer. Upload the same photo and the saved scale will apply if the image size matches.');
      });
    } else {
      plotImage = null;
      plotDataUrl = null;
    }
    select(null); renderLists(); initCanvas();
    updateCalibReadout();
    publishScale();
  } finally {
    applyingPlan = false;
  }
  if (!scene.plot.plotId && !scene.plot.photoUrl && !scene.plot.imageDataUrl) {
    document.dispatchEvent(new CustomEvent('plotphoto'));
  }
}

function saveJSON() {
  const plan = currentPlan();
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'garden-plan.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function showNewGardenDialog() {
  document.dispatchEvent(new CustomEvent('newgarden'));
}

function confirmNewGarden() {
  beds      = [];
  obstacles = [];
  garden    = { width: 20, height: 18, scale: null, widthText: '', heightText: '' };
  plot = blankPlot();
  plotImage = null;
  plotDataUrl = null;
  calibClicks = [];
  pendingCalib = null;
  draftPoints = [];
  draftCursor = null;
  tool = 'select';
  colorIdx  = 0;
  selectedObj = null;
  undoStack.length = 0;
  document.querySelector('.app')?.classList.remove('panel-open');
  select(null);
  setTool('select');
  updateCalibReadout();
  renderLists();
  fitView();
  draw();
  publishScale();
  document.dispatchEvent(new CustomEvent('plotphoto'));
}

function rememberScale(scale, widthText, heightText) {
  if (garden.scale === 'dimensions' || garden.scale === 'plan') return;
  if (scale !== 'dimensions' && scale !== 'plan') return;
  garden.scale = scale;
  garden.widthText = widthText || '';
  garden.heightText = heightText || '';
  publishScale();
  notePlanChanged();
}

function confirmDimensions(widthText, heightText, width, height) {
  if (!(width >= 1) || width > 500 || !(height >= 1) || height > 500) return false;
  saveHistory();
  garden.width = width;
  garden.height = height;
  garden.widthText = widthText;
  garden.heightText = heightText;
  garden.scale = 'dimensions';
  plot = blankPlot();
  plotImage = null;
  plotDataUrl = null;
  calibClicks = [];
  pendingCalib = null;
  setTool('select');
  updateCalibReadout();
  fitView();
  draw();
  notePlanChanged();
  publishScale();
  document.dispatchEvent(new CustomEvent('plotphoto'));
  return true;
}

function reviseDimensions(widthText, heightText, width, height) {
  if (garden.scale !== 'dimensions') return false;
  if (!(width >= 1) || width > 500 || !(height >= 1) || height > 500) return false;
  saveHistory();
  garden.width = width;
  garden.height = height;
  garden.widthText = widthText;
  garden.heightText = heightText;
  fitView();
  draw();
  notePlanChanged();
  publishScale();
  return true;
}

function loadJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (!visitOpen) return;
      try {
        applyPlan(JSON.parse(ev.target.result));
        alert('Plan loaded successfully!');
      } catch { alert('Could not read plan file. Make sure it was saved from this app.'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ─── Report Modal ─────────────────────────────────────────────────────────────
let activeTab = 'plant';

function openReport() {
  if (!beds.length) { alert('Add at least one bed first.'); return; }
  document.dispatchEvent(new CustomEvent('organizeropen'));
}

function closeReport() {
  document.dispatchEvent(new CustomEvent('organizerclose'));
}

function switchTab() {
  activeTab = 'plant';
  const body = document.getElementById('reportBody');
  if (!body) return;
  body.innerHTML = generatePlantsHTML();
}

// Footprint used by the size check. A crop under 1 sq ft still needs a 1 ft square.
function getPlantSpan(sqft) {
  if (sqft < 1) return { rowSpan: 1, colSpan: 1, perSqft: Math.max(2, Math.round(1 / sqft)) };
  if (sqft === 1) return { rowSpan: 1, colSpan: 1, perSqft: 1 };
  const side = Math.ceil(Math.sqrt(sqft));
  return { rowSpan: side, colSpan: side, perSqft: 1 };
}

function clearBedPlants(bedId) {
  const bed = beds.find(b => b.id === bedId);
  if (!bed) return;
  if (!confirm(`Remove all plants from "${bed.name}"? This cannot be undone.`)) return;
  bed.plants = [];
  saveHistory();
  notePlanChanged();
  switchTab(activeTab);
  syncPanel();
}

function showPlantToast(msg) {
  let t = document.getElementById('plantToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'plantToast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;z-index:9999;pointer-events:none;transition:opacity 0.3s;white-space:nowrap;max-width:90vw;text-align:center';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

function generatePlantsHTML() {
  const bedSections = beds.map(bed => {
    const plants  = bed.plants || [];
    const sqftTotal = Math.round(bedArea(bed) * 10) / 10;
    const sizeLabel = isPolygon(bed) ? `${sqftTotal} sq ft` : `${bed.w}×${bed.h} ft`;

    const addRow = `
      <div style="display:flex;gap:6px;align-items:center;padding:8px 16px;border-bottom:1px solid #d4e4d4;background:#f8fcf8">
        <select id="orgSelect-${bed.id}" style="flex:1;padding:5px 8px;border:1px solid #c6d9c6;border-radius:6px;font-size:13px;background:#fff">${PLANT_OPTIONS_HTML}</select>
        <button class="btn btn-primary btn-sm" onclick="addPlantFromOrganizer('${bed.id}')">+ Add</button>
      </div>`;

    if (!plants.length) {
      return `<div class="report-bed">
        <div class="report-bed-header"><h3>${bed.name}</h3><span>${sizeLabel}</span></div>
        ${addRow}
        <div class="report-bed-body"><p style="color:#888;font-size:13px;padding:4px 0">No plants yet — use the dropdown above to add some.</p></div>
      </div>`;
    }

    // Companion & conflict checks
    const companionAlerts = [];
    const avoidAlerts     = [];
    plants.forEach(p => {
      const pd = PLANT_DATA[p]; if (!pd) return;
      pd.companions.forEach(c => { if (plants.includes(c)) companionAlerts.push([p, c].sort().join(' + ')); });
      pd.avoid.forEach(a => { if (plants.includes(a)) avoidAlerts.push([p, a].sort().join(' conflicts with ')); });
    });

    const alertsHTML = avoidAlerts.length
      ? `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:6px;padding:9px 12px;margin-bottom:12px;font-size:12px">
          ⚠️ <strong>Conflicts detected:</strong> ${[...new Set(avoidAlerts)].join(' · ')}
        </div>` : '';
    const companionsHTML = [...new Set(companionAlerts)].length
      ? `<div style="background:#e8f4e8;border:1px solid #b8d8b8;border-radius:6px;padding:9px 12px;margin-bottom:12px;font-size:12px">
          ✅ <strong>Good companions:</strong> ${[...new Set(companionAlerts)].join(' · ')}
        </div>` : '';

    const isPot     = bed.type === 'pot';
    const isPlanter = bed.type === 'planter';

    // Per-plant detail rows
    const plantRows = plants.map(pName => {
      const pd = PLANT_DATA[pName]; if (!pd) return '';
      const perSqft    = pd.sqft < 1 ? Math.round(1 / pd.sqft) : null;
      const countLabel = perSqft
        ? `~${Math.round(sqftTotal * perSqft)} plants (${perSqft}/sq ft)`
        : `~${Math.floor(sqftTotal / pd.sqft)} plants`;
      const trellisTag  = pd.trellis ? `<span class="pill warn">🪝 Trellis needed</span>` : '';
      const cTags = pd.companions.filter(c => plants.includes(c)).map(c => `<span class="pill">✅ ${c}</span>`).join('');
      const aTags = pd.avoid.filter(a => plants.includes(a)).map(a => `<span class="pill bad">⚠️ ${a}</span>`).join('');

      return `<div class="plant-row">
        <div class="plant-emoji">${pd.emoji}</div>
        <div class="plant-info">
          <h5>${pName}</h5>
          <div class="plant-meta">
            <span class="pill">📐 ${pd.sqft >= 1 ? pd.sqft + ' sq ft/plant' : perSqft + '/sq ft'}</span>
            <span class="pill">↔ ${pd.spacing}" apart</span>
            ${(!isPot && !isPlanter) ? `<span class="pill">⬇ ${pd.depthIn}" soil</span>` : ''}
            <span class="pill">☀ ${pd.sun}</span>
            <span class="pill">💧 ${pd.water}</span>
            ${trellisTag}
          </div>
          ${(cTags || aTags) ? `<div class="plant-meta">${cTags}${aTags}</div>` : ''}
          <div class="plant-notes">${countLabel} in this ${sqftTotal} sq ft ${isPlanter ? 'planter' : isPot ? 'pot' : 'bed'}. ${pd.notes}</div>
        </div>
      </div>`;
    }).join('');

    return `<div class="report-bed">
      <div class="report-bed-header">
        <h3>${bed.name} ${isPlanter ? '<span style="font-size:11px;font-weight:normal;background:rgba(156,102,68,0.18);border:1px solid #9c6644;border-radius:4px;padding:1px 6px;vertical-align:middle">🍱 planter</span>' : isPot ? '<span style="font-size:11px;font-weight:normal;background:rgba(193,68,14,0.15);border:1px solid #c1440e;border-radius:4px;padding:1px 6px;vertical-align:middle">🪴 pot</span>' : ''}</h3>
        <span>${isPlanter ? `${Math.round(bed.w * 12)}×${Math.round(bed.h * 12)} in · ${sqftTotal} sq ft` : isPolygon(bed) ? `${sqftTotal} sq ft` : `${bed.w} ft × ${bed.h} ft · ${sqftTotal} sq ft`}</span>
      </div>
      ${addRow}
      <div class="report-bed-body">
        ${alertsHTML}${companionsHTML}
        <div class="report-section">
          <h4>🌿 Plant Details ${plants.length ? `<button class="btn btn-sm" style="font-size:11px;padding:3px 10px;background:#fee2e2;color:#b91c1c;border-color:#fca5a5" onclick="clearBedPlants('${bed.id}')">Clear all plants</button>` : ''}</h4>
          ${plantRows}
        </div>
      </div>
    </div>`;
  }).join('');

  const uniquePlants = [...new Set(beds.flatMap(b => b.plants || []))];
  const summary = `
  <div class="report-summary">
    <h3>🌱 Planting Summary</h3>
    <div class="summary-grid">
      <div class="summary-stat"><div class="val">${beds.length}</div><div class="lbl">Beds</div></div>
      <div class="summary-stat"><div class="val">${uniquePlants.length}</div><div class="lbl">Unique plants</div></div>
      <div class="summary-stat"><div class="val">${beds.reduce((s,b)=>s+b.w*b.h,0)}</div><div class="lbl">Sq ft total</div></div>
    </div>
  </div>`;

  return summary + bedSections;
}

function addPlantFromOrganizer(bedId) {
  const sel = document.getElementById('orgSelect-' + bedId);
  const p = sel.value; if (!p) return;
  const bed = beds.find(b => b.id === bedId); if (!bed) return;
  const pd = PLANT_DATA[p];
  if (pd && bed.type !== 'planter') {
    const { rowSpan, colSpan } = getPlantSpan(pd.sqft);
    const L = Math.floor(bed.h), W = Math.floor(bed.w);
    if (L < rowSpan || W < colSpan) {
      showPlantToast(`Too small for ${p} — needs at least ${colSpan}×${rowSpan} ft.`);
      sel.value = '';
      return;
    }
  }
  if (!bed.plants.includes(p)) {
    saveHistory();
    bed.plants.push(p);
    draw();
    notePlanChanged();
  }
  sel.value = '';
  switchTab('plant'); // re-render organizer to show new plant
}
