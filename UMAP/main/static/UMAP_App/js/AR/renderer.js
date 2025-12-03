console.log('[AR_RENDERER] renderer.js module loading as module script...');

// Clean, consolidated renderer implementation
// Provide a small debug helper early so other modules can call it
if (!window.updateDebug) window.updateDebug = function(text) { try { const s = document.getElementById('dbg-status'); if (s) s.textContent = text; else console.log('[AR_RENDERER] DBG:', text); } catch (e) { console.log('[AR_RENDERER] DBG:', text); } };

window._AR_RENDERER = window._AR_RENDERER || {};

let THREE_module = null;
let GLTFLoaderClass = null;
let threeRenderer = null;
let scene = null;
let camera = null;

async function initThree() {
  try {
    console.log('[AR_RENDERER] initThree() starting...');
    
    // Check for canvas element
    let canvas = document.getElementById('overlay');
    console.log('[AR_RENDERER] Canvas element found:', !!canvas, 'id:', canvas ? canvas.id : 'N/A');
    
    if (!canvas) {
      console.log('[AR_RENDERER] No overlay canvas found on page, creating fallback...');
      canvas = document.createElement('canvas');
      canvas.id = 'overlay';
      canvas.style.position = 'absolute';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '100';
      document.body.appendChild(canvas);
      console.log('[AR_RENDERER] Created fallback canvas with absolute positioning');
    }
    
    const mod = await import('three'); 
    THREE_module = mod; 
    window.THREE = THREE_module;
    console.log('[AR_RENDERER] Three.js module imported successfully');
    
    const loaderMod = await import('https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'); 
    GLTFLoaderClass = loaderMod.GLTFLoader;
    console.log('[AR_RENDERER] GLTFLoader imported successfully');

    threeRenderer = new THREE_module.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    threeRenderer.setPixelRatio(window.devicePixelRatio || 1);
    threeRenderer.xr.enabled = false; // We manage XR rendering manually in webxr.js
    threeRenderer.setClearColor(0x000000, 0);
    
    // Size renderer to modal canvas or window
    const updateRendererSize = () => {
      const canvasParent = canvas.parentElement;
      if (canvasParent && (canvasParent.id === 'ar-video-box' || canvasParent.id === 'user-ar-video-box')) {
        const rect = canvasParent.getBoundingClientRect();
        const width = Math.max(300, rect.width || 350);
        const height = Math.max(300, rect.height || 350);
        threeRenderer.setSize(width, height, false);
        console.log('[AR_RENDERER] Sized to modal:', width, 'x', height, '(parent:', canvasParent.id, ')');
      } else {
        threeRenderer.setSize(window.innerWidth, window.innerHeight, false);
        console.log('[AR_RENDERER] Sized to window:', window.innerWidth, 'x', window.innerHeight);
      }
    };
    updateRendererSize();
    window.addEventListener('resize', updateRendererSize);
    window._AR_RENDERER_RESIZE_HANDLER = updateRendererSize;
    console.log('[AR_RENDERER] WebGLRenderer created with proper sizing');

    scene = new THREE_module.Scene();
    const modelRoot = new THREE_module.Object3D(); 
    modelRoot.name = 'modelRoot'; 
    scene.add(modelRoot); 
    window._AR_RENDERER.modelRoot = modelRoot;
    console.log('[AR_RENDERER] Scene and modelRoot created');

    const hemi = new THREE_module.HemisphereLight(0xffffff, 0x444444, 0.6); 
    scene.add(hemi);
    const dir = new THREE_module.DirectionalLight(0xffffff, 0.8); 
    dir.position.set(5,10,7.5); 
    scene.add(dir);
    console.log('[AR_RENDERER] Lights added');

    // Create camera with proper aspect ratio based on canvas size
    const canvasRect = canvas.getBoundingClientRect();
    const aspectRatio = (canvasRect.width || window.innerWidth) / (canvasRect.height || window.innerHeight);
    camera = new THREE_module.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.set(0,5,20); 
    camera.lookAt(0,0,0);
    console.log('[AR_RENDERER] Camera created with aspect:', aspectRatio);

    try {
      const ctrlMod = await import('https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js');
      const OrbitControls = ctrlMod.OrbitControls;
      const controls = new OrbitControls(camera, threeRenderer.domElement);
      controls.enableDamping = true; 
      controls.dampingFactor = 0.07; 
      controls.screenSpacePanning = false; 
      controls.minDistance = 0.5; 
      controls.maxDistance = 200;
      controls.target.set(0,0,0); 
      controls.update(); 
      window._AR_RENDERER.controls = controls;
      console.log('[AR_RENDERER] OrbitControls initialized');
    } catch(e) { 
      console.warn('[AR_RENDERER] OrbitControls not available', e); 
    }

    window._AR_RENDERER.renderer = threeRenderer; 
    window._AR_RENDERER.scene = scene; 
    window._AR_RENDERER.camera = camera;
    console.log('[AR_RENDERER] Three.js initialized successfully');
    updateDebug('Three.js initialized (ESM)');
  } catch(e) {
    console.error('[AR_RENDERER] Failed to initialize Three (ESM):', e);
    updateDebug('Failed to initialize Three (ESM): ' + (e && e.message ? e.message : e));
  }
}

