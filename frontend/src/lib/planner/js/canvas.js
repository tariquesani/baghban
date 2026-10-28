// ─── Canvas setup ────────────────────────────────────────────────────────────
const canvas = document.getElementById('gardenCanvas');
const ctx    = canvas.getContext('2d');
function initCanvas() {
  const area = canvas.parentElement;
  canvas.width  = area.clientWidth  || 800;
  canvas.height = area.clientHeight || 600;
  fitView();
  draw();
  refreshCursor();
}

function fitView() {
  const margin = 30;
  const scaleX = (canvas.width  - margin * 2) / ft(garden.width);
  const scaleY = (canvas.height - margin * 2) / ft(garden.height);
  viewZoom = Math.min(scaleX, scaleY);
  viewX = (canvas.width  - ft(garden.width)  * viewZoom) / 2;
  viewY = (canvas.height - ft(garden.height) * viewZoom) / 2;
}

function adjustZoom(factor) {
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const newZoom = Math.min(4, Math.max(0.1, viewZoom * factor));
  viewX = cx - (cx - viewX) * (newZoom / viewZoom);
  viewY = cy - (cy - viewY) * (newZoom / viewZoom);
  viewZoom = newZoom;
  draw();
}
// ─── Draw ─────────────────────────────────────────────────────────────────────
function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Area outside the garden
  ctx.fillStyle = '#f0f4f0';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(viewX, viewY);
  ctx.scale(viewZoom, viewZoom);

  const GW = ft(garden.width), GH = ft(garden.height);

  // Garden background, with the plot photo underneath when one is loaded
  if (plotImage) {
    ctx.drawImage(plotImage, 0, 0, GW, GH);
  } else {
    ctx.fillStyle = '#dff0d8';
    ctx.fillRect(0, 0, GW, GH);
  }

  // Grid lines
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= garden.width; x++) {
    ctx.strokeStyle = x % 5 === 0 ? '#a8c8a8' : '#c8e0c0';
    ctx.beginPath(); ctx.moveTo(ft(x), 0); ctx.lineTo(ft(x), GH); ctx.stroke();
  }
  for (let y = 0; y <= garden.height; y++) {
    ctx.strokeStyle = y % 5 === 0 ? '#a8c8a8' : '#c8e0c0';
    ctx.beginPath(); ctx.moveTo(0, ft(y)); ctx.lineTo(GW, ft(y)); ctx.stroke();
  }

  // Foot labels
  ctx.fillStyle = '#7aaa7a'; ctx.font = '9px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let x = 1; x < garden.width; x += (garden.width > 30 ? 5 : 2))
    ctx.fillText(x, ft(x), 2);
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let y = 1; y < garden.height; y += (garden.height > 30 ? 5 : 2))
    ctx.fillText(y, GW - 3, ft(y));
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

  // Draw obstacles (back layer)
  obstacles.forEach(o => drawObstacle(o));

  // Draw beds (front layer)
  beds.forEach(b => drawBed(b));

  // Garden border
  ctx.strokeStyle = '#2d6a30'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, GW, GH);

  drawDraft();

  ctx.restore();
}

