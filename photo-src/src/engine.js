/* =========================================================================
   Photoreal planner — 3D engine.
   Physically based rendering: ACES tone mapping, image-based lighting
   (PMREM room environment), sun with soft shadows, GTAO ambient occlusion,
   MSAA, subtle bloom for lamps, hi-res snapshot export.
   ========================================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { utilMat, wallPaintMat, floorMat, finishMat, applyBoxUV, setEnvIntensity, colorMat } from './materials.js';
import { buildFurniture } from './catalog.js';
import { clamp, deg2rad, wallLen, wallAngle, wallPoint, wallNormal, openingsOnWall, wallSolidSegments, balconyCorners, planBounds } from './geom.js';

export const TIME_PRESETS = {
  morning: { label: 'Утро',  elev: 20, sunColor: '#ffd6aa', sun: 2.6, env: 0.75, hemi: 0.25, bg: '#ece5dc', exposure: 1.0, lamps: 0.15, bloom: 0.08 },
  day:     { label: 'День',  elev: 50, sunColor: '#fff3e2', sun: 3.0, env: 1.0,  hemi: 0.3,  bg: '#ebe9e5', exposure: 1.0, lamps: 0.0,  bloom: 0.05 },
  evening: { label: 'Вечер', elev: 9,  sunColor: '#ff9f5a', sun: 1.7, env: 0.38, hemi: 0.12, bg: '#d8c4b0', exposure: 1.05, lamps: 0.8,  bloom: 0.12 },
  night:   { label: 'Ночь',  elev: 35, sunColor: '#9fb3ff', sun: 0.1, env: 0.1,  hemi: 0.04, bg: '#1b2029', exposure: 1.0, lamps: 1.0,  bloom: 0.2 }
};
const MAX_LAMP_LIGHTS = 12;

export function createEngine(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ebe9e5');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(42, 1, 5, 30000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 30;
  controls.maxDistance = 6000;

  const hemi = new THREE.HemisphereLight('#ffffff', '#d9cbb8', 0.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3e2', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.8;
  scene.add(sun); scene.add(sun.target);

  // shadow-catching ground outside the apartment
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: '#3a2e22', opacity: 0.22 }));
  ground.receiveShadow = true; ground.position.y = -0.3;
  scene.add(ground);

  const content = new THREE.Group();
  scene.add(content);

  /* ---------------- post-processing ---------------- */
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 1.0;
  // keep glass / glows out of the AO buffers
  gtao.overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse(o => {
      cache.set(o, o.visible);
      if (o.isPoints || o.isLine || (o.isMesh && (o.userData.noAO || (o.material && o.material.transparent)))) o.visible = false;
    });
  };
  gtao.updateGtaoMaterial({ radius: 28, distanceExponent: 1.4, thickness: 12, distanceFallOff: 0.6, scale: 1.25, samples: 16, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 16 });
  composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.08, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const state = {
    project: null, opts: {},
    time: 'day', sunAzimuth: 135, quality: 'high',
    lamps: [], running: false, dirty: true, framed: false, mask: null
  };

  function applyQuality() {
    const high = state.quality === 'high';
    gtao.enabled = high;
    renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    const size = high ? 4096 : 2048;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    resize();
  }

  function applyTime() {
    const t = TIME_PRESETS[state.time] || TIME_PRESETS.day;
    scene.background = new THREE.Color(t.bg);
    sun.color.set(t.sunColor);
    sun.intensity = t.sun;
    hemi.intensity = t.hemi;
    setEnvIntensity(t.env);
    renderer.toneMappingExposure = t.exposure;
    bloom.strength = t.bloom;
    ground.material.opacity = state.time === 'night' ? 0.5 : 0.22;
    state.lamps.forEach(l => { l.intensity = l.userData.base * t.lamps; l.visible = t.lamps > 0.01; });
    positionSun();
    state.dirty = true;
  }

  function positionSun() {
    const b = state.project ? planBounds(state.project) : { minX: 0, minY: 0, maxX: 500, maxY: 400 };
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const span = Math.max(400, b.maxX - b.minX, b.maxY - b.minY);
    const t = TIME_PRESETS[state.time] || TIME_PRESETS.day;
    const el = deg2rad(t.elev), az = deg2rad(state.sunAzimuth);
    const R = span * 2 + 1500;
    sun.position.set(cx + Math.cos(az) * Math.cos(el) * R, Math.sin(el) * R, cy + Math.sin(az) * Math.cos(el) * R);
    sun.target.position.set(cx, 0, cy);
    const ext = span * 0.75 + 150;
    const cam = sun.shadow.camera;
    cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext;
    cam.near = 10; cam.far = R * 2;
    cam.updateProjectionMatrix();
    ground.scale.set(span * 8, 1, span * 8);
    ground.position.set(cx, -0.3, cy);
  }

  function resize() {
    const w = container.clientWidth || 800, h = container.clientHeight || 600;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    state.dirty = true;
  }

  /* ---------------- interior mask (flood fill from outside) ---------------- */
  function computeMask(p) {
    const b = planBounds(p);
    if (!p.walls.length) return null;
    const pad = 60;
    const minX = b.minX - pad, minY = b.minY - pad;
    const spanX = b.maxX - b.minX + pad * 2, spanY = b.maxY - b.minY + pad * 2;
    const cell = Math.max(2, Math.max(spanX, spanY) / 1024);
    const W = Math.ceil(spanX / cell), H = Math.ceil(spanY / cell);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#fff'; ctx.lineCap = 'square';
    p.walls.forEach(w => {
      ctx.lineWidth = Math.max(1.5, (w.thickness + 3) / cell);
      ctx.beginPath();
      ctx.moveTo((w.x1 - minX) / cell, (w.y1 - minY) / cell);
      ctx.lineTo((w.x2 - minX) / cell, (w.y2 - minY) / cell);
      ctx.stroke();
    });
    const img = ctx.getImageData(0, 0, W, H).data;
    const N = W * H;
    const wall = new Uint8Array(N);
    for (let i = 0; i < N; i++) wall[i] = img[i * 4] > 100 ? 1 : 0;
    const outside = new Uint8Array(N);
    const q = new Int32Array(N);
    let qh = 0, qt = 0;
    const push = i => { if (!outside[i] && !wall[i]) { outside[i] = 1; q[qt++] = i; } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (qh < qt) {
      const i = q[qh++], x = i % W;
      if (x > 0) push(i - 1);
      if (x < W - 1) push(i + 1);
      if (i >= W) push(i - W);
      if (i < N - W) push(i + W);
    }
    let interior = 0;
    for (let i = 0; i < N; i++) if (!outside[i] && !wall[i]) interior++;
    if (interior < N * 0.01) return null;
    const out = ctx.createImageData(W, H);
    for (let i = 0; i < N; i++) { const v = outside[i] ? 0 : 255; out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255; }
    ctx.putImageData(out, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.NoColorSpace;
    tex.channel = 1;
    tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    return {
      tex, minX, minY, spanX, spanY, W, H, cell,
      inside(x, y) {
        const px = Math.floor((x - minX) / cell), py = Math.floor((y - minY) / cell);
        if (px < 0 || py < 0 || px >= W || py >= H) return false;
        const i = py * W + px;
        return !outside[i] && !wall[i];
      }
    };
  }

  /* ---------------- builders: floor, walls, openings ---------------- */
  function planeXZ(minX, minY, spanX, spanY, y, faceDown) {
    const geo = new THREE.PlaneGeometry(spanX, spanY);
    geo.rotateX(faceDown ? Math.PI / 2 : -Math.PI / 2);
    geo.translate(minX + spanX / 2, y, minY + spanY / 2);
    const pos = geo.attributes.position;
    const uv = new Float32Array(pos.count * 2), uv1 = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      uv[i * 2] = x / 100; uv[i * 2 + 1] = -z / 100;
      uv1[i * 2] = (x - minX) / spanX; uv1[i * 2 + 1] = 1 - (z - minY) / spanY;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    return geo;
  }

  const disposables = [];
  function track(x) { disposables.push(x); return x; }

  function addFloor(p, mask, wallH) {
    const b = planBounds(p);
    let minX, minY, spanX, spanY;
    if (mask) { minX = mask.minX; minY = mask.minY; spanX = mask.spanX; spanY = mask.spanY; }
    else {
      const pad = p.walls.length ? 30 : 150;
      minX = b.minX - pad; minY = b.minY - pad; spanX = b.maxX - b.minX + pad * 2; spanY = b.maxY - b.minY + pad * 2;
    }
    const fm = track(floorMat(p.floor || 'oak').clone());
    if (mask) { fm.alphaMap = mask.tex; fm.alphaTest = 0.5; }
    const floor = new THREE.Mesh(track(planeXZ(minX, minY, spanX, spanY, 0, false)), fm);
    floor.receiveShadow = true;
    content.add(floor);
    // slab edge under the apartment so it doesn't float
    if (mask && p.showCeiling !== false && wallH >= p.ceilingHeight - 0.5) {
      const cm = track(utilMat('whitePaint').clone());
      cm.alphaMap = mask.tex; cm.alphaTest = 0.5;
      const ceil = new THREE.Mesh(track(planeXZ(minX, minY, spanX, spanY, wallH, true)), cm);
      ceil.receiveShadow = true; ceil.castShadow = false; ceil.userData.noAO = true;
      content.add(ceil);
    }
  }

  function wallBox(w, s0, s1, t0, t1, h0, h1, mats) {
    if (s1 - s0 < 0.3 || h1 - h0 < 0.3) return null;
    const c2 = wallPoint(w, (s0 + s1) / 2, (t0 + t1) / 2);
    const geo = applyBoxUV(new THREE.BoxGeometry(s1 - s0, h1 - h0, Math.max(0.3, t1 - t0)));
    const m = new THREE.Mesh(geo, mats);
    m.position.set(c2.x, (h0 + h1) / 2, c2.y);
    m.rotation.y = -wallAngle(w);
    m.castShadow = true; m.receiveShadow = true;
    content.add(m);
    return m;
  }

  /** which side (+1 normal side, -1 other, 0 both) is interior */
  function interiorSide(w, mask) {
    if (!mask) return 0;
    const L = wallLen(w), off = w.thickness / 2 + mask.cell * 3 + 4;
    let pos = 0, neg = 0;
    for (let k = 1; k < 8; k++) {
      const s = L * k / 8;
      const a = wallPoint(w, s, off), b = wallPoint(w, s, -off);
      if (mask.inside(a.x, a.y)) pos++;
      if (mask.inside(b.x, b.y)) neg++;
    }
    if (pos && neg) return 0;
    if (pos) return 1;
    if (neg) return -1;
    return 0;
  }

  function addWalls(p, mask, wallH) {
    const capMat = p.darkCaps === false ? utilMat('whitePaint') : utilMat('cap');
    const facade = wallPaintMat(p.facade || '#e4e1dc');
    const skirt = utilMat('whitePaint');
    p.walls.forEach(w => {
      const paint = wallPaintMat(w.paint || p.wallPaint || '#f1eee8');
      const side = w.type === 'exterior' ? interiorSide(w, mask) : 0;
      const plusMat = side === -1 ? facade : paint;
      const minusMat = side === 1 ? facade : paint;
      // box faces: +x, -x, +y(top), -y, +z(normal side), -z
      const mats = [paint, paint, capMat, paint, plusMat, minusMat];
      const t = w.thickness;
      const ceil = p.ceilingHeight;
      wallSolidSegments(p, w).forEach(seg => {
        wallBox(w, seg.s0, seg.s1, -t / 2, t / 2, 0, wallH, mats);
        // skirting boards on interior faces
        if (side >= 0) wallBox(w, seg.s0, seg.s1, t / 2, t / 2 + 1.4, 0, Math.min(8, wallH), skirt);
        if (side <= 0) wallBox(w, seg.s0, seg.s1, -t / 2 - 1.4, -t / 2, 0, Math.min(8, wallH), skirt);
      });
      openingsOnWall(p, w.id).forEach(o => {
        const bottom = o.sill || 0;
        const top = Math.min(bottom + o.height, ceil);
        if (bottom > 0.5) wallBox(w, o.pos, o.pos + o.width, -t / 2, t / 2, 0, Math.min(bottom, wallH), mats);
        if (top < wallH - 0.5) wallBox(w, o.pos, o.pos + o.width, -t / 2, t / 2, top, wallH, mats);
        if (wallH > bottom + 5) addOpening(w, o, side, wallH);
      });
    });
  }

  function addOpening(w, o, side, wallH) {
    const t = w.thickness;
    const inSign = side === 0 ? 1 : side;
    const clipH = (h0, h1) => [h0, Math.min(h1, wallH)];
    if (o.kind === 'window') {
      const frameMat = o.finish && o.finish !== 'pvc' ? finishMat(o.finish) : utilMat('pvc');
      const bottom = o.sill, top = o.sill + o.height;
      const fw = 6, fd = 7;
      const tc = side === 0 ? 0 : -inSign * (t / 2 - fd / 2 - 3); // frame toward the outside
      const box = (s0, s1, h0, h1, mat, t0, t1) => { const [a, b] = clipH(h0, h1); if (b > a) wallBox(w, s0, s1, t0, t1, a, b, mat); };
      box(o.pos, o.pos + fw, bottom, top, frameMat, tc - fd / 2, tc + fd / 2);
      box(o.pos + o.width - fw, o.pos + o.width, bottom, top, frameMat, tc - fd / 2, tc + fd / 2);
      box(o.pos, o.pos + o.width, top - fw, top, frameMat, tc - fd / 2, tc + fd / 2);
      box(o.pos, o.pos + o.width, bottom, bottom + fw, frameMat, tc - fd / 2, tc + fd / 2);
      const panes = o.width > 150 ? 3 : o.width > 90 ? 2 : 1;
      for (let i = 1; i < panes; i++) {
        const s = o.pos + o.width * i / panes;
        box(s - 3, s + 3, bottom + fw, top - fw, frameMat, tc - fd / 2 + 0.5, tc + fd / 2 - 0.5);
      }
      for (let i = 0; i < panes; i++) {
        const s0 = o.pos + fw + (o.width - fw * 2) * i / panes, s1 = o.pos + fw + (o.width - fw * 2) * (i + 1) / panes;
        // sash profile
        box(s0, s1, bottom + fw, bottom + fw + 4, frameMat, tc - 2.5, tc + 2.5);
        box(s0, s1, top - fw - 4, top - fw, frameMat, tc - 2.5, tc + 2.5);
        const [a, b] = clipH(bottom + fw + 4, top - fw - 4);
        if (b > a) { const g = wallBox(w, s0 + 2, s1 - 2, tc - 0.4, tc + 0.4, a, b, utilMat('windowGlass')); if (g) { g.castShadow = false; g.userData.noAO = true; } }
      }
      // interior sill + exterior drip
      if (bottom > 1 && bottom < wallH) {
        const ts = inSign;
        wallBox(w, o.pos - 5, o.pos + o.width + 5, ts > 0 ? tc + fd / 2 : -t / 2 - 5, ts > 0 ? t / 2 + 5 : tc - fd / 2, bottom - 2.5, bottom, utilMat('whitePaint'));
        if (side !== 0) wallBox(w, o.pos - 2, o.pos + o.width + 2, ts > 0 ? -t / 2 - 4 : tc + fd / 2, ts > 0 ? tc - fd / 2 : t / 2 + 4, bottom - 1.5, bottom - 0.5, finishMat('steel'));
      }
    } else if (o.kind === 'doorswing' || o.kind === 'arch' || o.kind === 'doorsliding') {
      const casing = utilMat('whitePaint');
      const leafMat = finishMat(o.finish || (o.kind === 'doorsliding' ? 'black' : 'oaklight'), o.color);
      const h = Math.min(o.height, wallH);
      const cw = 7;
      // jambs and head inside the opening
      wallBox(w, o.pos, o.pos + 2.5, -t / 2, t / 2, 0, h, casing);
      wallBox(w, o.pos + o.width - 2.5, o.pos + o.width, -t / 2, t / 2, 0, h, casing);
      if (o.height < wallH) wallBox(w, o.pos, o.pos + o.width, -t / 2, t / 2, o.height - 2.5, o.height, casing);
      // architraves on both faces
      [1, -1].forEach(sd => {
        const t0 = sd > 0 ? t / 2 : -t / 2 - 1.5, t1 = sd > 0 ? t / 2 + 1.5 : -t / 2;
        wallBox(w, o.pos - cw + 2.5, o.pos + 2.5, t0, t1, 0, Math.min(h + cw - 2.5, wallH), casing);
        wallBox(w, o.pos + o.width - 2.5, o.pos + o.width + cw - 2.5, t0, t1, 0, Math.min(h + cw - 2.5, wallH), casing);
        if (o.height + cw - 2.5 <= wallH) wallBox(w, o.pos - cw + 2.5, o.pos + o.width + cw - 2.5, t0, t1, o.height - 2.5, o.height + cw - 2.5, casing);
      });
      if (o.kind === 'doorswing') {
        const hingeAtStart = o.hinge !== 'right';
        const openSign = hingeAtStart ? 1 : -1;
        const hingeS = hingeAtStart ? o.pos + 2.6 : o.pos + o.width - 2.6;
        const leafLen = Math.max(10, o.width - 5.4);
        const leafH = Math.max(10, Math.min(o.height - 3, wallH));
        const hp = wallPoint(w, hingeS, inSign * (t / 2 - 2));
        const pivot = new THREE.Group();
        pivot.position.set(hp.x, 0, hp.y);
        pivot.rotation.y = -wallAngle(w) - openSign * inSign * deg2rad(62);
        content.add(pivot);
        const leaf = new THREE.Mesh(applyBoxUV(new THREE.BoxGeometry(leafLen, leafH, 4)), leafMat);
        leaf.position.set(openSign * leafLen / 2, leafH / 2 + 0.5, 0);
        leaf.castShadow = leaf.receiveShadow = true;
        pivot.add(leaf);
        const hm = finishMat('chrome');
        [-1, 1].forEach(sd => {
          const rose = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.8, 24), hm);
          rose.rotation.x = Math.PI / 2; rose.position.set(openSign * (leafLen - 6), 100, sd * 2.4);
          const lever = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 1.6), hm);
          lever.position.set(openSign * (leafLen - 11), 100, sd * 4.4);
          [rose, lever].forEach(m => { m.castShadow = true; pivot.add(m); });
        });
      } else if (o.kind === 'doorsliding') {
        const panel = o.width * 0.55, ts = inSign * (t / 2 + 3);
        wallBox(w, o.pos - 8, o.pos + o.width + 8, ts - 2, ts + 2, o.height, Math.min(o.height + 5, wallH), finishMat('black'));
        const ph = Math.min(o.height - 1, wallH);
        const fm = leafMat;
        wallBox(w, o.pos, o.pos + 3, ts - 1.5, ts + 1.5, 1, ph, fm);
        wallBox(w, o.pos + panel - 3, o.pos + panel, ts - 1.5, ts + 1.5, 1, ph, fm);
        wallBox(w, o.pos, o.pos + panel, ts - 1.5, ts + 1.5, ph - 3, ph, fm);
        wallBox(w, o.pos, o.pos + panel, ts - 1.5, ts + 1.5, 1, 4, fm);
        const gl = wallBox(w, o.pos + 3, o.pos + panel - 3, ts - 0.4, ts + 0.4, 4, ph - 3, finishMat('glass'));
        if (gl) { gl.castShadow = false; gl.userData.noAO = true; }
      }
    }
  }

  function addBalcony(b) {
    const c = balconyCorners(b);
    const shape = new THREE.Shape();
    shape.moveTo(c[0].x, c[0].y); c.slice(1).forEach(p => shape.lineTo(p.x, p.y)); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 16, bevelEnabled: false });
    geo.rotateX(Math.PI / 2); geo.translate(0, 0.5, 0);
    applyBoxUV(geo);
    const slab = new THREE.Mesh(geo, [utilMat('balconyDeck'), utilMat('slab')]);
    slab.receiveShadow = slab.castShadow = true;
    content.add(slab);
    const rail = finishMat('black');
    const edge = (pA, pB) => {
      const len = Math.hypot(pB.x - pA.x, pB.y - pA.y); if (len < 1) return;
      const ang = Math.atan2(pB.y - pA.y, pB.x - pA.x);
      const mk = (h, y, d, mat) => {
        const m = new THREE.Mesh(applyBoxUV(new THREE.BoxGeometry(len, h, d)), mat);
        m.position.set((pA.x + pB.x) / 2, y, (pA.y + pB.y) / 2); m.rotation.y = -ang;
        m.castShadow = true; m.receiveShadow = true; content.add(m); return m;
      };
      const g = mk(b.parapet - 8, (b.parapet - 8) / 2 + 2, 1.2, utilMat('windowGlass')); g.castShadow = false; g.userData.noAO = true;
      mk(4, b.parapet - 2, 6, rail);
      mk(3, 1.5, 4, rail);
    };
    edge(c[1], c[2]); edge(c[2], c[3]); edge(c[3], c[0]);
  }

  function addFurniture(p) {
    const lamps = [];
    p.furniture.forEach(item => {
      const g = buildFurniture(item, { ceiling: p.ceilingHeight });
      const wrapper = new THREE.Group();
      wrapper.add(g);
      wrapper.position.set(item.x, item.z || 0, item.y);
      wrapper.rotation.y = -deg2rad(item.rotation || 0);
      if (g.userData.noShadow) g.traverse(m => { if (m.isMesh) m.castShadow = false; });
      content.add(wrapper);
      if (g.userData.lights) {
        wrapper.updateMatrixWorld(true);
        g.userData.lights.forEach(L => lamps.push({ pos: wrapper.localToWorld(new THREE.Vector3(L.x, L.y, L.z)), power: L.power || 1, color: L.color }));
      }
    });
    state.lamps = [];
    lamps.slice(0, MAX_LAMP_LIGHTS).forEach(L => {
      const pl = new THREE.PointLight(L.color || '#ffd7a1', 1, 900, 2);
      pl.userData.base = 2.2e4 * L.power;
      pl.position.copy(L.pos);
      pl.castShadow = false;
      content.add(pl);
      state.lamps.push(pl);
    });
  }

  function clearContent() {
    while (content.children.length) {
      const c = content.children[0];
      content.remove(c);
      c.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    }
    disposables.forEach(d => d.dispose && d.dispose());
    disposables.length = 0;
    if (state.mask && state.mask.tex) state.mask.tex.dispose();
  }

  function rebuild(project, opts) {
    state.project = project; state.opts = opts || {};
    clearContent();
    const wallH = project.ceilingHeight * clamp(state.opts.wallHeightPct || 100, 20, 100) / 100;
    const mask = computeMask(project);
    state.mask = mask;
    addFloor(project, mask, wallH);
    addWalls(project, mask, wallH);
    project.balconies.forEach(addBalcony);
    addFurniture(project);
    applyTime();
    if (!state.framed) { frame('iso'); state.framed = true; }
    state.dirty = true;
  }

  /** centre of the largest free area inside the walls (distance transform of the interior mask) */
  function roomiestSpot() {
    const m = state.mask; if (!m) return null;
    const { W, H } = m, N = W * H;
    const d = new Float32Array(N).fill(1e9);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!m.inside(m.minX + (x + 0.5) * m.cell, m.minY + (y + 0.5) * m.cell)) d[i] = 0;
    }
    // two-pass chamfer distance
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!d[i]) continue;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y > 0) d[i] = Math.min(d[i], d[i - W] + 1);
    }
    let best = -1, bi = 0;
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; if (!d[i]) continue;
      if (x < W - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y < H - 1) d[i] = Math.min(d[i], d[i + W] + 1);
      if (d[i] > best) { best = d[i]; bi = i; }
    }
    if (best <= 0) return null;
    return { x: m.minX + (bi % W + 0.5) * m.cell, y: m.minY + (Math.floor(bi / W) + 0.5) * m.cell, r: best * m.cell };
  }

  /* ---------------- camera presets ---------------- */
  function frame(kind) {
    const b = state.project ? planBounds(state.project) : { minX: 0, minY: 0, maxX: 500, maxY: 400 };
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const span = Math.max(260, b.maxX - b.minX, b.maxY - b.minY);
    controls.minDistance = 30;
    if (kind === 'top') {
      controls.target.set(cx, 0, cy);
      camera.position.set(cx + 0.01, span * 1.55, cy + span * 0.02);
    } else if (kind === 'eye') {
      // stand in the roomiest spot of the apartment and look around
      const h = 150;
      const spot = roomiestSpot();
      const px = spot ? spot.x : cx, py = spot ? spot.y : cy, r = spot ? spot.r : span * 0.3;
      controls.target.set(px, h - 15, py);
      camera.position.set(px + r * 0.75, h, py + r * 0.75);
      controls.minDistance = 5;
    } else {
      controls.target.set(cx, 20, cy + span * 0.04);
      camera.position.set(cx + span * 0.42, span * 1.12, cy + span * 0.78);
    }
    camera.far = Math.max(8000, span * 10);
    camera.updateProjectionMatrix();
    controls.update();
    state.dirty = true;
  }

  /* ---------------- loop ---------------- */
  controls.addEventListener('change', () => { state.dirty = true; });
  function loop() {
    if (!state.running) return;
    controls.update();
    if (state.dirty) { composer.render(); state.dirty = false; }
    requestAnimationFrame(loop);
  }

  /* ---------------- snapshot ---------------- */
  function snapshot(longSide) {
    const w0 = container.clientWidth || 800, h0 = container.clientHeight || 600;
    const pr0 = renderer.getPixelRatio();
    const scale = (longSide || 3000) / Math.max(w0, h0);
    const W = Math.round(w0 * scale), H = Math.round(h0 * scale);
    const wasGtao = gtao.enabled;
    gtao.enabled = true;
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    composer.setPixelRatio(1);
    composer.setSize(W, H);
    gtao.updateGtaoMaterial({ samples: 24 });
    composer.render();
    const url = renderer.domElement.toDataURL('image/png');
    gtao.updateGtaoMaterial({ samples: 16 });
    gtao.enabled = wasGtao;
    renderer.setPixelRatio(pr0);
    renderer.setSize(w0, h0);
    composer.setPixelRatio(pr0);
    composer.setSize(w0, h0);
    state.dirty = true;
    return url;
  }

  window.addEventListener('resize', () => { if (state.running) resize(); });

  return {
    renderer, scene, camera, controls,
    rebuild,
    start() { if (state.running) return; state.running = true; resize(); loop(); },
    stop() { state.running = false; },
    resize,
    frame,
    resetFraming() { state.framed = false; },
    setTime(t) { state.time = t; applyTime(); },
    setSunAzimuth(a) { state.sunAzimuth = a; positionSun(); state.dirty = true; },
    setQuality(q) { state.quality = q; applyQuality(); },
    get time() { return state.time; },
    get quality() { return state.quality; },
    snapshot,
    invalidate() { state.dirty = true; }
  };
}

