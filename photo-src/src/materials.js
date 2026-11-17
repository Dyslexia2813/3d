/* =========================================================================
   Photoreal planner — procedural textures & PBR material library.
   Every texture is generated on a <canvas> at runtime, so the planner needs
   no external image files and works offline from a single HTML file.
   Units: geometry is in centimetres, UVs are in metres (see applyBoxUV).
   ========================================================================= */
import * as THREE from 'three';

/* ---------------- deterministic noise ---------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** tileable value noise on a period×period lattice */
function makeNoise(period, seed) {
  const rnd = mulberry32(seed || 1);
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const fade = t => t * t * (3 - 2 * t);
  return function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const a = g[y0 * period + x0], b = g[y0 * period + x1], c = g[y1 * period + x0], d = g[y1 * period + x1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}
/** fractal noise, tileable over [0,1)² when sampled as fbm(u*base, v*base) */
function makeFbm(base, octaves, seed) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push(makeNoise(base << o, (seed || 1) * 31 + o * 7));
  return function (u, v) {
    let sum = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < octaves; o++) {
      const f = base << o;
      sum += layers[o](u * f, v * f) * amp; norm += amp; amp *= 0.5;
    }
    return sum / norm;
  };
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}
function hexToRgb(hex) { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; }
function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

/** paint a canvas pixel by pixel. fn(u,v) -> [r,g,b] or number (gray) */
function paint(size, fn) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = fn(x / size, y / size, x, y);
      const i = (y * size + x) * 4;
      if (typeof r === 'number') { d[i] = d[i + 1] = d[i + 2] = clamp255(r); }
      else { d[i] = clamp255(r[0]); d[i + 1] = clamp255(r[1]); d[i + 2] = clamp255(r[2]); }
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function toTexture(c, srgb, repeatMeters) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeatMeters) t.repeat.set(1 / repeatMeters, 1 / repeatMeters);
  t.needsUpdate = true;
  return t;
}

/* ---------------- texture recipes ---------------- */
const texCache = new Map();
function cached(key, make) {
  if (!texCache.has(key)) texCache.set(key, make());
  return texCache.get(key);
}

const WOOD_TONES = {
  oak:       { base: '#c9a982', dark: '#a3825e', label: 'Дуб натуральный' },
  oaklight:  { base: '#dcc3a1', dark: '#b89c78', label: 'Дуб светлый' },
  walnut:    { base: '#7a5236', dark: '#4f321f', label: 'Орех' },
  oakgray:   { base: '#a89f94', dark: '#7f766b', label: 'Дуб серый' },
  ash:       { base: '#e6dccd', dark: '#c8b9a3', label: 'Ясень беленый' },
  teak:      { base: '#a27552', dark: '#73502f', label: 'Тик' }
};

/** wood grain value at (u,v) — long fibres along v */
function grainFn(seed) {
  const n1 = makeFbm(4, 5, seed);
  const n2 = makeFbm(2, 3, seed + 9);
  const fine = makeFbm(32, 2, seed + 3);
  return function (u, v) {
    const warp = n1(u, v) * 1.6 + n2(u, v) * 0.8;
    const rings = Math.sin((u * 48 + warp * 2.2) * Math.PI);
    const fibre = fine(u, v);
    return 0.62 + 0.16 * rings * Math.abs(rings) + 0.22 * (fibre - 0.5) + (n2(u, v) - 0.5) * 0.25;
  };
}

