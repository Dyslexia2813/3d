import { FURNITURE_CATALOG, FURNITURE_BY_KEY, CATEGORY_LABELS, CATEGORY_ORDER, planColor } from './catalog.js';
import { FINISHES, FLOORS } from './materials.js';
import { createEngine, renderThumbnail, TIME_PRESETS } from './engine.js';
import { DEMO_PROJECT } from './demo.js';
/* =========================================================================
   ASP Studio — Apartment Planner
   Part 1: constants, state, math utils, project model
   ========================================================================= */

/* ---------- id generator ---------- */
let __idCounter = 1;
function uid(prefix) {
  return prefix + (__idCounter++).toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------- catalog: opening defaults ---------- */
const OPENING_DEFAULTS = {
  window:      { label: 'Окно',              width: 120, height: 140, sill: 90,  color: '#7fa8b8' },
  doorswing:   { label: 'Дверь распашная',    width: 90,  height: 205, sill: 0,   color: '#8a6d4f', hinge: 'left' },
  doorsliding: { label: 'Дверь сдвижная',     width: 120, height: 210, sill: 0,   color: '#8a6d4f' },
  arch:        { label: 'Арка',               width: 110, height: 210, sill: 0,   color: '#c9a678' }
};

/* ---------- catalog: wall defaults ---------- */
const WALL_DEFAULTS = {
  exterior: { thickness: 25, color: '#3a4552' },
  interior: { thickness: 10, color: '#8b96a3' }
};

/* ---------- application state ---------- */
function newProject() {
  return {
    schema: 1,
    name: 'Новый проект',
    ceilingHeight: 270,
    walls: [],
    openings: [],
    balconies: [],
    furniture: [],
    // photoreal-only settings (ignored by the classic planner)
    floor: 'oak',
    wallPaint: '#f1eee8',
    facade: '#e4e1dc',
    showCeiling: true,
    darkCaps: true
  };
}

let project = newProject();
let projectFileHandleName = null;

let selected = null;      // { type:'wall'|'opening'|'balcony'|'furniture', id }
let wallsLocked = false;

let activeTool = 'select'; // select | draw-wall | add-window | add-doorswing | add-doorsliding | add-arch | add-balcony
let drawWallType = 'exterior';
let drawWallThickness = WALL_DEFAULTS.exterior.thickness;
let wallDraft = [];        // array of {x,y} plan points while drawing a chain

let view = '2d';           // '2d' | '3d'

const ed = { scale: 1.6, panX: 120, panY: 120 }; // px per cm, pan offset in px

let drag = null;           // active pointer-drag descriptor
let wallHeightPct3D = 100; // 3D-only cutaway of wall height (visual aid)
let scene3DDirty = true;   // rebuild 3D scene on next show
let engine = null;         // photoreal 3D engine, created on first visit of the 3D tab
let hasFramedOnce = false;
let mousePlanPos = { x: 0, y: 0 }; // current mouse position in plan (world/cm) coordinates

/* ---------- math utils ---------- */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function deg2rad(d) { return d * Math.PI / 180; }
function rad2deg(r) { return r * 180 / Math.PI; }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function snap(v, step) { return Math.round(v / step) * step; }

function wallLen(w) { return dist(w.x1, w.y1, w.x2, w.y2); }
function wallAngle(w) { return Math.atan2(w.y2 - w.y1, w.x2 - w.x1); }
function wallDir(w) { const a = wallAngle(w); return { x: Math.cos(a), y: Math.sin(a) }; }
function wallNormal(w) { const a = wallAngle(w); return { x: -Math.sin(a), y: Math.cos(a) }; }
/** point on wall centerline at distance s along, offset t across (plan coords) */
function wallPoint(w, s, t) {
  const u = wallDir(w), n = wallNormal(w);
  return { x: w.x1 + u.x * s + n.x * (t || 0), y: w.y1 + u.y * s + n.y * (t || 0) };
}

function getWall(id) { return project.walls.find(w => w.id === id); }
function getOpening(id) { return project.openings.find(o => o.id === id); }
function getBalcony(id) { return project.balconies.find(b => b.id === id); }
function getFurniture(id) { return project.furniture.find(f => f.id === id); }

function openingsOnWall(wallId) {
  return project.openings.filter(o => o.wallId === wallId).sort((a, b) => a.pos - b.pos);
}

/* bounding box of the whole plan (plan/world coords, cm) */
function planBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;
  project.walls.forEach(w => {
    [[w.x1, w.y1], [w.x2, w.y2]].forEach(([x, y]) => {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      any = true;
    });
  });
  project.balconies.forEach(b => {
    const corners = balconyCorners(b);
    corners.forEach(c => {
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
      any = true;
    });
  });
  if (!any) return { minX: 0, minY: 0, maxX: 500, maxY: 400 };
  return { minX, minY, maxX, maxY };
}

/* balcony geometry: anchored at inner-edge midpoint (b.x,b.y), rotationDeg = outward dir,
   width = extent along inner edge, depth = protrusion length outward */
function balconyCorners(b) {
  const a = deg2rad(b.rotation || 0);
  const ux = Math.cos(a), uy = Math.sin(a);   // outward direction
  const nx = -Math.sin(a), ny = Math.cos(a);  // along-edge direction
  const hw = b.width / 2;
  const p0 = { x: b.x + nx * hw, y: b.y + ny * hw };                       // inner edge, +side
  const p1 = { x: b.x - nx * hw, y: b.y - ny * hw };                       // inner edge, -side
  const p2 = { x: p1.x + ux * b.depth, y: p1.y + uy * b.depth };           // outer edge, -side
  const p3 = { x: p0.x + ux * b.depth, y: p0.y + uy * b.depth };           // outer edge, +side
  return [p0, p1, p2, p3];
}


/* =========================================================================
   Part 2: opening geometry helpers (shared by 2D + 3D), save / load
   ========================================================================= */

