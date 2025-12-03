console.log('[AR_MARKERS] markers.js module loading...');

// Marker creation and updates (moved from ar_navigation.js)
function getScene() { return (window._AR_RENDERER && window._AR_RENDERER.scene) || null; }
let roomMarkers = [];
// Allow swapping room X/Y axes when model coordinate system differs (sideways markers)
if (typeof window._AR_SWAP_XY === 'undefined') window._AR_SWAP_XY = false;
// By default markers are bound to the model transforms (so they move with modelRoot).
// Set window._AR_MARKERS_BIND_TO_MODEL = false to position markers independently.
if (typeof window._AR_MARKERS_BIND_TO_MODEL === 'undefined') window._AR_MARKERS_BIND_TO_MODEL = true;
// Default offset for markers (only used if window._AR_MARKERS_OFFSET not already set)
if (typeof window._AR_MARKERS_OFFSET === 'undefined' || window._AR_MARKERS_OFFSET === null) {
  window._AR_MARKERS_OFFSET = { x: -1.9, y: -0.2, z: -3.0 };
}

/**
 * Clear all room markers from the scene
 */
function clearAllMarkers() {
  const s = getScene();
  roomMarkers.forEach(marker => {
    try {
      if (s && marker.parent) s.remove(marker);
    } catch(e) { /* ignore */ }
  });
  roomMarkers = [];
  console.log('[AR_MARKERS] All markers cleared');
}
function highlightOtherRooms(rooms, userRoomId) {
  // Remove existing markers
  clearAllMarkers();
  // If THREE isn't ready yet, schedule a retry shortly
  if (typeof THREE === 'undefined' || !getScene()) {
    setTimeout(() => highlightOtherRooms(rooms, userRoomId), 200);
    return;
  }
  // visual sizing (in scene units/meters) - independent of coordinate world scale
  // world scale used for placing markers and sizing labels; keep it tied to window._AR_WORLD_SCALE
  const effectiveWorldScale = (window._AR_WORLD_SCALE && Number(window._AR_WORLD_SCALE)) ? Number(window._AR_WORLD_SCALE) : 1;
  // default marker size tuned to better match model in preview; can be changed via debug UI
  const markerSize = (typeof window._AR_MARKER_SIZE !== 'undefined') ? window._AR_MARKER_SIZE : 0.3;
  const labelHeight = (typeof window._AR_MARKER_LABEL_HEIGHT !== 'undefined') ? window._AR_MARKER_LABEL_HEIGHT : (markerSize * 1.6);
  rooms.forEach((room, idx) => {
    const isUserRoom = (room.id === userRoomId);
  // scale geometry in scene units by the effective world scale so markers look consistent
  const effectiveWorldScale = (window._AR_WORLD_SCALE && Number(window._AR_WORLD_SCALE)) ? Number(window._AR_WORLD_SCALE) : 1;
  const geometry = new THREE.SphereGeometry(markerSize * effectiveWorldScale, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: isUserRoom ? 0x2196f3 : 0x00ff00 });
    const marker = new THREE.Mesh(geometry, material);
    marker.userData = { roomId: room.id, roomName: room.name, index: idx };
    const s = getScene(); if (s) s.add(marker);
    // create a compact canvas-based label and scale it in world units
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64; const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#fff'; ctx.font='24px sans-serif'; ctx.fillText(room.name,10,40);
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex });
    // allow depth testing so labels occlude/are occluded naturally
    spriteMat.depthTest = true; spriteMat.depthWrite = false;
    const sprite = new THREE.Sprite(spriteMat);
    // scale sprite based on markerSize so it remains reasonable regardless of world-scale
  // Scale sprite in world units; we multiply by effectiveWorldScale to keep labels visually consistent
  sprite.scale.set(markerSize * 3.0 * effectiveWorldScale, markerSize * 0.9 * effectiveWorldScale, 1);
    sprite.position.set(0, labelHeight, 0);
    marker.add(sprite);
    roomMarkers.push(marker);
  });
  console.log('[AR_MARKERS] created', roomMarkers.length, 'markers');
  // allow an optional global scale to map world coordinates into Three scene units
  // default scale set to 0.9 per user request (maps model units to scene units)
  if (typeof window._AR_WORLD_SCALE === 'undefined') window._AR_WORLD_SCALE = 0.9; // default scale
  updateRoomMarkers(rooms);
}

