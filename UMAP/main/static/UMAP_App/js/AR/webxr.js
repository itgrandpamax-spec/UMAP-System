console.log('[AR_WEBXR] webxr.js module loading...');

// WebXR session, hit-test and anchors (moved from ar_navigation.js)
// Safe lookup of renderer/scene/camera from the shared holder
if (!window.updateDebug) window.updateDebug = function(text) { try { console.log('DBG:', text); } catch(e){} };
// prefer centralized debug API when available
if (window._AR_DEBUG && window._AR_DEBUG.setStatus) window.updateDebug = window._AR_DEBUG.setStatus;
function getARRenderer() { return (window._AR_RENDERER && window._AR_RENDERER.renderer) || null; }
function getARScene() { return (window._AR_RENDERER && window._AR_RENDERER.scene) || null; }
function getARCamera() { return (window._AR_RENDERER && window._AR_RENDERER.camera) || null; }

let xrSession = null;
let xrRefSpace = null;
let xrHitTestSource = null;
let isXRSupported = false;
let anchors = [];
let placeAnchorRequested = false;
let calibrateRequested = false;
let lastFrameHit = null;
let isInXRFrame = false; // Track if we're currently inside an XR animation frame
// Reticle for hit-test visual feedback
let xrReticle = null;

function ensureReticle() {
  const s = getARScene();
  if (!s) return;
  if (xrReticle) return;
  if (typeof THREE === 'undefined') {
    // try again shortly
    setTimeout(ensureReticle, 200);
    return;
  }
  const ringGeo = new THREE.RingGeometry(0.12, 0.16, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x1565c0, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  xrReticle = new THREE.Mesh(ringGeo, ringMat);
  xrReticle.rotation.x = -Math.PI/2; // lie flat on ground
  xrReticle.visible = false;
  s.add(xrReticle);
}

function updateAnchorCount() {
  const c = document.getElementById('dbg-anchors-count');
  if (c) c.textContent = anchors.length.toString();
}

function clearAnchors() {
  // remove visuals and delete anchors if possible, keep same array object
    anchors.forEach(a => {
      try {
        const s = getARScene();
        if (a.object && s && a.object.parent) s.remove(a.object);
      } catch (e) { /* ignore */ }
      try {
        if (a.anchor && typeof a.anchor.delete === 'function') a.anchor.delete();
      } catch (e) { /* ignore */ }
    });
  anchors.length = 0;
  updateDebug('Anchors cleared');
  updateAnchorCount();
}

async function checkXRSupport() {
  if (navigator.xr && navigator.xr.isSessionSupported) {
    try {
      isXRSupported = await navigator.xr.isSessionSupported('immersive-ar');
    updateDebug('WebXR supported: ' + isXRSupported);
    } catch (err) { console.warn('XR support check failed', err); isXRSupported = false; }
  } else { isXRSupported = false; updateDebug('WebXR not available'); }
}
checkXRSupport();

function addPlaceAnchorButton() {
  if (document.getElementById('place-anchor-btn')) return;
  const container = document.body;
  const p = document.createElement('button');
  p.id = 'place-anchor-btn'; p.textContent = 'Place Anchor';
  p.style.position = 'absolute'; p.style.right = '10px'; p.style.bottom = '60px'; p.style.zIndex = 10001; p.style.pointerEvents = 'auto';
  container.appendChild(p);
  p.onclick = () => { placeAnchorRequested = true; updateDebug('Place anchor requested (will place at next XR frame hit test)'); };
}
addPlaceAnchorButton();

// hide by default
const _placeBtn = document.getElementById('place-anchor-btn'); if (_placeBtn) _placeBtn.style.display = 'none';

async function startARSession() {
  if (!navigator.xr) { updateDebug('WebXR not available'); return; }
  
  // Wait for model to be fully loaded before starting AR
  try {
    let modelReady = false;
    let waitAttempts = 0;
    while (!modelReady && waitAttempts < 20) {
      if (window._AR_RENDERER && window._AR_RENDERER.currentModel && window._AR_RENDERER.scene) {
        modelReady = true;
        console.log('[AR_WEBXR] Model loaded and ready for AR');
      } else {
        waitAttempts++;
        await new Promise(r => setTimeout(r, 100));
      }
    }
    if (!modelReady) {
      console.warn('[AR_WEBXR] Model not fully loaded, proceeding anyway');
    }
  } catch (e) {
    console.warn('[AR_WEBXR] Error waiting for model load:', e);
  }
  
  try {
    // Constrain AR to overlay canvas only, not fullscreen
    const overlayCanvas = document.getElementById('overlay');
    const sessionInit = { 
      requiredFeatures: ['hit-test','local-floor'], 
      optionalFeatures: [],
      // Don't use dom-overlay to prevent fullscreen takeover
    };
    
    xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
  updateDebug('XR session started');
  // When entering AR, prefer a larger world-scale so markers match real-world spacing
  try {
    window._AR_WORLD_SCALE = 0.9;
    updateDebug('AR started: setting world scale to 0.9 for XR');
    // reapply transforms so model and markers update to new scale
    // Unbind markers from the model during AR so they can be positioned in world space
    try {
      // store previous bind state so we can restore it when XR ends
      window._AR_MARKERS_BIND_TO_MODEL_PREV = (typeof window._AR_MARKERS_BIND_TO_MODEL === 'undefined') ? true : !!window._AR_MARKERS_BIND_TO_MODEL;
      window._AR_MARKERS_BIND_TO_MODEL = false;
      // Use highlightTwoRooms for Point A (current) and Point B (destination)
      // Skip if markers already preloaded in preview mode
      if (!window._AR_MARKERS_PRELOADED && window._AR_MARKERS && window._AR_MARKERS.highlightTwoRooms && window._AR_NAV_CURRENT_ROOM && window._AR_NAV_DESTINATION_ROOM) {
        window._AR_MARKERS.highlightTwoRooms(window._AR_NAV_CURRENT_ROOM, window._AR_NAV_DESTINATION_ROOM);
      }
      // AUTO-TELEPORT IN XR: Position Point A at device origin so user starts at Point A
      // In XR, the viewer's device is at (0,0,0) by default. We need to shift world coordinates
      // so that Point A appears at that origin. This is done via modelRoot transformation.
      if (window._AR_PENDING_TELEPORT_ROOM) {
        const pointA = window._AR_PENDING_TELEPORT_ROOM;
        const scale = window._AR_WORLD_SCALE || 0.9;
        
        // Calculate Point A's world position
        let x = (pointA.x || 0) * scale;
        let y = (pointA.z || 0) * scale;  // Use Z for vertical (Y in 3D)
        let z = -(pointA.y || 0) * scale;
        
        if (window._AR_FLIP_X) x = -x;
        if (window._AR_FLIP_Z) y = -y;
        if (window._AR_FLIP_Y) z = -z;
        
        // Move modelRoot so Point A is at viewer origin (0,0,0)
        if (window._AR_RENDERER && window._AR_RENDERER.modelRoot) {
          const pointAPos = new THREE.Vector3(x, y, z);
          window._AR_RENDERER.modelRoot.position.copy(pointAPos).negate();
          window._AR_RENDERER.modelRoot.updateMatrixWorld(true);
          console.log('[AR_WEBXR] XR teleport: positioned Point A at viewer origin. ModelRoot offset:', window._AR_RENDERER.modelRoot.position);
        }
        window._AR_PENDING_TELEPORT_ROOM = null; // Clear to avoid repeat teleports
      }
    } catch(e) { console.warn('Failed to render AR markers or teleport', e); }
    if (window._AR_RENDERER && window._AR_RENDERER.recenterCurrentModel) window._AR_RENDERER.recenterCurrentModel();
    if (window._AR_RENDERER && window._AR_RENDERER.setModelScale) window._AR_RENDERER.setModelScale(window._AR_MODEL_SCALE || 1);
  } catch (e) { console.warn('Failed to apply AR start scale updates', e); }
  // hide preview model if present to avoid visual conflicts in XR
  try { if (window._AR_RENDERER && window._AR_RENDERER.currentModel) { window._AR_RENDERER.currentModel.visible = false; } } catch(e) {}
    const arRenderer = getARRenderer();
    const gl = arRenderer ? arRenderer.getContext() : null;
    if (gl && gl.makeXRCompatible) await gl.makeXRCompatible();
    if (arRenderer) {
      arRenderer.xr.enabled = true;
      // Let three handle the XR session binding
      arRenderer.xr.setSession(xrSession);
    }
    if (gl) xrSession.updateRenderState({ baseLayer: new XRWebGLLayer(xrSession, gl) });
  xrRefSpace = await xrSession.requestReferenceSpace('local-floor');
  // expose reference space to other modules
  try { window._AR_WEBXR = window._AR_WEBXR || {}; window._AR_WEBXR.xrRefSpace = xrRefSpace; } catch(e) {}
    const viewerSpace = await xrSession.requestReferenceSpace('viewer');
    xrHitTestSource = await xrSession.requestHitTestSource({ space: viewerSpace });
    // Force-disable free-roam when entering XR so the device-controlled viewer pose
    // isn't conflicted by keyboard/mouse free-roam controllers. Save previous state
    // so we can restore it when XR ends.
    try {
      window._AR_FREE_ROAM_PREV = window._AR_FREE_ROAM_PREV || {};
      if (window._AR_FREE_ROAM && typeof window._AR_FREE_ROAM === 'object') {
        window._AR_FREE_ROAM_PREV.enabled = !!window._AR_FREE_ROAM.enabled;
        window._AR_FREE_ROAM_PREV.update = window._AR_FREE_ROAM.update;
      } else {
        window._AR_FREE_ROAM_PREV.enabled = false; window._AR_FREE_ROAM_PREV.update = null;
      }
      // ensure free-roam is turned off and its update is a no-op while XR is active
      try { if (window.disableFreeRoam) window.disableFreeRoam(); } catch(e) {}
      window._AR_FREE_ROAM = window._AR_FREE_ROAM || {};
      window._AR_FREE_ROAM.enabled = false;
      window._AR_FREE_ROAM.update = function(){};
      const freeEl = document.getElementById('dbg-free-roam'); if (freeEl) freeEl.checked = false;
      updateDebug('Free roam disabled for XR session (overridden)');
    } catch(e) { console.warn('Failed to override free-roam on XR start', e); }
    xrSession.addEventListener('select', () => { placeAnchorRequested = true; updateDebug('XR select: place anchor requested'); });
    xrSession.requestAnimationFrame(onXRFrame);
    // If the app already has a selected/localized room (e.g. user chose a target before
    // starting AR), attempt to localize in XR so the POV is locked to that room's marker.
    try {
      // Prefer a selected target (targetRoomId) over userRoomId when centering POV
      const preferredId = (typeof window.targetRoomId !== 'undefined' && window.targetRoomId) ? window.targetRoomId : window.userRoomId;
      if (preferredId) {
        const room = (window.rooms || []).find(r => String(r.id) === String(preferredId));
        if (room) {
          // localizeInXR uses xrSession/xrRefSpace internally; call it to compute xrLocalization
          if (typeof localizeInXR === 'function') {
            localizeInXR(room).then(xrLoc => {
              try {
                if (xrLoc) {
                  // update markers with the newly computed xrLocalization
                  if (window._AR_MARKERS && window._AR_MARKERS.updateRoomMarkers) window._AR_MARKERS.updateRoomMarkers(window.rooms, window.userPos, xrSession, xrRefSpace, window.xrLocalization);
                  updateDebug('XR localized to selected room: ' + room.name);
                }
              } catch(e) { console.warn('post-localizeInXR update failed', e); }
            }).catch(err => { console.warn('localizeInXR failed at XR start', err); });
          }
        }
      }
    } catch(e) { console.warn('Auto-localize on XR start failed', e); }
  const placeBtn = document.getElementById('place-anchor-btn'); if (placeBtn) placeBtn.style.display = 'inline-block';
  const calBtn = document.getElementById('calibrate-here-btn'); if (calBtn) calBtn.style.display = 'inline-block';
  // expose active session
  window._AR_WEBXR.xrSession = xrSession;
    xrSession.addEventListener('end', () => {
    xrSession = null; xrHitTestSource = null; window._AR_WEBXR.xrSession = null; try { window._AR_WEBXR.xrRefSpace = null; } catch(e) {}
    // Restore free-roam state that was present prior to entering XR
    try {
      if (window._AR_FREE_ROAM_PREV) {
        window._AR_FREE_ROAM = window._AR_FREE_ROAM || {};
        window._AR_FREE_ROAM.enabled = !!window._AR_FREE_ROAM_PREV.enabled;
        if (typeof window._AR_FREE_ROAM_PREV.update === 'function') window._AR_FREE_ROAM.update = window._AR_FREE_ROAM_PREV.update;
        delete window._AR_FREE_ROAM_PREV;
      }
    } catch(e) { console.warn('Failed to restore free-roam state after XR end', e); }
    updateDebug('XR session ended');
    // restore markers bind state after leaving XR (only for admin context, not user modal)
    try {
      const isUserARModal = document.getElementById('user-ar-video-box') && !document.getElementById('ar-video-box');
      if (!isUserARModal) {
        if (typeof window._AR_MARKERS_BIND_TO_MODEL_PREV !== 'undefined') {
          window._AR_MARKERS_BIND_TO_MODEL = !!window._AR_MARKERS_BIND_TO_MODEL_PREV;
          delete window._AR_MARKERS_BIND_TO_MODEL_PREV;
        } else {
          window._AR_MARKERS_BIND_TO_MODEL = true;
        }
        if (window._AR_MARKERS && window._AR_MARKERS.highlightOtherRooms) window._AR_MARKERS.highlightOtherRooms(window.rooms, window.userRoomId);
      } else {
        console.log('[AR_WEBXR] Detected user AR modal - skipping marker restoration after XR exit');
      }
    } catch(e) { console.warn('Failed to restore marker bind state after XR', e); }
    const p = document.getElementById('place-anchor-btn'); if (p) p.style.display = 'none';
    const c = document.getElementById('calibrate-here-btn'); if (c) c.style.display = 'none';
  });
  } catch (err) {
    console.error('startARSession error', err);
    if (err && err.name === 'NotSupportedError') { updateDebug('XR session not supported on this device/browser'); alert('WebXR immersive-ar is not supported on this device or browser. Use an AR-capable Android device with ARCore and a compatible browser.'); }
    else updateDebug('XR session error: ' + err);
  }
}

function onXRFrame(time, xrFrame) {
  const session = xrFrame.session;
  isInXRFrame = true;
  session.requestAnimationFrame(onXRFrame);
  try {
  const pose = xrFrame.getViewerPose(xrRefSpace);
  if (pose) {
    const view = pose.views[0]; const viewport = session.renderState.baseLayer.getViewport(view);
  const arRenderer = getARRenderer(); 
  // Only set size if renderer supports it and not during XR
  if (arRenderer && false) { // Disabled: can't setSize during XR
    arRenderer.setSize(viewport.width, viewport.height);
  }
    const m = new THREE.Matrix4().fromArray(view.transform.inverse.matrix);
    // getInverse removed in newer Three.js, use invert()
    const camMat = new THREE.Matrix4().copy(m).invert();
  const arCamera = getARCamera(); if (arCamera) { arCamera.matrix.fromArray(camMat.elements); arCamera.matrix.decompose(arCamera.position, arCamera.quaternion, arCamera.scale); arCamera.updateMatrixWorld(true); }
  }
  // hit test
  if (xrHitTestSource) {
    const hits = xrFrame.getHitTestResults(xrHitTestSource);
    if (hits.length > 0) {
      const hit = hits[0]; const hitPose = hit.getPose(xrRefSpace);
      if (hitPose) {
        lastFrameHit = { hit, pose: hitPose };
        // show reticle at hit
        ensureReticle();
        if (xrReticle) {
          xrReticle.visible = true;
          xrReticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
          xrReticle.quaternion.set(hitPose.transform.orientation.x, hitPose.transform.orientation.y, hitPose.transform.orientation.z, hitPose.transform.orientation.w);
        }
        if (placeAnchorRequested) {
          placeAnchorRequested = false;
          if (hit.createAnchor) {
            (async () => {
              try {
                const xrAnchor = await hit.createAnchor();
                const s = getARScene(); if (typeof THREE === 'undefined') { setTimeout(() => { try { const s2 = getARScene(); if (s2) s2.add(new (window.THREE || THREE).Mesh(new (window.THREE || THREE).BoxGeometry(0.2,0.2,0.2), new (window.THREE || THREE).MeshNormalMaterial())); } catch(e){} }, 200); } else { const cube = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshNormalMaterial()); if (s) s.add(cube); }
                anchors.push({ anchor: xrAnchor, anchorSpace: xrAnchor.anchorSpace || xrAnchor, object: cube });
                updateDebug('Anchor created (persistent)');
                updateAnchorCount();
              } catch (e) {
                console.error('createAnchor failed', e);
                const s2 = getARScene(); if (typeof THREE === 'undefined') { setTimeout(() => { try { const s3 = getARScene(); if (s3) { const cube2 = new (window.THREE || THREE).Mesh(new (window.THREE || THREE).BoxGeometry(0.2,0.2,0.2), new (window.THREE || THREE).MeshNormalMaterial()); cube2.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z); s3.add(cube2); anchors.push({ anchor: null, anchorSpace: null, object: cube2, staticPose: hitPose }); updateDebug('Anchor created (fallback, delayed)'); updateAnchorCount(); } } catch(e){} }, 200); } else { const cube = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshNormalMaterial()); cube.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z); if (s2) s2.add(cube); anchors.push({ anchor: null, anchorSpace: null, object: cube, staticPose: hitPose }); updateDebug('Anchor created (fallback)'); updateAnchorCount(); }
              }
            })();
          } else {
            const s3 = getARScene(); if (typeof THREE === 'undefined') { setTimeout(() => { try { const s4 = getARScene(); if (s4) { const cube3 = new (window.THREE || THREE).Mesh(new (window.THREE || THREE).BoxGeometry(0.2,0.2,0.2), new (window.THREE || THREE).MeshNormalMaterial()); cube3.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z); s4.add(cube3); anchors.push({ anchor: null, anchorSpace: null, object: cube3, staticPose: hitPose }); updateDebug('Anchor created (fallback, delayed)'); updateAnchorCount(); } } catch(e){} }, 200); } else { const cube = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshNormalMaterial()); cube.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z); if (s3) s3.add(cube); anchors.push({ anchor: null, anchorSpace: null, object: cube, staticPose: hitPose }); updateDebug('Anchor created (fallback)'); updateAnchorCount(); }
          }
        }
        // If calibration requested, create an anchor and save it as xrLocalization
        if (calibrateRequested) {
          calibrateRequested = false;
          (async () => {
            try {
              if (hit.createAnchor) {
                const xrAnchor = await hit.createAnchor();
                // store localization anchor holder
                window.xrLocalization = { anchor: xrAnchor, anchorMatrix: null, type: 'anchor' };
                updateDebug('Calibration anchor created (XR anchor)');
                anchors.push({ anchor: xrAnchor, anchorSpace: xrAnchor.anchorSpace || xrAnchor, object: null });
                updateAnchorCount();
              } else {
                // fallback: static pose
                const mat = new THREE.Matrix4().fromArray(hitPose.transform.matrix);
                window.xrLocalization = { anchor: null, anchorMatrix: mat, anchorMatrixInverse: new THREE.Matrix4().copy(mat).invert(), type: 'staticPose' };
                updateDebug('Calibration saved (static pose fallback)');
              }
            } catch (e) {
              console.error('Calibration anchor creation failed', e);
              const mat = new THREE.Matrix4().fromArray(hitPose.transform.matrix);
              window.xrLocalization = { anchor: null, anchorMatrix: mat, anchorMatrixInverse: new THREE.Matrix4().copy(mat).invert(), type: 'staticPose' };
              updateDebug('Calibration saved (fallback after error)');
            }
          })();
        }
      }
    }
    else {
      // no hits this frame -> hide reticle
      if (xrReticle) xrReticle.visible = false;
    }
  }

  if (anchors.length > 0) {
    anchors.forEach(a => {
      if (a.anchor && a.anchor.anchorSpace) {
        const p = xrFrame.getPose(a.anchor.anchorSpace, xrRefSpace);
        if (p) {
          if (a.object) { a.object.position.set(p.transform.position.x, p.transform.position.y, p.transform.position.z); a.object.quaternion.set(p.transform.orientation.x, p.transform.orientation.y, p.transform.orientation.z, p.transform.orientation.w); }
          // if this anchor is the calibration anchor, update global anchorMatrix
          if (window.xrLocalization && window.xrLocalization.anchor === a.anchor) {
            const m = new THREE.Matrix4().fromArray(p.transform.matrix);
            window.xrLocalization.anchorMatrix = m;
            window.xrLocalization.anchorMatrixInverse = new THREE.Matrix4().copy(m).invert();
          }
        }
      } else if (a.staticPose) { if (a.object) a.object.position.set(a.staticPose.transform.position.x, a.staticPose.transform.position.y, a.staticPose.transform.position.z); }
    });
    // Also handle case where calibration anchor is stored as window.xrLocalization.anchor (not present in anchors array)
    if (window.xrLocalization && window.xrLocalization.anchor && !(anchors.find(x=>x.anchor===window.xrLocalization.anchor))) {
      const p = xrFrame.getPose(window.xrLocalization.anchor.anchorSpace, xrRefSpace);
      if (p) { const m = new THREE.Matrix4().fromArray(p.transform.matrix); window.xrLocalization.anchorMatrix = m; window.xrLocalization.anchorMatrixInverse = new THREE.Matrix4().copy(m).invert(); }
    }
  }

  // XR HUD: ensure it exists and position
  if (xrSession) {
    if (typeof ensureXRHUD === 'function') ensureXRHUD();
    if (window.xrHUD) {
      const arCamera = getARCamera(); const dir = new THREE.Vector3(); if (arCamera) { arCamera.getWorldDirection(dir); const worldPos = new THREE.Vector3().copy(arCamera.position).add(dir.multiplyScalar(1.2)); window.xrHUD.position.copy(worldPos); window.xrHUD.quaternion.copy(arCamera.quaternion); }
    }
  }
  // Only render if inside XR frame
  const arRenderer2 = getARRenderer(), arScene2 = getARScene(), arCamera2 = getARCamera();
  if (arRenderer2 && arScene2 && arCamera2) {
    arRenderer2.render(arScene2, arCamera2);
  }
  
  // Update HUD compass each frame (screen-space overlay)
  try {
    if (window._AR_HUD && typeof window._AR_HUD.updateCompassHUD === 'function') {
      window._AR_HUD.updateCompassHUD();
    }
  } catch(e) { console.warn('[AR_WEBXR] HUD update error:', e); }
  
  } catch(e) {
    console.error('[AR_WEBXR] Error in onXRFrame:', e);
  } finally {
    isInXRFrame = false;
  }
}

