// ─── Plot photo + calibration ─────────────────────────────────────────────────
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('garden-planner', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('plots')) req.result.createObjectStore('plots');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(plotId, dataUrl) {
  if (!plotId || !dataUrl) return Promise.resolve();
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('plots', 'readwrite');
    tx.objectStore('plots').put(dataUrl, plotId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  })).catch(() => {});
}

function idbGet(plotId) {
  if (!plotId) return Promise.resolve(null);
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('plots', 'readonly');
    const req = tx.objectStore('plots').get(plotId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  })).catch(() => null);
}

function updateCalibReadout() {
  const el = document.getElementById('calibReadout');
  if (el) {
    if (!plotImage) el.textContent = 'No plot photo loaded.';
    else if (!(plot.feetPerPixel > 0)) el.textContent = 'Not calibrated. Draw a line and enter its length in feet.';
    else {
      const pxPerFt = 1 / plot.feetPerPixel;
      el.textContent = `Calibrated · 1 ft = ${pxPerFt.toFixed(1)} px · garden ${garden.width.toFixed(1)} × ${garden.height.toFixed(1)} ft`;
    }
  }
  const drawBtn = document.getElementById('tool-draw');
  const allowed = polygonDrawAllowed();
  if (drawBtn) drawBtn.disabled = !allowed;
  if (tool === 'draw-bed' && !allowed) {
    tool = 'select';
    draftPoints = [];
    draftCursor = null;
    syncToolButtons('select');
  }
}

function syncToolButtons(name) {
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === name);
  });
  document.dispatchEvent(new CustomEvent('toolchange', { detail: name }));
}

function setTool(name) {
  if (name === 'pan') name = 'select';
  if (name === 'calibrate' && !plotImage) {
    alert('Upload a plot photo first.');
    return;
  }
  if (name === 'draw-bed' && !polygonDrawAllowed()) {
    alert('This plan needs a scale before a bed can be plotted.');
    return;
  }
  tool = name;
  if (name !== 'draw-bed') { draftPoints = []; draftCursor = null; }
  if (name !== 'calibrate') { calibClicks = []; calibHover = null; calibDrag = null; }
  syncToolButtons(name);
  refreshCursor();
  draw();
}

function currentPlotPhoto() {
  return plotDataUrl || null;
}

function currentPlotId() {
  return plot.plotId || null;
}

function rememberPhotoUrl(url) {
  plot.photoUrl = url || null;
}

function blankPlot() {
  return { plotId: null, widthPx: 0, heightPx: 0, calibration: null, feetPerPixel: 0, photoUrl: null };
}

function restorePlotMeta(meta) {
  const prevId = plot.plotId;
  plot.plotId = meta.plotId || null;
  plot.widthPx = meta.widthPx || 0;
  plot.heightPx = meta.heightPx || 0;
  plot.calibration = meta.calibration ? { ...meta.calibration } : null;
  plot.feetPerPixel = meta.feetPerPixel || 0;
  plot.photoUrl = meta.photoUrl || null;
  if (plot.plotId !== prevId) {
    plotImage = null;
    plotDataUrl = null;
    if (plot.photoUrl) {
      adoptPlotDataUrl(plot.photoUrl, { preserveCalibration: true, keepId: true, quiet: true });
    } else if (plot.plotId) {
      idbGet(plot.plotId).then(url => {
        if (!visitOpen || !url) return;
        adoptPlotDataUrl(url, { preserveCalibration: true, keepId: true });
      });
    }
  }
}

function worldToImagePixel(wx, wy, doSnap) {
  const gw = ft(garden.width) || 1, gh = ft(garden.height) || 1;
  let ix = (wx / gw) * plot.widthPx;
  let iy = (wy / gh) * plot.heightPx;
  if (doSnap && plot.feetPerPixel > 0) {
    const fx = snap(ix * plot.feetPerPixel);
    const fy = snap(iy * plot.feetPerPixel);
    ix = fx / plot.feetPerPixel;
    iy = fy / plot.feetPerPixel;
  }
  return { x: ix, y: iy };
}

function imagePixelToWorld(ix, iy) {
  const gw = ft(garden.width), gh = ft(garden.height);
  return {
    x: plot.widthPx ? (ix / plot.widthPx) * gw : 0,
    y: plot.heightPx ? (iy / plot.heightPx) * gh : 0,
  };
}