/** solid (non-opening) horizontal segments of a wall, in local "s" coords */
function wallSolidSegments(wall) {
  const len = wallLen(wall);
  const ops = openingsOnWall(wall.id);
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

/** clamp an opening's position along its wall so it stays in bounds and doesn't overlap neighbors */
function clampOpeningPos(wall, opening, desiredPos) {
  const len = wallLen(wall);
  const width = opening.width;
  const others = openingsOnWall(wall.id).filter(o => o.id !== opening.id);
  let left = 0, right = len;
  others.forEach(o => {
    if (o.pos + o.width <= desiredPos + 0.001 && o.pos + o.width > left) left = o.pos + o.width;
    if (o.pos >= desiredPos - 0.001 && o.pos < right) right = o.pos;
  });
  let lo = Math.max(0, left);
  let hi = Math.min(len - width, right - width);
  if (hi < lo) hi = lo;
  return clamp(desiredPos, lo, hi);
}

/** clamp an opening's width given its fixed start position and neighbors */
function clampOpeningWidth(wall, opening, desiredWidth) {
  const len = wallLen(wall);
  const others = openingsOnWall(wall.id).filter(o => o.id !== opening.id);
  let rightBound = len;
  others.forEach(o => { if (o.pos >= opening.pos - 0.001 && o.pos < rightBound) rightBound = o.pos; });
  const maxW = Math.max(20, rightBound - opening.pos);
  return clamp(desiredWidth, 20, Math.min(maxW, len));
}

function isProjectEmpty() {
  return project.walls.length === 0 && project.furniture.length === 0 && project.balconies.length === 0;
}

/* ---------- serialize / deserialize ---------- */
function serializeProject() {
  const payload = { app: 'ASP Studio', fileSchema: 1, variant: 'photo', savedAt: new Date().toISOString(), project: project };
  return JSON.stringify(payload, null, 2);
}

function sanitizeFileName(name) {
  const base = (name || 'project').trim().replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
  return (base || 'project') + '.json';
}

function downloadProjectFile() {
  const json = serializeProject();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFileName(project.name);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function normalizeLoadedProject(raw) {
  const p = newProject();
  if (!raw || typeof raw !== 'object') return p;
  p.name = typeof raw.name === 'string' && raw.name.trim() ? raw.name : p.name;
  p.ceilingHeight = Number(raw.ceilingHeight) > 0 ? Number(raw.ceilingHeight) : p.ceilingHeight;
  if (typeof raw.floor === 'string' && FLOORS[raw.floor]) p.floor = raw.floor;
  if (typeof raw.wallPaint === 'string') p.wallPaint = raw.wallPaint;
  if (typeof raw.facade === 'string') p.facade = raw.facade;
  if (typeof raw.showCeiling === 'boolean') p.showCeiling = raw.showCeiling;
  if (typeof raw.darkCaps === 'boolean') p.darkCaps = raw.darkCaps;
  const idset = new Set();
  const fixId = (obj, prefix) => {
    if (!obj.id || typeof obj.id !== 'string' || idset.has(obj.id)) obj.id = uid(prefix);
    idset.add(obj.id);
    return obj;
  };
  if (Array.isArray(raw.walls)) {
    p.walls = raw.walls.map(w => fixId({
      id: w.id,
      type: w.type === 'interior' ? 'interior' : 'exterior',
      x1: Number(w.x1) || 0, y1: Number(w.y1) || 0,
      x2: Number(w.x2) || 0, y2: Number(w.y2) || 0,
      thickness: Number(w.thickness) > 0 ? Number(w.thickness) : WALL_DEFAULTS.exterior.thickness,
      color: typeof w.color === 'string' ? w.color : WALL_DEFAULTS.exterior.color,
      paint: typeof w.paint === 'string' ? w.paint : null
    }, 'w'));
  }
  const wallIds = new Set(p.walls.map(w => w.id));
  if (Array.isArray(raw.openings)) {
    p.openings = raw.openings
      .filter(o => wallIds.has(o.wallId))
      .map(o => fixId({
        id: o.id,
        wallId: o.wallId,
        kind: ['window', 'doorswing', 'doorsliding', 'arch'].includes(o.kind) ? o.kind : 'window',
        pos: Number(o.pos) || 0,
        width: Number(o.width) > 0 ? Number(o.width) : 100,
        height: Number(o.height) > 0 ? Number(o.height) : 120,
        sill: Number(o.sill) >= 0 ? Number(o.sill) : 0,
        color: typeof o.color === 'string' ? o.color : '#7fa8b8',
        hinge: o.hinge === 'right' ? 'right' : 'left',
        finish: typeof o.finish === 'string' ? o.finish : null
      }, 'o'));
  }
  if (Array.isArray(raw.balconies)) {
    p.balconies = raw.balconies.map(b => fixId({
      id: b.id,
      x: Number(b.x) || 0, y: Number(b.y) || 0,
      width: Number(b.width) > 0 ? Number(b.width) : 150,
      depth: Number(b.depth) > 0 ? Number(b.depth) : 90,
      rotation: Number(b.rotation) || 0,
      parapet: Number(b.parapet) > 0 ? Number(b.parapet) : 100,
      color: typeof b.color === 'string' ? b.color : '#9aa5b1'
    }, 'b'));
  }
  if (Array.isArray(raw.furniture)) {
    p.furniture = raw.furniture.map(f => { const def = FURNITURE_BY_KEY[f.key] || {}; return withFinishes(fixId({
      id: f.id,
      key: typeof f.key === 'string' ? f.key : 'kf_table',
      cat: typeof f.cat === 'string' ? f.cat : (def.cat || 'living'),
      label: typeof f.label === 'string' ? f.label : (def.label || 'Мебель'),
      x: Number(f.x) || 0, y: Number(f.y) || 0,
      rotation: Number(f.rotation) || 0,
      w: Number(f.w) > 0 ? Number(f.w) : (def.w || 60),
      d: Number(f.d) > 0 ? Number(f.d) : (def.d || 60),
      h: Number(f.h) > 0 ? Number(f.h) : (def.h || 75),
      z: Number(f.z) >= 0 ? Number(f.z) : (def.z || 0),
      color: typeof f.color === 'string' ? f.color : (def.color || '#a9835a'),
      finish: typeof f.finish === 'string' ? f.finish : null,
      frame: typeof f.frame === 'string' ? f.frame : null,
      top: typeof f.top === 'string' ? f.top : null
    }, 'f')); });
  }
  return p;
}

/** fill in finish/frame/top defaults from the catalogue (old projects have none) */
function withFinishes(f) {
  const def = FURNITURE_BY_KEY[f.key];
  if (!def) return f;
  if (def.fin && !(f.finish && def.fin.includes(f.finish))) f.finish = def.finish;
  if (def.frm && !(f.frame && def.frm.includes(f.frame))) f.frame = def.frame;
  if (def.tops && !(f.top && def.tops.includes(f.top))) f.top = def.top;
  return f;
}

function loadProjectFromJSONText(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { throw new Error('Файл повреждён или имеет неверный формат JSON.'); }
  const src = raw && raw.project ? raw.project : raw;
  const p = normalizeLoadedProject(src);
  project = p;
  wallsLocked = project.walls.length > 0; // loaded layouts start locked to prevent accidental edits
  selected = null;
  wallDraft = [];
  activeTool = 'select';
  scene3DDirty = true;
}


/* =========================================================================
   Part 3: 2D SVG rendering engine
   ========================================================================= */

const SVGNS = 'http://www.w3.org/2000/svg';
const PALETTE = { canvasBg: '#eef1f2', balconyFill: 'rgba(148,176,154,0.22)', accent: '#d18b3d' };
function svgEl(tag, attrs) {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) el.setAttribute(k, attrs[k]);
  return el;
}

/* DOM refs, assigned in initDom() */
let editorSvg, worldGroup, balconyLayer, wallLayer, furnitureLayer, draftLayer, handleLayer, emptyHint;

function initDom2D() {
  editorSvg = document.getElementById('editorSvg');
  worldGroup = document.getElementById('worldGroup');
  balconyLayer = document.getElementById('balconyLayer');
  wallLayer = document.getElementById('wallLayer');
  furnitureLayer = document.getElementById('furnitureLayer');
  draftLayer = document.getElementById('draftLayer');
  handleLayer = document.getElementById('handleLayer');
  emptyHint = document.getElementById('emptyHint');
}

function screenToWorld(px, py) {
  return { x: (px - ed.panX) / ed.scale, y: (py - ed.panY) / ed.scale };
}
function worldToScreen(x, y) {
  return { x: x * ed.scale + ed.panX, y: y * ed.scale + ed.panY };
}
function eventToWorld(e) {
  const rect = editorSvg.getBoundingClientRect();
  return screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
}

function updateWorldTransform() {
  worldGroup.setAttribute('transform', `translate(${ed.panX} ${ed.panY}) scale(${ed.scale})`);
}

/* rectangle centered at (cx,cy), size w x d, rotated rotDeg (deg, about center) -> 4 corners */
function rectCorners(cx, cy, w, d, rotDeg) {
  const a = deg2rad(rotDeg || 0);
  const cs = Math.cos(a), sn = Math.sin(a);
  const local = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  return local.map(([lx, ly]) => ({ x: cx + lx * cs - ly * sn, y: cy + lx * sn + ly * cs }));
}
function pointsAttr(pts) { return pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '); }

/* polygon in wall-local (s,t) box -> world polygon element */
function polyFromWall(w, s0, s1, t0, t1, attrs) {
  const p1 = wallPoint(w, s0, t0), p2 = wallPoint(w, s1, t0), p3 = wallPoint(w, s1, t1), p4 = wallPoint(w, s0, t1);
  return svgEl('polygon', Object.assign({ points: pointsAttr([p1, p2, p3, p4]) }, attrs || {}));
}

/* a <g> that counter-scales so children keep constant screen size regardless of zoom */
function screenConstGroup(wx, wy, attrs) {
  const g = svgEl('g', Object.assign({ transform: `translate(${wx} ${wy}) scale(${1 / ed.scale})` }, attrs || {}));
  return g;
}

function textAngleDeg(angleRad) {
  let deg = rad2deg(angleRad);
  if (deg > 90 || deg < -90) deg += 180;
  return deg;
}

/* ---------------- walls ---------------- */
function renderWalls() {
  wallLayer.textContent = '';
  project.walls.forEach(w => {
    const isSel = selected && selected.type === 'wall' && selected.id === w.id;
    const g = svgEl('g', { class: 'wall-g' + (isSel ? ' is-selected' : '') + (wallsLocked ? ' is-locked' : '') });
    const t = w.thickness;
    wallSolidSegments(w).forEach(seg => {
      const poly = polyFromWall(w, seg.s0, seg.s1, -t / 2, t / 2, {
        'data-role': 'wall-body', 'data-id': w.id, fill: w.color, class: 'wall-body'
      });
      g.appendChild(poly);
    });
    openingsOnWall(w.id).forEach(o => g.appendChild(renderOpeningSymbol(w, o)));

    // length label
    const mid = wallPoint(w, wallLen(w) / 2, 0);
    const off = wallPoint(w, wallLen(w) / 2, (t / 2) + 16 * (1));
    const lbl = screenConstGroup(off.x, off.y, { class: 'dim-label' });
    const deg = textAngleDeg(wallAngle(w));
    const txt = svgEl('text', { x: 0, y: 0, 'text-anchor': 'middle', transform: `rotate(${deg})` });
    txt.textContent = Math.round(wallLen(w)) + ' см';
    lbl.appendChild(txt);
    g.appendChild(lbl);

    if (!wallsLocked && isSel) {
      g.appendChild(endpointHandle(w, 'a'));
      g.appendChild(endpointHandle(w, 'b'));
    }
    wallLayer.appendChild(g);
  });
}

function endpointHandle(w, which) {
  const p = which === 'a' ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
  const g = screenConstGroup(p.x, p.y, { 'data-role': 'wall-endpoint', 'data-id': w.id, 'data-which': which, class: 'endpoint-handle' });
  g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 7 }));
  return g;
}