function updateRoomMarkers(rooms, userPos, xrSession, xrRefSpace, xrLocalization) {
  if (!rooms) return;
  roomMarkers.forEach(marker => {
    if (!marker || !marker.userData) return;
    const room = (rooms || []).find(r => String(r.id) === String(marker.userData.roomId));
    if (!room) return;
    const scale = (window._AR_WORLD_SCALE || 1);
    // flip options
    if (typeof window._AR_FLIP_X === 'undefined') window._AR_FLIP_X = false;
    if (typeof window._AR_FLIP_Y === 'undefined') window._AR_FLIP_Y = false;
    if (typeof window._AR_FLIP_Z === 'undefined') window._AR_FLIP_Z = false;
    
    if (xrSession && xrRefSpace) {
      // If we have a calibrated anchorMatrix, map model-local -> world via that matrix
      if (window.xrLocalization && window.xrLocalization.anchorMatrix) {
        // compute local coordinates with optional axis-swap
        // ✅ Now includes Z coordinate for vertical positioning
        let lx = (room.x || 0) * scale;
        let ly = (room.z || 0) * scale;  // ✅ Use Z for Y (vertical) position
        let lz = -(room.y || 0) * scale;
        if (window._AR_SWAP_XY) {
          // swap axes: room.x -> Z, room.y -> X (with same sign conventions)
          lx = (room.y || 0) * scale;
          lz = -(room.x || 0) * scale;
        }
        const local = new THREE.Vector3(lx, ly, lz);
        // apply flips if requested (before applying anchorMatrix)
        if (window._AR_FLIP_X) local.x = -local.x;
        if (window._AR_FLIP_Y) local.z = -local.z;
        if (window._AR_FLIP_Z) local.y = -local.y;
        const worldPos = local.applyMatrix4(window.xrLocalization.anchorMatrix);
        marker.position.copy(worldPos);
        // Optional: set marker orientation to anchor rotation
        if (marker.userData && marker.userData.setOrientationFromAnchor) {
          const rot = new THREE.Quaternion(); window.xrLocalization.anchorMatrix.decompose(new THREE.Vector3(), rot, new THREE.Vector3()); marker.quaternion.copy(rot);
        }
      } else {
        // fallback to placing relative to the XR viewer/user pos
        // compute local coords with optional axis swap and flips
        // ✅ Now includes Z coordinate for vertical positioning
        let x = (room.x || 0) * scale;
        let y = (room.z || 0) * scale;  // ✅ Use Z for Y (vertical) position
        let z = -(room.y || 0) * scale;
        if (window._AR_SWAP_XY) {
          x = (room.y || 0) * scale;
          z = -(room.x || 0) * scale;
        }
        if (window._AR_FLIP_X) x = -x;
        if (window._AR_FLIP_Y) z = -z;
        if (window._AR_FLIP_Z) y = -y;
        const basePos = new THREE.Vector3(x, y, z);
        if (xrLocalization && xrLocalization.offset) { const worldPos = new THREE.Vector3().addVectors(basePos, xrLocalization.offset); marker.position.copy(worldPos); }
        else marker.position.copy(basePos);
      }
    } else {
      // Non-XR: place markers in absolute model coordinates relative to modelRoot
      // This makes markers fixed to the model and teleporting only moves the user/camera
      // ✅ Now includes Z coordinate for vertical positioning
      let xabs = (room.x || 0) * scale;
      let yabs = (room.z || 0) * scale;  // ✅ Use Z for Y (vertical) position
      let zabs = -(room.y || 0) * scale;
      if (window._AR_SWAP_XY) {
        xabs = (room.y || 0) * scale;
        zabs = -(room.x || 0) * scale;
      }
      if (window._AR_FLIP_X) xabs = -xabs;
      if (window._AR_FLIP_Y) zabs = -zabs;
      if (window._AR_FLIP_Z) yabs = -yabs;
      // If markers are bound to the model, apply the modelRoot matrix so they follow model transforms.
      try {
        if (window._AR_MARKERS_BIND_TO_MODEL) {
          if (window._AR_RENDERER && window._AR_RENDERER.modelRoot) {
            const root = window._AR_RENDERER.modelRoot;
            const local = new THREE.Vector3(xabs, yabs, zabs);
            const worldPos = local.applyMatrix4(root.matrixWorld || root.matrix);
            marker.position.copy(worldPos);
          } else {
            marker.position.set(xabs, yabs, zabs);
          }
        } else {
          // Markers are independent from model transforms: position in scene coordinates
          marker.position.set(xabs, yabs, zabs);
        }
        // If a manual debug offset is present, apply it so devs can nudge markers at runtime
        if (window._AR_MARKERS_OFFSET && typeof window._AR_MARKERS_OFFSET === 'object') {
          const ox = Number(window._AR_MARKERS_OFFSET.x) || 0;
          const oy = Number(window._AR_MARKERS_OFFSET.y) || 0;
          const oz = Number(window._AR_MARKERS_OFFSET.z) || 0;
          marker.position.add(new THREE.Vector3(ox, oy, oz));
        }
      } catch(e) { /* ignore */ }
    }
  });
  // debug: print sample positions
  try { console.log('[AR_MARKERS] sample positions:', roomMarkers.slice(0,6).map(m => ({ id: m.userData.roomId, pos: m.position.toArray() }))); } catch(e) {}
  console.log('[AR_MARKERS] scale=', window._AR_WORLD_SCALE, 'flipX=', window._AR_FLIP_X, 'flipY=', window._AR_FLIP_Y, 'flipZ=', window._AR_FLIP_Z);
}