// Wait for DOM to be ready before initializing Three.js
if (document.readyState === 'loading') {
  console.log('[AR_RENDERER] Document still loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[AR_RENDERER] DOMContentLoaded fired, initializing Three.js');
    initThree();
  });
} else {
  console.log('[AR_RENDERER] Document already loaded, initializing Three.js immediately');
  initThree();
}

const CANONICAL_GLTF = '/static/UMAP_App/glb/Umak_3d.glb';
function sanitizeGltfPath(p) { try { if (!p) return CANONICAL_GLTF; const lp = String(p); if (lp.indexOf('{') !== -1 || lp.indexOf('%7B') !== -1) return CANONICAL_GLTF; return lp; } catch(e) { return CANONICAL_GLTF; } }
window._AR_GLTF_PATH = sanitizeGltfPath(window._AR_GLTF_PATH || CANONICAL_GLTF);
if (typeof window._AR_AUTO_SCALE === 'undefined') window._AR_AUTO_SCALE = false;
if (typeof window._AR_PREVIEW_ROT_DEG === 'undefined') window._AR_PREVIEW_ROT_DEG = { x:0,y:0,z:0 };

// load GLTF with fetch-as-blob (cache-busting) and apply preview yaw only (no X/Z tilt)
window._AR_RENDERER.loadGLTF = async function(path) {
  if (!path) { console.warn('No GLTF path provided'); return; }
  path = sanitizeGltfPath(path);
  console.log('loadGLTF called with path (sanitized):', path);
  try {
    let attempts = 0; while((!THREE_module||!GLTFLoaderClass||!scene||!threeRenderer) && attempts<50) { await new Promise(r=>setTimeout(r,100)); attempts++; }
    if (!THREE_module||!GLTFLoaderClass||!scene||!threeRenderer) throw new Error('Three or GLTFLoader not initialized');

    try { if (window._AR_RENDERER.currentModel) { const p = window._AR_RENDERER.currentModel.parent; if (p) p.remove(window._AR_RENDERER.currentModel); window._AR_RENDERER.currentModel = null; } } catch(e){}

    let loadUrl = path;
    try { const resp = await fetch(path, { cache: 'no-store' }); if (resp && resp.ok) { const blob = await resp.blob(); loadUrl = URL.createObjectURL(blob); console.log('[AR_RENDERER] fetched GLB blob size=', blob.size); } } catch(e) { console.warn('[AR_RENDERER] GLB fetch failed', e); }

    const loader = new GLTFLoaderClass();
    return new Promise((resolve, reject) => {
      loader.load(loadUrl, (g) => {
        try {
          const root = g.scene || (g.scenes && g.scenes[0]) || null;
          if (!root) { scene.add(g.scene); window._AR_RENDERER.currentModel = g.scene; updateDebug('GLTF loaded (scene)'); resolve(window._AR_RENDERER.currentModel); return; }

          // apply model-local rotation, but only capture yaw (Y). We avoid applying X/Z pitch/roll
          // to the model root because that tilts the marker plane into portrait.
          try {
            const rotDeg = window._AR_MODEL_ROT_DEG || { x:0,y:0,z:0 };
            const yawRad = THREE_module.MathUtils.degToRad(Number(rotDeg.y) || 0);
            // store initial yaw on the model so aligner can combine it with its computed yaw
            if (!root.userData) root.userData = {};
            root.userData.__initialYaw = yawRad;
            // keep the geometry upright for centering (no X/Z rotation applied)
            root.rotation.set(0, 0, 0);
          } catch(e) { console.warn('apply model rotation failed', e); }

          // neutral scale, measure, optional autoscale
          root.scale.set(1,1,1); root.updateMatrixWorld(true);
          try {
            const b = new THREE_module.Box3().setFromObject(root);
            const s = b.getSize(new THREE_module.Vector3());
            const maxDim = Math.max(s.x,s.y,s.z);
            if (maxDim > 0) {
              let desired = 6;
              if (window.rooms && window.rooms.length) {
                const xs = window.rooms.map(r=>Number(r.x||0));
                const ys = window.rooms.map(r=>Number(r.y||0));
                const roomWidth = Math.max(1, Math.abs(Math.max(...xs)-Math.min(...xs)));
                const roomDepth = Math.max(1, Math.abs(Math.max(...ys)-Math.min(...ys)));
                const target = Math.max(roomWidth, roomDepth) * (window._AR_WORLD_SCALE || 0.9);
                desired = Math.max(3, target);
              }
              const scaleFactor = desired / maxDim;
              if (window._AR_AUTO_SCALE) root.scale.setScalar(scaleFactor); else root.scale.setScalar(1);
            }
          } catch(e) { console.warn('scaling step failed', e); }

          // model flips are no longer applied here; keep geometry upright and let aligner handle yaw-only rotation

          // center the geometry around origin (do not floor-align here). The aligner will
          // apply final Y translation after the modelRoot scale is set so floor alignment
          // uses the correct, possibly scaled dimensions.
          try { root.updateMatrixWorld(true); const bb = new THREE_module.Box3().setFromObject(root); const center = bb.getCenter(new THREE_module.Vector3()); root.position.sub(center); root.updateMatrixWorld(true); } catch(e) { console.warn('center failed', e); }

          const parent = window._AR_RENDERER.modelRoot || scene; parent.add(root); window._AR_RENDERER.currentModel = root;

          try { if (typeof window._AR_RENDERER.alignModelToRooms === 'function') window._AR_RENDERER.alignModelToRooms(); } catch(e) { console.warn('alignModelToRooms failed', e); }

          // Apply preview-only yaw to modelRoot (do not tilt on X/Z)
          try { const mr = window._AR_RENDERER.modelRoot; if (mr) { const py = THREE_module.MathUtils.degToRad(Number((window._AR_PREVIEW_ROT_DEG && window._AR_PREVIEW_ROT_DEG.y) || 0)); mr.rotation.set(0, py, 0); mr.updateMatrixWorld(true); } } catch(e) {}

          updateDebug('GLTF (glb) loaded (ESM)');
          // emit event: model loaded
          try { window._AR_EVENTS = window._AR_EVENTS || { _listeners: {} , on(fn,e){}, emit: function(name, payload){ const L = (window._AR_EVENTS && window._AR_EVENTS._listeners && window._AR_EVENTS._listeners[name]) || []; L.forEach(cb => { try { cb(payload); } catch(e){} }); } };
            if (window._AR_EVENTS && typeof window._AR_EVENTS.emit === 'function') window._AR_EVENTS.emit('model:loaded', { model: window._AR_RENDERER.currentModel, path: path }); } catch(e) {}
          resolve(window._AR_RENDERER.currentModel);
        } catch (err) { console.error('GLTF post-process error', err); reject(err); }
      }, undefined, (err) => { console.error('GLTF load err (ESM)', err); updateDebug('GLTF load failed (ESM)'); reject(err); });
    });
  } catch (e) {
    console.error('GLTF load failed (overall):', e);
    updateDebug('GLTF load failed (overall): ' + (e && e.message ? e.message : e));
    throw e;
  }
};

