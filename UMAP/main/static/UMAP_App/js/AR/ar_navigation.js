console.log('[AR_NAV] ar_navigation.js module loading...');

// Start camera feed - with retry logic for video element
async function startCamera() {
  let video = null;
  let attempts = 0;
  
  // Retry to find video element (it might not be in DOM yet)
  while (!video && attempts < 10) {
    video = document.getElementById('camera');
    if (!video) {
      console.log('[AR_NAV] Camera element not found, retrying... (attempt', attempts + 1, ')');
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
  }
  
  if (!video) {
    console.error('[AR_NAV] Camera element not found after retries');
    alert('Camera element not found. Please refresh the page.');
    return;
  }
  
  try {
    console.log('[AR_NAV] Requesting camera permission...');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    console.log('[AR_NAV] Camera stream started successfully');
  } catch (err) {
    console.error('[AR_NAV] Camera error:', err);
    alert('Camera not accessible: ' + err);
  }
}
window.startCamera = startCamera;

window.updateDebug = function(text) { const s = document.getElementById('dbg-status'); if (s) s.textContent = text; else console.log('[AR_NAV] DBG:', text); };
window.rooms = [];
console.log('[AR_NAV] ar_navigation.js module loaded');

if (!window._AR_EVENTS) {
  window._AR_EVENTS = {
    _listeners: {},
    on(name, cb) { if (!this._listeners[name]) this._listeners[name] = []; this._listeners[name].push(cb); },
    off(name, cb) { if (!this._listeners[name]) return; this._listeners[name] = this._listeners[name].filter(f => f !== cb); },
    emit(name, payload) { const l = this._listeners[name] || []; l.forEach(fn => { try { fn(payload); } catch(e){} }); }
  };
}

// default world scale 
if (typeof window._AR_WORLD_SCALE === 'undefined') window._AR_WORLD_SCALE = 0.9;
// default marker size
if (typeof window._AR_MARKER_SIZE === 'undefined') window._AR_MARKER_SIZE = 0.3;
// default model scale
if (typeof window._AR_MODEL_SCALE === 'undefined') window._AR_MODEL_SCALE = 0.9;
// disable automatic model autoscaling by default 
if (typeof window._AR_AUTO_SCALE === 'undefined') window._AR_AUTO_SCALE = false;

// Load rooms from server
try {
  if (window._SERVER_ROOMS && Array.isArray(window._SERVER_ROOMS) && window._SERVER_ROOMS.length > 0) {
    window.rooms = window._SERVER_ROOMS;
    if (window._AR_UI && window._AR_UI.populateRoomSelects) window._AR_UI.populateRoomSelects(window.rooms);
    // DISABLED: Don't render all markers on init - wait for explicit AR navigation via UserAR.js modal
    // if (window._AR_MARKERS && window._AR_MARKERS.highlightOtherRooms) window._AR_MARKERS.highlightOtherRooms(window.rooms, window.userRoomId);
    updateDebug('Loaded rooms from server (inline): ' + window.rooms.length);
  }
} catch (e) { /* ignore */ }

async function loadRoomsFromServer() {
  try {
    console.log('[AR_NAV] Fetching rooms from /api/ar/rooms/');
    const res = await fetch('/api/ar/rooms/');
    if (!res.ok) {
      console.error('[AR_NAV] Rooms fetch failed:', res.status);
      throw new Error('rooms fetch failed: ' + res.status);
    }
    
    const data = await res.json();
    console.log('[AR_NAV] Rooms API response received:', data.rooms ? data.rooms.length : 0, 'rooms');
    
    const roomsArray = data.rooms || data || [];
    window.rooms = (roomsArray || []).map(r => ({ 
      id: String(r.id), 
      number: String(r.number || r.id), 
      name: (r.name && r.name.trim()) || (r.number ? ('Room ' + r.number) : ('Room ' + r.id)), 
      x: Number(r.x) || 0, 
      y: Number(r.y) || 0, 
      z: Number(r.z) || 0 
    }));
    
    console.log('[AR_NAV] Processed', window.rooms.length, 'rooms');
    
    if (window._AR_UI && window._AR_UI.populateRoomSelects) {
      window._AR_UI.populateRoomSelects(window.rooms.map(r => ({ id: r.id, name: r.name })));
    }
    
    // Only render all markers in admin context, NOT in user AR modal context
    const isUserARModal = document.getElementById('user-ar-video-box') && !document.getElementById('ar-video-box');
    if (!isUserARModal && window._AR_MARKERS && window._AR_MARKERS.highlightOtherRooms) {
      console.log('[AR_NAV] Loading rooms in admin context (not user AR modal)');
      window._AR_MARKERS.highlightOtherRooms(window.rooms, window.userRoomId);
    } else if (isUserARModal) {
      console.log('[AR_NAV] Detected user AR modal - skipping highlightOtherRooms, will use User_render instead');
    }
    try { window._AR_EVENTS.emit('rooms:updated', window.rooms); } catch(e) {}
    updateDebug('Loaded rooms from server: ' + window.rooms.length);
    console.log('[AR_NAV] Rooms loaded successfully');
  } catch (err) {
    updateDebug('Failed to load rooms from server: ' + err);
    console.error('[AR_NAV] Room load error:', err);
  }
}

if (document.readyState === 'loading') {
  console.log('[AR_NAV] Document still loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[AR_NAV] DOMContentLoaded fired, loading rooms');
    loadRoomsFromServer();
  });
} else {
  console.log('[AR_NAV] Document already loaded, loading rooms immediately');
  loadRoomsFromServer();
}window.userPos = { x: 0, y: 0, z: 0 };
window.userRoomId = null;