/* ---------------- openings ---------------- */
function renderOpeningSymbol(w, o) {
  const isSel = selected && selected.type === 'opening' && selected.id === o.id;
  const g = svgEl('g', { class: 'opening-g' + (isSel ? ' is-selected' : ''), 'data-role': 'opening', 'data-id': o.id });
  const t = w.thickness;
  if (o.kind === 'window') {
    const outer = polyFromWall(w, o.pos, o.pos + o.width, -t / 2, t / 2, { fill: PALETTE.canvasBg, stroke: o.color, 'stroke-width': 2 });
    g.appendChild(outer);
    [-t * 0.17, t * 0.17].forEach(tt => {
      const p1 = wallPoint(w, o.pos + 2, tt), p2 = wallPoint(w, o.pos + o.width - 2, tt);
      g.appendChild(svgEl('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: o.color, 'stroke-width': 1.6 }));
    });
  } else if (o.kind === 'doorswing') {
    g.appendChild(polyFromWall(w, o.pos, o.pos + o.width, -t / 2, t / 2, { fill: PALETTE.canvasBg, stroke: o.color, 'stroke-width': 1.4, 'stroke-dasharray': '3 2' }));
    const hingeAtStart = o.hinge !== 'right';
    const hingeS = hingeAtStart ? o.pos : o.pos + o.width;
    const farS = hingeAtStart ? o.pos + o.width : o.pos;
    const leafLen = Math.max(10, o.width - 2);
    const hingePt = wallPoint(w, hingeS, 0);
    const farPt = wallPoint(w, farS, 0);
    const tipPt = wallPoint(w, hingeS, leafLen);
    g.appendChild(svgEl('line', { x1: hingePt.x, y1: hingePt.y, x2: tipPt.x, y2: tipPt.y, stroke: o.color, 'stroke-width': 2.4 }));
    const cross = (tipPt.x - hingePt.x) * (farPt.y - hingePt.y) - (tipPt.y - hingePt.y) * (farPt.x - hingePt.x);
    const sweep = cross > 0 ? 1 : 0;
    g.appendChild(svgEl('path', {
      d: `M ${tipPt.x} ${tipPt.y} A ${leafLen} ${leafLen} 0 0 ${sweep} ${farPt.x} ${farPt.y}`,
      fill: 'none', stroke: o.color, 'stroke-width': 1, 'stroke-dasharray': '4 3', opacity: 0.65
    }));
  } else if (o.kind === 'doorsliding') {
    g.appendChild(polyFromWall(w, o.pos, o.pos + o.width, -t / 2, t / 2, { fill: PALETTE.canvasBg, stroke: o.color, 'stroke-width': 1.4, 'stroke-dasharray': '3 2' }));
    const trackA = wallPoint(w, o.pos - 4, t / 2 + 2), trackB = wallPoint(w, o.pos + o.width + 4, t / 2 + 2);
    g.appendChild(svgEl('line', { x1: trackA.x, y1: trackA.y, x2: trackB.x, y2: trackB.y, stroke: o.color, 'stroke-width': 1, 'stroke-dasharray': '2 2' }));
    const panelLen = o.width * 0.55;
    g.appendChild(polyFromWall(w, o.pos, o.pos + panelLen, t / 2 - 1, t / 2 + 3, { fill: o.color, opacity: 0.85 }));
  } else if (o.kind === 'arch') {
    g.appendChild(polyFromWall(w, o.pos, o.pos + o.width, -t / 2, t / 2, { fill: PALETTE.canvasBg, stroke: o.color, 'stroke-width': 2, 'stroke-dasharray': '6 3' }));
  }
  return g;
}

/* ---------------- balconies ---------------- */
function renderBalconies() {
  balconyLayer.textContent = '';
  project.balconies.forEach(b => {
    const isSel = selected && selected.type === 'balcony' && selected.id === b.id;
    const corners = balconyCorners(b);
    const g = svgEl('g', { class: 'balcony-g' + (isSel ? ' is-selected' : ''), 'data-role': 'balcony-body', 'data-id': b.id });
    g.appendChild(svgEl('polygon', { points: pointsAttr(corners), fill: PALETTE.balconyFill, stroke: b.color, 'stroke-width': 2, 'stroke-dasharray': '5 3' }));
    const cx = (corners[0].x + corners[2].x) / 2, cy = (corners[0].y + corners[2].y) / 2;
    const lbl = screenConstGroup(cx, cy, { class: 'dim-label' });
    const txt = svgEl('text', { x: 0, y: 0, 'text-anchor': 'middle' });
    txt.textContent = 'Балкон';
    lbl.appendChild(txt);
    g.appendChild(lbl);
    balconyLayer.appendChild(g);
  });
}

/* ---------------- furniture ---------------- */
function renderFurniture() {
  furnitureLayer.textContent = '';
  // flat items (rugs, floor zones) first so they stay underneath
  const order = project.furniture.slice().sort((a, b) => (a.h <= 2 ? 0 : 1) - (b.h <= 2 ? 0 : 1));
  order.forEach(f => {
    const isSel = selected && selected.type === 'furniture' && selected.id === f.id;
    const corners = rectCorners(f.x, f.y, f.w, f.d, f.rotation);
    const g = svgEl('g', { class: 'furn-g' + (isSel ? ' is-selected' : ''), 'data-role': 'furniture', 'data-id': f.id });
    const flat = f.h <= 2;
    g.appendChild(svgEl('polygon', { points: pointsAttr(corners), fill: planColor(f), 'fill-opacity': flat ? 0.55 : 0.92, stroke: 'rgba(0,0,0,.38)', 'stroke-width': 1 }));
    // front edge (local +Y in plan = front of the 3D model)
    if (!flat) g.appendChild(svgEl('line', { x1: corners[2].x, y1: corners[2].y, x2: corners[3].x, y2: corners[3].y, stroke: 'rgba(0,0,0,.55)', 'stroke-width': 2.2 }));
    if (f.w * ed.scale > Math.max(26, f.label.length * 5.6) && f.d * ed.scale > 16) {
      const lbl = screenConstGroup(f.x, f.y, { class: 'dim-label furn-label' });
      const txt = svgEl('text', { x: 0, y: 0, 'text-anchor': 'middle' });
      txt.textContent = f.label;
      lbl.appendChild(txt);
      g.appendChild(lbl);
    }
    furnitureLayer.appendChild(g);
  });
}

/* ---------------- draft (wall being drawn) ---------------- */
function renderDraft() {
  draftLayer.textContent = '';
  if (activeTool !== 'draw-wall' || wallDraft.length === 0) return;
  const pts = wallDraft.concat(mousePlanPos ? [mousePlanPos] : []);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    g_line(draftLayer, a, b, PALETTE.accent, 2, '6 4');
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const lbl = screenConstGroup(mid.x, mid.y, { class: 'dim-label dim-label--draft' });
    const txt = svgEl('text', { x: 0, y: -6, 'text-anchor': 'middle' });
    txt.textContent = Math.round(dist(a.x, a.y, b.x, b.y)) + ' см';
    lbl.appendChild(txt);
    draftLayer.appendChild(lbl);
  }
  pts.slice(0, -1).forEach(p => {
    const d = screenConstGroup(p.x, p.y);
    d.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 4, fill: PALETTE.accent }));
    draftLayer.appendChild(d);
  });
}
function g_line(layer, a, b, stroke, width, dash) {
  layer.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke, 'stroke-width': width, 'stroke-dasharray': dash || 'none' }));
}

