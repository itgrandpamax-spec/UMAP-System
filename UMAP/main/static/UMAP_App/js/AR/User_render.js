console.log('[USER_RENDER] User_render.js loading - Point-to-point rendering for AR modal');

/**
 * User_render.js - Dedicated rendering for AR modal's two-point navigation
 * Renders ONLY Point A (current) and Point B (destination)
 * Separate from admin/debug rendering to avoid conflicts
 * Uses user-specific container: user-ar-video-box
 */

let userRenderScene = null;
let userRenderCamera = null;
let userRenderRenderer = null;
let userVideoBox = null;
let pointAMarker = null;
let pointBMarker = null;

function initializeUserRender() {
  console.log('[USER_RENDER] Initializing user render system');
  
  // Get reference to user-specific video box
  userVideoBox = document.getElementById('user-ar-video-box');
  if (!userVideoBox) {
    console.warn('[USER_RENDER] user-ar-video-box not found');
    return false;
  }
  
  // Use existing AR renderer if available
  if (window._AR_RENDERER && window._AR_RENDERER.renderer) {
    userRenderRenderer = window._AR_RENDERER.renderer;
    userRenderScene = window._AR_RENDERER.scene;
    userRenderCamera = window._AR_RENDERER.camera;
    console.log('[USER_RENDER] Using existing AR renderer for user-ar-video-box');
    return true;
  }
  
  console.warn('[USER_RENDER] AR Renderer components not available');
  return false;
}

/**
 * Render two room markers for AR navigation
 * @param {Object} roomA - Point A (current location)
 * @param {Object} roomB - Point B (destination)
 */
function renderUserNavigationPoints(roomA, roomB) {
  console.log('[USER_RENDER] Rendering navigation points:', {
    pointA: roomA.name,
    pointB: roomB.name
  });
  
  if (!initializeUserRender()) {
    console.warn('[USER_RENDER] Renderer not ready, retrying in 200ms');
    setTimeout(() => renderUserNavigationPoints(roomA, roomB), 200);
    return;
  }
  
  // Clear existing markers
  if (pointAMarker && userRenderScene) {
    userRenderScene.remove(pointAMarker);
    pointAMarker = null;
  }
  if (pointBMarker && userRenderScene) {
    userRenderScene.remove(pointBMarker);
    pointBMarker = null;
  }
  
  if (!userRenderScene || typeof THREE === 'undefined') {
    console.warn('[USER_RENDER] Scene or THREE not available');
    return;
  }
  
  const scale = window._AR_WORLD_SCALE || 0.9;
  const markerSize = 0.3;
  
  console.log('[USER_RENDER] Creating markers with scale:', scale, 'roomA:', roomA, 'roomB:', roomB);
  
  // Helper to create marker
  function createMarker(room, color) {
    if (!room) {
      console.error('[USER_RENDER] Invalid room object passed to createMarker');
      return null;
    }
    
    const geometry = new THREE.SphereGeometry(markerSize, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color });
    const marker = new THREE.Mesh(geometry, material);
    
    // Position marker - ensure we have valid x, y, z
    let x = parseFloat(room.x) || 0;
    let y = parseFloat(room.z) || 0;  // Use Z for vertical
    let z = -parseFloat(room.y) || 0;
    
    console.log('[USER_RENDER] Room position raw:', { roomX: room.x, roomY: room.y, roomZ: room.z }, 'scaled:', { x: x * scale, y: y * scale, z: z * scale });
    
    if (window._AR_FLIP_X) x = -x;
    if (window._AR_FLIP_Z) y = -y;
    if (window._AR_FLIP_Y) z = -z;
    
    marker.position.set(x * scale, y * scale, z * scale);
    console.log('[USER_RENDER] Marker positioned at:', marker.position);
    
    // Add label
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(room.name || 'Unknown', 10, 30);
    ctx.font = '14px sans-serif';
    ctx.fillText(room.number || 'N/A', 10, 50);
    
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex });
    spriteMat.depthTest = true;
    spriteMat.depthWrite = false;
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.9, 0.27, 1);
    sprite.position.set(0, 0.48, 0);
    marker.add(sprite);
    
    return marker;
  }
  
  // Create Point A (blue - current location)
  pointAMarker = createMarker(roomA, 0x2196f3);
  userRenderScene.add(pointAMarker);
  console.log('[USER_RENDER] Point A created at', pointAMarker.position);
  
  // Create Point B (green - destination)
  pointBMarker = createMarker(roomB, 0x00ff00);
  userRenderScene.add(pointBMarker);
  console.log('[USER_RENDER] Point B created at', pointBMarker.position);
  
  // Position camera at Point A
  if (userRenderCamera) {
    const cameraOffset = 8;
    console.log('[USER_RENDER] Setting camera position. pointA position:', pointAMarker ? pointAMarker.position : 'MARKER NOT CREATED');
    userRenderCamera.position.set(
      pointAMarker.position.x,
      pointAMarker.position.y + 5,
      pointAMarker.position.z + cameraOffset
    );
    userRenderCamera.lookAt(pointAMarker.position);
    userRenderCamera.updateProjectionMatrix();
    userRenderCamera.updateMatrixWorld();
    console.log('[USER_RENDER] Camera positioned at:', userRenderCamera.position);
  } else {
    console.warn('[USER_RENDER] Camera not available for positioning');
  }
  
  console.log('[USER_RENDER] User navigation points rendered successfully');
  console.log('[USER_RENDER] Point A:', { name: roomA.name, pos: pointAMarker ? pointAMarker.position : 'FAILED' });
  console.log('[USER_RENDER] Point B:', { name: roomB.name, pos: pointBMarker ? pointBMarker.position : 'FAILED' });
}

/**
 * Get Point A position (for HUD arrow target)
 */
function getPointAPosition() {
  return pointAMarker ? pointAMarker.position : null;
}

/**
 * Get Point B position (for HUD arrow target)
 */
function getPointBPosition() {
  return pointBMarker ? pointBMarker.position : null;
}

/**
 * Clear user render points
 */
function clearUserRenderPoints() {
  if (pointAMarker && userRenderScene) {
    userRenderScene.remove(pointAMarker);
    pointAMarker = null;
  }
  if (pointBMarker && userRenderScene) {
    userRenderScene.remove(pointBMarker);
    pointBMarker = null;
  }
  console.log('[USER_RENDER] User render points cleared');
}

// Export module
window._USER_RENDER = {
  initializeUserRender,
  renderUserNavigationPoints,
  getPointAPosition,
  getPointBPosition,
  clearUserRenderPoints
};

console.log('[USER_RENDER] User_render.js loaded successfully');
