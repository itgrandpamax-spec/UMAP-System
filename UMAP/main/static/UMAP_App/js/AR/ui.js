console.log('[AR_UI] ui.js module loading...');

// UI helpers (moved from ar_navigation.js)
function ensureDebugOverlay() {
  if (window._AR_DEBUG_CREATED) return;
  window._AR_DEBUG_CREATED = true;
  
  // Hook updateDebug to append to mobile log area
  const _oldDbg = window.updateDebug || function(t){ console.log('DBG:', t); };
  window.updateDebug = function(text) { 
    try { 
      _oldDbg(text); 
      const a = document.getElementById('mobile-log-area'); 
      if (a) { 
        const el = document.createElement('div'); 
        el.textContent = text; 
        a.appendChild(el); 
        a.scrollTop = a.scrollHeight; 
      } 
    } catch(e) { console.log('DBG hook error', e); } 
  };

  // Wire up buttons
  const orientBtn = document.getElementById('dbg-orient-perm'); 
  if (orientBtn) orientBtn.onclick = () => { 
    if (window._AR_SENSORS && window._AR_SENSORS.requestOrientationPermissionIfNeeded) 
      window._AR_SENSORS.requestOrientationPermissionIfNeeded(); 
    else 
      updateDebug('Orientation permission helper not available'); 
  };
  
  const calibrateBtn = document.getElementById('dbg-calibrate'); 
  if (calibrateBtn) calibrateBtn.onclick = () => { 
    if (window._AR_SENSORS && window._AR_SENSORS.trySimpleGroundCalibration) 
      window._AR_SENSORS.trySimpleGroundCalibration(); 
    else 
      updateDebug('Calibration helper not available'); 
  };
  
  const camBtn = document.getElementById('dbg-start-camera'); 
  if (camBtn) camBtn.onclick = () => { 
    if (window.startCamera) { 
      window.startCamera(); 
      updateDebug('Camera start requested'); 
    } else 
      updateDebug('startCamera not available'); 
  };
  
  const clearAnchorsBtn = document.getElementById('dbg-clear-anchors');
  if (clearAnchorsBtn) clearAnchorsBtn.onclick = () => {
    if (window._AR_WEBXR && window._AR_WEBXR.clearAnchors) {
      window._AR_WEBXR.clearAnchors();
    } else {
      if (window._AR_WEBXR && window._AR_WEBXR.anchors) {
        window._AR_WEBXR.anchors.forEach(a => { 
          try { if (a.object) window._AR_RENDERER.scene.remove(a.object); } catch (e) {} 
          try { if (a.anchor && a.anchor.delete) a.anchor.delete(); } catch (e) {} 
        });
        window._AR_WEBXR.anchors.length = 0;
        const c = document.getElementById('dbg-anchors-count'); 
        if (c) c.textContent = '0';
        updateDebug('Anchors cleared (fallback)');
      } else 
        updateDebug('No anchors module available');
    }
  };

  // Capture console.error and window.onerror into mobile log
  (function(){
    const origErr = console.error; 
    console.error = function(...args){ 
      try { 
        origErr.apply(console, args); 
        const a = document.getElementById('mobile-log-area'); 
        if (a) { 
          const el = document.createElement('div'); 
          el.style.color='#ff6b6b'; 
          el.textContent = 'ERROR: ' + args.map(x=> (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' '); 
          a.appendChild(el); 
          a.scrollTop = a.scrollHeight; 
        } 
      } catch(e){} 
    }; 
    window.onerror = function(msg, src, line, col, err) { 
      try { 
        const a = document.getElementById('mobile-log-area'); 
        if (a) { 
          const el = document.createElement('div'); 
          el.style.color='#ff6b6b'; 
          el.textContent = `onerror: ${msg} (${src}:${line}:${col})`; 
          a.appendChild(el); 
          a.scrollTop = a.scrollHeight; 
        } 
      } catch(e){} 
    }; 
  })();
}

// Wait for DOM to be ready before initializing UI
if (document.readyState === 'loading') {
  console.log('[AR_UI] Document still loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[AR_UI] DOMContentLoaded fired, initializing UI');
    ensureDebugOverlay();
  });
} else {
  console.log('[AR_UI] Document already loaded, initializing UI immediately');
  ensureDebugOverlay();
}