function drawObstacle(o) {
  const ox = ft(o.x), oy = ft(o.y), w = ft(o.w), h = ft(o.h);
  const cx = ox + w/2, cy = oy + h/2;
  const rot = o.rotation || 0;
  const sel = o.id === selectedId;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.translate(-w/2, -h/2);
  const x = 0, y = 0;

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = o.color;
  roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = sel ? '#ff9f0a' : 'rgba(0,0,0,0.25)';
  ctx.lineWidth   = sel ? 2.5 : 1;
  roundRect(x, y, w, h, 4); ctx.stroke();

  // label
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${clamp(10, 13, w / 5)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  wrapText(o.name, x + w/2, y + h/2, w - 8, 14);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.restore();

  // Rotation handle
  if (sel) {
    const handleDist = 22 / viewZoom;
    const handleR    = 7  / viewZoom;
    const sin = Math.sin(rot), cos = Math.cos(rot);
    const topCX = cx + (h/2) * sin;
    const topCY = cy - (h/2) * cos;
    const hx = topCX + handleDist * sin;
    const hy = topCY - handleDist * cos;
    ctx.beginPath();
    ctx.moveTo(topCX, topCY);
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = '#ff9f0a';
    ctx.lineWidth = 1.5 / viewZoom;
    ctx.setLineDash([3 / viewZoom, 2 / viewZoom]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(hx, hy, handleR, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9f0a';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 / viewZoom;
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.font = `bold ${Math.round(9 / viewZoom)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('↻', hx, hy);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
}

function drawTurnHandle(fromX, fromY, hx, hy) {
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(hx, hy);
  ctx.strokeStyle = '#ff9f0a';
  ctx.lineWidth = 1.5 / viewZoom;
  ctx.setLineDash([3 / viewZoom, 2 / viewZoom]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(hx, hy, 7 / viewZoom, 0, Math.PI * 2);
  ctx.fillStyle = '#ff9f0a';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1 / viewZoom;
  ctx.stroke();
  ctx.fillStyle = '#333';
  ctx.font = `bold ${Math.round(9 / viewZoom)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('↻', hx, hy);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function polygonTurnHandle(bed) {
  const rot = bed.rotation || 0;
  const top = rotatePoint({ x: bed.x + bed.w / 2, y: bed.y }, polygonPivot(bed), rot);
  const dist = (22 / viewZoom) / SCALE;
  return {
    x: top.x + Math.sin(rot) * dist,
    y: top.y - Math.cos(rot) * dist,
    fromX: top.x,
    fromY: top.y,
  };
}

function drawPolygonTurnHandle(bed) {
  const handle = polygonTurnHandle(bed);
  drawTurnHandle(ft(handle.fromX), ft(handle.fromY), ft(handle.x), ft(handle.y));
}

function hitPolygonRotateHandle(wx, wy, bed) {
  const handle = polygonTurnHandle(bed);
  const dx = wx - ft(handle.x), dy = wy - ft(handle.y);
  return dx * dx + dy * dy <= (10 / viewZoom) ** 2;
}

function hitPolygonVertex(bed, wx, wy, radiusWorld) {
  const local = polygonLocalFeet(bed, wx / SCALE, wy / SCALE);
  return hitVertex(ft(local.x), ft(local.y), bed.points, radiusWorld);
}

function polygonFitsGarden(bed, rotation) {
  const previous = bed.rotation;
  bed.rotation = rotation;
  const fits = polygonWorldPoints(bed).every(point =>
    point.x >= -0.01 && point.y >= -0.01 && point.x <= garden.width + 0.01 && point.y <= garden.height + 0.01);
  bed.rotation = previous;
  return fits;
}

function rotationInsideGarden(bed, target, fallback) {
  if (polygonFitsGarden(bed, target)) return target;
  if (!polygonFitsGarden(bed, fallback)) return fallback;
  let near = fallback, far = target;
  for (let step = 0; step < 12; step++) {
    const mid = (near + far) / 2;
    if (polygonFitsGarden(bed, mid)) near = mid;
    else far = mid;
  }
  return near;
}

function drawPolygonBed(b) {
  const sel = b.id === selectedId;
  const pivot = polygonPivot(b);
  const rot = b.rotation || 0;
  ctx.save();
  ctx.translate(ft(pivot.x), ft(pivot.y));
  ctx.rotate(rot);
  ctx.translate(-ft(pivot.x), -ft(pivot.y));
  const pts = b.points.map(p => ({ x: ft(p.x), y: ft(p.y) }));
  const path = () => {
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
  };

  ctx.save();
  ctx.shadowColor = sel ? 'rgba(255,159,10,0.4)' : 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = sel ? 12 : 5;
  ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
  ctx.fillStyle = b.color;
  path(); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  ctx.strokeStyle = sel ? '#ff9f0a' : 'rgba(0,0,0,0.28)';
  ctx.lineWidth = sel ? 3 : 1.5;
  path(); ctx.stroke();

  ctx.save();
  path(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  const x0 = ft(b.x), y0 = ft(b.y);
  for (let col = 1; col < b.w; col++) {
    const lx = x0 + ft(col);
    ctx.moveTo(lx, y0); ctx.lineTo(lx, y0 + ft(b.h));
  }
  for (let row = 1; row < b.h; row++) {
    const ly = y0 + ft(row);
    ctx.moveTo(x0, ly); ctx.lineTo(x0 + ft(b.w), ly);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  if (!b.plantGrid && b.plants?.length) initPlantGrid(b);
  if (b.plantGrid) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    b.plantGrid.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (!cell || cell.occupied) return;
        if (!polygonCellInside(b, ri, ci)) return;
        const emoji = typeof cell === 'string' ? cell : cell.emoji;
        if (!emoji) return;
        const rSpan = cell.rowSpan || 1;
        const cSpan = cell.colSpan || 1;
        const ex = x0 + ft(ci) + ft(cSpan) / 2;
        const ey = y0 + ft(ri) + ft(rSpan) / 2;
        const fs = clamp(10, Math.round(SCALE * Math.min(rSpan, cSpan) * 0.58), 36);
        ctx.font = `${fs}px sans-serif`;
        ctx.globalAlpha = 0.92;
        ctx.fillText(emoji, ex, ey);
        ctx.globalAlpha = 1;
      });
    });
  }
  ctx.restore();

  const label = polygonLabelPoint(b.points);
  const area = bedArea(b);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${clamp(10, 13, ft(Math.min(b.w, b.h)) / 5)}px sans-serif`;
  ctx.fillText(b.name, ft(label.x), ft(label.y) - 8);
  ctx.font = `${clamp(9, 11, ft(Math.min(b.w, b.h)) / 6)}px sans-serif`;
  ctx.globalAlpha = 0.85;
  ctx.fillText(`${area.toFixed(1)} sq ft`, ft(label.x), ft(label.y) + 8);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.restore();

  if (sel) {
    pts.forEach((p, i) => {
      const active = i === selectedVertex;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (active ? 8 : 6) / viewZoom, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#fff' : '#ff9f0a';
      ctx.fill();
      ctx.strokeStyle = active ? '#ff9f0a' : '#fff';
      ctx.lineWidth = (active ? 2 : 1) / viewZoom;
      ctx.stroke();
    });
    drawVertexEdgeLabels(b);
  }
  ctx.restore();
  if (sel) drawPolygonTurnHandle(b);
}

function drawVertexEdgeLabels(b) {
  const n = b.points.length;
  if (selectedVertex < 0 || selectedVertex >= n) return;
  const i = selectedVertex;
  const prev = b.points[(i - 1 + n) % n];
  const cur = b.points[i];
  const next = b.points[(i + 1) % n];
  [ [prev, cur], [cur, next] ].forEach(([a, c]) => {
    ctx.beginPath();
    ctx.moveTo(ft(a.x), ft(a.y));
    ctx.lineTo(ft(c.x), ft(c.y));
    ctx.strokeStyle = '#1f2933';
    ctx.lineWidth = 3 / viewZoom;
    ctx.stroke();
    const text = formatFeetInches(Math.hypot(c.x - a.x, c.y - a.y));
    const mx = ft((a.x + c.x) / 2);
    const my = ft((a.y + c.y) / 2);
    ctx.font = `bold ${Math.round(13 / viewZoom)}px sans-serif`;
    const pad = 4 / viewZoom;
    const w = ctx.measureText(text).width + pad * 2;
    const h = 18 / viewZoom;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.fillRect(mx - w / 2, my - h / 2, w, h);
    ctx.strokeStyle = '#1f2933';
    ctx.lineWidth = 1 / viewZoom;
    ctx.strokeRect(mx - w / 2, my - h / 2, w, h);
    ctx.fillStyle = '#1f2933';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, mx, my);
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawBed(b) {
  if (isPolygon(b)) { drawPolygonBed(b); return; }
  const bx = ft(b.x), by = ft(b.y), w = ft(b.w), h = ft(b.h);
  const cx = bx + w/2, cy = by + h/2;
  const rot = b.rotation || 0;
  const sel = b.id === selectedId;
  const isPot     = b.type === 'pot';
  const isPlanter = b.type === 'planter';

  // Apply rotation transform around bed center
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.translate(-w/2, -h/2);
  const x = 0, y = 0; // local origin = bed top-left

  // Shadow
  ctx.shadowColor = sel ? 'rgba(255,159,10,0.4)' : 'rgba(0,0,0,0.18)';
  ctx.shadowBlur  = sel ? 12 : 5;
  ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;

  ctx.fillStyle = b.color;
  roundRect(x, y, w, h, 5); ctx.fill();

  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  if (isPot) {
    const r  = ft(b.diam) / 2;
    const potCx = x + r, potCy = y + r;
    // Shadow
    ctx.shadowColor = sel ? 'rgba(255,159,10,0.4)' : 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = sel ? 12 : 5;
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(potCx, potCy, r, 0, Math.PI*2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    // Inner rim ring
    ctx.beginPath(); ctx.arc(potCx, potCy, r * 0.82, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2; ctx.stroke();
    // Selection ring
    if (sel) {
      ctx.beginPath(); ctx.arc(potCx, potCy, r + 3, 0, Math.PI*2);
      ctx.strokeStyle = '#ff9f0a'; ctx.lineWidth = 3; ctx.stroke();
    }
    // Name + diameter labels
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const hasPlants = b.plants && b.plants.length;
    ctx.font = `bold ${clamp(9, 12, r / 2)}px sans-serif`;
    ctx.fillText(b.name, potCx, hasPlants ? potCy - r * 0.45 : potCy - r * 0.18);
    ctx.font = `${clamp(8, 10, r / 3)}px sans-serif`;
    ctx.globalAlpha = 0.75;
    ctx.fillText(`${b.diam * 12}"`, potCx, hasPlants ? potCy - r * 0.18 : potCy + r * 0.32);
    ctx.globalAlpha = 1;
    // Plant emojis (up to 2 inside the circle)
    if (hasPlants && r > 20) {
      ctx.font = `${clamp(9, 11, r / 3)}px sans-serif`;
      b.plants.slice(0, 2).forEach((p, i) => {
        ctx.globalAlpha = 0.88;
        ctx.fillText(p, potCx, potCy + r * 0.2 + i * 14);
      });
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.restore();
    return;
  }

  if (isPlanter) {
    const inset = Math.max(3, Math.min(w, h) * 0.12);
    roundRect(x + inset, y + inset, Math.max(1, w - inset * 2), Math.max(1, h - inset * 2), 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(1.5, inset * 0.35);
    ctx.stroke();
    if (sel) {
      ctx.strokeStyle = '#ff9f0a'; ctx.lineWidth = 3;
      roundRect(x, y, w, h, 5); ctx.stroke();
    }
  } else if (sel) {
    ctx.strokeStyle = '#ff9f0a'; ctx.lineWidth = 3;
    roundRect(x, y, w, h, 5); ctx.stroke();
  }

  // Square-foot grid lines (beds only — not pots or planters)
  if (!isPot && !isPlanter) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    for (let col = 1; col < b.w; col++) {
      const lx = x + ft(col);
      ctx.moveTo(lx, y); ctx.lineTo(lx, y + h);
    }
    for (let row = 1; row < b.h; row++) {
      const ly = y + ft(row);
      ctx.moveTo(x, ly); ctx.lineTo(x + w, ly);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Plant emojis from grid — draw first so name label sits on top
  if (!isPlanter && !b.plantGrid && b.plants?.length) initPlantGrid(b);
  if (!isPlanter && b.plantGrid) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    b.plantGrid.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (!cell || cell.occupied) return;
        const emoji = typeof cell === 'string' ? cell : cell.emoji;
        if (!emoji) return;
        const rSpan    = cell.rowSpan  || 1;
        const cSpan    = cell.colSpan  || 1;
        const perSqft  = cell.perSqft  || 1;
        const ex = x + ft(ci) + ft(cSpan) / 2;
        const ey = y + ft(ri) + ft(rSpan) / 2;
        const fs = clamp(10, Math.round(SCALE * Math.min(rSpan, cSpan) * 0.58), 36);
        ctx.font = `${fs}px sans-serif`;
        ctx.globalAlpha = 0.92;
        ctx.fillText(emoji, ex, ey);
        // Dense plants: draw ×N count badge in bottom-right of cell
        if (perSqft > 1) {
          const badgeFs = clamp(7, Math.round(SCALE * 0.26), 12);
          ctx.font = `bold ${badgeFs}px sans-serif`;
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = 0.85;
          ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
          ctx.fillText(`×${perSqft}`, x + ft(ci) + ft(cSpan) - 2, y + ft(ri) + ft(rSpan) - 1);
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
        }
      });
    });
    ctx.globalAlpha = 1;
  }

  if (isPlanter) {
    const lenIn = Math.round(b.w * 12);
    const widIn = Math.round(b.h * 12);
    const icons = (b.plants || []).slice(0, 2)
      .map(p => PLANT_DATA[p] && PLANT_DATA[p].emoji)
      .filter(Boolean);
    const shortSide = Math.min(w, h);
    const nameFs = clamp(8, 13, shortSide / 3.2);
    const sizeFs = clamp(7, 11, shortSide / 4.5);
    const sizeLabel = `${lenIn}×${widIn}"`;

    ctx.save();
    roundRect(x, y, w, h, 5);
    ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';

    if (!icons.length) {
      ctx.textAlign = 'center';
      ctx.font = `bold ${nameFs}px sans-serif`;
      ctx.fillText(b.name, x + w / 2, y + h / 2 - 5);
      ctx.font = `${sizeFs}px sans-serif`;
      ctx.globalAlpha = 0.8;
      ctx.fillText(sizeLabel, x + w / 2, y + h / 2 + 8);
      ctx.globalAlpha = 1;
    } else if (w >= h + 8) {
      const pad = 6;
      ctx.font = `bold ${nameFs}px sans-serif`;
      const nameW = ctx.measureText(b.name).width;
      ctx.font = `${sizeFs}px sans-serif`;
      const sizeW = ctx.measureText(sizeLabel).width;
      const labelW = Math.max(nameW, sizeW);
      ctx.textAlign = 'left';
      ctx.font = `bold ${nameFs}px sans-serif`;
      ctx.fillText(b.name, x + pad, y + h * 0.38);
      ctx.font = `${sizeFs}px sans-serif`;
      ctx.globalAlpha = 0.8;
      ctx.fillText(sizeLabel, x + pad, y + h * 0.72);
      ctx.globalAlpha = 1;

      const emojiFs = clamp(12, Math.round(shortSide * 0.62), 28);
      const gap = emojiFs * 1.05;
      const iconSpan = (icons.length - 1) * gap;
      const areaLeft = x + pad + labelW + 8;
      const areaRight = x + w - 6;
      const cxIcons = (areaLeft + areaRight) / 2;
      ctx.font = `${emojiFs}px sans-serif`;
      ctx.textAlign = 'center';
      icons.forEach((emoji, i) => {
        ctx.globalAlpha = 0.95;
        ctx.fillText(emoji, cxIcons - iconSpan / 2 + i * gap, y + h / 2);
      });
      ctx.globalAlpha = 1;
    } else {
      const emojiFs = clamp(12, Math.round(shortSide * 0.5), 28);
      const gap = emojiFs * 1.05;
      const iconSpan = (icons.length - 1) * gap;
      ctx.textAlign = 'center';
      ctx.font = `${emojiFs}px sans-serif`;
      icons.forEach((emoji, i) => {
        ctx.globalAlpha = 0.95;
        ctx.fillText(emoji, x + w / 2 - iconSpan / 2 + i * gap, y + h * 0.32);
      });
      ctx.globalAlpha = 1;
      ctx.font = `bold ${nameFs}px sans-serif`;
      ctx.fillText(b.name, x + w / 2, y + h * 0.68);
      ctx.font = `${sizeFs}px sans-serif`;
      ctx.globalAlpha = 0.8;
      ctx.fillText(sizeLabel, x + w / 2, y + h * 0.86);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // Name label backdrop strip
  if (!isPlanter) {
  const hasGrid = b.plantGrid && b.plants && b.plants.length;
  const dimLabel = `${b.w}×${b.h} · ${b.w*b.h} sqft`;
  if (hasGrid) {
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(x, y, w, 36);
  }

  // Bed name
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${clamp(10, 13, w / 5)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(b.name, x + w/2, y + (hasGrid ? 3 : 7));

  // Dimensions sub-label — always shown
  ctx.font = `${clamp(9, 11, w/6)}px sans-serif`;
  ctx.globalAlpha = 0.8;
  ctx.fillText(dimLabel, x + w/2, y + (hasGrid ? 18 : 22));
  ctx.globalAlpha = 1;

  if (!hasGrid) {
    // Plant name fallback (before organizer is opened)
    if (b.plants && b.plants.length && h > 70) {
      ctx.font = `${clamp(9, 11, w/6)}px sans-serif`;
      b.plants.slice(0, 4).forEach((p, i) => {
        ctx.globalAlpha = 0.88;
        ctx.fillText(p, x + w/2, y + 38 + i * 14);
      });
      ctx.globalAlpha = 1;
    }
  }
  }

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.restore(); // end rotation transform

  if (sel) {
    const handleDist = 22 / viewZoom;
    const sin = Math.sin(rot), cos = Math.cos(rot);
    const topCX = cx + (h/2) * sin;
    const topCY = cy - (h/2) * cos;
    drawTurnHandle(topCX, topCY, topCX + handleDist * sin, topCY - handleDist * cos);
  }
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(text, cx, cy, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  words.forEach(w => {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  });
  lines.push(line);
  const startY = cy - ((lines.length - 1) * lineH) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineH));
}

function clamp(min, max, val) { return Math.min(max, Math.max(min, val)); }

// ─── Hit test ────────────────────────────────────────────────────────────────
function applyDragRotation(pointerX, pointerY, shiftKey) {
  const selItem = beds.find(b => b.id === selectedId) || obstacles.find(o => o.id === selectedId);
  if (!selItem) return;
  const polygon = isPolygon(selItem);
  const cen = polygon
    ? { x: ft(polygonPivot(selItem).x), y: ft(polygonPivot(selItem).y) }
    : { x: ft(selItem.x) + ft(selItem.w) / 2, y: ft(selItem.y) + ft(selItem.h) / 2 };
  const angle = Math.atan2(pointerX - cen.x, -(pointerY - cen.y));
  let newRot = rotateStartRot + (angle - rotateStartAngle);
  if (shiftKey) newRot = Math.round(newRot / (Math.PI / 12)) * (Math.PI / 12);
  if (polygon) newRot = rotationInsideGarden(selItem, newRot, rotateStartRot);
  selItem.rotation = newRot;
  syncRotationField();
  if (!polygon) syncPositionFields();
  draw();
}

function beginRotate(item, pointerX, pointerY) {
  saveHistory();
  if (isPolygon(item)) lockPolygonPivot(item);
  isRotating = true;
  const cen = isPolygon(item)
    ? { x: ft(polygonPivot(item).x), y: ft(polygonPivot(item).y) }
    : { x: ft(item.x) + ft(item.w) / 2, y: ft(item.y) + ft(item.h) / 2 };
  rotateStartAngle = Math.atan2(pointerX - cen.x, -(pointerY - cen.y));
  rotateStartRot = item.rotation || 0;
}

function movePolygonVertex(bed, index, pointerX, pointerY) {
  const local = polygonLocalFeet(bed, pointerX / SCALE, pointerY / SCALE);
  const next = (bed.rotation || 0)
    ? { x: snap(local.x), y: snap(local.y) }
    : pointerFeet(pointerX, pointerY);
  const previous = bed.points[index];
  bed.points[index] = next;
  syncPolygonBounds(bed);
  if ((bed.rotation || 0) && !polygonFitsGarden(bed, bed.rotation)) {
    bed.points[index] = previous;
    syncPolygonBounds(bed);
  }
}

function hitRotateHandle(px, py, item) {
  const w = ft(item.w), h = ft(item.h);
  const cx = ft(item.x) + w/2, cy = ft(item.y) + h/2;
  const rot = item.rotation || 0;
  const handleDist = 22 / viewZoom;
  const hx = cx + (h/2 + handleDist) * Math.sin(rot);
  const hy = cy - (h/2 + handleDist) * Math.cos(rot);
  return Math.sqrt((px - hx)**2 + (py - hy)**2) <= 10 / viewZoom;
}

function hitTest(wx, wy) {
  function inRotated(item) {
    const w = ft(item.w), h = ft(item.h);
    const cx = ft(item.x) + w/2, cy = ft(item.y) + h/2;
    const rot = -(item.rotation || 0);
    const dx = wx - cx, dy = wy - cy;
    const lx = dx * Math.cos(rot) - dy * Math.sin(rot);
    const ly = dx * Math.sin(rot) + dy * Math.cos(rot);
    return lx >= -w/2 && lx <= w/2 && ly >= -h/2 && ly <= h/2;
  }
  for (let i = beds.length - 1; i >= 0; i--) {
    const b = beds[i];
    if (isPolygon(b)) {
      const local = polygonLocalFeet(b, wx / SCALE, wy / SCALE);
      if (pointInPolygon(local.x, local.y, b.points)) return { type:'bed', item:b };
    } else if (inRotated(b)) return { type:'bed', item:b };
  }
  for (let i = obstacles.length - 1; i >= 0; i--)
    if (inRotated(obstacles[i])) return { type:'obstacle', item:obstacles[i] };
  return null;
}

// ─── Pointer cursor ───────────────────────────────────────────────────────────
// Open hand on empty ground, move arrows on an object, the arrow pointer on a
// corner or the rotation handle, and a closed hand while panning, dragging a corner, or turning.
let pointerWorld = null;
let spacePan = false;

function rememberPointer(event) {
  const bounds = canvas.getBoundingClientRect();
  pointerWorld = screenToWorld(event.clientX - bounds.left, event.clientY - bounds.top);
}

function pointerCursor() {
  if (spacePan) return 'grab';
  if (tool === 'draw-bed') return 'crosshair';
  if (tool === 'calibrate') {
    if (pointerWorld && calibClicks.length === 0 && hitCalibEndpoint(pointerWorld.x, pointerWorld.y) >= 0) return 'grab';
    return 'crosshair';
  }
  if (!pointerWorld) return 'grab';
  const wpx = pointerWorld.x, wpy = pointerWorld.y;
  const selItem = selectedId && (beds.find(b => b.id === selectedId) || obstacles.find(o => o.id === selectedId));
  if (selItem && isPolygon(selItem)) {
    if (hitPolygonRotateHandle(wpx, wpy, selItem)) return 'default';
    if (hitPolygonVertex(selItem, wpx, wpy, 12 / viewZoom) >= 0) return 'default';
  }
  if (selItem && !isPolygon(selItem) && selItem.type !== 'pot' && hitRotateHandle(wpx, wpy, selItem)) return 'default';
  const hit = hitTest(wpx, wpy);
  if (hit && isPolygon(hit.item) && hitPolygonVertex(hit.item, wpx, wpy, 12 / viewZoom) >= 0) return 'default';
  if (hit) return 'move';
  return 'grab';
}

function refreshCursor() {
  if (calibDrag || isPanning) canvas.style.cursor = 'grabbing';
  else if (isRotating) canvas.style.cursor = 'grabbing';
  else if (dragging && dragMode === 'vertex') canvas.style.cursor = 'grabbing';
  else if (dragging) canvas.style.cursor = 'move';
  else canvas.style.cursor = pointerCursor();
}

function typingInField() {
  const element = document.activeElement;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
}

function holdSpace(event) {
  if (typingInField() || document.querySelector('.modal-overlay')) return;
  event.preventDefault();
  if (event.repeat || spacePan) return;
  spacePan = true;
  refreshCursor();
}

function releaseSpace() {
  if (!spacePan) return;
  spacePan = false;
  refreshCursor();
}

function finishPointerGesture(event) {
  if (calibDrag) finishCalibDrag();
  if (isRotating) isRotating = false;
  if (dragging && isPolygon(dragging) && dragMode === 'vertex') dragging.plantGrid = null;
  dragging = null;
  dragMode = null;
  dragVertex = -1;
  if (selectedId && beds.some(b => b.id === selectedId && isPolygon(b))) updatePolyPanel();
  dragOriginPoints = null;
  dragOriginPivot = null;
  isPanning = false;
  if (event) rememberPointer(event);
  refreshCursor();
  renderLists();
  draw();
}

// ─── Mouse events ─────────────────────────────────────────────────────────────
canvas.addEventListener('mousedown', e => {
  if (e.button === 2) return;
  rememberPointer(e);
  const r  = canvas.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  const { x: wpx, y: wpy } = screenToWorld(sx, sy);

  if (e.button === 1 || spacePan) {
    if (e.button === 1) e.preventDefault();
    isPanning = true;
    panStart  = { x: sx - viewX, y: sy - viewY };
    refreshCursor();
    return;
  }
  if (tool === 'calibrate') {
    if (calibClicks.length === 0) {
      const end = hitCalibEndpoint(wpx, wpy);
      if (end >= 0) { beginCalibDrag(end, sx, sy); return; }
    }
    handleCalibClick(wpx, wpy);
    return;
  }
  if (tool === 'draw-bed') { onDrawClick(wpx, wpy); return; }

  // Check rotation handle of selected item first
  const selItem = selectedId && (beds.find(b => b.id === selectedId) || obstacles.find(o => o.id === selectedId));
  if (selItem && isPolygon(selItem) && hitPolygonRotateHandle(wpx, wpy, selItem)) {
    beginRotate(selItem, wpx, wpy);
    refreshCursor();
    return;
  }
  if (selItem && isPolygon(selItem)) {
    const vi = hitPolygonVertex(selItem, wpx, wpy, 12 / viewZoom);
    if (vi >= 0) {
      saveHistory();
      dragging = selItem;
      dragMode = 'vertex';
      dragVertex = vi;
      selectedVertex = vi;
      refreshCursor();
      updatePolyPanel();
      draw();
      return;
    }
  }
  if (selItem && !isPolygon(selItem) && selItem.type !== 'pot' && hitRotateHandle(wpx, wpy, selItem)) {
    beginRotate(selItem, wpx, wpy);
    refreshCursor();
    return;
  }

  const hit = hitTest(wpx, wpy);
  if (hit) {
    saveHistory();
    select(hit.item.id, hit.type);
    dragging = hit.item;
    if (isPolygon(hit.item)) {
      const vi = hitPolygonVertex(hit.item, wpx, wpy, 12 / viewZoom);
      if (vi >= 0) {
        dragMode = 'vertex';
        dragVertex = vi;
        selectedVertex = vi;
      } else {
        dragMode = 'move';
        selectedVertex = -1;
        dragOriginPoints = hit.item.points.map(p => ({ x: p.x, y: p.y }));
        dragOriginPivot = hit.item.pivot ? { x: hit.item.pivot.x, y: hit.item.pivot.y } : null;
        dragStartFeet = { x: snap(wpx / SCALE), y: snap(wpy / SCALE) };
      }
    } else {
      dragMode = 'item';
      dragOff  = { x: wpx - ft(hit.item.x), y: wpy - ft(hit.item.y) };
    }
  } else {
    select(null);
    isPanning = true;
    panStart  = { x: sx - viewX, y: sy - viewY };
  }
  refreshCursor();
});

canvas.addEventListener('mousemove', e => {
  rememberPointer(e);
  const r  = canvas.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  const { x: wpx, y: wpy } = screenToWorld(sx, sy);

  if (calibDrag) {
    refreshCursor();
    return;
  }
  if (isRotating) {
    applyDragRotation(wpx, wpy, e.shiftKey);
  } else if (dragging && isPolygon(dragging)) {
    if (dragMode === 'vertex') {
      movePolygonVertex(dragging, dragVertex, wpx, wpy);
    } else if (dragOriginPoints) {
      const rawDx = snap(wpx / SCALE) - dragStartFeet.x;
      const rawDy = snap(wpy / SCALE) - dragStartFeet.y;
      const { dx, dy } = clampPolygonMove(dragging, dragOriginPoints, dragOriginPivot, rawDx, rawDy);
      dragging.points = dragOriginPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
      if (dragOriginPivot) dragging.pivot = { x: dragOriginPivot.x + dx, y: dragOriginPivot.y + dy };
      syncPolygonBounds(dragging);
    }
    updatePolyPanel();
    draw();
  } else if (dragging) {
    // Compute AABB of the rotated item so clamping uses its visual footprint
    const rot = dragging.rotation || 0;
    const ac = Math.abs(Math.cos(rot)), as = Math.abs(Math.sin(rot));
    const aabbHalfW = (dragging.w / 2) * ac + (dragging.h / 2) * as;
    const aabbHalfH = (dragging.w / 2) * as + (dragging.h / 2) * ac;
    const minX = aabbHalfW - dragging.w / 2;
    const maxX = garden.width  - aabbHalfW - dragging.w / 2;
    const minY = aabbHalfH - dragging.h / 2;
    const maxY = garden.height - aabbHalfH - dragging.h / 2;
    dragging.x = snap(Math.max(minX, Math.min(px(wpx - dragOff.x), maxX)));
    dragging.y = snap(Math.max(minY, Math.min(px(wpy - dragOff.y), maxY)));
    syncPositionFields();
    draw();
  } else if (isPanning) {
    viewX = sx - panStart.x;
    viewY = sy - panStart.y;
    draw();
  } else if (tool === 'draw-bed') {
    draftCursor = pointerFeet(wpx, wpy);
    draw();
  } else if (tool === 'calibrate') {
    if (plotImage && plot.widthPx) calibHover = worldToImagePixel(wpx, wpy, plot.feetPerPixel > 0);
    if (calibClicks.length === 1) draw();
  }
  refreshCursor();
});

document.addEventListener('mousemove', e => {
  if (!calibDrag) return;
  const r = canvas.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  const { x: wpx, y: wpy } = screenToWorld(sx, sy);
  rememberPointer(e);
  moveCalibDrag(wpx, wpy, sx, sy);
  refreshCursor();
});

document.addEventListener('mouseup', e => {
  if (e.target === canvas) return;
  if (!calibDrag && !isPanning && !dragging && !isRotating) return;
  finishPointerGesture(e);
});

canvas.addEventListener('mouseup', e => finishPointerGesture(e));

// Touch support:
//  • 1 finger on item  → tap = select, drag = move item
//  • 1 finger on empty → pan the view
//  • 2 fingers          → pinch-zoom + pan
{
  let touchHit      = null;
  let touchStart    = null;
  let touchMoved    = false;
  let pinchDist     = null;
  let lastTapId     = null;   // for double-tap detection
  let lastTapTime   = 0;
  let pinchMid      = null;

  function getTouchDist(t) {
    const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }
  function getTouchMid(t, r) {
    return { x: (t[0].clientX + t[1].clientX) / 2 - r.left,
             y: (t[0].clientY + t[1].clientY) / 2 - r.top };
  }

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();

    if (e.touches.length === 2) {
      // Begin pinch — cancel any ongoing item drag
      if (calibDrag) { calibDrag = null; draw(); }
      dragging = null; isPanning = false; touchHit = null;
      pinchDist = getTouchDist(e.touches);
      pinchMid  = getTouchMid(e.touches, r);
      return;
    }

    // Single finger
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
    touchMoved = false;
    pinchDist  = null;
    const sx = t.clientX - r.left, sy = t.clientY - r.top;
    const { x: wpx, y: wpy } = screenToWorld(sx, sy);

    if (tool === 'calibrate' && calibClicks.length === 0) {
      const end = hitCalibEndpoint(wpx, wpy, 14 / viewZoom);
      if (end >= 0) {
        beginCalibDrag(end, sx, sy);
        touchHit = null;
        dragging = null;
        isPanning = false;
        return;
      }
    }
    if (tool === 'calibrate' || tool === 'draw-bed') {
      touchHit = null;
      dragging = null;
      isPanning = false;
      return;
    }

    // Check rotation handle first
    const selItem = selectedId && (beds.find(b => b.id === selectedId) || obstacles.find(o => o.id === selectedId));
    if (selItem && isPolygon(selItem) && hitPolygonRotateHandle(wpx, wpy, selItem)) {
      beginRotate(selItem, wpx, wpy);
      touchHit = { type: 'bed', item: selItem };
      return;
    }
    if (selItem && isPolygon(selItem)) {
      const vi = hitPolygonVertex(selItem, wpx, wpy, 14 / viewZoom);
      if (vi >= 0) {
        saveHistory();
        dragging = selItem;
        dragMode = 'vertex';
        dragVertex = vi;
        selectedVertex = vi;
        touchHit = { type: 'bed', item: selItem };
        updatePolyPanel();
        draw();
        return;
      }
    }
    if (selItem && !isPolygon(selItem) && selItem.type !== 'pot' && hitRotateHandle(wpx, wpy, selItem)) {
      beginRotate(selItem, wpx, wpy);
      return;
    }

    touchHit = hitTest(wpx, wpy);
    if (touchHit) {
      saveHistory();
      dragging = touchHit.item;
      if (isPolygon(touchHit.item)) {
        const vi = hitPolygonVertex(touchHit.item, wpx, wpy, 14 / viewZoom);
        if (vi >= 0) {
          dragMode = 'vertex';
          dragVertex = vi;
          selectedVertex = vi;
        } else {
          dragMode = 'move';
          selectedVertex = -1;
          dragOriginPoints = touchHit.item.points.map(p => ({ x: p.x, y: p.y }));
          dragOriginPivot = touchHit.item.pivot ? { x: touchHit.item.pivot.x, y: touchHit.item.pivot.y } : null;
          dragStartFeet = { x: snap(wpx / SCALE), y: snap(wpy / SCALE) };
        }
      } else {
        dragMode = 'item';
        dragOff  = { x: wpx - ft(touchHit.item.x), y: wpy - ft(touchHit.item.y) };
      }
    } else {
      select(null); touchHit = null;
      isPanning = true;
      panStart  = { x: sx - viewX, y: sy - viewY };
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();

    if (e.touches.length === 2) {
      // Pinch zoom + pan
      const dist = getTouchDist(e.touches);
      const mid  = getTouchMid(e.touches, r);
      if (pinchDist !== null) {
        const factor  = dist / pinchDist;
        const newZoom = Math.min(4, Math.max(0.1, viewZoom * factor));
        // Zoom centered on pinch midpoint
        viewX = mid.x - (mid.x - viewX) * (newZoom / viewZoom);
        viewY = mid.y - (mid.y - viewY) * (newZoom / viewZoom);
        viewZoom = newZoom;
        // Pan from midpoint delta
        viewX += mid.x - pinchMid.x;
        viewY += mid.y - pinchMid.y;
        draw();
      }
      pinchDist = dist; pinchMid = mid;
      return;
    }

    const t  = e.touches[0];
    const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    if (Math.sqrt(dx*dx + dy*dy) > 5) touchMoved = true;

    if (calibDrag) {
      const sx = t.clientX - r.left, sy = t.clientY - r.top;
      const { x: wpx, y: wpy } = screenToWorld(sx, sy);
      moveCalibDrag(wpx, wpy, sx, sy);
      return;
    }

    if (isRotating) {
      const rr = canvas.getBoundingClientRect();
      const { x: wpx, y: wpy } = screenToWorld(t.clientX - rr.left, t.clientY - rr.top);
      applyDragRotation(wpx, wpy, false);
    } else if (dragging) {
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
    } else if (isPanning) {
      const sx = t.clientX - r.left, sy = t.clientY - r.top;
      viewX = sx - panStart.x;
      viewY = sy - panStart.y;
      draw();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    pinchDist = null;
    if (calibDrag) {
      finishCalibDrag();
      touchHit = null;
      isPanning = false;
      dragging = null;
      return;
    }
    if (!touchMoved && touchStart && (tool === 'calibrate' || tool === 'draw-bed')) {
      const rr = canvas.getBoundingClientRect();
      const { x: wpx, y: wpy } = screenToWorld(touchStart.x - rr.left, touchStart.y - rr.top);
      if (tool === 'calibrate') handleCalibClick(wpx, wpy);
      else onDrawClick(wpx, wpy);
      touchHit = null;
      isPanning = false;
      dragging = null;
      return;
    }
    if (isRotating) { isRotating = false; draw(); touchHit = null; return; }
    if (!touchMoved && touchHit) {
      const hitId  = touchHit.item.id;
      const hitType = touchHit.type;
      const now    = Date.now();
      const isDoubleTap = hitId === lastTapId && (now - lastTapTime) < 350;
      if (isDoubleTap) {
        // Double-tap → open panel
        select(hitId, hitType, true);
        lastTapId = null; lastTapTime = 0;
      } else {
        // Single tap → just select (show rotation handle, no panel)
        select(hitId, hitType, false);
        lastTapId   = hitId;
        lastTapTime = now;
      }
    } else if (!touchHit) {
      select(null);
    }
    isPanning = false;
    if (dragging) canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    else { dragging = null; renderLists(); draw(); }
    touchHit = null;
  }, { passive: false });
}

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const r  = canvas.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  const factor  = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const newZoom = Math.min(4, Math.max(0.1, viewZoom * factor));
  viewX = sx - (sx - viewX) * (newZoom / viewZoom);
  viewY = sy - (sy - viewY) * (newZoom / viewZoom);
  viewZoom = newZoom;
  draw();
}, { passive: false });