// GLB path — use canonical correct path
try {
  if (window.sanitizeGltfPath) window._AR_GLTF_PATH = window.sanitizeGltfPath('/static/UMAP_App/glb/Umak_3d.glb');
  else window._AR_GLTF_PATH = '/static/UMAP_App/glb/Umak_3d.glb';
} catch (e) { window._AR_GLTF_PATH = '/static/UMAP_App/glb/Umak_3d.glb'; }

// Wire UI population after modules loaded
setTimeout(() => {
  if (window._AR_UI && window._AR_UI.populateRoomSelects) window._AR_UI.populateRoomSelects(window.rooms);
  // DISABLED: Don't render all markers on init - wait for explicit AR navigation via UserAR.js modal
  // if (window._AR_MARKERS && window._AR_MARKERS.highlightOtherRooms) window._AR_MARKERS.highlightOtherRooms(window.rooms, window.userRoomId);
  // show debug and minimap
  updateDebug('Ready');
  // load GLB automatically
  if (window._AR_RENDERER && window._AR_RENDERER.loadGLTF) {
    // if glb is replaced
    window._AR_RENDERER.loadGLTF(window._AR_GLTF_PATH + '?cb=' + Date.now()).then(m => { if (m) updateDebug('Preview model loaded (cache-busted)'); }).catch(e => console.warn('Preview load failed', e));
  }
}, 200);

// Coords overlay helpers ----------------------------------------------------
function refreshCoordsOverlay() {
  try {
    const s = window._AR_WORLD_SCALE || 0.9; const fx = !!window._AR_FLIP_X; const fy = !!window._AR_FLIP_Y;
    const xs = window.rooms.map(r => Number(r.x || 0)); const ys = window.rooms.map(r => Number(r.y || 0));
    if (!xs.length) return;
    const minx = Math.min(...xs), maxx = Math.max(...xs); const miny = Math.min(...ys), maxy = Math.max(...ys);
    const ext = document.getElementById('coords-extents'); if (ext) ext.textContent = `X:[${minx.toFixed(1)},${maxx.toFixed(1)}] Y:[${miny.toFixed(1)},${maxy.toFixed(1)}]`;
    const samples = document.getElementById('coords-samples'); if (samples) {
      samples.innerHTML = '';
      window.rooms.slice(0,10).forEach(r => {
        let x = (r.x || 0) * s; if (fx) x = -x; let z = -(r.y || 0) * s; if (fy) z = -z;
        const el = document.createElement('div'); el.textContent = `${r.name}: scene(${x.toFixed(2)}, ${z.toFixed(2)})`;
        samples.appendChild(el);
      });
    }
  } catch(e) { console.warn('refreshCoordsOverlay error', e); }
}

document.addEventListener('click', function(e){ if (e.target && e.target.id === 'coords-refresh') refreshCoordsOverlay(); });