// recenter model
window._AR_RENDERER.recenterCurrentModel = function() {
  try {
    const THREEm = THREE_module; const root = window._AR_RENDERER.currentModel; if (!root || !THREEm) return;
    try {
      const modelRoot = window._AR_RENDERER.modelRoot || null;
  // do not apply arbitrary model rotations here; keep root neutral and let aligner + initial yaw handle orientation
  root.scale.set(1,1,1); root.updateMatrixWorld(true);
      const boxBefore = new THREEm.Box3().setFromObject(root); const sizeBefore = boxBefore.getSize(new THREEm.Vector3()); const maxDimBefore = Math.max(sizeBefore.x, sizeBefore.y, sizeBefore.z);
      if (maxDimBefore > 0) {
        if (window._AR_AUTO_SCALE) { const worldScale = (window._AR_WORLD_SCALE && Number(window._AR_WORLD_SCALE)) ? Number(window._AR_WORLD_SCALE) : 0.9; const desired = 6 * worldScale; const scaleFactor = desired / maxDimBefore; root.scale.setScalar(scaleFactor); } else root.scale.setScalar(1);
      }
  // model flips removed — do not invert axis scales here
      root.updateMatrixWorld(true); const box = new THREEm.Box3().setFromObject(root); const center = box.getCenter(new THREEm.Vector3()); root.position.sub(center);
      if (modelRoot) modelRoot.position.set(0,0,0);
      try { root.updateMatrixWorld(true); const finalBox = new THREEm.Box3().setFromObject(root); const minY = finalBox.min.y || 0; if (modelRoot) modelRoot.position.y -= minY; else root.position.y -= minY; } catch(e) { console.warn('floor align failed', e); }
    } catch(e) { console.warn('recenterCurrentModel inner failed', e); }
  } catch(e) { console.warn('recenterCurrentModel failed', e); }
};