/* ---------------- catalogue thumbnails ---------------- */
let thumbR = null;
export function renderThumbnail(item) {
  if (!thumbR) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(160, 160);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    const sun = new THREE.DirectionalLight('#fff4e4', 2.2);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
    scene.add(sun); scene.add(sun.target);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.18 }));
    ground.receiveShadow = true; scene.add(ground);
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 10000);
    thumbR = { renderer, scene, camera, sun };
  }
  const { renderer, scene, camera, sun } = thumbR;
  const g = buildFurniture(Object.assign({}, item, { z: 0 }), { ceiling: item.h + 12 });
  g.traverse(o => { if (o.isMesh && g.userData.noShadow) o.castShadow = false; });
  scene.add(g);
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z, 10) * 0.5 * Math.SQRT2 * 1.02;
  const flat = size.y < 6;
  const dir = flat ? new THREE.Vector3(0.25, 1.4, 0.75).normalize() : new THREE.Vector3(0.62, 0.42, 0.85).normalize();
  const dist = r / Math.sin(deg2rad(15)) * 0.98;
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.near = dist / 20; camera.far = dist * 4; camera.updateProjectionMatrix();
  camera.lookAt(center);
  sun.position.set(center.x + r * 2, center.y + r * 4, center.z + r * 2.5);
  sun.target.position.copy(center);
  const ext = r * 2;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: r * 12 });
  sun.shadow.camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(g);
  g.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  void colorMat;
  return url;
}