// Start AR flow: show preview, require pointing at ground and calibrate, then start XR session
window.startARFlow = async function() {
  updateDebug('Starting AR flow: preparing camera and preview');
  if (window.startCamera) await window.startCamera();
  // instruction overlay to point at ground
  const instr = document.createElement('div'); instr.id = 'point-ground-instr'; instr.style.position = 'fixed'; instr.style.left = '50%'; instr.style.top = '10%'; instr.style.transform = 'translateX(-50%)'; instr.style.background='rgba(0,0,0,0.7)'; instr.style.color='#fff'; instr.style.padding='12px 18px'; instr.style.borderRadius='8px'; instr.style.zIndex=12000; instr.style.pointerEvents='auto'; instr.textContent = 'Point your device at the ground and press CALIBRATE when ready.';
  const btn = document.createElement('button'); btn.textContent = 'CALIBRATE'; btn.style.marginLeft='12px'; btn.onclick = async () => {
    // check pointing via sensors helper
    if (window._AR_SENSORS && window._AR_SENSORS.isPointingAtGround && !window._AR_SENSORS.isPointingAtGround()) { alert('Please point the device more toward the ground and try again'); return; }
    // perform calibration
    if (window._AR_SENSORS && window._AR_SENSORS.trySimpleGroundCalibration) window._AR_SENSORS.trySimpleGroundCalibration();
    // small delay to collect samples
    await new Promise(r=>setTimeout(r,1300));
    // hide overlay and start XR
    try { document.body.removeChild(instr); } catch(e){}
    updateDebug('Calibration complete — starting AR session');
    if (window._AR_WEBXR && window._AR_WEBXR.startARSession) window._AR_WEBXR.startARSession();
  };
  instr.appendChild(btn);
  document.body.appendChild(instr);
};

// recreate small test cube in scene for renderer sanity
if (window._AR_RENDERER && window._AR_RENDERER.scene) {
  const geom = new THREE.BoxGeometry(1,1,1); const mat = new THREE.MeshNormalMaterial(); const cube = new THREE.Mesh(geom, mat); cube.position.set(0,1.5,-3); window._AR_RENDERER.scene.add(cube); window.testCube = cube;
}

// Expose a simple public API used by template to localize
window.localizeAR = function(selectedRoomId) {
  const room = window.rooms.find(r => r.id === selectedRoomId);
  if (!room) return;
  window.userPos = { x: room.x, y: room.y, z: room.z };
  window.userRoomId = room.id;
  updateDebug('Localized to ' + room.name);
  
  // Skip rendering all markers if we're using point-to-point AR navigation
  // In that mode, highlightTwoRooms is managed by UserAR.js and webxr.js
  const isPointToPointMode = (window._AR_NAV_CURRENT_ROOM && window._AR_NAV_DESTINATION_ROOM);
  if (!isPointToPointMode && window._AR_MARKERS && window._AR_MARKERS.highlightOtherRooms) {
    window._AR_MARKERS.highlightOtherRooms(window.rooms, window.userRoomId);
  }
  
  // If in XR, try to compute xrLocalization offset using viewer pose (webxr module)
  if (window._AR_WEBXR && window._AR_WEBXR.startARSession && window._AR_WEBXR.anchors !== undefined) {
    // webxr handles xrLocalization when available (left as future improvement)
  }
};

// Move camera / orbit controls to a room's world position so teleport feels like moving the viewer
window.moveCameraToRoom = function(room) {
  try {
    const rendererObj = window._AR_RENDERER;
    if (!rendererObj) return;
    const camera = rendererObj.camera;
    const controls = rendererObj.controls;
    const modelRoot = rendererObj.modelRoot;
    
    // compute world position for the given room
    // ✅ Now includes Z coordinate for vertical positioning
    const scale = window._AR_WORLD_SCALE || 0.9;
    let x = (room.x || 0) * scale; if (window._AR_FLIP_X) x = -x;
    let y = (room.z || 0) * scale; if (window._AR_FLIP_Z) y = -y;  // ✅ Use room.z for Y (vertical)
    let z = -(room.y || 0) * scale; if (window._AR_FLIP_Y) z = -z;
    let roomWorldPos = new THREE.Vector3(x, y, z);
    
    // Check if we're in XR mode
    const xrSession = (window._AR_WEBXR && window._AR_WEBXR.xrSession) || null;
    
    if (xrSession) {
      // In XR mode: position the model root so room appears at device location
      // This shifts the world so the room is at the viewer's position
      if (modelRoot) {
        // Move model root so that room appears at XR viewer origin
        modelRoot.position.copy(roomWorldPos).negate();
        modelRoot.updateMatrixWorld(true);
        console.log('[AR_NAV] XR teleport: moved modelRoot to', modelRoot.position);
      }
    } else {
      // Non-XR mode: move camera with orbit controls
      if (controls) {
        controls.target.copy(roomWorldPos);
        // place camera a bit back from the target (maintaining height from room.z)
        camera.position.set(roomWorldPos.x + 0, roomWorldPos.y + 5, roomWorldPos.z + 8);
        controls.update();
      } else if (camera) {
        camera.position.set(roomWorldPos.x + 0, roomWorldPos.y + 5, roomWorldPos.z + 8);
        camera.lookAt(roomWorldPos);
      }
    }
  } catch(e) { console.warn('moveCameraToRoom failed', e); }
};