function scaleWorld(ratio) {
  const scalePt = p => { p.x *= ratio; p.y *= ratio; };
  beds.forEach(b => {
    if (isPolygon(b)) {
      b.points.forEach(scalePt);
      if (b.pivot) scalePt(b.pivot);
      syncPolygonBounds(b);
    } else {
      b.x *= ratio;
      b.y *= ratio;
    }
  });
  obstacles.forEach(o => { o.x *= ratio; o.y *= ratio; });
}

function matchGardenToPhotoAspect() {
  if (!plot.widthPx || !plot.heightPx) return;
  const aspect = plot.widthPx / plot.heightPx;
  const longSide = Math.max(garden.width, garden.height, 10);
  if (aspect >= 1) {
    garden.width = longSide;
    garden.height = longSide / aspect;
  } else {
    garden.height = longSide;
    garden.width = longSide * aspect;
  }
}

function applyCalibration(cal) {
  const fpp = feetPerPixelFromLine(cal.x1, cal.y1, cal.x2, cal.y2, cal.lengthFt);
  if (!(fpp > 0) || !isFinite(fpp)) return false;
  const nextW = plot.widthPx * fpp, nextH = plot.heightPx * fpp;
  if (nextW > 500 || nextH > 500 || nextW < 1 || nextH < 1) return false;
  saveHistory();
  const old = plot.feetPerPixel;
  if (old > 0) scaleWorld(fpp / old);
  plot.calibration = { ...cal };
  plot.feetPerPixel = fpp;
  garden.width = plot.widthPx * fpp;
  garden.height = plot.heightPx * fpp;
  garden.scale = 'plan';
  garden.widthText = '';
  garden.heightText = '';
  updateCalibReadout();
  fitView();
  renderLists();
  if (selectedObj) syncPanel();
  draw();
  publishScale();
  return true;
}

function offerCalibLength(x1, y1, x2, y2) {
  pendingCalib = { x1, y1, x2, y2 };
  const previous = plot.calibration && plot.calibration.lengthFt ? String(plot.calibration.lengthFt) : '';
  document.dispatchEvent(new CustomEvent('calibline', {
    detail: { x1, y1, x2, y2, previous },
  }));
  draw();
}

function beginCalibration() {
  if (!plotImage) return false;
  setTool('calibrate');
  return true;
}

function submitCalibLength(raw) {
  const line = pendingCalib || (plot.calibration ? {
    x1: plot.calibration.x1,
    y1: plot.calibration.y1,
    x2: plot.calibration.x2,
    y2: plot.calibration.y2,
  } : null);
  if (!line) return false;
  const lengthFt = parseFloat(String(raw).trim());
  if (!(lengthFt > 0)) return false;
  const applied = applyCalibration({ ...line, lengthFt });
  if (applied) pendingCalib = null;
  return !!applied;
}

function handleCalibClick(wx, wy) {
  if (!plotImage || !plot.widthPx) return;
  const p = worldToImagePixel(wx, wy, plot.feetPerPixel > 0);
  calibClicks.push(p);
  if (calibClicks.length < 2) { draw(); return; }
  const [a, b] = calibClicks;
  const lenPx = lineLengthPx(a.x, a.y, b.x, b.y);
  calibClicks = [];
  calibHover = null;
  if (lenPx < 2) { draw(); return; }
  offerCalibLength(a.x, a.y, b.x, b.y);
}

function hitCalibEndpoint(wx, wy, radiusWorld) {
  const c = plot.calibration;
  if (!c || !plot.widthPx) return -1;
  const r = radiusWorld == null ? 12 / viewZoom : radiusWorld;
  const r2 = r * r;
  const pts = [imagePixelToWorld(c.x1, c.y1), imagePixelToWorld(c.x2, c.y2)];
  let best = -1, bestD = r2;
  pts.forEach((p, i) => {
    const d = (wx - p.x) ** 2 + (wy - p.y) ** 2;
    if (d <= bestD) { bestD = d; best = i; }
  });
  return best;
}

function beginCalibDrag(end, sx, sy) {
  const c = plot.calibration;
  if (!c) return;
  calibClicks = [];
  calibHover = null;
  const x = end === 0 ? c.x1 : c.x2;
  const y = end === 0 ? c.y1 : c.y2;
  calibDrag = { end, x, y, ox: x, oy: y, sx, sy, moved: false };
  refreshCursor();
  draw();
}

function moveCalibDrag(wpx, wpy, sx, sy) {
  if (!calibDrag) return;
  if (!calibDrag.moved) {
    const dx = sx - calibDrag.sx, dy = sy - calibDrag.sy;
    if (dx * dx + dy * dy < 16) return;
    calibDrag.moved = true;
  }
  const p = worldToImagePixel(wpx, wpy, plot.feetPerPixel > 0);
  calibDrag.x = p.x;
  calibDrag.y = p.y;
  draw();
}

