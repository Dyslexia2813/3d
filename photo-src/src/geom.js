/* Pure plan-geometry helpers shared by the 2D editor and the 3D engine. Units: cm. */
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function deg2rad(d) { return d * Math.PI / 180; }
export function rad2deg(r) { return r * 180 / Math.PI; }
export function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
export function snap(v, step) { return Math.round(v / step) * step; }

export function wallLen(w) { return dist(w.x1, w.y1, w.x2, w.y2); }
export function wallAngle(w) { return Math.atan2(w.y2 - w.y1, w.x2 - w.x1); }
export function wallDir(w) { const a = wallAngle(w); return { x: Math.cos(a), y: Math.sin(a) }; }
export function wallNormal(w) { const a = wallAngle(w); return { x: -Math.sin(a), y: Math.cos(a) }; }
/** point on wall centerline at distance s along, offset t across (plan coords) */
export function wallPoint(w, s, t) {
  const u = wallDir(w), n = wallNormal(w);
  return { x: w.x1 + u.x * s + n.x * (t || 0), y: w.y1 + u.y * s + n.y * (t || 0) };
}

export function openingsOnWall(project, wallId) {
  return project.openings.filter(o => o.wallId === wallId).sort((a, b) => a.pos - b.pos);
}

/** solid (non-opening) horizontal segments of a wall, in local "s" coords */
export function wallSolidSegments(project, wall) {
  const len = wallLen(wall);
  const ops = openingsOnWall(project, wall.id);
  const segs = [];
  let cursor = 0;
  ops.forEach(o => {
    const s0 = clamp(o.pos, 0, len);
    const s1 = clamp(o.pos + o.width, 0, len);
    if (s0 > cursor + 0.01) segs.push({ s0: cursor, s1: s0 });
    cursor = Math.max(cursor, s1);
  });
  if (cursor < len - 0.01) segs.push({ s0: cursor, s1: len });
  return segs;
}

/* balcony geometry: anchored at inner-edge midpoint (b.x,b.y), rotation = outward dir */
export function balconyCorners(b) {
  const a = deg2rad(b.rotation || 0);
  const ux = Math.cos(a), uy = Math.sin(a);
  const nx = -Math.sin(a), ny = Math.cos(a);
  const hw = b.width / 2;
  const p0 = { x: b.x + nx * hw, y: b.y + ny * hw };
  const p1 = { x: b.x - nx * hw, y: b.y - ny * hw };
  const p2 = { x: p1.x + ux * b.depth, y: p1.y + uy * b.depth };
  const p3 = { x: p0.x + ux * b.depth, y: p0.y + uy * b.depth };
  return [p0, p1, p2, p3];
}

export function planBounds(project) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
  const addPt = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); any = true; };
  project.walls.forEach(w => { addPt(w.x1, w.y1); addPt(w.x2, w.y2); });
  project.balconies.forEach(b => balconyCorners(b).forEach(c => addPt(c.x, c.y)));
  if (!any) {
    if (project.furniture.length) {
      project.furniture.forEach(f => { addPt(f.x - f.w / 2, f.y - f.d / 2); addPt(f.x + f.w / 2, f.y + f.d / 2); });
      return { minX, minY, maxX, maxY };
    }
    return { minX: 0, minY: 0, maxX: 500, maxY: 400 };
  }
  return { minX, minY, maxX, maxY };
}