// Ground calibration and device motion helpers moved to sensors.js
// Minimal animation loop and glue using modularized modules
function getRenderer() { return (window._AR_RENDERER && window._AR_RENDERER.renderer) || null; }
function getScene() { return (window._AR_RENDERER && window._AR_RENDERER.scene) || null; }
function getCamera() { return (window._AR_RENDERER && window._AR_RENDERER.camera) || null; }

// Defer creation of arrow/test cube until Three is initialized
function createThreeDebugObjectsOnce() {
  try {
    if (!window.THREE) return false;
    const s = getScene(); if (!s) return false;
    if (!window.arrowHelper) {
      const dir = new THREE.Vector3(0,0,-1);
      const origin = new THREE.Vector3(0,0,0);
      const arrow = new THREE.ArrowHelper(dir, origin, 2, 0xff0000);
      s.add(arrow);
      window.arrowHelper = arrow;
    }
    // create test cube
    if (!window.testCube) {
      const geom = new THREE.BoxGeometry(1,1,1);
      const mat = new THREE.MeshNormalMaterial();
      const cube = new THREE.Mesh(geom, mat);
      cube.position.set(0,1.5,-3);
      s.add(cube);
      window.testCube = cube;
    }
    return true;
  } catch (e) { return false; }
}
// try immediately and retry until Three is ready
if (!createThreeDebugObjectsOnce()) {
  const _tryCreate = setInterval(() => { if (createThreeDebugObjectsOnce()) clearInterval(_tryCreate); }, 200);
}

// minimap removed — kept intentionally minimal to reduce UI clutter

// Runtime debug
let _lastDbgUpdate = 0;
function maybeUpdateRuntimeDebug() {
  const now = performance.now(); if (now - _lastDbgUpdate < 1000) return; _lastDbgUpdate = now;
  const video = document.getElementById('camera'); const ready = video ? video.readyState : 'no-video'; const stream = video && video.srcObject ? video.srcObject : null; const tracks = stream ? (stream.getTracks ? stream.getTracks().length : 'unknown') : 0; const webglOK = !!getRenderer() ? 'ok' : 'unknown'; const xrActive = (window._AR_WEBXR && window._AR_WEBXR.anchors) ? 'maybe' : 'none'; updateDebug(`ready=${ready} tracks=${tracks} webgl=${webglOK} xr=${xrActive}`);
}