// Align model to rooms (2D similarity fit)
window._AR_RENDERER.alignModelToRooms = function() {
  try {
    const root = window._AR_RENDERER.currentModel; const modelRoot = window._AR_RENDERER.modelRoot; if (!root || !modelRoot || !window.rooms || window.rooms.length === 0 || !THREE_module) { console.warn('alignModelToRooms: missing prerequisites (model, modelRoot, rooms, THREE)'); return false; }
    const worldScale = (window._AR_WORLD_SCALE && Number(window._AR_WORLD_SCALE)) ? Number(window._AR_WORLD_SCALE) : 1;
    const roomPts = window.rooms.map(r => ({ x: (Number(r.x||0) * worldScale), y: (-(Number(r.y||0) * worldScale)) }));
    const modelPts = [];
    try {
      root.traverse(function(node) {
        if (node.isMesh && node.geometry) {
          const pos = node.geometry.attributes && node.geometry.attributes.position;
          if (pos && pos.array) {
            const arr = pos.array;
            for (let i=0;i<arr.length;i+=3) modelPts.push({ x: arr[i], y: arr[i+2] });
          }
        }
      });
    } catch (e) { console.warn('gathering model vertices failed', e); }
    if (!modelPts.length) { console.warn('alignModelToRooms: no model vertices found'); return false; }
    const maxPts = 2000; const step = Math.max(1, Math.floor(modelPts.length / maxPts)); const sampled = [];
    for (let i=0;i<modelPts.length;i+=step) sampled.push(modelPts[i]);
    const matchesSrc = [], matchesDst = [];
    for (let i=0;i<roomPts.length;i++) {
      const rp = roomPts[i]; let best = null; let bestd = Infinity;
      for (let j=0;j<sampled.length;j++) {
        const mp = sampled[j]; const ddx = mp.x - rp.x; const ddy = mp.y - rp.y; const d2 = ddx*ddx + ddy*ddy;
        if (d2 < bestd) { bestd = d2; best = mp; }
      }
      if (best) { matchesSrc.push([best.x, best.y]); matchesDst.push([rp.x, rp.y]); }
    }
    if (matchesSrc.length < 2) { console.warn('alignModelToRooms: not enough matches for transform'); return false; }
    const n = matchesSrc.length; let sx=0, sy=0, dx=0, dy=0;
    for (let i=0;i<n;i++){ sx += matchesSrc[i][0]; sy += matchesSrc[i][1]; dx += matchesDst[i][0]; dy += matchesDst[i][1]; }
    sx/=n; sy/=n; dx/=n; dy/=n;
    let sumDot=0, sumCross=0, srcSq=0;
    for (let i=0;i<n;i++){
      const sx0 = matchesSrc[i][0]-sx; const sy0 = matchesSrc[i][1]-sy; const dx0 = matchesDst[i][0]-dx; const dy0 = matchesDst[i][1]-dy;
      sumDot += sx0*dx0 + sy0*dy0; sumCross += sx0*dy0 - sy0*dx0; srcSq += sx0*sx0 + sy0*sy0;
    }
    const angle = Math.atan2(sumCross, sumDot);
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    let numer = 0;
    for (let i=0;i<n;i++){
      const sx0 = matchesSrc[i][0]-sx; const sy0 = matchesSrc[i][1]-sy;
      const rx = cosA * sx0 - sinA * sy0; const ry = sinA * sx0 + cosA * sy0;
      numer += matchesDst[i][0] * rx + matchesDst[i][1] * ry;
    }
    const scale = srcSq > 0 ? numer / srcSq : 1;
    const rotCx = cosA * sx - sinA * sy; const rotCz = sinA * sx + cosA * sy;
    const tx = dx - scale * rotCx; const tz = dy - scale * rotCz;

  // apply to modelRoot: combine computed alignment yaw with model's initial yaw (if any)
  const initialYaw = (root && root.userData && root.userData.__initialYaw) ? Number(root.userData.__initialYaw) : 0;
  const totalYaw = angle + (initialYaw || 0);
  modelRoot.rotation.set(0, totalYaw, 0);
  // compute base scale: either the similarity scale (autoscale) or the configured world-scale
  const baseScale = window._AR_AUTO_SCALE ? scale : ((window._AR_WORLD_SCALE && Number(window._AR_WORLD_SCALE)) ? Number(window._AR_WORLD_SCALE) : 1);
  // allow a user multiplier window._AR_MODEL_SCALE to nudge model size interactively
  const userMultiplier = (typeof window._AR_MODEL_SCALE !== 'undefined') ? Number(window._AR_MODEL_SCALE) : 1;
  const appliedBase = (isFinite(baseScale) ? baseScale : 1);
  modelRoot.scale.setScalar(appliedBase * (isFinite(userMultiplier) ? userMultiplier : 1));
  // store last base scale for helper functions
  if (!modelRoot.userData) modelRoot.userData = {};
  modelRoot.userData.__lastBaseScale = appliedBase;
    modelRoot.position.set(tx, 0, tz);

    root.updateMatrixWorld(true);
    const b = new THREE_module.Box3().setFromObject(root);
    const minY = b.min.y || 0;
    const appliedScale = modelRoot.scale.x || 1;
    modelRoot.position.y = -minY * appliedScale;
    modelRoot.updateMatrixWorld(true);

    console.log('[AR_RENDERER] alignModelToRooms (ICP-like) result', { angle: angle * 180/Math.PI, scale, tx, tz, minY });
    // Alignment debug: draw lines between matched model sample -> room target if debug enabled
    try {
      if (window._AR_DEBUG_ALIGN) {
        // convert matchesSrc (model local x,z) into world positions after modelRoot transform
        const dbgLines = [];
        for (let i=0;i<matchesSrc.length;i++) {
          const mx = matchesSrc[i][0], mz = matchesSrc[i][1];
          // model local point -> Vector3
          const local = new THREE_module.Vector3(mx, 0, mz);
          // apply modelRoot transform: modelRoot is parent of root so to transform model-local coordinates into world,
          // first consider root's local transform (root may have been recentered); use root.localToWorld
          try {
            const worldPos = local.clone(); if (root && typeof root.localToWorld === 'function') root.localToWorld(worldPos);
            // target room position is matchesDst[i]
            const txw = matchesDst[i][0], tzw = matchesDst[i][1];
            const roomPos = new THREE_module.Vector3(txw, 0, tzw);
            dbgLines.push([worldPos, roomPos]);
          } catch(e) { /* ignore per-sample failures */ }
        }
        window._AR_RENDERER.drawAlignmentDebug && window._AR_RENDERER.drawAlignmentDebug(dbgLines);
      }
    } catch(e) { console.warn('alignment debug failed', e); }
    return true;
  } catch (e) { console.error('alignModelToRooms error', e); return false; }
};