// expose for other modules
// localizeInXR: capture viewer pose and compute offset mapping a given room to world
async function localizeInXR(room) {
  if (!xrSession || !xrRefSpace) { updateDebug('No XR session for localize'); return null; }
  return new Promise((resolve) => {
    xrSession.requestAnimationFrame((time, xrFrame) => {
      const pose = xrFrame.getViewerPose(xrRefSpace);
      if (pose && pose.views && pose.views.length > 0) {
        const p = pose.views[0].transform.position;
        const viewerPos = new THREE.Vector3(p.x, p.y, p.z);
        const roomScenePos = new THREE.Vector3(room.x, 0, -room.y);
        const offset = new THREE.Vector3().subVectors(viewerPos, roomScenePos);
        window.xrLocalization = { roomId: room.id, viewerPos, offset };
        updateDebug('XR localized: offset=' + offset.toArray().map(n=>n.toFixed(2)).join(','));
        resolve(window.xrLocalization);
      } else {
        updateDebug('Could not get XR viewer pose at localize time'); resolve(null);
      }
    });
  });
}

// Helper: perform calibration using the last hit stored during onXRFrame (if any)
async function calibrateUsingLastFrameHit() {
  if (!lastFrameHit) { updateDebug('No recent hit test result available for calibration'); return null; }
  // reuse the same code path used when calibrateRequested was true
  try {
    const hit = lastFrameHit.hit; const pose = lastFrameHit.pose;
    if (hit && hit.createAnchor) {
      const xrAnchor = await hit.createAnchor();
      window.xrLocalization = { anchor: xrAnchor, anchorMatrix: null, type: 'anchor' };
      anchors.push({ anchor: xrAnchor, anchorSpace: xrAnchor.anchorSpace || xrAnchor, object: null });
      updateAnchorCount();
      updateDebug('Calibration (manual) anchor created');
      return window.xrLocalization;
    }
    if (pose) {
      const mat = new THREE.Matrix4().fromArray(pose.transform.matrix);
      window.xrLocalization = { anchor: null, anchorMatrix: mat, anchorMatrixInverse: new THREE.Matrix4().copy(mat).invert(), type: 'staticPose' };
      updateDebug('Calibration (manual) stored static pose');
      return window.xrLocalization;
    }
  } catch (e) { console.error('calibrateUsingLastFrameHit error', e); }
  return null;
}

window._AR_WEBXR = { startARSession, anchors, checkXRSupport, localizeInXR, xrSession, clearAnchors, calibrateUsingLastFrameHit };