function animate() {
  requestAnimationFrame(animate);
  
  // Skip rendering if XR session is active - let webxr.js handle rendering in XR frames
  const xrSession = (window._AR_WEBXR && window._AR_WEBXR.xrSession) || null;
  if (xrSession) {
    // XR is active - only update marker positions, don't render
    if (window._AR_MARKERS && window._AR_MARKERS.updateRoomMarkers) {
      const xrRef = (window._AR_WEBXR && window._AR_WEBXR.xrRefSpace) || null;
      const xrLoc = (typeof window.xrLocalization !== 'undefined') ? window.xrLocalization : null;
      window._AR_MARKERS.updateRoomMarkers(window.rooms, window.userPos, xrSession, xrRef, xrLoc);
    }
    return; // Skip all preview rendering during XR
  }
  
  const currentHeading = (window._AR_SENSORS && window._AR_SENSORS.currentHeadingGetter) ? window._AR_SENSORS.currentHeadingGetter() : 0;
  if (window.arrowHelper) window.arrowHelper.setDirection(new THREE.Vector3(Math.sin(currentHeading),0,-Math.cos(currentHeading)));
  // update markers
  if (window._AR_MARKERS && window._AR_MARKERS.updateRoomMarkers) {
    const xrRef = (window._AR_WEBXR && window._AR_WEBXR.xrRefSpace) || null;
    const xrLoc = (typeof window.xrLocalization !== 'undefined') ? window.xrLocalization : null;
    window._AR_MARKERS.updateRoomMarkers(window.rooms, window.userPos, null, xrRef, xrLoc);
  }
  if (window.testCube) { window.testCube.rotation.x += 0.01; window.testCube.rotation.y += 0.02; }
  const renderer = getRenderer(), scene = getScene(), camera = getCamera();
  // update controls: either OrbitControls or free-roam controller
  const freeState = (window._AR_FREE_ROAM && window._AR_FREE_ROAM.enabled);
  if (window._AR_RENDERER && window._AR_RENDERER.controls) {
    try { window._AR_RENDERER.controls.enabled = !freeState; window._AR_RENDERER.controls.update(); } catch(e) {}
  }
  if (freeState && window._AR_FREE_ROAM && typeof window._AR_FREE_ROAM.update === 'function') {
    window._AR_FREE_ROAM.update();
  }
  // If XR localization anchorMatrix exists, apply it to the modelRoot so the model stays anchored in world
  try {
    if (window.xrLocalization && window.xrLocalization.anchorMatrix && window._AR_RENDERER && window._AR_RENDERER.modelRoot) {
      const m = window.xrLocalization.anchorMatrix; // THREE.Matrix4
      const root = window._AR_RENDERER.modelRoot;
      // copy matrix into root and decompose to position/rotation/scale
      root.matrix.copy(m);
      root.matrix.decompose(root.position, root.quaternion, root.scale);
      root.matrixAutoUpdate = false;
    }
  } catch(e) { console.warn('apply anchorMatrix to modelRoot failed', e); }
  if (renderer && scene && camera) renderer.render(scene, camera);
  maybeUpdateRuntimeDebug();
}

animate();

// pointing helper: determine which room user is pointing at using current heading
function detectPointedRoom() {
  if (!window.userRoomId) return;
  let minAngleDiff = Math.PI;
  let pointedRoom = null;
  const currentHeading = (window._AR_SENSORS && window._AR_SENSORS.currentHeadingGetter) ? window._AR_SENSORS.currentHeadingGetter() : 0;
  window.rooms.forEach(room => {
    if (room.id !== window.userRoomId) {
      const dx = room.x - window.userPos.x;
      const dy = room.y - window.userPos.y;
      const angleToRoom = Math.atan2(-dy, dx);
      let diff = Math.abs(normalizeAngle(angleToRoom - currentHeading));
      if (diff < minAngleDiff) { minAngleDiff = diff; pointedRoom = room; }
    }
  });
  if (pointedRoom && minAngleDiff < 0.35) showPointedRoomLabel(pointedRoom.name); else showPointedRoomLabel('');
}

function normalizeAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

let pointedRoomLabelDiv = null;
function showPointedRoomLabel(name) {
  if (!pointedRoomLabelDiv) {
    pointedRoomLabelDiv = document.createElement('div');
    pointedRoomLabelDiv.style.position = 'fixed'; pointedRoomLabelDiv.style.bottom = '10%'; pointedRoomLabelDiv.style.left = '50%'; pointedRoomLabelDiv.style.transform = 'translateX(-50%)';
    pointedRoomLabelDiv.style.background = 'rgba(0,0,0,0.7)'; pointedRoomLabelDiv.style.color = '#fff'; pointedRoomLabelDiv.style.padding = '0.7em 1.5em'; pointedRoomLabelDiv.style.borderRadius = '10px'; pointedRoomLabelDiv.style.fontSize = '1.3em'; pointedRoomLabelDiv.style.zIndex = 30;
    document.body.appendChild(pointedRoomLabelDiv);
  }
  pointedRoomLabelDiv.textContent = name ? `Pointing at: ${name}` : '';
  pointedRoomLabelDiv.style.display = name ? 'block' : 'none';
}