canvas.addEventListener('dblclick', e => {
  if (tool === 'draw-bed') {
    if (draftPoints.length >= 2) {
      const a = draftPoints[draftPoints.length - 1];
      const b = draftPoints[draftPoints.length - 2];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 0.75) draftPoints.pop();
    }
    if (draftPoints.length >= 3) closeDraft();
    return;
  }
  const r   = canvas.getBoundingClientRect();
  const sx  = e.clientX - r.left, sy = e.clientY - r.top;
  const hit = hitTest(...Object.values(screenToWorld(sx, sy)));
  if (!hit) return;
  const name = prompt('Rename:', hit.item.name);
  if (name) { hit.item.name = name; draw(); renderLists(); syncPanel(); }
});

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // Ctrl+Z / Cmd+Z — undo (always active, even when typing)
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undoLast();
    return;
  }
  if (e.code === 'Space') {
    holdSpace(e);
    return;
  }
  if (e.key === 'Escape' && (draftPoints.length || calibClicks.length || calibDrag)) {
    draftPoints = [];
    draftCursor = null;
    calibClicks = [];
    calibHover = null;
    calibDrag = null;
    draw();
    refreshCursor();
    return;
  }
  if (e.key === 'Escape' && !document.querySelector('.modal-overlay') && (tool === 'draw-bed' || tool === 'calibrate')) {
    setTool('select');
    return;
  }
  if (!selectedId) return;
  // Don't fire Delete when user is typing in an input / textarea
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelected();
  }
});

document.addEventListener('keyup', e => {
  if (e.code === 'Space') releaseSpace();
});

window.addEventListener('blur', releaseSpace);