// Draw alignment debug lines (array of [Vector3 modelWorldPos, Vector3 roomWorldPos])
window._AR_RENDERER.drawAlignmentDebug = function(lines) {
  try {
    if (!THREE_module) return;
    // remove previous debug group
    if (window._AR_RENDERER._alignDbgGroup) { try { window._AR_RENDERER.scene.remove(window._AR_RENDERER._alignDbgGroup); } catch(e){} window._AR_RENDERER._alignDbgGroup = null; }
    const g = new THREE_module.Group(); g.name = 'alignDebug';
    const mat = new THREE_module.LineBasicMaterial({ color: 0xff0000 });
    lines.forEach(pair => {
      const geo = new THREE_module.BufferGeometry().setFromPoints([ pair[0], pair[1] ]);
      const line = new THREE_module.Line(geo, mat);
      g.add(line);
      // add small spheres at endpoints
      const sgeo = new THREE_module.SphereGeometry(0.03, 8, 8);
      const m1 = new THREE_module.MeshBasicMaterial({ color: 0x00ff00 }); const p1 = new THREE_module.Mesh(sgeo, m1); p1.position.copy(pair[0]); g.add(p1);
      const m2 = new THREE_module.MeshBasicMaterial({ color: 0x0000ff }); const p2 = new THREE_module.Mesh(sgeo, m2); p2.position.copy(pair[1]); g.add(p2);
    });
    window._AR_RENDERER.scene.add(g); window._AR_RENDERER._alignDbgGroup = g;
  } catch(e) { console.warn('drawAlignmentDebug failed', e); }
};