window._AR_MARKERS = { highlightOtherRooms, updateRoomMarkers, highlightTwoRooms, clearAllMarkers };


/**
 * Highlight only two rooms with markers and an arrow pointing from Point A to Point B
 * @param {Object} roomA - Current location (Point A) - {id, name, x, y, z, coordinates}
 * @param {Object} roomB - Destination (Point B) - {id, name, x, y, z, coordinates}
 */
function highlightTwoRooms(roomA, roomB) {
  console.log('[AR_MARKERS] highlightTwoRooms called with:', {
    roomA: { id: roomA.id, name: roomA.name, coords: roomA.coordinates },
    roomB: { id: roomB.id, name: roomB.name, coords: roomB.coordinates }
  });

  // Remove existing markers first - critical for preventing marker accumulation
  clearAllMarkers();

  // If THREE isn't ready yet, schedule a retry shortly
  if (typeof THREE === 'undefined' || !getScene()) {
    console.log('[AR_MARKERS] THREE.js not ready, retrying in 200ms');
    setTimeout(() => highlightTwoRooms(roomA, roomB), 200);
    return;
  }

  const scene = getScene();
  if (!scene) {
    console.error('[AR_MARKERS] Scene not available');
    return;
  }

  const effectiveWorldScale = (window._AR_WORLD_SCALE && Number(window._AR_WORLD_SCALE)) ? Number(window._AR_WORLD_SCALE) : 1;
  const markerSize = (typeof window._AR_MARKER_SIZE !== 'undefined') ? window._AR_MARKER_SIZE : 0.3;
  const labelHeight = (typeof window._AR_MARKER_LABEL_HEIGHT !== 'undefined') ? window._AR_MARKER_LABEL_HEIGHT : (markerSize * 1.6);

  // Helper function to create a marker for a room
  function createRoomMarker(room, color, isDestination = false) {
    const geometry = new THREE.SphereGeometry(markerSize * effectiveWorldScale, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const marker = new THREE.Mesh(geometry, material);
    marker.userData = { 
      roomId: room.id, 
      roomName: room.name, 
      isDestination: isDestination,
      coordinates: room.coordinates || { x: room.x, y: room.y, z: room.z }
    };
    scene.add(marker);

    // Create canvas-based label
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(room.name, 10, 30);
    ctx.font = '14px sans-serif';
    ctx.fillText(room.number, 10, 50);

    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex });
    spriteMat.depthTest = true;
    spriteMat.depthWrite = false;
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(markerSize * 3.0 * effectiveWorldScale, markerSize * 0.9 * effectiveWorldScale, 1);
    sprite.position.set(0, labelHeight, 0);
    marker.add(sprite);

    return marker;
  }

  // Helper function to position marker in 3D space
  function positionMarker(marker, room) {
    const scale = (window._AR_WORLD_SCALE || 1);
    
    // Get coordinates
    let coords = room.coordinates || { x: room.x, y: room.y, z: room.z };
    
    let x = (coords.x || 0) * scale;
    let y = (coords.z || 0) * scale;  // Use Z for vertical (Y in 3D)
    let z = -(coords.y || 0) * scale;

    if (window._AR_SWAP_XY) {
      x = (coords.y || 0) * scale;
      z = -(coords.x || 0) * scale;
    }

    if (window._AR_FLIP_X) x = -x;
    if (window._AR_FLIP_Y) z = -z;
    if (window._AR_FLIP_Z) y = -y;

    // Apply offset if exists
    if (window._AR_MARKERS_OFFSET && typeof window._AR_MARKERS_OFFSET === 'object') {
      const ox = Number(window._AR_MARKERS_OFFSET.x) || 0;
      const oy = Number(window._AR_MARKERS_OFFSET.y) || 0;
      const oz = Number(window._AR_MARKERS_OFFSET.z) || 0;
      marker.position.set(x + ox, y + oy, z + oz);
    } else {
      marker.position.set(x, y, z);
    }
  }

  // Create Point A marker (blue - current location)
  const markerA = createRoomMarker(roomA, 0x2196f3, false);
  roomMarkers.push(markerA);
  positionMarker(markerA, roomA);
  console.log('[AR_MARKERS] Created Point A marker for:', roomA.name, 'at', markerA.position);

  // Create Point B marker (green - destination)
  const markerB = createRoomMarker(roomB, 0x00ff00, true);
  roomMarkers.push(markerB);
  positionMarker(markerB, roomB);
  console.log('[AR_MARKERS] Created Point B marker for:', roomB.name, 'at', markerB.position);

  // SKIP 3D arrow in favor of HUD compass pointing to Point B
  // Initialize screen-space HUD compass that will be updated in animation loop
  try {
    if (window._AR_HUD && typeof window._AR_HUD.setCompassTarget === 'function') {
      window._AR_HUD.setCompassTarget(markerB.position);
      console.log('[AR_MARKERS] Initialized HUD compass pointing to Point B');
    }
  } catch (e) {
    console.error('[AR_MARKERS] Error initializing HUD compass:', e);
  }

  console.log('[AR_MARKERS] highlightTwoRooms complete: 2 markers + HUD compass initialized');
}