// Wire up transform debug panel controls
function wireTransformDebugPanel() {
  try {
    const stored = localStorage.getItem('ar_markers_offset');
    if (stored) window._AR_MARKERS_OFFSET = JSON.parse(stored);
  } catch(e) {}
  if (!window._AR_MARKERS_OFFSET) window._AR_MARKERS_OFFSET = { x: -1.9, y: -0.2, z: -3.0 };

  // Set default scales
  window._AR_WORLD_SCALE = 0.9;
  window._AR_MARKER_SIZE = 0.3;
  window._AR_MODEL_SCALE = 0.9;

  const getInput = id => document.getElementById(id);
  
  // Apply Transform Button
  const applyBtn = getInput('dbg-apply-transform');
  if (applyBtn) {
    applyBtn.onclick = () => {
      const s = parseFloat(getInput('dbg-scale').value) || 0.9;
      window._AR_WORLD_SCALE = s;
      const markerSize = parseFloat(getInput('dbg-marker-size').value) || 0.3;
      window._AR_MARKER_SIZE = markerSize;
      const msVal = parseFloat(getInput('dbg-model-scale').value) || 0.9;
      window._AR_MODEL_SCALE = msVal;
      if (window.updateDebug) window.updateDebug('Applied: world=' + s + ' marker=' + markerSize + ' model=' + msVal);
      if (window._AR_MARKERS && window._AR_MARKERS.highlightOtherRooms) window._AR_MARKERS.highlightOtherRooms(window.rooms, window.userRoomId);
    };
  }

  // Nudge Controls
  const nudgeXInput = getInput('dbg-nudge-x');
  const nudgeYInput = getInput('dbg-nudge-y');
  const nudgeZInput = getInput('dbg-nudge-z');
  const nudgeResetBtn = getInput('dbg-nudge-reset');
  const nudgeTarget = getInput('dbg-nudge-target');
  const bindMarkersChk = getInput('dbg-bind-markers');

  if (nudgeResetBtn) {
    nudgeResetBtn.onclick = () => {
      if (nudgeXInput) nudgeXInput.value = '0';
      if (nudgeYInput) nudgeYInput.value = '0';
      if (nudgeZInput) nudgeZInput.value = '0';
      if (window.updateDebug) window.updateDebug('Nudge reset to origin');
    };
  }

  if (bindMarkersChk) {
    bindMarkersChk.onchange = () => {
      window._AR_MARKERS_BIND_TO_MODEL = !!bindMarkersChk.checked;
      if (window.updateDebug) window.updateDebug('Markers bind to model: ' + bindMarkersChk.checked);
      if (window._AR_MARKERS && window._AR_MARKERS.highlightOtherRooms) window._AR_MARKERS.highlightOtherRooms(window.rooms, window.userRoomId);
    };
  }

  // Nudge input handlers - apply nudge in real-time
  const applyNudge = () => {
    try {
      const target = nudgeTarget ? nudgeTarget.value : 'model';
      const x = parseFloat(nudgeXInput?.value || 0);
      const y = parseFloat(nudgeYInput?.value || 0);
      const z = parseFloat(nudgeZInput?.value || 0);

      if (target === 'model') {
        if (window._AR_RENDERER && window._AR_RENDERER.modelRoot) {
          window._AR_RENDERER.modelRoot.position.x += x;
          window._AR_RENDERER.modelRoot.position.y += y;
          window._AR_RENDERER.modelRoot.position.z += z;
        }
      } else if (target === 'markers') {
        window._AR_MARKERS_OFFSET = { x: x, y: y, z: z };
        if (window._AR_MARKERS && window._AR_MARKERS.highlightOtherRooms) {
          window._AR_MARKERS.highlightOtherRooms(window.rooms, window.userRoomId);
        }
      }
    } catch(e) { console.warn('Nudge apply failed', e); }
  };

  if (nudgeXInput) nudgeXInput.onchange = applyNudge;
  if (nudgeYInput) nudgeYInput.onchange = applyNudge;
  if (nudgeZInput) nudgeZInput.onchange = applyNudge;
}
wireTransformDebugPanel();