/* ---------------- master render ---------------- */
function render2D() {
  updateWorldTransform();
  renderWalls();
  renderBalconies();
  renderFurniture();
  renderDraft();
  if (emptyHint) emptyHint.style.display = (isProjectEmpty() && activeTool !== 'draw-wall') ? 'flex' : 'none';
  renderProperties();
  renderToolUI();
  scene3DDirty = true;
}


/* =========================================================================
   Part 4: 2D interaction — drawing, selecting, dragging, zoom/pan, keys
   ========================================================================= */

function projectPointOnWall(w, pt) {
  const u = wallDir(w), n = wallNormal(w);
  const dx = pt.x - w.x1, dy = pt.y - w.y1;
  return { s: dx * u.x + dy * u.y, t: dx * n.x + dy * n.y };
}

function findNearestExistingPoint(pt, excludeWallId, excludeWhich) {
  let best = null, bd = Infinity;
  const thresh = 14 / ed.scale;
  project.walls.forEach(w => {
    [['a', w.x1, w.y1], ['b', w.x2, w.y2]].forEach(([which, x, y]) => {
      if (w.id === excludeWallId && which === excludeWhich) return;
      const d = dist(pt.x, pt.y, x, y);
      if (d < thresh && d < bd) { bd = d; best = { x, y }; }
    });
  });
  return best;
}
function applyEndpointSnap(pt, excludeWallId, excludeWhich) {
  return findNearestExistingPoint(pt, excludeWallId, excludeWhich) || { x: snap(pt.x, 5), y: snap(pt.y, 5) };
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

function computeSnappedDrawPoint(rawPt) {
  let pt = { x: snap(rawPt.x, 5), y: snap(rawPt.y, 5) };
  const magnet = findNearestExistingPoint(rawPt, null, null);
  if (magnet && dist(magnet.x, magnet.y, rawPt.x, rawPt.y) < 14 / ed.scale) pt = magnet;
  if (wallDraft.length > 0) {
    const prev = wallDraft[wallDraft.length - 1];
    const dx = pt.x - prev.x, dy = pt.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.01) {
      const ang = Math.atan2(dy, dx);
      const step = deg2rad(15);
      const snapAng = Math.round(ang / step) * step;
      if (Math.abs(angDiff(ang, snapAng)) < deg2rad(6)) {
        pt = { x: snap(prev.x + Math.cos(snapAng) * len, 5), y: snap(prev.y + Math.sin(snapAng) * len, 5) };
      }
    }
  }
  return pt;
}

/* ---------------- wall drawing ---------------- */
function handleDrawWallClick(rawWorld) {
  const pt = computeSnappedDrawPoint(rawWorld);
  wallDraft.push(pt);
  if (wallDraft.length >= 2) {
    const a = wallDraft[wallDraft.length - 2], b = wallDraft[wallDraft.length - 1];
    if (dist(a.x, a.y, b.x, b.y) >= 5) {
      project.walls.push({
        id: uid('w'), type: drawWallType, x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        thickness: drawWallThickness, color: WALL_DEFAULTS[drawWallType].color
      });
    } else {
      wallDraft.pop();
    }
  }
  render2D();
}
function finishWallChain() { wallDraft = []; renderDraft(); }

/* ---------------- add-tool clicks (openings / balcony) ---------------- */
function addOpeningAt(w, kind, worldPt) {
  const def = OPENING_DEFAULTS[kind];
  const local = projectPointOnWall(w, worldPt);
  const len = wallLen(w);
  const width = Math.min(def.width, Math.max(20, len - 10));
  let pos = clamp(local.s - width / 2, 0, Math.max(0, len - width));
  const fake = { id: '__new__', width };
  pos = clampOpeningPos(w, fake, pos);
  const o = { id: uid('o'), wallId: w.id, kind, pos, width, height: def.height, sill: def.sill, color: def.color, hinge: def.hinge || 'left' };
  project.openings.push(o);
  selectObj('opening', o.id);
}

function addBalconyAt(pt) {
  let nearest = null, nd = Infinity;
  project.walls.filter(w => w.type === 'exterior').forEach(w => {
    const local = projectPointOnWall(w, pt);
    const s = clamp(local.s, 0, wallLen(w));
    const proj = wallPoint(w, s, 0);
    const d = dist(pt.x, pt.y, proj.x, proj.y);
    if (d < nd) { nd = d; nearest = { w, s }; }
  });
  let x = pt.x, y = pt.y, rotation = 0, width = 150;
  if (nearest && nd < 400) {
    const w = nearest.w;
    const n = wallNormal(w);
    const b = planBounds();
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const wc = wallPoint(w, nearest.s, 0);
    const outward = ((wc.x - cx) * n.x + (wc.y - cy) * n.y) >= 0 ? 1 : -1;
    x = wc.x + n.x * (w.thickness / 2) * outward;
    y = wc.y + n.y * (w.thickness / 2) * outward;
    rotation = rad2deg(Math.atan2(n.y * outward, n.x * outward));
    width = clamp(wallLen(w) * 0.6, 80, 220);
  }
  const b = { id: uid('bal'), x, y, width, depth: 90, rotation, parapet: 100, color: '#9aa5b1' };
  project.balconies.push(b);
  selectObj('balcony', b.id);
}

function handleAddToolClick(tool, role, roleEl, world) {
  if (tool === 'add-balcony') { addBalconyAt(world); setTool('select'); render2D(); return; }
  const kindMap = { 'add-window': 'window', 'add-doorswing': 'doorswing', 'add-doorsliding': 'doorsliding', 'add-arch': 'arch' };
  const kind = kindMap[tool];
  if (!kind) return;
  if (role === 'wall-body') {
    addOpeningAt(getWall(roleEl.getAttribute('data-id')), kind, world);
    setTool('select');
    render2D();
  } else {
    flashStatus('Кликните по стене, чтобы добавить проём');
  }
}

/* ---------------- selection ---------------- */
function selectObj(type, id) { selected = type ? { type, id } : null; }

function deleteSelected() {
  if (!selected) return;
  if (selected.type === 'wall') {
    project.walls = project.walls.filter(w => w.id !== selected.id);
    project.openings = project.openings.filter(o => o.wallId !== selected.id);
  } else if (selected.type === 'opening') {
    project.openings = project.openings.filter(o => o.id !== selected.id);
  } else if (selected.type === 'balcony') {
    project.balconies = project.balconies.filter(b => b.id !== selected.id);
  } else if (selected.type === 'furniture') {
    project.furniture = project.furniture.filter(f => f.id !== selected.id);
  }
  selected = null;
  render2D();
}

/* ---------------- furniture add from palette ---------------- */
function addFurniture(key) {
  const def = FURNITURE_BY_KEY[key];
  if (!def) return;
  const b = planBounds();
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const jitter = (project.furniture.length % 6) * 14;
  const item = withFinishes({ id: uid('f'), key, cat: def.cat, label: def.label, x: cx + jitter, y: cy + jitter, rotation: 0, w: def.w, d: def.d, h: def.h, z: def.z || 0, color: def.color || '#bbbbbb', finish: null, frame: null, top: null });
  project.furniture.push(item);
  selectObj('furniture', item.id);
  setTool('select');
  render2D();
}

/* ---------------- tool switching ---------------- */
function setTool(tool) {
  if (activeTool === 'draw-wall' && tool !== 'draw-wall') finishWallChain();
  activeTool = tool;
  if (editorSvg) editorSvg.classList.toggle('cursor-crosshair', tool !== 'select');
  renderToolUI();
}