window._AR_RENDERER.forceAlign = function() { if (window._AR_RENDERER.alignModelToRooms) return window._AR_RENDERER.alignModelToRooms(); return false; };

// Model scale helpers: allow manual adjustment of the final applied scale
window._AR_RENDERER.setModelScale = function(value) {
  try {
    const v = Number(value);
    if (!isFinite(v)) return false;
    window._AR_MODEL_SCALE = v;
    const mr = window._AR_RENDERER.modelRoot; if (!mr) return true;
    const base = (mr.userData && mr.userData.__lastBaseScale) ? Number(mr.userData.__lastBaseScale) : ((window._AR_WORLD_SCALE && Number(window._AR_WORLD_SCALE)) ? Number(window._AR_WORLD_SCALE) : 1);
    mr.scale.setScalar(base * v);
    mr.updateMatrixWorld(true);
    return true;
  } catch(e) { console.warn('setModelScale failed', e); return false; }
};

window._AR_RENDERER.multiplyModelScale = function(factor) {
  try {
    const f = Number(factor); if (!isFinite(f)) return false;
    const cur = (typeof window._AR_MODEL_SCALE !== 'undefined') ? Number(window._AR_MODEL_SCALE) : 1;
    return window._AR_RENDERER.setModelScale(cur * f);
  } catch(e) { console.warn('multiplyModelScale failed', e); return false; }
};