/** floor boards: 2.4 m × 2.4 m tile, 12 boards of 20 cm, staggered joints */
function woodFloorTextures(tone) {
  return cached('floor_' + tone, () => {
    const S = 1024, boards = 12;
    const t = WOOD_TONES[tone] || WOOD_TONES.oak;
    const base = hexToRgb(t.base), dark = hexToRgb(t.dark);
    const rnd = mulberry32(tone.length * 97 + 3);
    const cols = [];
    for (let i = 0; i < boards; i++) {
      const cut = 0.25 + rnd() * 0.5, off = rnd();
      cols.push({ cut, off, tint: [0.9 + rnd() * 0.2, 0.9 + rnd() * 0.2], shade: 0.86 + rnd() * 0.22 });
    }
    const grain = grainFn(11);
    const color = [], height = [];
    const col = paint(S, (u, v) => {
      const bi = Math.floor(u * boards), bu = u * boards - bi, c = cols[bi];
      const vv = (v + c.off) % 1;
      const seg = vv < c.cut ? 0 : 1;
      const g = grain((bu + bi * 0.37 + seg * 0.5) % 1, (vv * 0.5 + seg * 0.31) % 1);
      const sh = c.shade * c.tint[seg];
      const k = Math.min(1, Math.max(0, g));
      let r = (dark[0] + (base[0] - dark[0]) * k) * sh, gg = (dark[1] + (base[1] - dark[1]) * k) * sh, b = (dark[2] + (base[2] - dark[2]) * k) * sh;
      const edge = Math.min(bu, 1 - bu) * S / boards;            // px to long joint
      const vEdge = Math.min(Math.abs(vv - c.cut), vv, 1 - vv) * S; // px to butt joint
      if (edge < 1.2 || vEdge < 1.2) { r *= 0.55; gg *= 0.55; b *= 0.55; }
      return [r, gg, b];
    });
    const bump = paint(512, (u, v) => {
      const bi = Math.floor(u * boards), bu = u * boards - bi, c = cols[bi];
      const vv = (v + c.off) % 1;
      const edge = Math.min(bu, 1 - bu) * 512 / boards;
      const vEdge = Math.min(Math.abs(vv - c.cut), vv, 1 - vv) * 512;
      const g = grain((bu + bi * 0.37) % 1, vv * 0.5);
      if (edge < 0.8 || vEdge < 0.8) return 40;
      return 170 + g * 50;
    });
    return { map: toTexture(col, true, 2.4), bump: toTexture(bump, false, 2.4) };
  });
}

/** furniture veneer: 1 m tile, continuous grain */
function veneerTextures(tone) {
  return cached('veneer_' + tone, () => {
    const t = WOOD_TONES[tone] || WOOD_TONES.oak;
    const base = hexToRgb(t.base), dark = hexToRgb(t.dark);
    const grain = grainFn(tone.length * 13 + 5);
    const col = paint(512, (u, v) => {
      const k = Math.min(1, Math.max(0, grain(u, v)));
      return [dark[0] + (base[0] - dark[0]) * k, dark[1] + (base[1] - dark[1]) * k, dark[2] + (base[2] - dark[2]) * k];
    });
    const bump = paint(256, (u, v) => 140 + grain(u, v) * 60);
    return { map: toTexture(col, true, 1), bump: toTexture(bump, false, 1) };
  });
}

/** woven fabric: near-white albedo (tinted by material.color) + weave bump. 12 cm tile */
function fabricTextures(kind) {
  return cached('fabric_' + kind, () => {
    const n = makeFbm(8, 4, kind.length * 5 + 1);
    const fine = makeNoise(256, 77);
    let col, bump;
    if (kind === 'boucle') {
      const blobs = makeFbm(16, 3, 41);
      col = paint(256, (u, v) => 205 + blobs(u, v) * 50);
      bump = paint(256, (u, v) => { const b = blobs(u, v); return 60 + Math.pow(b, 1.6) * 260; });
    } else if (kind === 'velvet') {
      col = paint(256, (u, v) => 220 + n(u, v) * 35);
      bump = paint(256, (u, v) => 128 + (n(u, v) - 0.5) * 40);
    } else if (kind === 'leather') {
      const cell = makeFbm(24, 3, 9);
      col = paint(256, (u, v) => 215 + n(u, v) * 40);
      bump = paint(256, (u, v) => { const c = cell(u, v); return 110 + Math.abs(c - 0.5) * 220; });
    } else { // linen / woven
      const threads = 64;
      col = paint(256, (u, v, x, y) => {
        const s = 222 + n(u, v) * 30 + (fine(x, y) - 0.5) * 18;
        return s;
      });
      bump = paint(256, (u, v) => {
        const a = Math.sin(u * threads * Math.PI * 2), b = Math.sin(v * threads * Math.PI * 2);
        const warp = (Math.floor(u * threads) + Math.floor(v * threads)) % 2 ? a : b;
        return 128 + warp * 60 + (n(u, v) - 0.5) * 50;
      });
    }
    const rep = kind === 'leather' ? 0.25 : kind === 'boucle' ? 0.18 : 0.12;
    return { map: toTexture(col, true, rep), bump: toTexture(bump, false, rep) };
  });
}