// Free-roam controller (WASD + mouse look)
;(function(){
  const state = { enabled: false, keys: {}, pitch: 0, yaw: 0, moveSpeed: 5.0, lookSpeed: 0.002, dragging: false, lastX:0, lastY:0, pointerLocked: false, lastTime: performance.now() };

  function onKeyDown(e) { 
    // Toggle with 'R'
    if (e.code === 'KeyR') { if (!state.enabled) enableFreeRoam(); else disableFreeRoam(); try { const el = document.getElementById('dbg-free-roam'); if (el) el.checked = state.enabled; } catch(e){} return; }
    state.keys[e.code] = true;
    // prevent page scrolling and other default actions for movement keys while free-roam is active
    if (state.enabled && (e.code === 'Space' || e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD' || e.code === 'ShiftLeft' || e.code === 'ShiftRight')) {
      try { e.preventDefault(); } catch(ex) {}
    }
    if (e.code === 'Escape' || e.key === 'f' || e.key === 'F') { disableFreeRoam(); try { const el = document.getElementById('dbg-free-roam'); if (el) el.checked = false; } catch(e){} }
  }
  function onKeyUp(e) { 
    state.keys[e.code] = false; 
    if (state.enabled && (e.code === 'Space' || e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD' || e.code === 'ShiftLeft' || e.code === 'ShiftRight')) {
      try { e.preventDefault(); } catch(ex) {}
    }
  }
  function onMouseDown(e) { if (e.button === 2) { state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY; e.preventDefault(); } }
  function onMouseUp(e) { if (e.button === 2) { state.dragging = false; } }
  function onMouseMove(e) {
    if (state.pointerLocked) {
      // movementX/movementY are relative motion when pointer is locked
      const dx = e.movementX || 0; const dy = e.movementY || 0;
      state.yaw -= dx * state.lookSpeed; state.pitch -= dy * state.lookSpeed;
      state.pitch = Math.max(-Math.PI/2 + 0.001, Math.min(Math.PI/2 - 0.001, state.pitch));
      return;
    }
    if (!state.dragging) return;
    const dx = e.clientX - state.lastX; const dy = e.clientY - state.lastY; state.lastX = e.clientX; state.lastY = e.clientY;
    state.yaw -= dx * state.lookSpeed; state.pitch -= dy * state.lookSpeed;
    state.pitch = Math.max(-Math.PI/2 + 0.001, Math.min(Math.PI/2 - 0.001, state.pitch));
  }

  function onPointerLockChange() {
    state.pointerLocked = (document.pointerLockElement === document.body);
  }

  function onPointerLockError(){ console.warn('pointer lock error'); }

  function enableFreeRoam() {
    console.log('enableFreeRoam called');
    if (state.enabled) return;
    state.enabled = true; window._AR_FREE_ROAM = window._AR_FREE_ROAM || {};
    window._AR_FREE_ROAM.enabled = true; window._AR_FREE_ROAM._state = state; window._AR_FREE_ROAM.update = update;
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp); window.addEventListener('mousemove', onMouseMove);
    // pointer lock handlers
    document.addEventListener('pointerlockchange', onPointerLockChange); document.addEventListener('pointerlockerror', onPointerLockError);
    // request pointer lock on first user gesture (click) for smoother look; create a prompt
    try {
      const ask = () => { try { document.body.requestPointerLock(); document.removeEventListener('click', ask); } catch(e){} };
      document.addEventListener('click', ask, { once: true });
    } catch(e) {}
    // prevent context menu from opening while free-roam is active
    window.addEventListener('contextmenu', onContextMenuPrevent);
  // hide cursor (pointer lock will manage this when active)
  try { document.body.style.cursor = 'none'; } catch(e){}
    // initialize pitch/yaw from current camera quaternion
    try {
      const cam = (window._AR_RENDERER && window._AR_RENDERER.camera) || null;
      if (cam) {
        const euler = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ'); state.yaw = euler.y; state.pitch = euler.x;
      }
    } catch(e){}
    try { if (window._AR_RENDERER && window._AR_RENDERER.frameModelAndMarkers) window._AR_RENDERER.frameModelAndMarkers(); } catch(e){}
    // create small HUD to show free-roam status
    try {
      let hud = document.getElementById('free-roam-hud');
      if (!hud) {
        hud = document.createElement('div'); hud.id = 'free-roam-hud'; hud.style.position = 'fixed'; hud.style.left = '10px'; hud.style.top = '10px'; hud.style.zIndex = 20000; hud.style.background='rgba(0,0,0,0.5)'; hud.style.color='#fff'; hud.style.padding='6px 10px'; hud.style.borderRadius='6px'; hud.style.fontFamily='monospace'; document.body.appendChild(hud);
      }
      hud.textContent = 'Free roam: ON (R to toggle, Esc to exit)';
    } catch(e){}
  }

  function disableFreeRoam() {
    console.log('disableFreeRoam called');
    if (!state.enabled) return;
    state.enabled = false; window._AR_FREE_ROAM.enabled = false;
    window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp); window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('contextmenu', onContextMenuPrevent);
    try { document.body.style.cursor = ''; } catch(e){}
    try { const hud = document.getElementById('free-roam-hud'); if (hud && hud.parentNode) hud.parentNode.removeChild(hud); } catch(e){}
  }

  function onContextMenuPrevent(e) { if (state.enabled) { e.preventDefault(); return false; } }

  function update() {
    const cam = (window._AR_RENDERER && window._AR_RENDERER.camera) || null; if (!cam) return;
    const now = performance.now(); const dt = Math.min(0.1, (now - state.lastTime) / 1000); state.lastTime = now;
  // movement vector in camera space (W forward, S back)
  let moveZ = 0, moveX = 0, moveY = 0;
  if (state.keys['KeyW']) moveZ += 1; if (state.keys['KeyS']) moveZ -= 1;
  if (state.keys['KeyA']) moveX -= 1; if (state.keys['KeyD']) moveX += 1;
    if (state.keys['Space']) moveY += 1; if (state.keys['ShiftLeft'] || state.keys['ShiftRight']) moveY -= 1;
    // normalize
    const len = Math.hypot(moveX, moveY, moveZ) || 1;
    const speed = state.moveSpeed;
    const localDX = (moveX / len) * speed * dt; const localDY = (moveY / len) * speed * dt; const localDZ = (moveZ / len) * speed * dt;
  // apply movement relative to camera heading (use camera quaternion)
  const forwardDir = new THREE.Vector3(0,0,-1).applyQuaternion(cam.quaternion);
  forwardDir.y = 0; forwardDir.normalize();
  const rightDir = new THREE.Vector3().crossVectors(forwardDir, new THREE.Vector3(0,1,0)).normalize();
  const delta = new THREE.Vector3();
  delta.addScaledVector(forwardDir, localDZ);
  delta.addScaledVector(rightDir, localDX);
  delta.y += localDY;
    cam.position.add(delta);
    // apply rotation
    cam.quaternion.setFromEuler(new THREE.Euler(state.pitch, state.yaw, 0, 'YXZ'));
  }

  // expose
  window.enableFreeRoam = enableFreeRoam; window.disableFreeRoam = disableFreeRoam; window._AR_FREE_ROAM = window._AR_FREE_ROAM || { enabled: false, update };
})();