function safeSetPointerCapture(e) {
  try { if (editorSvg.setPointerCapture) editorSvg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
}

/* ---------------- drag lifecycle ---------------- */
function beginDragWallEndpoint(wallId, which, e) {
  safeSetPointerCapture(e);
  drag = { type: 'wall-endpoint', wallId, which };
}
function beginDragWallBody(wallId, world, e) {
  safeSetPointerCapture(e);
  const w = getWall(wallId);
  drag = { type: 'wall-body', wallId, start: world, orig: { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 } };
}
function beginDragOpening(openingId, e) {
  safeSetPointerCapture(e);
  drag = { type: 'opening', id: openingId };
}
function beginDragFurniture(id, world, e) {
  safeSetPointerCapture(e);
  const f = getFurniture(id);
  drag = { type: 'furniture', id, offset: { x: world.x - f.x, y: world.y - f.y } };
}
function beginDragBalcony(id, world, e) {
  safeSetPointerCapture(e);
  const b = getBalcony(id);
  drag = { type: 'balcony', id, offset: { x: world.x - b.x, y: world.y - b.y } };
}
function beginPan(e) {
  safeSetPointerCapture(e);
  drag = { type: 'pan', startClientX: e.clientX, startClientY: e.clientY, startPan: { x: ed.panX, y: ed.panY } };
}

function handleDragMove(e, world) {
  if (!drag) return;
  if (drag.type === 'wall-endpoint') {
    const w = getWall(drag.wallId);
    if (!w) return;
    const p = applyEndpointSnap(world, drag.wallId, drag.which);
    if (drag.which === 'a') { w.x1 = p.x; w.y1 = p.y; } else { w.x2 = p.x; w.y2 = p.y; }
    render2D();
  } else if (drag.type === 'wall-body') {
    const w = getWall(drag.wallId);
    if (!w) return;
    const dx = world.x - drag.start.x, dy = world.y - drag.start.y;
    w.x1 = drag.orig.x1 + dx; w.y1 = drag.orig.y1 + dy;
    w.x2 = drag.orig.x2 + dx; w.y2 = drag.orig.y2 + dy;
    render2D();
  } else if (drag.type === 'opening') {
    const o = getOpening(drag.id);
    if (!o) return;
    const w = getWall(o.wallId);
    const local = projectPointOnWall(w, world);
    o.pos = clampOpeningPos(w, o, local.s - o.width / 2);
    render2D();
  } else if (drag.type === 'furniture') {
    const f = getFurniture(drag.id);
    if (!f) return;
    f.x = world.x - drag.offset.x;
    f.y = world.y - drag.offset.y;
    render2D();
  } else if (drag.type === 'balcony') {
    const b = getBalcony(drag.id);
    if (!b) return;
    b.x = world.x - drag.offset.x;
    b.y = world.y - drag.offset.y;
    render2D();
  } else if (drag.type === 'pan') {
    ed.panX = drag.startPan.x + (e.clientX - drag.startClientX);
    ed.panY = drag.startPan.y + (e.clientY - drag.startClientY);
    render2D();
  }
}

/* ---------------- pointer event wiring ---------------- */
function onPointerDown(e) {
  if (view !== '2d') return;
  if (e.button === 1) { e.preventDefault(); beginPan(e); return; }
  if (e.button !== 0) return;
  const world = eventToWorld(e);
  const roleEl = e.target.closest('[data-role]');
  const role = roleEl ? roleEl.getAttribute('data-role') : null;

  if (activeTool === 'draw-wall') { handleDrawWallClick(world); return; }
  if (activeTool.indexOf('add-') === 0) { handleAddToolClick(activeTool, role, roleEl, world); return; }

  if (role === 'wall-endpoint' && !wallsLocked) {
    selectObj('wall', roleEl.getAttribute('data-id'));
    beginDragWallEndpoint(roleEl.getAttribute('data-id'), roleEl.getAttribute('data-which'), e);
  } else if (role === 'wall-body') {
    selectObj('wall', roleEl.getAttribute('data-id'));
    if (!wallsLocked) beginDragWallBody(roleEl.getAttribute('data-id'), world, e);
  } else if (role === 'opening') {
    selectObj('opening', roleEl.getAttribute('data-id'));
    beginDragOpening(roleEl.getAttribute('data-id'), e);
  } else if (role === 'balcony-body') {
    selectObj('balcony', roleEl.getAttribute('data-id'));
    beginDragBalcony(roleEl.getAttribute('data-id'), world, e);
  } else if (role === 'furniture') {
    selectObj('furniture', roleEl.getAttribute('data-id'));
    beginDragFurniture(roleEl.getAttribute('data-id'), world, e);
  } else {
    selectObj(null, null);
    beginPan(e);
  }
  render2D();
}
function onPointerMove(e) {
  if (view !== '2d') return;
  const raw = eventToWorld(e);
  if (activeTool === 'draw-wall') {
    mousePlanPos = computeSnappedDrawPoint(raw);
    renderDraft();
    updateStatusBar(mousePlanPos);
    return;
  }
  mousePlanPos = raw;
  if (drag) { handleDragMove(e, raw); }
  updateStatusBar(raw);
}
function onPointerUp(e) {
  if (drag) { try { if (editorSvg.releasePointerCapture) editorSvg.releasePointerCapture(e.pointerId); } catch (err) { } }
  drag = null;
}

function zoomFit() {
  const b = planBounds();
  const w = Math.max(80, b.maxX - b.minX + 160), h = Math.max(80, b.maxY - b.minY + 160);
  const availW = Math.max(100, editorSvg.clientWidth - 40), availH = Math.max(100, editorSvg.clientHeight - 40);
  const s = clamp(Math.min(availW / w, availH / h), 0.08, 6);
  ed.scale = s;
  ed.panX = editorSvg.clientWidth / 2 - (b.minX + b.maxX) / 2 * s;
  ed.panY = editorSvg.clientHeight / 2 - (b.minY + b.maxY) / 2 * s;
  render2D();
}
function zoomBy(factor) {
  const cx = editorSvg.clientWidth / 2, cy = editorSvg.clientHeight / 2;
  const newScale = clamp(ed.scale * factor, 0.15, 8);
  const wx = (cx - ed.panX) / ed.scale, wy = (cy - ed.panY) / ed.scale;
  ed.panX = cx - wx * newScale; ed.panY = cy - wy * newScale; ed.scale = newScale;
  render2D();
}

let flashTimer = null;
function flashStatus(msg) {
  const el = document.getElementById('statusBar');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('flash');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('flash'), 1400);
}
function updateStatusBar(pt) {
  const el = document.getElementById('statusBar');
  if (!el || el.classList.contains('flash')) return;
  if (pt) el.textContent = `X: ${Math.round(pt.x)} см    Y: ${Math.round(pt.y)} см    масштаб: ${(ed.scale).toFixed(2)} пикс/см`;
}

function initInteraction2D() {
  editorSvg.addEventListener('pointerdown', onPointerDown);
  editorSvg.addEventListener('pointermove', onPointerMove);
  editorSvg.addEventListener('pointerup', onPointerUp);
  editorSvg.addEventListener('pointercancel', onPointerUp);
  editorSvg.addEventListener('contextmenu', e => { e.preventDefault(); if (activeTool === 'draw-wall') { finishWallChain(); render2D(); } });
  editorSvg.addEventListener('dblclick', e => { e.preventDefault(); if (activeTool === 'draw-wall') { finishWallChain(); render2D(); } });
  editorSvg.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = editorSvg.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const newScale = clamp(ed.scale * factor, 0.15, 8);
    const wx = (mx - ed.panX) / ed.scale, wy = (my - ed.panY) / ed.scale;
    ed.panX = mx - wx * newScale; ed.panY = my - wy * newScale; ed.scale = newScale;
    render2D();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    if (view !== '2d') return;
    if (e.key === 'Escape') {
      if (activeTool === 'draw-wall' && wallDraft.length > 0) { finishWallChain(); render2D(); }
      else { setTool('select'); selectObj(null, null); render2D(); }
    } else if (e.key === 'Backspace' && activeTool === 'draw-wall' && wallDraft.length > 0) {
      e.preventDefault();
      if (wallDraft.length >= 2) project.walls.pop();
      wallDraft.pop();
      render2D();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      e.preventDefault();
      deleteSelected();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'в') && selected) {
      e.preventDefault();
      duplicateSelected();
    } else if ((e.key === 'r' || e.key === 'к') && selected && selected.type === 'furniture') {
      const f = getFurniture(selected.id);
      if (f) { f.rotation = ((f.rotation || 0) + 90) % 360; render2D(); }
    }
  });
}


/* =========================================================================
   Part 5: properties panel, tool rail, top bar, view switching
   ========================================================================= */

let activeFurnCat = 'living';
let furnSearch = '';

/* ---- tiny DOM helpers ---- */
function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'text') e.textContent = attrs[k];
    else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  (children || []).forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}