window._AR_RENDERER.getModelScale = function() { return (typeof window._AR_MODEL_SCALE !== 'undefined') ? Number(window._AR_MODEL_SCALE) : 1; };

window._AR_RENDERER.setStaticModelPose = function(matrixOrObj) {
  try {
    const modelRoot = window._AR_RENDERER.modelRoot; if (!modelRoot) return;
    if (matrixOrObj && matrixOrObj.isMatrix4) { modelRoot.matrix.copy(matrixOrObj); modelRoot.matrix.decompose(modelRoot.position, modelRoot.quaternion, modelRoot.scale); modelRoot.matrixAutoUpdate = false; }
    else if (matrixOrObj && matrixOrObj.position) { modelRoot.position.copy(matrixOrObj.position); if (matrixOrObj.quaternion) modelRoot.quaternion.copy(matrixOrObj.quaternion); if (matrixOrObj.scale) modelRoot.scale.copy(matrixOrObj.scale); modelRoot.matrixAutoUpdate = true; }
  } catch(e) { console.warn('setStaticModelPose failed', e); }
};

window._AR_RENDERER.frameModelAndMarkers = function(paddingFactor) {
  try {
    const THREEm = THREE_module; const rendererObj = window._AR_RENDERER; if (!rendererObj || !rendererObj.scene || !rendererObj.camera) return false;
    const cam = rendererObj.camera; const controls = rendererObj.controls; paddingFactor = (typeof paddingFactor === 'number') ? paddingFactor : 1.2;
    const box = new THREEm.Box3(); let hasAny = false;
    try { const root = rendererObj.currentModel; if (root) { root.updateMatrixWorld(true); box.expandByObject(root); hasAny = true; } } catch(e) {}
    try { if (window.rooms && window.rooms.length) { window.rooms.forEach(r => { const s = (window._AR_WORLD_SCALE && Number(window._AR_WORLD_SCALE)) ? Number(window._AR_WORLD_SCALE) : 1; let x = (Number(r.x||0) * s); if (window._AR_FLIP_X) x = -x; let z = -(Number(r.y||0) * s); if (window._AR_FLIP_Y) z = -z; let v = new THREEm.Vector3(x, 0, z); if (rendererObj.modelRoot) v.applyMatrix4(rendererObj.modelRoot.matrixWorld || rendererObj.modelRoot.matrix); box.expandByPoint(v); hasAny = true; }); } } catch(e) { console.warn('frameModelAndMarkers: failed computing room points', e); }
    if (!hasAny) return false; const size = box.getSize(new THREEm.Vector3()); const center = box.getCenter(new THREEm.Vector3()); const maxDim = Math.max(size.x, size.y, size.z, 0.1) * paddingFactor; const halfFov = (cam.fov * Math.PI / 180) / 2; const distance = (maxDim / 2) / Math.tan(halfFov);
    const dir = new THREEm.Vector3(0, 0, 1); try { dir.copy(cam.getWorldDirection(new THREEm.Vector3()).negate()); } catch(e) {}
    const camPos = new THREEm.Vector3().copy(center).addScaledVector(dir, distance + 2); cam.position.set(camPos.x, center.y + Math.max(2, size.y * 0.7), camPos.z);
    if (controls) { controls.target.copy(center); controls.update(); } else cam.lookAt(center);
    return true;
  } catch(e) { console.warn('frameModelAndMarkers failed', e); return false; }
};
