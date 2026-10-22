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
  if (!document.getElementById('snapToggle').checked) return v;
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
  const b = polygonBounds(bed.points);
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

function bedArea(bed) {
  if (isPolygon(bed)) return shoelaceArea(bed.points);
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

function pointSegDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
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
  return !(plotImage && !(plot.feetPerPixel > 0));
}