// Ensure global toggles work: checkbox change and global key handler (R to toggle, Esc/F to disable)
try {
  document.addEventListener('change', function(e) { try {
    // Ignore free-roam toggles while XR session is active
    if (window._AR_WEBXR && window._AR_WEBXR.xrSession) { return; }
    if (e.target && e.target.id === 'dbg-free-roam') { console.log('global change event for dbg-free-roam, checked=', e.target.checked); if (e.target.checked) { if (window.enableFreeRoam) window.enableFreeRoam(); } else { if (window.disableFreeRoam) window.disableFreeRoam(); } }
  } catch(ex) {} });
  document.addEventListener('keydown', function(e) { try {
    // Prevent toggles from interfering with XR sessions
    if (window._AR_WEBXR && window._AR_WEBXR.xrSession) { return; }
    if (e.code === 'KeyR') { console.log('KeyR pressed global'); if (window._AR_FREE_ROAM && window._AR_FREE_ROAM.enabled) { if (window.disableFreeRoam) window.disableFreeRoam(); const el = document.getElementById('dbg-free-roam'); if (el) el.checked = false; } else { if (window.enableFreeRoam) window.enableFreeRoam(); const el = document.getElementById('dbg-free-roam'); if (el) el.checked = true; } }
    if (e.code === 'Escape' || e.key === 'f' || e.key === 'F') { if (window.disableFreeRoam) window.disableFreeRoam(); const el = document.getElementById('dbg-free-roam'); if (el) el.checked = false; }
  } catch(ex) {} });
} catch(e) { }

// ===== Example: Pointing toward a target (default: first other room) =====