function propRow(labelText, inputEl, hint) {
  const row = el('div', { class: 'prop-row' });
  row.appendChild(el('label', { text: labelText }));
  row.appendChild(inputEl);
  if (hint) row.appendChild(el('div', { class: 'prop-hint', text: hint }));
  return row;
}
function numberRow(label, value, onChange, opts) {
  opts = opts || {};
  const input = el('input', { type: 'number', value: Math.round(value * 100) / 100, step: opts.step || 1 });
  if (opts.min !== undefined) input.min = opts.min;
  if (opts.max !== undefined) input.max = opts.max;
  if (opts.disabled) input.disabled = true;
  input.addEventListener('change', () => { const v = parseFloat(input.value); if (!isNaN(v)) onChange(v); });
  return propRow(label, input, opts.hint);
}
function colorRow(label, value, onChange) {
  const input = el('input', { type: 'color', value: value });
  input.addEventListener('input', () => onChange(input.value));
  return propRow(label, input);
}
function selectRow(label, value, options, onChange, opts) {
  opts = opts || {};
  const sel = el('select', {});
  if (opts.disabled) sel.disabled = true;
  options.forEach(([val, text]) => {
    const opt = el('option', { value: val, text: text });
    if (val === value) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => onChange(sel.value));
  return propRow(label, sel, opts.hint);
}
function textRow(label, value, onChange) {
  const input = el('input', { type: 'text', value: value });
  input.addEventListener('change', () => onChange(input.value));
  return propRow(label, input);
}

function setWallLength(w, newLen) {
  const d = wallDir(w);
  w.x2 = w.x1 + d.x * newLen;
  w.y2 = w.y1 + d.y * newLen;
}

/* ---------------- properties panel ---------------- */
function renderProperties() {
  const body = document.getElementById('propBody');
  const title = document.getElementById('propTitle');
  if (!body || !title) return;
  body.textContent = '';

  if (!selected) {
    title.textContent = 'Свойства';
    body.appendChild(el('p', { class: 'prop-empty', text: 'Выберите стену, проём, балкон или мебель на плане, чтобы изменить их параметры.' }));
    body.appendChild(el('p', { class: 'prop-empty', text: 'Delete — удалить, Ctrl+D — дублировать выбранный элемент.' }));
    renderProjectFinishes(body);
    return;
  }

  if (selected.type === 'wall') {
    const w = getWall(selected.id);
    if (!w) { selected = null; renderProperties(); return; }
    title.textContent = 'Стена';
    const locked = wallsLocked;
    body.appendChild(selectRow('Тип стены', w.type, [['exterior', 'Наружная'], ['interior', 'Внутренняя']], v => {
      w.type = v; render2D();
    }, { disabled: locked }));
    body.appendChild(numberRow('Длина, см', wallLen(w), v => { setWallLength(w, Math.max(20, v)); render2D(); }, { min: 20, step: 1, disabled: locked }));
    body.appendChild(numberRow('Толщина, см', w.thickness, v => { w.thickness = clamp(v, 4, 60); render2D(); }, { min: 4, max: 60, step: 1, disabled: locked }));
    if (locked) body.appendChild(el('p', { class: 'prop-hint prop-hint--warn', text: 'Планировка закреплена. Разблокируйте её, чтобы менять геометрию стен.' }));
    body.appendChild(colorRow('Цвет на плане', w.color, v => { w.color = v; render2D(); }));
    body.appendChild(colorRow('Покраска (3D)', w.paint || project.wallPaint, v => { w.paint = v; render2D(); }));
    if (w.paint) {
      const rb = el('button', { class: 'btn btn-mini', type: 'button', text: 'Как у всей квартиры' });
      rb.addEventListener('click', () => { w.paint = null; render2D(); });
      body.appendChild(el('div', { class: 'prop-row' }, [el('span'), rb]));
    }
    body.appendChild(deleteButton());
  } else if (selected.type === 'opening') {
    const o = getOpening(selected.id);
    if (!o) { selected = null; renderProperties(); return; }
    const w = getWall(o.wallId);
    const def = OPENING_DEFAULTS[o.kind];
    title.textContent = def.label;
    body.appendChild(numberRow('Позиция на стене, см', o.pos, v => { o.pos = clampOpeningPos(w, o, v); render2D(); }, { min: 0, step: 1 }));
    body.appendChild(numberRow('Ширина, см', o.width, v => { o.width = clampOpeningWidth(w, o, v); o.pos = clampOpeningPos(w, o, o.pos); render2D(); }, { min: 20, step: 1 }));
    body.appendChild(numberRow('Высота, см', o.height, v => { o.height = clamp(v, 30, project.ceilingHeight); render2D(); }, { min: 30, max: project.ceilingHeight, step: 1 }));
    if (o.kind === 'window') {
      body.appendChild(numberRow('Высота подоконника, см', o.sill, v => { o.sill = clamp(v, 0, project.ceilingHeight - 30); render2D(); }, { min: 0, step: 1 }));
    }
    if (o.kind === 'doorswing') {
      body.appendChild(selectRow('Открывание', o.hinge, [['left', 'Петли слева'], ['right', 'Петли справа']], v => { o.hinge = v; render2D(); }));
    }
    if (o.kind === 'window') {
      body.appendChild(selectRow('Профиль окна', o.finish || 'pvc', [['pvc', 'Белый ПВХ'], ['black', 'Чёрный алюминий'], ['oak', 'Дерево — дуб'], ['walnut', 'Дерево — орех']], v => { o.finish = v; render2D(); }));
    } else if (o.kind === 'doorswing' || o.kind === 'doorsliding') {
      const opts = [['oaklight', 'Дуб светлый'], ['oak', 'Дуб'], ['walnut', 'Орех'], ['ash', 'Ясень беленый'], ['matte', 'Эмаль (цвет ниже)'], ['black', 'Чёрный металл']];
      body.appendChild(selectRow(o.kind === 'doorsliding' ? 'Профиль' : 'Полотно', o.finish || (o.kind === 'doorsliding' ? 'black' : 'oaklight'), opts, v => { o.finish = v; render2D(); }));
    }
    body.appendChild(colorRow('Цвет', o.color, v => { o.color = v; render2D(); }));
    body.appendChild(deleteButton());
  } else if (selected.type === 'balcony') {
    const b = getBalcony(selected.id);
    if (!b) { selected = null; renderProperties(); return; }
    title.textContent = 'Балкон';
    body.appendChild(numberRow('Ширина, см', b.width, v => { b.width = clamp(v, 60, 500); render2D(); }, { min: 60, step: 1 }));
    body.appendChild(numberRow('Глубина, см', b.depth, v => { b.depth = clamp(v, 40, 300); render2D(); }, { min: 40, step: 1 }));
    body.appendChild(numberRow('Высота ограждения, см', b.parapet, v => { b.parapet = clamp(v, 60, 150); render2D(); }, { min: 60, max: 150, step: 1 }));
    body.appendChild(numberRow('Поворот, °', b.rotation, v => { b.rotation = v; render2D(); }, { step: 5 }));
    body.appendChild(numberRow('X, см', b.x, v => { b.x = v; render2D(); }, { step: 1 }));
    body.appendChild(numberRow('Y, см', b.y, v => { b.y = v; render2D(); }, { step: 1 }));
    body.appendChild(colorRow('Цвет ограждения', b.color, v => { b.color = v; render2D(); }));
    body.appendChild(el('p', { class: 'prop-hint', text: 'Перетащите балкон на плане, чтобы изменить его расположение.' }));
    body.appendChild(deleteButton());
  } else if (selected.type === 'furniture') {
    const f = getFurniture(selected.id);
    if (!f) { selected = null; renderProperties(); return; }
    title.textContent = f.label;
    body.appendChild(textRow('Название', f.label, v => { f.label = v || f.label; render2D(); }));
    body.appendChild(numberRow('Ширина, см', f.w, v => { f.w = clamp(v, 10, 500); render2D(); }, { min: 10, step: 1 }));
    body.appendChild(numberRow('Глубина, см', f.d, v => { f.d = clamp(v, 10, 500); render2D(); }, { min: 10, step: 1 }));
    body.appendChild(numberRow('Высота, см', f.h, v => { f.h = clamp(v, 10, 300); render2D(); }, { min: 10, step: 1 }));
    body.appendChild(numberRow('Высота от пола, см', f.z, v => { f.z = clamp(v, 0, 250); render2D(); }, { min: 0, step: 1, hint: 'Например, для подвесного шкафа' }));
    const rotRow = el('div', { class: 'prop-row' });
    rotRow.appendChild(el('label', { text: 'Поворот, °' }));
    const rotWrap = el('div', { class: 'rot-wrap' });
    const rotInput = el('input', { type: 'number', value: f.rotation, step: 5 });
    rotInput.addEventListener('change', () => { f.rotation = parseFloat(rotInput.value) || 0; render2D(); });
    const rotL = el('button', { class: 'btn btn-mini', type: 'button', text: '⟲ 90°' });
    rotL.addEventListener('click', () => { f.rotation = (f.rotation - 90) % 360; render2D(); });
    const rotR = el('button', { class: 'btn btn-mini', type: 'button', text: '90° ⟳' });
    rotR.addEventListener('click', () => { f.rotation = (f.rotation + 90) % 360; render2D(); });
    rotWrap.appendChild(rotL); rotWrap.appendChild(rotInput); rotWrap.appendChild(rotR);
    rotRow.appendChild(rotWrap);
    body.appendChild(rotRow);
    const def = FURNITURE_BY_KEY[f.key] || {};
    const finOpts = list => list.map(k => [k, FINISHES[k] ? FINISHES[k].label : k]);
    if (def.fin) body.appendChild(selectRow(def.fl || 'Материал', f.finish || def.finish, finOpts(def.fin), v => { f.finish = v; render2D(); }));
    if (def.tops) body.appendChild(selectRow(def.tl || 'Столешница', f.top || def.top, finOpts(def.tops), v => { f.top = v; render2D(); }));
    if (def.frm) body.appendChild(selectRow(def.rl || 'Ножки / фурнитура', f.frame || def.frame, finOpts(def.frm), v => { f.frame = v; render2D(); }));
    const fin = f.finish || def.finish;
    if (!fin || (FINISHES[fin] && FINISHES[fin].tint)) body.appendChild(colorRow('Цвет', f.color, v => { f.color = v; render2D(); }));
    const dup = el('button', { class: 'btn btn-block', type: 'button', text: '⧉ Дублировать' });
    dup.addEventListener('click', duplicateSelected);
    body.appendChild(dup);
    body.appendChild(deleteButton());
  }
}

function renderProjectFinishes(body) {
  body.appendChild(el('h4', { class: 'rail-title', text: 'Отделка квартиры (3D)', style: 'margin-top:18px' }));
  body.appendChild(selectRow('Пол', project.floor, Object.keys(FLOORS).map(k => [k, FLOORS[k]]), v => { project.floor = v; render2D(); }));
  body.appendChild(colorRow('Стены внутри', project.wallPaint, v => { project.wallPaint = v; render2D(); }));
  body.appendChild(colorRow('Фасад', project.facade, v => { project.facade = v; render2D(); }));
  body.appendChild(selectRow('Срез стен', project.darkCaps ? 'dark' : 'light', [['dark', 'Графитовый'], ['light', 'Белый']], v => { project.darkCaps = v === 'dark'; render2D(); }));
  body.appendChild(selectRow('Потолок', project.showCeiling ? 'on' : 'off', [['on', 'Виден изнутри'], ['off', 'Без потолка']], v => { project.showCeiling = v === 'on'; render2D(); }));
  body.appendChild(el('p', { class: 'prop-hint', text: 'Потолок виден только из камеры «от первого лица» — сверху он прозрачен. Для отдельной комнаты можно положить «Пол: плитка (зона)» из раздела «Отделка».' }));
}

function duplicateSelected() {
  if (!selected || selected.type !== 'furniture') return;
  const f = getFurniture(selected.id); if (!f) return;
  const c = Object.assign({}, f, { id: uid('f'), x: f.x + 20, y: f.y + 20 });
  project.furniture.push(c);
  selectObj('furniture', c.id);
  render2D();
}

function deleteButton() {
  const btn = el('button', { class: 'btn btn-danger btn-block', type: 'button', text: 'Удалить элемент' });
  btn.addEventListener('click', () => deleteSelected());
  return btn;
}

/* ---------------- tool rail state ---------------- */
function renderToolUI() {
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tool') === activeTool);
  });
  const drawBtn = document.getElementById('drawWallBtn');
  if (drawBtn) drawBtn.disabled = wallsLocked;
  const lockBtn = document.getElementById('lockBtn');
  if (lockBtn) {
    lockBtn.textContent = wallsLocked ? '🔓 Редактировать планировку' : '🔒 Закрепить планировку';
    lockBtn.classList.toggle('is-locked', wallsLocked);
  }
  const wts = document.getElementById('wallTypeSelect');
  if (wts) wts.value = drawWallType;
  const wth = document.getElementById('wallThicknessInput');
  if (wth && document.activeElement !== wth) wth.value = drawWallThickness;
  document.querySelectorAll('.furn-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-cat') === activeFurnCat);
  });
  const view2Btn = document.getElementById('viewTab2D'), view3Btn = document.getElementById('viewTab3D');
  if (view2Btn && view3Btn) { view2Btn.classList.toggle('active', view === '2d'); view3Btn.classList.toggle('active', view === '3d'); }
  const nameInput = document.getElementById('projectNameInput');
  if (nameInput && document.activeElement !== nameInput) nameInput.value = project.name;
  const ceilInput = document.getElementById('ceilingHeightInput');
  if (ceilInput && document.activeElement !== ceilInput) ceilInput.value = project.ceilingHeight;
  const wallHeightSlider = document.getElementById('wallHeightPctInput');
  if (wallHeightSlider && document.activeElement !== wallHeightSlider) wallHeightSlider.value = wallHeightPct3D;
}