function finishCalibDrag() {
  if (!calibDrag) return;
  const drag = calibDrag;
  calibDrag = null;
  const c = plot.calibration;
  if (!drag.moved || !c) { draw(); return; }
  const x1 = drag.end === 0 ? drag.x : c.x1;
  const y1 = drag.end === 0 ? drag.y : c.y1;
  const x2 = drag.end === 1 ? drag.x : c.x2;
  const y2 = drag.end === 1 ? drag.y : c.y2;
  if (lineLengthPx(x1, y1, x2, y2) < 2 || Math.hypot(drag.x - drag.ox, drag.y - drag.oy) < 0.5) {
    draw();
    return;
  }
  offerCalibLength(x1, y1, x2, y2);
}

function calibLineEnds() {
  const c = plot.calibration;
  const a = { x: c.x1, y: c.y1 };
  const b = { x: c.x2, y: c.y2 };
  if (calibDrag && calibDrag.moved) {
    if (calibDrag.end === 0) { a.x = calibDrag.x; a.y = calibDrag.y; }
    else { b.x = calibDrag.x; b.y = calibDrag.y; }
  }
  return [a, b];
}

function adoptPlotDataUrl(dataUrl, opts = {}) {
  const img = new Image();
  img.onload = () => {
    if (!visitOpen) return;
    const sameSize = plot.widthPx === img.naturalWidth && plot.heightPx === img.naturalHeight && plot.calibration;
    const keep = opts.preserveCalibration && sameSize;
    if (!keep) saveHistory();
    plotImage = img;
    plotDataUrl = dataUrl;
    plot.widthPx = img.naturalWidth;
    plot.heightPx = img.naturalHeight;
    if (!opts.keepId || !plot.plotId) plot.plotId = 'plot-' + Date.now();
    if (!keep) {
      if (opts.preserveCalibration && plot.calibration && !sameSize) {
        alert('The photo size does not match the saved calibration, so the scale was cleared. Calibrate again.');
      }
      plot.calibration = null;
      plot.feetPerPixel = 0;
      matchGardenToPhotoAspect();
    }
    idbPut(plot.plotId, dataUrl);
    updateCalibReadout();
    fitView();
    draw();
    notePlanChanged();
    document.dispatchEvent(new CustomEvent('plotimage'));
    if (!opts.quiet) document.dispatchEvent(new CustomEvent('plotphoto'));
  };
  img.src = dataUrl;
}

function uploadPlot() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (!visitOpen) return;
      const fillingGap = !plotImage && plot.calibration;
      adoptPlotDataUrl(ev.target.result, { preserveCalibration: fillingGap, keepId: fillingGap });
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function onDrawClick(wx, wy) {
  if (!polygonDrawAllowed()) return;
  const now = Date.now();
  const isDouble = now - lastDrawTap < 350;
  lastDrawTap = now;
  const f = pointerFeet(wx, wy);
  if (isDouble && draftPoints.length >= 3) {
    const last = draftPoints[draftPoints.length - 1];
    if (Math.hypot(f.x - last.x, f.y - last.y) < 0.75) {
      draftPoints.pop();
      if (draftPoints.length >= 3) { closeDraft(); return; }
    }
  }
  if (draftPoints.length >= 3) {
    const first = draftPoints[0];
    if (Math.hypot(ft(f.x) - ft(first.x), ft(f.y) - ft(first.y)) <= 14 / viewZoom) {
      closeDraft();
      return;
    }
  }
  draftPoints.push(f);
  draw();
}

function closeDraft() {
  if (draftPoints.length < 3) return;
  saveHistory();
  const id = takeStandInId();
  const color = BED_COLORS[colorIdx++ % BED_COLORS.length];
  const bed = {
    id, name: 'New Bed',
    shape: 'polygon',
    points: draftPoints.map(p => ({ x: p.x, y: p.y })),
    x: 0, y: 0, w: 1, h: 1,
    color, type: 'bed',
    plants: [], notes: '',
  };
  syncPolygonBounds(bed);
  beds.push(bed);
  draftPoints = [];
  draftCursor = null;
  setTool('select');
  renderLists();
  draw();
  select(id, 'bed');
}

function clampPolygonMove(bed, points, pivot, dx, dy) {
  const rotation = bed.rotation || 0;
  const base = points.map(point => {
    const placed = { x: point.x, y: point.y };
    return rotation ? rotatePoint(placed, pivot || polygonCentroid(points), rotation) : placed;
  });
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  base.forEach(point => {
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
  });
  if (minX + dx < 0) dx = -minX;
  if (minY + dy < 0) dy = -minY;
  if (maxX + dx > garden.width) dx = garden.width - maxX;
  if (maxY + dy > garden.height) dy = garden.height - maxY;
  return { dx, dy };
}