let targetRoomId = null;
window.setTargetRoom = function(roomId) {
  targetRoomId = roomId;
  updateTargetArrow();

  try {
    const room = window.rooms.find(r => String(r.id) === String(roomId));
    if (!room) return;

    // If in an active XR session, compute an XR localization so the selected room
    // is placed at the viewer (effectively centering the POV on the chosen marker).
    if (window._AR_WEBXR && window._AR_WEBXR.xrSession) {
      // Use the exposed helper which captures the current viewer pose and computes
      // an offset that maps the room's scene coordinates to world coordinates.
      const localizeFn = (window._AR_WEBXR && typeof window._AR_WEBXR.localizeInXR === 'function') ? window._AR_WEBXR.localizeInXR : window.localizeInXR;
      if (localizeFn) {
        localizeFn(room).then(xrLoc => {
          try {
            // mark user as located in this room
            window.userPos = { x: room.x, y: room.y, z: room.z };
            window.userRoomId = room.id;
            // DISABLED: Don't render all markers - using point-to-point AR navigation now
            // if (window._AR_MARKERS && window._AR_MARKERS.highlightOtherRooms) window._AR_MARKERS.highlightOtherRooms(window.rooms, window.userRoomId);
            // Force markers to update now that xrLocalization is set
            try { if (window._AR_MARKERS && window._AR_MARKERS.updateRoomMarkers) window._AR_MARKERS.updateRoomMarkers(window.rooms, window.userPos, window._AR_WEBXR.xrSession, null, window.xrLocalization); } catch(e){}
            updateDebug('XR centered on ' + room.name);
          } catch(e) { console.warn('post-localizeInXR handler failed', e); }
        }).catch(err => { console.warn('localizeInXR failed', err); });
        return;
      }
    }

    // Non-XR (preview) mode: move the orbit camera to frame the selected room
    if (window.moveCameraToRoom) {
      window.moveCameraToRoom(room);
      window.userPos = { x: room.x, y: room.y, z: room.z };
      window.userRoomId = room.id;
      // DISABLED: Don't render all markers - using point-to-point AR navigation now
      // if (window._AR_MARKERS && window._AR_MARKERS.highlightOtherRooms) window._AR_MARKERS.highlightOtherRooms(window.rooms, window.userRoomId);
      updateDebug('Moved preview camera to ' + room.name);
    }
  } catch (e) { console.warn('setTargetRoom handling failed', e); }
};

function updateTargetArrow() {
  let targetRoom = window.rooms.find(r => r.id === targetRoomId);
  if (!targetRoom) {
    // Default: pick first room that's not user's room
    targetRoom = window.rooms.find(r => r.id !== window.userRoomId);
    if (!targetRoom) return;
  }
  let angle = 0;
  var dx, dy, dz;
  if (window.xrLocalization && window.xrLocalization.offset) {
    // compute arrow direction using XR world positions
    const targetPos = new THREE.Vector3(targetRoom.x, 0, -targetRoom.y).add(window.xrLocalization.offset);
    const userWorldPos = window.xrLocalization.viewerPos;
    dx = targetPos.x - userWorldPos.x;
    dz = targetPos.z - userWorldPos.z;
    angle = Math.atan2(dz, dx);
    if (window.arrowHelper) window.arrowHelper.setDirection(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
  } else {
    dx = targetRoom.x - window.userPos.x;
    dy = targetRoom.y - window.userPos.y;
    // Use -dy to convert to Three.js Z
    angle = Math.atan2(-dy, dx);
    if (window.arrowHelper) window.arrowHelper.setDirection(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
  }

  // Check if user is close enough to target room to "arrive"
  let dist = 1e9;
  if (typeof dy !== 'undefined') dist = Math.sqrt(dx*dx + dy*dy);
  else if (typeof dz !== 'undefined') dist = Math.sqrt(dx*dx + dz*dz);
  if (dist < 1.0) { // 1 meter threshold
    // Auto-localize to new room
    window.userPos = { x: targetRoom.x, y: targetRoom.y, z: targetRoom.z };
    window.userRoomId = targetRoom.id;
    if (window._AR_MARKERS && window._AR_MARKERS.highlightOtherRooms) window._AR_MARKERS.highlightOtherRooms(window.rooms, window.userRoomId);
    // Optionally update UI
    if (document.getElementById('directions-status')) {
      document.getElementById('directions-status').textContent = 'Arrived at ' + targetRoom.name;
    }
    // Remove target
    targetRoomId = null;
  }
}