/* ---------------- furniture palette with rendered thumbnails ---------------- */
const thumbCache = {};
let thumbQueue = [];
let thumbBusy = false;

function buildFurniturePalette() {
  const tabsEl = document.getElementById('furnTabs');
  tabsEl.textContent = '';
  CATEGORY_ORDER.forEach(cat => {
    const n = FURNITURE_CATALOG.filter(f => f.cat === cat).length;
    const tab = el('button', { class: 'furn-tab', 'data-cat': cat, type: 'button', title: n + ' предметов' }, [CATEGORY_LABELS[cat]]);
    tab.addEventListener('click', () => { activeFurnCat = cat; furnSearch = ''; document.getElementById('furnSearch').value = ''; renderPalette(); renderToolUI(); });
    tabsEl.appendChild(tab);
  });
  const search = document.getElementById('furnSearch');
  search.addEventListener('input', () => { furnSearch = search.value.trim().toLowerCase(); renderPalette(); });
  document.getElementById('furnCount').textContent = FURNITURE_CATALOG.length + ' моделей';
  renderPalette();
  // render every thumbnail in the background, current category first
  thumbQueue = FURNITURE_CATALOG.slice().sort((a, b) => (a.cat === activeFurnCat ? 0 : 1) - (b.cat === activeFurnCat ? 0 : 1)).map(f => f.key);
  setTimeout(pumpThumbs, 300);
}

function pumpThumbs() {
  if (thumbBusy) return;
  const key = thumbQueue.shift();
  if (!key) return;
  thumbBusy = true;
  try {
    const def = FURNITURE_BY_KEY[key];
    if (!thumbCache[key]) thumbCache[key] = renderThumbnail(withFinishes({ key, w: def.w, d: def.d, h: def.h, color: def.color || '#bbbbbb' }));
    document.querySelectorAll('img[data-thumb="' + key + '"]').forEach(img => { img.src = thumbCache[key]; img.classList.add('ready'); });
  } catch (e) { console.warn('thumbnail failed', key, e); }
  thumbBusy = false;
  if (window.requestIdleCallback) window.requestIdleCallback(pumpThumbs, { timeout: 200 }); else setTimeout(pumpThumbs, 16);
}