function marbleTextures(tone) {
  return cached('marble_' + tone, () => {
    const n = makeFbm(3, 6, tone === 'dark' ? 5 : 2);
    const m = makeFbm(6, 4, 8);
    const isDark = tone === 'dark', isWarm = tone === 'warm';
    const col = paint(1024, (u, v) => {
      const t = Math.abs(Math.sin((u * 2 + v * 3) * Math.PI + n(u, v) * 9));
      const vein = Math.pow(1 - t, 14) * 0.9 + Math.pow(1 - Math.abs(Math.sin((u * 5 - v) * Math.PI + m(u, v) * 12)), 30) * 0.5;
      const cloud = n(u * 2 % 1, v * 2 % 1) * 0.06;
      if (isDark) { const b = 32 + cloud * 300; return [b + vein * 170, b + vein * 160, b + vein * 150]; }
      const b = 242 - cloud * 220;
      if (isWarm) return [b - vein * 90, b - vein * 100 - 6, b - vein * 112 - 14];
      return [b - vein * 120, b - vein * 116, b - vein * 110];
    });
    return { map: toTexture(col, true, 1.6) };
  });
}

function concreteTextures(tone) {
  return cached('concrete_' + tone, () => {
    const n = makeFbm(4, 6, 21);
    const pores = makeNoise(512, 3);
    const base = tone === 'dark' ? 105 : tone === 'warm' ? 196 : 182;
    const col = paint(512, (u, v, x, y) => {
      const b = base + (n(u, v) - 0.5) * 50 - (pores(x, y) > 0.985 ? 30 : 0);
      return tone === 'warm' ? [b + 6, b, b - 8] : [b, b, b + 2];
    });
    const bump = paint(512, (u, v, x, y) => 128 + (n(u, v) - 0.5) * 50 - (pores(x, y) > 0.985 ? 70 : 0));
    return { map: toTexture(col, true, 1.8), bump: toTexture(bump, false, 1.8) };
  });
}

/** square tiles: size in cm, grout colour, glaze variation */
function tileTextures(key, opts) {
  return cached('tile_' + key, () => {
    const per = opts.per; // tiles per texture side
    const n = makeFbm(4, 4, key.length + 2);
    const rnd = mulberry32(key.length * 7 + 1);
    const shades = []; for (let i = 0; i < per * per; i++) shades.push(0.94 + rnd() * 0.1);
    const base = hexToRgb(opts.color), grout = hexToRgb(opts.grout);
    const S = 1024, gw = opts.groutPx || 3;
    const marble = opts.marble ? marbleTextures(opts.marble).map.image : null;
    let mctx = null;
    if (marble) mctx = marble.getContext('2d').getImageData(0, 0, marble.width, marble.height).data;
    const col = paint(S, (u, v, x, y) => {
      const tx = Math.floor(u * per), ty = Math.floor(v * per);
      const lx = (u * per - tx) * S / per, ly = (v * per - ty) * S / per;
      if (lx < gw || ly < gw) return grout;
      const sh = shades[ty * per + tx] * (0.96 + n(u, v) * 0.08);
      if (mctx) {
        const mi = ((y % marble.height) * marble.width + (x % marble.width)) * 4;
        return [mctx[mi] * sh, mctx[mi + 1] * sh, mctx[mi + 2] * sh];
      }
      return [base[0] * sh, base[1] * sh, base[2] * sh];
    });
    const rough = paint(256, (u, v) => {
      const lx = (u * per % 1) * 256 / per, ly = (v * per % 1) * 256 / per;
      return (lx < gw / 4 || ly < gw / 4) ? 245 : opts.rough * 255 + (n(u, v) - 0.5) * 30;
    });
    const bump = paint(256, (u, v) => {
      const lx = (u * per % 1) * 256 / per, ly = (v * per % 1) * 256 / per;
      return (lx < gw / 4 || ly < gw / 4) ? 30 : 200;
    });
    const rep = opts.size * per / 100;
    return { map: toTexture(col, true, rep), rough: toTexture(rough, false, rep), bump: toTexture(bump, false, rep) };
  });
}

