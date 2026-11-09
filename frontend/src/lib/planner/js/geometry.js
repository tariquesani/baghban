function formatFeetInches(feet) {
  const inches = Math.max(0, Math.round(Math.abs(feet) * 12));
  const f = Math.floor(inches / 12);
  const i = inches % 12;
  if (f && i) return `${f}'${i}"`;
  if (f) return `${f}'`;
  return `${i}"`;
}

function ft(v) { return v * SCALE; }
function px(v) { return v / SCALE; }
function snap(v) {
  const toggle = document.getElementById('snapToggle');
  if (toggle && toggle.getAttribute('aria-pressed') === 'false') return v;
  return Math.round(v / GRID) * GRID;
}
// ─── Geometry ─────────────────────────────────────────────────────────────────
function isPolygon(item) {
  return !!(item && item.shape === 'polygon' && Array.isArray(item.points) && item.points.length >= 3);
}

function lineLengthPx(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function feetPerPixelFromLine(x1, y1, x2, y2, lengthFt) {
  const len = lineLengthPx(x1, y1, x2, y2);
  if (len < 1) return 0;
  return lengthFt / len;
}

function shoelaceArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(sum) / 2;
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const denom = (yj - yi) || 1e-12;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / denom + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonBounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });
  return { x: minX, y: minY, w: Math.max(0.1, maxX - minX), h: Math.max(0.1, maxY - minY) };
}

function syncPolygonBounds(bed) {
  const b = polygonBounds(polygonOutline(bed));
  bed.x = b.x; bed.y = b.y; bed.w = b.w; bed.h = b.h;
}

function polygonPivot(bed) {
  if (bed.pivot) return bed.pivot;
  return polygonCentroid(bed.points);
}

function lockPolygonPivot(bed) {
  if (!bed.pivot) bed.pivot = polygonCentroid(bed.points);
  return bed.pivot;
}

function rotatePoint(point, pivot, rotation) {
  const dx = point.x - pivot.x, dy = point.y - pivot.y;
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return { x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c };
}

function polygonWorldPoints(bed) {
  const rotation = bed.rotation || 0;
  if (!rotation) return bed.points.map(point => ({ x: point.x, y: point.y }));
  const pivot = polygonPivot(bed);
  return bed.points.map(point => rotatePoint(point, pivot, rotation));
}

function polygonLocalFeet(bed, x, y) {
  const rotation = bed.rotation || 0;
  if (!rotation) return { x, y };
  return rotatePoint({ x, y }, polygonPivot(bed), -rotation);
}

// A side bows by `bulge` feet, stored on the corner where the side starts.
// Positive is to the left of the corner-to-corner direction. The curve is a
// quadratic whose midpoint sits that far off the straight side.
function sideBulge(point) {
  const bulge = point && typeof point.bulge === 'number' ? point.bulge : 0;
  return Number.isFinite(bulge) ? bulge : 0;
}

function copyGardenPoint(point, dx, dy) {
  const next = { x: point.x + (dx || 0), y: point.y + (dy || 0) };
  const bulge = sideBulge(point);
  if (bulge) next.bulge = bulge;
  return next;
}

function edgeAxes(start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return null;
  return { length, nx: -dy / length, ny: dx / length };
}

function edgeControl(start, end) {
  const bulge = sideBulge(start);
  const axes = edgeAxes(start, end);
  if (!axes || !bulge) return null;
  return {
    x: (start.x + end.x) / 2 + 2 * bulge * axes.nx,
    y: (start.y + end.y) / 2 + 2 * bulge * axes.ny,
  };
}

function quadraticAt(start, control, end, t) {
  const u = 1 - t;
  return {
    x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
    y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
  };
}

// About one inch between samples, and never more than 64, so a long side stays cheap.
function sampleEdge(start, end) {
  const control = edgeControl(start, end);
  if (!control) return [{ x: end.x, y: end.y }];
  const axes = edgeAxes(start, end);
  const span = axes.length + 2 * Math.abs(sideBulge(start));
  const steps = Math.min(64, Math.max(4, Math.ceil(span / (1 / 12))));
  const samples = [];
  for (let i = 1; i <= steps; i++) samples.push(quadraticAt(start, control, end, i / steps));
  return samples;
}