function renderPalette() {
  const grid = document.getElementById('furnGrid');
  grid.textContent = '';
  const items = FURNITURE_CATALOG.filter(f => furnSearch ? f.label.toLowerCase().includes(furnSearch) || CATEGORY_LABELS[f.cat].toLowerCase().includes(furnSearch) : f.cat === activeFurnCat);
  if (!items.length) grid.appendChild(el('p', { class: 'prop-empty', text: 'Ничего не найдено.' }));
  items.forEach(f => {
    const btn = el('button', { class: 'furn-item', type: 'button', title: f.label + ' — ' + f.w + '×' + f.d + '×' + f.h + ' см' });
    const img = el('img', { 'data-thumb': f.key, alt: '' });
    if (thumbCache[f.key]) { img.src = thumbCache[f.key]; img.classList.add('ready'); }
    else if (!thumbQueue.includes(f.key)) thumbQueue.unshift(f.key);
    else { thumbQueue.splice(thumbQueue.indexOf(f.key), 1); thumbQueue.unshift(f.key); }
    btn.appendChild(el('span', { class: 'furn-thumb' }, [img]));
    btn.appendChild(el('span', { class: 'furn-name', text: f.label }));
    btn.appendChild(el('span', { class: 'furn-dims', text: f.w + '×' + f.d + ' см' }));
    btn.addEventListener('click', () => addFurniture(f.key));
    grid.appendChild(btn);
  });
  pumpThumbs();
}

/* ---------------- top bar / left panel wiring ---------------- */
function toggleLock() {
  wallsLocked = !wallsLocked;
  if (wallsLocked && activeTool === 'draw-wall') setTool('select');
  if (wallsLocked && selected && selected.type === 'wall') selected = null;
  render2D();
}

function switchView(v) {
  view = v;
  document.getElementById('view2DPane').style.display = v === '2d' ? 'block' : 'none';
  document.getElementById('view3DPane').style.display = v === '3d' ? 'block' : 'none';
  document.getElementById('leftRail').style.display = v === '2d' ? 'flex' : 'none';
  document.getElementById('rightRail').style.display = v === '2d' ? 'flex' : 'none';
  document.getElementById('workspace').classList.toggle('mode-3d', v === '3d');
  document.getElementById('statusBar').style.display = v === '2d' ? 'block' : 'none';
  document.getElementById('view3DToolbar').style.display = v === '3d' ? 'flex' : 'none';
  renderToolUI();
  if (v === '3d') {
    ensureEngine();
    if (!engine) return;
    engine.start();
    if (scene3DDirty) { rebuildScene(); scene3DDirty = false; }
  } else if (engine) {
    engine.stop();
  }
}

function toggleHelp(show) {
  document.getElementById('helpOverlay').style.display = show ? 'flex' : 'none';
}

function initTopBar() {
  document.getElementById('projectNameInput').addEventListener('change', e => {
    project.name = e.target.value.trim() || 'Без названия';
    e.target.value = project.name;
  });
  document.getElementById('ceilingHeightInput').addEventListener('change', e => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0) project.ceilingHeight = clamp(v, 150, 600);
    e.target.value = project.ceilingHeight;
    scene3DDirty = true;
    if (view === '3d') { rebuildScene(); scene3DDirty = false; }
    renderProperties();
  });
  document.getElementById('lockBtn').addEventListener('click', toggleLock);
  document.getElementById('viewTab2D').addEventListener('click', () => switchView('2d'));
  document.getElementById('viewTab3D').addEventListener('click', () => switchView('3d'));
  document.getElementById('newProjectBtn').addEventListener('click', () => {
    if (isProjectEmpty() || confirm('Создать новый проект? Несохранённые изменения будут потеряны.')) {
      project = newProject(); wallsLocked = false; selected = null; wallDraft = []; activeTool = 'select'; scene3DDirty = true;
      hasFramedOnce = false;
      ed.scale = 1.6; ed.panX = 120; ed.panY = 120;
      render2D();
    }
  });
  document.getElementById('saveProjectBtn').addEventListener('click', downloadProjectFile);
  document.getElementById('loadProjectBtn').addEventListener('click', () => document.getElementById('loadFileInput').click());
  document.getElementById('loadFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { loadProjectFromJSONText(reader.result); hasFramedOnce = false; render2D(); zoomFit(); }
      catch (err) { alert(err.message || 'Не удалось загрузить файл.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
  document.getElementById('helpBtn').addEventListener('click', () => toggleHelp(true));
  document.getElementById('helpCloseBtn').addEventListener('click', () => toggleHelp(false));
  document.getElementById('helpOverlay').addEventListener('click', (e) => { if (e.target.id === 'helpOverlay') toggleHelp(false); });
  document.getElementById('zoomInBtn').addEventListener('click', () => zoomBy(1.25));
  document.getElementById('zoomOutBtn').addEventListener('click', () => zoomBy(0.8));
  document.getElementById('zoomFitBtn').addEventListener('click', zoomFit);
  document.getElementById('wallHeightPctInput').addEventListener('input', (e) => {
    wallHeightPct3D = parseFloat(e.target.value) || 100;
    if (view === '3d') rebuildScene();
  });
  document.getElementById('resetViewBtn').addEventListener('click', () => engine && engine.frame('iso'));
  document.getElementById('camTopBtn').addEventListener('click', () => engine && engine.frame('top'));
  document.getElementById('camEyeBtn').addEventListener('click', () => engine && engine.frame('eye'));
  document.querySelectorAll('[data-time]').forEach(b => b.addEventListener('click', () => {
    if (!engine) return;
    engine.setTime(b.getAttribute('data-time'));
    document.querySelectorAll('[data-time]').forEach(x => x.classList.toggle('active', x === b));
  }));
  document.getElementById('sunAzInput').addEventListener('input', e => engine && engine.setSunAzimuth(parseFloat(e.target.value) || 0));
  document.getElementById('qualitySelect').addEventListener('change', e => engine && engine.setQuality(e.target.value));
  document.getElementById('snapshotBtn').addEventListener('click', takeSnapshot);
  document.getElementById('demoBtn').addEventListener('click', loadDemo);
  const hintDemo = document.getElementById('hintDemoBtn');
  if (hintDemo) hintDemo.addEventListener('click', loadDemo);
}

/* ---------------- photoreal 3D glue ---------------- */
function ensureEngine() {
  if (engine) return;
  try {
    engine = createEngine(document.getElementById('threeContainer'));
  } catch (e) {
    console.error(e);
    alert('Не удалось запустить WebGL. Фотореалистичный режим требует браузер с поддержкой WebGL 2.');
    engine = null;
  }
}

function rebuildScene() {
  ensureEngine();
  if (!engine) return;
  if (!hasFramedOnce) { engine.resetFraming(); hasFramedOnce = true; }
  engine.rebuild(project, { wallHeightPct: wallHeightPct3D });
}

function takeSnapshot() {
  if (!engine) return;
  const btn = document.getElementById('snapshotBtn');
  const sizeSel = document.getElementById('snapshotSize');
  btn.disabled = true; btn.textContent = '⏳ Рендер…';
  setTimeout(() => {
    try {
      const dataUrl = engine.snapshot(parseInt(sizeSel.value, 10) || 3000);
      // convert to a Blob URL: big data: URLs are refused as downloads by some browsers
      const bin = atob(dataUrl.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      const a = document.createElement('a');
      a.href = url;
      a.download = (project.name || 'render').replace(/[\\/:*?"<>|]+/g, '_') + ' — 3D.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { alert('Не удалось сохранить снимок: ' + (e.message || e)); }
    btn.disabled = false; btn.textContent = '📸 Снимок';
  }, 30);
}

function loadDemo() {
  if (!isProjectEmpty() && !confirm('Загрузить пример квартиры? Текущий проект будет заменён (сохраните его, если нужно).')) return;
  loadProjectFromJSONText(JSON.stringify(DEMO_PROJECT));
  hasFramedOnce = false;
  render2D(); zoomFit();
  if (view === '3d') { rebuildScene(); scene3DDirty = false; }
}

function initLeftPanel() {
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-tool');
      if (t === 'draw-wall' && wallsLocked) return;
      setTool(t);
      render2D();
    });
  });
  document.getElementById('wallTypeSelect').addEventListener('change', (e) => {
    drawWallType = e.target.value;
    drawWallThickness = WALL_DEFAULTS[drawWallType].thickness;
    renderToolUI();
  });
  document.getElementById('wallThicknessInput').addEventListener('change', (e) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0) drawWallThickness = clamp(v, 4, 60);
    renderToolUI();
  });
}


/* =========================================================================
   Part 7: bootstrap
   ========================================================================= */

function initApp() {
  initDom2D();
  buildFurniturePalette();
  initTopBar();
  initLeftPanel();
  initInteraction2D();
  render2D();
  zoomFit();
  renderToolUI();
}

document.addEventListener('DOMContentLoaded', initApp);