function plasterTextures() {
  return cached('plaster', () => {
    const n = makeFbm(8, 5, 4);
    const col = paint(256, (u, v) => 246 + (n(u, v) - 0.5) * 14);
    const bump = paint(256, (u, v) => 128 + (n(u, v) - 0.5) * 70);
    return { map: toTexture(col, true, 1.2), bump: toTexture(bump, false, 1.2) };
  });
}

function rattanTextures() {
  return cached('rattan', () => {
    const k = 24;
    const col = paint(256, (u, v) => {
      const a = Math.abs(Math.sin((u + v) * k * Math.PI)), b = Math.abs(Math.sin((u - v) * k * Math.PI));
      const hole = a < 0.25 && b < 0.25;
      if (hole) return [60, 42, 26];
      const w = Math.max(a, b);
      return [196 * w + 30, 160 * w + 24, 112 * w + 16];
    });
    return { map: toTexture(col, true, 0.15), bump: toTexture(col, false, 0.15) };
  });
}

/* ---------------- rugs & art (UV 0..1 across the object) ---------------- */
export function rugTexture(pattern, colorA, colorB) {
  return cached('rug_' + pattern + colorA + colorB, () => {
    const a = hexToRgb(colorA), b = hexToRgb(colorB);
    const n = makeFbm(16, 3, 5);
    const fine = makeNoise(512, 8);
    const c = paint(512, (u, v, x, y) => {
      let k = 0;
      const fx = Math.min(u, 1 - u), fy = Math.min(v, 1 - v), f = Math.min(fx, fy);
      if (pattern === 'border') k = (f > 0.04 && f < 0.07) || (f > 0.10 && f < 0.11) ? 1 : 0;
      else if (pattern === 'stripes') k = Math.floor(u * 14) % 2;
      else if (pattern === 'geo') { const gx = Math.abs(((u * 6) % 1) - 0.5), gy = Math.abs(((v * 6) % 1) - 0.5); k = Math.abs(gx + gy - 0.5) < 0.06 ? 1 : 0; }
      else if (pattern === 'round') { const r = Math.hypot(u - 0.5, v - 0.5); k = (r > 0.40 && r < 0.43) || (r > 0.30 && r < 0.31) ? 1 : 0; }
      else if (pattern === 'abstract') k = n(u, v) > 0.56 ? 1 : 0;
      const t = 0.9 + fine(x, y) * 0.18;
      return [(a[0] + (b[0] - a[0]) * k) * t, (a[1] + (b[1] - a[1]) * k) * t, (a[2] + (b[2] - a[2]) * k) * t];
    });
    const t = toTexture(c, true);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

export function artTexture(style) {
  return cached('art_' + style, () => {
    const c = canvas(512); const ctx = c.getContext('2d');
    const rnd = mulberry32(style.length * 101 + style.charCodeAt(0));
    if (style === 'abstract') {
      ctx.fillStyle = '#efe7da'; ctx.fillRect(0, 0, 512, 512);
      const pal = ['#c8714b', '#2f4858', '#d9b26f', '#86a39a', '#1d1d1f'];
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = pal[i % pal.length]; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(rnd() * 512, rnd() * 512, 50 + rnd() * 140, rnd() * 6, rnd() * 6 + 3); ctx.fill();
      }
    } else if (style === 'landscape') {
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#9fb8c8'); g.addColorStop(0.55, '#e9d6b8'); g.addColorStop(1, '#6d7d64');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
      ['#7d8e8f', '#5d6e6a', '#3f4d47'].forEach((col, i) => {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 512);
        for (let x = 0; x <= 512; x += 16) ctx.lineTo(x, 260 + i * 60 + Math.sin(x / 70 + i * 2) * 40 + rnd() * 14);
        ctx.lineTo(512, 512); ctx.fill();
      });
    } else { // lines / minimal
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#1f1f1f'; ctx.lineWidth = 6; ctx.beginPath();
      ctx.moveTo(60, 400); ctx.bezierCurveTo(160, 80, 300, 460, 450, 120); ctx.stroke();
      ctx.fillStyle = '#c56b43'; ctx.beginPath(); ctx.arc(330, 170, 60, 0, Math.PI * 2); ctx.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  });
}

/* ---------------- UV helper ---------------- */
/** box-projected UVs in metres from local positions & normals (makes textures true to scale) */
export function applyBoxUV(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  if (!pos || !nor) return geo;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i) / 100, y = pos.getY(i) / 100, z = pos.getZ(i) / 100;
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; }        // top/bottom: grain along depth
    else if (nx >= nz) { u = z; v = y; }               // sides: grain vertical
    else { u = x; v = y; }                             // front/back
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/* ---------------- material library ---------------- */
/* Finishes the user can choose for an item's main surface.
   tint: whether the colour picker affects the material. */
export const FINISHES = {
  fabric:   { label: 'Ткань (рогожка)', tint: true },
  velvet:   { label: 'Бархат', tint: true },
  boucle:   { label: 'Букле', tint: true },
  leather:  { label: 'Кожа', tint: true },
  matte:    { label: 'Эмаль матовая', tint: true },
  gloss:    { label: 'Глянец', tint: true },
  oak:      { label: 'Дуб натуральный', tint: false, swatch: '#c19a6b' },
  oaklight: { label: 'Дуб светлый', tint: false, swatch: '#dcc3a1' },
  walnut:   { label: 'Орех', tint: false, swatch: '#7a5236' },
  ash:      { label: 'Ясень беленый', tint: false, swatch: '#e6dccd' },
  oakgray:  { label: 'Дуб серый', tint: false, swatch: '#a89f94' },
  teak:     { label: 'Тик', tint: false, swatch: '#a0683c' },
  marble:   { label: 'Мрамор белый', tint: false, swatch: '#ecebe8' },
  marblewarm: { label: 'Мрамор бежевый', tint: false, swatch: '#e6dccb' },
  marbledark: { label: 'Мрамор чёрный', tint: false, swatch: '#2c2c2e' },
  concrete: { label: 'Бетон', tint: false, swatch: '#b6b6b4' },
  ceramic:  { label: 'Керамика', tint: true },
  steel:    { label: 'Нерж. сталь', tint: false, swatch: '#c9ccce' },
  chrome:   { label: 'Хром', tint: false, swatch: '#dfe3e6' },
  black:    { label: 'Чёрный металл', tint: false, swatch: '#26272a' },
  brass:    { label: 'Латунь', tint: false, swatch: '#c3a061' },
  glass:    { label: 'Стекло', tint: false, swatch: '#cfe2e6' },
  rattan:   { label: 'Ротанг', tint: false, swatch: '#c9a66f' },
  mirror:   { label: 'Зеркало', tint: false, swatch: '#dfe8ea' }
};

/* floor coverings for the whole apartment */
export const FLOORS = {
  oak:      'Паркетная доска — дуб',
  oaklight: 'Паркетная доска — светлый дуб',
  walnut:   'Паркетная доска — орех',
  oakgray:  'Паркетная доска — серый дуб',
  tile60:   'Керамогранит 60×60 светлый',
  tilegray: 'Керамогранит 60×60 серый',
  marble:   'Мрамор 60×60',
  concrete: 'Микроцемент',
  carpet:   'Ковролин'
};

const matCache = new Map();
const registry = new Set(); // every material ever handed out (for global env-intensity updates)
let envIntensity = 1;

function remember(m) { m.envMapIntensity = (m.userData.envBase || 1) * envIntensity; registry.add(m); return m; }
export function setEnvIntensity(k) {
  envIntensity = k;
  registry.forEach(m => { m.envMapIntensity = (m.userData.envBase || 1) * k; });
}

function std(params, envBase) {
  const m = new THREE.MeshStandardMaterial(params);
  m.userData.envBase = envBase || 1;
  return remember(m);
}
function phys(params, envBase) {
  const m = new THREE.MeshPhysicalMaterial(params);
  m.userData.envBase = envBase || 1;
  return remember(m);
}

/** get (cached) material for a finish key + tint colour */
export function finishMat(key, color) {
  const fin = FINISHES[key] ? key : 'matte';
  const ck = fin + '|' + (FINISHES[fin].tint ? color : '');
  if (matCache.has(ck)) return matCache.get(ck);
  let m;
  const col = new THREE.Color(color || '#cccccc');
  switch (fin) {
    case 'fabric': {
      const t = fabricTextures('linen');
      m = phys({ color: col, map: t.map, bumpMap: t.bump, bumpScale: 0.6, roughness: 0.92, sheen: 0.6, sheenRoughness: 0.75, sheenColor: col.clone().lerp(new THREE.Color('#ffffff'), 0.35) }, 0.6);
      break;
    }
    case 'velvet': {
      const t = fabricTextures('velvet');
      m = phys({ color: col.clone().multiplyScalar(0.85), map: t.map, bumpMap: t.bump, bumpScale: 0.3, roughness: 0.8, sheen: 1, sheenRoughness: 0.35, sheenColor: col.clone().lerp(new THREE.Color('#ffffff'), 0.5) }, 0.6);
      break;
    }
    case 'boucle': {
      const t = fabricTextures('boucle');
      m = phys({ color: col, map: t.map, bumpMap: t.bump, bumpScale: 2.2, roughness: 0.96, sheen: 0.5, sheenRoughness: 0.9, sheenColor: new THREE.Color('#ffffff') }, 0.5);
      break;
    }
    case 'leather': {
      const t = fabricTextures('leather');
      m = phys({ color: col, map: t.map, bumpMap: t.bump, bumpScale: 0.5, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.5 }, 0.9);
      break;
    }
    case 'matte': m = std({ color: col, roughness: 0.62, metalness: 0 }, 0.8); break;
    case 'gloss': m = phys({ color: col, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 }, 1.1); break;
    case 'oak': case 'oaklight': case 'walnut': case 'ash': case 'oakgray': case 'teak': {
      const t = veneerTextures(fin);
      m = phys({ map: t.map, bumpMap: t.bump, bumpScale: 0.25, roughness: 0.58, clearcoat: 0.12, clearcoatRoughness: 0.6 }, 0.8);
      break;
    }
    case 'marble': case 'marblewarm': case 'marbledark': {
      const t = marbleTextures(fin === 'marble' ? 'white' : fin === 'marblewarm' ? 'warm' : 'dark');
      m = phys({ map: t.map, roughness: 0.16, clearcoat: 0.6, clearcoatRoughness: 0.15 }, 1.1);
      break;
    }
    case 'concrete': { const t = concreteTextures('light'); m = std({ map: t.map, bumpMap: t.bump, bumpScale: 0.8, roughness: 0.88 }, 0.7); break; }
    case 'ceramic': m = phys({ color: col, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }, 1.2); break;
    case 'steel': m = std({ color: '#c9ccce', metalness: 1, roughness: 0.32 }, 1.2); break;
    case 'chrome': m = std({ color: '#e8ecef', metalness: 1, roughness: 0.08 }, 1.3); break;
    case 'black': m = std({ color: '#1e1f22', metalness: 0.75, roughness: 0.42 }, 0.9); break;
    case 'brass': m = std({ color: '#d0a85c', metalness: 1, roughness: 0.28 }, 1.2); break;
    case 'glass': m = phys({ color: '#e9f4f4', metalness: 0, roughness: 0.03, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, specularIntensity: 1 }, 1.6); break;
    case 'rattan': { const t = rattanTextures(); m = std({ map: t.map, bumpMap: t.bump, bumpScale: 0.6, roughness: 0.8 }, 0.6); break; }
    case 'mirror': m = std({ color: '#f2f6f7', metalness: 1, roughness: 0.02 }, 1.6); break;
  }
  matCache.set(ck, m);
  return m;
}

/** fixed utility materials */
export function utilMat(key) {
  if (matCache.has('u|' + key)) return matCache.get('u|' + key);
  let m;
  switch (key) {
    case 'plaster': { const t = plasterTextures(); m = std({ color: '#ffffff', map: t.map, bumpMap: t.bump, bumpScale: 0.35, roughness: 0.92 }, 0.55); break; }
    case 'cap': m = std({ color: '#2e3135', roughness: 0.85 }, 0.4); break;
    case 'whitePaint': m = std({ color: '#f4f3f0', roughness: 0.5 }, 0.8); break;
    case 'pvc': m = phys({ color: '#f6f6f4', roughness: 0.35, clearcoat: 0.3 }, 0.9); break;
    case 'windowGlass': m = phys({ color: '#dcebef', metalness: 0, roughness: 0.02, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }, 1.8); break;
    case 'mattress': { const t = fabricTextures('linen'); m = phys({ color: '#f3f1ec', map: t.map, bumpMap: t.bump, bumpScale: 0.5, roughness: 0.95, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') }, 0.5); break; }
    case 'linen': { const t = fabricTextures('linen'); m = phys({ color: '#f5f2ec', map: t.map, bumpMap: t.bump, bumpScale: 0.7, roughness: 0.95, sheen: 0.5, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ffffff') }, 0.5); break; }
    case 'sheer': m = phys({ color: '#fbf8f2', roughness: 0.9, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') }, 0.5); break;
    case 'screen': m = phys({ color: '#060708', roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 }, 1.2); break;
    case 'plastic': m = std({ color: '#1b1c1e', roughness: 0.5 }, 0.7); break;
    case 'plasticWhite': m = std({ color: '#f1f2f2', roughness: 0.38 }, 0.9); break;
    case 'blackGlass': m = phys({ color: '#0b0c0d', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }, 1.3); break;
    case 'rubber': m = std({ color: '#2a2a2a', roughness: 0.9 }, 0.4); break;
    case 'leaf': m = std({ color: '#3f6b35', roughness: 0.55, side: THREE.DoubleSide }, 0.7); break;
    case 'leafLight': m = std({ color: '#5f8a45', roughness: 0.55, side: THREE.DoubleSide }, 0.7); break;
    case 'soil': m = std({ color: '#3a2b20', roughness: 1 }, 0.3); break;
    case 'bulb': m = std({ color: '#fff4dc', emissive: '#ffdca0', emissiveIntensity: 2.4, roughness: 0.3 }, 0.4); break;
    case 'shadeGlow': m = phys({ color: '#f6efe2', emissive: '#ffd9a0', emissiveIntensity: 0.25, roughness: 0.9, side: THREE.DoubleSide, sheen: 0.3, sheenColor: new THREE.Color('#ffffff') }, 0.5); break;
    case 'water': m = phys({ color: '#cfe6ea', roughness: 0.02, transparent: true, opacity: 0.5, depthWrite: false }, 1.6); break;
    case 'balconyDeck': { const t = woodFloorTextures('teak'); m = std({ map: t.map, bumpMap: t.bump, bumpScale: 0.6, roughness: 0.75 }, 0.6); break; }
    case 'slab': { const t = concreteTextures('light'); m = std({ map: t.map, bumpMap: t.bump, bumpScale: 0.6, roughness: 0.9 }, 0.6); break; }
    case 'paper': m = std({ color: '#f1ece2', roughness: 0.9 }, 0.5); break;
    default: m = std({ color: '#cccccc', roughness: 0.7 });
  }
  matCache.set('u|' + key, m);
  return m;
}

/** solid-colour helper (books, decor) */
export function colorMat(color, rough, metal) {
  const ck = 'c|' + color + '|' + (rough || 0.7) + '|' + (metal || 0);
  if (matCache.has(ck)) return matCache.get(ck);
  const m = std({ color, roughness: rough === undefined ? 0.7 : rough, metalness: metal || 0 }, 0.8);
  matCache.set(ck, m);
  return m;
}

/** painted-wall material (tinted plaster) */
export function wallPaintMat(color) {
  const ck = 'wall|' + color;
  if (matCache.has(ck)) return matCache.get(ck);
  const t = plasterTextures();
  const m = std({ color, map: t.map, bumpMap: t.bump, bumpScale: 0.35, roughness: 0.92 }, 0.55);
  matCache.set(ck, m);
  return m;
}

/** floor material for whole-apartment covering or floor zones */
export function floorMat(key) {
  const ck = 'floor|' + key;
  if (matCache.has(ck)) return matCache.get(ck);
  let m;
  if (WOOD_TONES[key]) {
    const t = woodFloorTextures(key);
    m = phys({ map: t.map, bumpMap: t.bump, bumpScale: 0.5, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 }, 0.9);
  } else if (key === 'tile60') {
    const t = tileTextures('tile60', { per: 4, size: 60, color: '#e6e1d8', grout: '#c9c3b8', rough: 0.3, groutPx: 3 });
    m = std({ map: t.map, roughnessMap: t.rough, bumpMap: t.bump, bumpScale: 0.4, roughness: 1 }, 1);
  } else if (key === 'tilegray') {
    const t = tileTextures('tilegray', { per: 4, size: 60, color: '#9c9c99', grout: '#7d7d7a', rough: 0.45, groutPx: 3 });
    m = std({ map: t.map, roughnessMap: t.rough, bumpMap: t.bump, bumpScale: 0.4, roughness: 1 }, 1);
  } else if (key === 'marble') {
    const t = tileTextures('marbletile', { per: 4, size: 60, color: '#ffffff', grout: '#d9d6d0', rough: 0.12, groutPx: 2, marble: 'white' });
    m = phys({ map: t.map, roughnessMap: t.rough, bumpMap: t.bump, bumpScale: 0.3, roughness: 1, clearcoat: 0.5, clearcoatRoughness: 0.1 }, 1.1);
  } else if (key === 'mosaic') {
    const t = tileTextures('mosaic', { per: 20, size: 5, color: '#dfe7e6', grout: '#f4f4f2', rough: 0.15, groutPx: 6 });
    m = std({ map: t.map, roughnessMap: t.rough, bumpMap: t.bump, bumpScale: 0.4, roughness: 1 }, 1.1);
  } else if (key === 'hexdark') {
    const t = tileTextures('tiledark', { per: 8, size: 20, color: '#3a3c3f', grout: '#bdb8b0', rough: 0.4, groutPx: 4 });
    m = std({ map: t.map, roughnessMap: t.rough, bumpMap: t.bump, bumpScale: 0.4, roughness: 1 }, 1);
  } else if (key === 'concrete') {
    const t = concreteTextures('warm');
    m = std({ map: t.map, bumpMap: t.bump, bumpScale: 0.4, roughness: 0.6 }, 0.8);
  } else if (key === 'carpet') {
    const t = fabricTextures('boucle');
    m = phys({ color: '#b8ad9d', map: t.map, bumpMap: t.bump, bumpScale: 1.4, roughness: 1, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') }, 0.4);
  } else {
    return floorMat('oak');
  }
  matCache.set(ck, m);
  return m;
}