function polygonOutline(bed) {
  const points = (bed && bed.points) || [];
  if (!points.length) return [];
  const outline = [{ x: points[0].x, y: points[0].y }];
  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    sampleEdge(start, end).forEach(sample => outline.push(sample));
  }
  const last = outline[outline.length - 1];
  if (outline.length > 1 && last.x === outline[0].x && last.y === outline[0].y) outline.pop();
  return outline;
}

function polygonWorldOutline(bed) {
  const outline = polygonOutline(bed);
  const rotation = bed.rotation || 0;
  if (!rotation) return outline;
  const pivot = polygonPivot(bed);
  return outline.map(point => rotatePoint(point, pivot, rotation));
}

function edgeLengthFeet(start, end) {
  const samples = sampleEdge(start, end);
  let length = 0;
  let prev = start;
  samples.forEach(sample => {
    length += Math.hypot(sample.x - prev.x, sample.y - prev.y);
    prev = sample;
  });
  return length;
}

function edgeMidpoint(start, end) {
  const bulge = sideBulge(start);
  const axes = edgeAxes(start, end);
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  if (!axes || !bulge) return { x: mx, y: my };
  return { x: mx + bulge * axes.nx, y: my + bulge * axes.ny };
}

function bulgeFromPointer(start, end, pointer) {
  const axes = edgeAxes(start, end);
  if (!axes) return 0;
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const offset = (pointer.x - mx) * axes.nx + (pointer.y - my) * axes.ny;
  // A quarter-inch of slack straightens the side. The drag itself is not on the grid.
  if (Math.abs(offset) < 0.02) return 0;
  return offset;
}