// Wire up teleport and load controls
function wireTeleportControls() {
  const sel = document.getElementById('dbg-teleport-select');
  const tpBtn = document.getElementById('dbg-teleport-btn');
  const loadBtn = document.getElementById('dbg-load-fbx');
  const freeRoamChk = document.getElementById('dbg-free-roam');

  if (tpBtn) {
    tpBtn.onclick = () => {
      try {
        const free = freeRoamChk && freeRoamChk.checked;
        const id = (sel && sel.value) || null;
        const room = window.rooms && window.rooms.find(r => r.id === id);
        if (!room) return;
        window.userPos = { x: room.x, y: room.y, z: room.z };
        window.userRoomId = room.id;
        if (window._AR_MARKERS && window._AR_MARKERS.highlightOtherRooms) 
          window._AR_MARKERS.highlightOtherRooms(window.rooms, window.userRoomId);
        if (!free) {
          if (window.moveCameraToRoom) window.moveCameraToRoom(room);
          if (window.updateDebug) window.updateDebug('Teleported to ' + room.name);
        } else {
          if (window.updateDebug) window.updateDebug('Free roam enabled — not teleporting (selected ' + room.name + ')');
        }
      } catch(e) { console.warn('teleport handler failed', e); }
    };
  }

  if (loadBtn) {
    loadBtn.onclick = () => {
      if (window._AR_RENDERER && window._AR_RENDERER.loadGLTF) 
        window._AR_RENDERER.loadGLTF(window._AR_GLTF_PATH + '?cb=' + Date.now());
    };
  }
}
wireTeleportControls();

// Wire up calibrate button
function wireCalibrateButton() {
  const calBtn = document.getElementById('calibrate-here-btn');
  if (calBtn) {
    calBtn.onclick = () => {
      if (!window._AR_WEBXR || !window._AR_WEBXR.xrSession) {
        if (window.updateDebug) window.updateDebug('Calibrate requires an active XR session');
        return;
      }
      if (window._AR_WEBXR && typeof window._AR_WEBXR.calibrateUsingLastFrameHit === 'function') {
        window._AR_WEBXR.calibrateUsingLastFrameHit();
      }
    };
  }
}
wireCalibrateButton();

// Wire up Start AR button
function wireStartARButton() {
  const startBtn = document.getElementById('start-ar-btn');
  if (startBtn) {
    startBtn.onclick = () => {
      if (window.startARFlow) {
        window.startARFlow();
      } else if (window._AR_WEBXR && typeof window._AR_WEBXR.startARSession === 'function') {
        window._AR_WEBXR.startARSession();
      } else {
        if (window.updateDebug) window.updateDebug('AR session start not available');
      }
    };
  }
}
wireStartARButton();

function populateRoomSelects(rooms) {
  try {
    console.log('populateRoomSelects called with', rooms && rooms.length, 'rooms');
    const dbgSel = document.getElementById('dbg-teleport-select'); if (dbgSel) { dbgSel.innerHTML = ''; rooms.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.name; dbgSel.appendChild(o); }); }
    const targetSel = document.getElementById('target-room-select'); if (targetSel) { targetSel.innerHTML = ''; rooms.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.name; targetSel.appendChild(o); }); }
    const goBtn = document.getElementById('go-to-room-btn'); if (goBtn && targetSel) { goBtn.onclick = () => { const id = targetSel.value; window.setTargetRoom(id); document.getElementById('directions-ui').style.display = 'block'; document.getElementById('directions-status').textContent = 'Heading to ' + targetSel.options[targetSel.selectedIndex].text; }; }
    // populate the localization overlay select (if present in template)
    const locSel = document.getElementById('room-select'); if (locSel) { locSel.innerHTML = ''; const placeholder = document.createElement('option'); placeholder.value=''; placeholder.disabled=true; placeholder.selected=true; placeholder.textContent = 'Select a room'; locSel.appendChild(placeholder); rooms.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.name; locSel.appendChild(o); }); }
  } catch (err) { console.warn('populateRoomSelects error', err); }
}

// localization overlay wiring is in template; we expose showDirectionsUI used by template
window.showDirectionsUI = function(selectedRoomId) {
  try {
    const directions = document.getElementById('directions-ui'); if (directions) directions.style.display = 'block';
    const sel = document.getElementById('target-room-select'); if (sel && selectedRoomId) { for (let i=0;i<sel.options.length;i++) { if (sel.options[i].value !== selectedRoomId) { sel.selectedIndex = i; break; } } }
  } catch (err) { console.warn('showDirectionsUI error', err); }
};

window._AR_UI = { ensureDebugOverlay, populateRoomSelects };