function polygonSummary(item) {
  let edgeNote = '';
  const n = item.points.length;
  if (selectedVertex >= 0 && selectedVertex < n) {
    const i = selectedVertex;
    const prev = item.points[(i - 1 + n) % n];
    const cur = item.points[i];
    const next = item.points[(i + 1) % n];
    const a = formatFeetInches(Math.hypot(cur.x - prev.x, cur.y - prev.y));
    const b = formatFeetInches(Math.hypot(next.x - cur.x, next.y - cur.y));
    edgeNote = ` · edges ${a} and ${b}`;
  }
  return {
    stats: `${bedArea(item).toFixed(1)} sq ft · ${item.points.length} corners${edgeNote}`,
    neighbor: neighborWarning(item) || '',
  };
}

function updatePolyPanel() {
  if (detailsOpen) publishDetails();
}

function drawCalibLine(a, b, label, activeEnd, showHandles) {
  const p1 = imagePixelToWorld(a.x, a.y);
  const p2 = imagePixelToWorld(b.x, b.y);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = '#ff9f0a';
  ctx.lineWidth = 2 / viewZoom;
  ctx.setLineDash([6 / viewZoom, 4 / viewZoom]);
  ctx.stroke();
  ctx.setLineDash([]);
  [p1, p2].forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, (i === activeEnd ? 7 : 5) / viewZoom, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9f0a';
    ctx.fill();
    if (showHandles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9 / viewZoom, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff9f0a';
      ctx.lineWidth = 1.5 / viewZoom;
      ctx.stroke();
    }
  });
  if (label) {
    ctx.fillStyle = '#7a3e00';
    ctx.font = `bold ${Math.round(12 / viewZoom)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(label, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 6 / viewZoom);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
}

function drawEdgeLengthBadge(a, b) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 0.05) return;
  const text = formatFeetInches(len);
  const mx = ft((a.x + b.x) / 2);
  const my = ft((a.y + b.y) / 2);
  ctx.font = `bold ${Math.round(13 / viewZoom)}px sans-serif`;
  const pad = 4 / viewZoom;
  const w = ctx.measureText(text).width + pad * 2;
  const h = 18 / viewZoom;
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillRect(mx - w / 2, my - h / 2, w, h);
  ctx.strokeStyle = '#7a3e00';
  ctx.lineWidth = 1 / viewZoom;
  ctx.strokeRect(mx - w / 2, my - h / 2, w, h);
  ctx.fillStyle = '#7a3e00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, mx, my);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawDraft() {
  if (draftPoints.length) {
    ctx.beginPath();
    draftPoints.forEach((p, i) => i ? ctx.lineTo(ft(p.x), ft(p.y)) : ctx.moveTo(ft(p.x), ft(p.y)));
    if (draftCursor) ctx.lineTo(ft(draftCursor.x), ft(draftCursor.y));
    ctx.strokeStyle = '#ff9f0a';
    ctx.lineWidth = 2 / viewZoom;
    ctx.setLineDash([4 / viewZoom, 3 / viewZoom]);
    ctx.stroke();
    ctx.setLineDash([]);
    draftPoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(ft(p.x), ft(p.y), 5 / viewZoom, 0, Math.PI * 2);
      ctx.fillStyle = '#ff9f0a';
      ctx.fill();
    });
    for (let i = 1; i < draftPoints.length; i++) {
      drawEdgeLengthBadge(draftPoints[i - 1], draftPoints[i]);
    }
    if (draftCursor) {
      drawEdgeLengthBadge(draftPoints[draftPoints.length - 1], draftCursor);
    }
  }
  if (plot.calibration && plot.widthPx) {
    const [a, b] = calibLineEnds();
    const draggingEnd = calibDrag && calibDrag.moved;
    drawCalibLine(
      a, b,
      `${plot.calibration.lengthFt} ft`,
      draggingEnd ? calibDrag.end : -1,
      tool === 'calibrate' && calibClicks.length === 0
    );
  }
  if (calibClicks.length === 1 && calibHover) drawCalibLine(calibClicks[0], calibHover, '');
  else if (calibClicks.length === 1) {
    const p = imagePixelToWorld(calibClicks[0].x, calibClicks[0].y);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 / viewZoom, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9f0a';
    ctx.fill();
  }
}