function polygonCentroid(points) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const cross = points[i].x * points[j].y - points[j].x * points[i].y;
    a += cross;
    cx += (points[i].x + points[j].x) * cross;
    cy += (points[i].y + points[j].y) * cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) {
    const b = polygonBounds(points);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

function polygonLabelPoint(points) {
  const c = polygonCentroid(points);
  if (pointInPolygon(c.x, c.y, points)) return c;
  const n = points.length || 1;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

// Direction of the bed's length. A drawn bed can slope while its rotation stays 0,
// and the long sides are often several short edges, so one edge is not the length.
// The angle stays within upright reading range.
function polygonLabelAngle(points) {
  const spots = points || [];
  if (spots.length < 2) return 0;
  let mx = 0, my = 0;
  for (const p of spots) { mx += p.x; my += p.y; }
  mx /= spots.length;
  my /= spots.length;
  let xx = 0, xy = 0, yy = 0;
  for (const p of spots) {
    const dx = p.x - mx, dy = p.y - my;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  let angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  if (angle >= Math.PI / 2) angle -= Math.PI;
  return angle;
}

function polygonLabelFrame(points) {
  const angle = polygonLabelAngle(points);
  if (!points || points.length < 2) return { angle: 0, length: 0, thickness: 0 };
  const alongX = Math.cos(angle);
  const alongY = Math.sin(angle);
  const acrossX = -alongY;
  const acrossY = alongX;
  let alongMin = Infinity;
  let alongMax = -Infinity;
  let acrossMin = Infinity;
  let acrossMax = -Infinity;
  for (const p of points) {
    const along = p.x * alongX + p.y * alongY;
    const across = p.x * acrossX + p.y * acrossY;
    if (along < alongMin) alongMin = along;
    if (along > alongMax) alongMax = along;
    if (across < acrossMin) acrossMin = across;
    if (across > acrossMax) acrossMax = across;
  }
  return { angle, length: alongMax - alongMin, thickness: acrossMax - acrossMin };
}

function bedArea(bed) {
  if (isPolygon(bed)) return shoelaceArea(polygonOutline(bed));
  if (bed.type === 'tree') {
    const diam = bed.diam || bed.w || 0;
    return Math.PI * (diam / 2) * (diam / 2);
  }
  return (bed.w || 0) * (bed.h || 0);
}

function hitVertex(wx, wy, points, radiusWorld) {
  const r2 = radiusWorld * radiusWorld;
  let best = -1, bestD = r2;
  points.forEach((p, i) => {
    const dx = wx - ft(p.x), dy = wy - ft(p.y);
    const d = dx * dx + dy * dy;
    if (d <= bestD) { bestD = d; best = i; }
  });
  return best;
}

function pointerFeet(wx, wy) {
  let x = snap(wx / SCALE);
  let y = snap(wy / SCALE);
  x = Math.max(0, Math.min(garden.width, x));
  y = Math.max(0, Math.min(garden.height, y));
  return { x, y };
}

function polygonCellInside(bed, r, c) {
  return pointInPolygon(bed.x + c + 0.5, bed.y + r + 0.5, bed.points);
}

function closestPointOnSegment(point, start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { x: start.x + t * dx, y: start.y + t * dy };
}

function pointSegDist(p, a, b) {
  const closest = closestPointOnSegment(p, a, b);
  return Math.hypot(p.x - closest.x, p.y - closest.y);
}

// `radius` uses the same units as `points`. Each end of the edge is left for
// the corner handle, but never more than 30% of that edge, so a short edge
// still has a middle that can take a new corner.
function closestOnChain(point, chain) {
  let best = null;
  for (let i = 0; i < chain.length - 1; i++) {
    const projected = closestPointOnSegment(point, chain[i], chain[i + 1]);
    const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
    if (!best || distance < best.distance) best = { point: projected, distance };
  }
  return best;
}

function polygonEdgeInsertPoint(points, point, radius) {
  let best = null;
  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    const chain = [{ x: start.x, y: start.y }].concat(sampleEdge(start, end));
    const hit = closestOnChain(point, chain);
    if (!hit || hit.distance > radius) continue;
    const edgeLength = Math.hypot(end.x - start.x, end.y - start.y);
    const keepOff = Math.min(radius, edgeLength * 0.3);
    if (Math.hypot(hit.point.x - start.x, hit.point.y - start.y) <= keepOff) continue;
    if (Math.hypot(hit.point.x - end.x, hit.point.y - end.y) <= keepOff) continue;
    if (!best || hit.distance < best.distance) {
      best = { index: i, point: { x: hit.point.x, y: hit.point.y }, distance: hit.distance };
    }
  }
  return best;
}

function segmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

function segDist(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(pointSegDist(a, c, d), pointSegDist(b, c, d), pointSegDist(c, a, b), pointSegDist(d, a, b));
}

function itemOutline(item) {
  if (isPolygon(item)) return polygonWorldPoints(item);
  const rot = item.rotation || 0;
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
  const corners = [[-item.w / 2, -item.h / 2], [item.w / 2, -item.h / 2], [item.w / 2, item.h / 2], [-item.w / 2, item.h / 2]];
  return corners.map(([dx, dy]) => ({
    x: cx + dx * Math.cos(rot) - dy * Math.sin(rot),
    y: cy + dx * Math.sin(rot) + dy * Math.cos(rot),
  }));
}

function outlineDistance(a, b) {
  if (pointInPolygon(a[0].x, a[0].y, b) || pointInPolygon(b[0].x, b[0].y, a)) return 0;
  let min = Infinity;
  for (let i = 0; i < a.length; i++) {
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b2 = b[(j + 1) % b.length];
      min = Math.min(min, segDist(a[i], a2, b[j], b2));
    }
  }
  return min;
}

function neighborWarning(bed) {
  const outline = itemOutline(bed);
  let closest = Infinity, name = '';
  beds.forEach(other => {
    if (other.id === bed.id) return;
    const d = outlineDistance(outline, itemOutline(other));
    if (d < closest) { closest = d; name = other.name; }
  });
  if (closest < 2) return `${name} is ${closest.toFixed(1)} ft away. Leave about 2 ft for a walking path.`;
  return '';
}

function polygonDrawAllowed() {
  if (!gardenReady()) return false;
  return !(plotImage && !(plot.feetPerPixel > 0));
}