/**
 * Create an arrow from point A to point B
 * @param {THREE.Vector3} pointA - Start position
 * @param {THREE.Vector3} pointB - End position
 * @returns {THREE.Group} Group containing arrow (shaft + head)
 */
function createArrow(pointA, pointB) {
  if (typeof THREE === 'undefined') return null;

  const arrowGroup = new THREE.Group();
  const direction = new THREE.Vector3().subVectors(pointB, pointA);
  const length = direction.length();
  
  if (length < 0.01) {
    console.warn('[AR_MARKERS] Arrow length too small, skipping');
    return null;
  }

  const arrowSize = length * 0.1; // Arrow head is 10% of distance
  const shaftRadius = length * 0.02; // Shaft radius

  // Shaft (cylinder)
  const shaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, length * 0.85, 8);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const shaft = new THREE.Mesh(shaftGeom, arrowMat);
  
  // Position shaft at midpoint
  const shaftMid = new THREE.Vector3().addVectors(pointA, pointB).multiplyScalar(0.5);
  shaft.position.copy(shaftMid);
  
  // Rotate shaft to point from A to B
  const normalizedDir = direction.clone().normalize();
  const quaternion = new THREE.Quaternion();
  // Rotate from default up (0,1,0) to point direction
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalizedDir);
  shaft.quaternion.copy(quaternion);

  arrowGroup.add(shaft);

  // Arrow head (cone at point B)
  const headGeom = new THREE.ConeGeometry(arrowSize, arrowSize * 2, 8);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const head = new THREE.Mesh(headGeom, headMat);
  head.position.copy(pointB);
  head.quaternion.copy(quaternion);
  head.position.addScaledVector(normalizedDir, -arrowSize);

  arrowGroup.add(head);

  return arrowGroup;
}
