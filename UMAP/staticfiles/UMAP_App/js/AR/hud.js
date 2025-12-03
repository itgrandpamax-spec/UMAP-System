console.log('[AR_HUD] hud.js module loading...');

/**
 * AR HUD System - Screen-space overlay for navigation arrow
 * Renders a directional arrow pointing from camera to Point B (destination)
 * Positioned INSIDE the AR video box modal
 */

let compassTarget = null;
let compassCanvas = null;
let compassContext = null;
let videoBox = null;

function initializeCompassHUD() {
  console.log('[AR_HUD] Initializing HUD arrow (inside modal)');
  
  // Find the AR video box container (user-specific)
  videoBox = document.getElementById('user-ar-video-box');
  if (!videoBox) {
    console.warn('[AR_HUD] user-ar-video-box not found, retrying in 200ms');
    setTimeout(initializeCompassHUD, 200);
    return;
  }
  
  // Create canvas overlay if it doesn't exist
  if (!compassCanvas) {
    compassCanvas = document.createElement('canvas');
    compassCanvas.id = 'ar-hud-arrow';
    compassCanvas.style.position = 'absolute';
    compassCanvas.style.bottom = '20px';
    compassCanvas.style.left = '50%';
    compassCanvas.style.transform = 'translateX(-50%)';
    compassCanvas.style.width = '80px';
    compassCanvas.style.height = '80px';
    compassCanvas.style.zIndex = '10000';
    compassCanvas.style.pointerEvents = 'none';
    compassCanvas.style.border = 'none';
    
    videoBox.style.position = 'relative';
    videoBox.appendChild(compassCanvas);
    compassContext = compassCanvas.getContext('2d');
    
    // Set actual resolution (retina support)
    compassCanvas.width = 80 * window.devicePixelRatio;
    compassCanvas.height = 80 * window.devicePixelRatio;
    compassContext.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    console.log('[AR_HUD] HUD arrow canvas created inside modal');
  }
}

/**
 * Set the target position for the arrow
 * This should be the world position of Point B (destination marker)
 */
function setCompassTarget(targetPosition) {
  if (typeof THREE === 'undefined') {
    console.warn('[AR_HUD] THREE.js not available yet');
    return;
  }
  
  if (targetPosition instanceof THREE.Vector3) {
    compassTarget = targetPosition;
  } else if (targetPosition && typeof targetPosition === 'object') {
    compassTarget = new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z);
  }
  
  console.log('[AR_HUD] Arrow target set to:', compassTarget);
  initializeCompassHUD();
}

/**
 * Update HUD arrow - called each frame
 * Calculates angle from camera to target and draws directional arrow
 */
function updateCompassHUD() {
  if (!compassCanvas || !compassContext || !compassTarget) {
    return;
  }
  
  const renderer = (window._AR_RENDERER && window._AR_RENDERER.renderer) || null;
  const camera = (window._AR_RENDERER && window._AR_RENDERER.camera) || null;
  
  if (!renderer || !camera) {
    return;
  }
  
  // Get camera world position and forward direction
  const cameraPos = new THREE.Vector3();
  camera.getWorldPosition(cameraPos);
  
  const cameraForward = new THREE.Vector3(0, 0, -1);
  cameraForward.applyQuaternion(camera.quaternion);
  
  // Vector from camera to target
  const toTarget = new THREE.Vector3().subVectors(compassTarget, cameraPos);
  toTarget.normalize();
  
  // Calculate angle in screen space (horizontal plane)
  const horizontalForward = new THREE.Vector3(cameraForward.x, 0, cameraForward.z).normalize();
  const horizontalTarget = new THREE.Vector3(toTarget.x, 0, toTarget.z).normalize();
  
  // Use atan2 to get angle from forward direction
  const angleToTarget = Math.atan2(
    horizontalForward.x * horizontalTarget.z - horizontalForward.z * horizontalTarget.x,
    horizontalForward.x * horizontalTarget.x + horizontalForward.z * horizontalTarget.z
  );
  
  // Calculate distance to target (for label)
  const distance = cameraPos.distanceTo(compassTarget);
  
  // Draw arrow HUD
  drawArrowHUD(angleToTarget, distance);
}

function drawArrowHUD(angle, distance) {
  const width = 80;
  const height = 80;
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Clear canvas
  compassContext.clearRect(0, 0, width, height);
  
  // Draw semi-transparent circular background
  compassContext.fillStyle = 'rgba(0, 0, 0, 0.5)';
  compassContext.beginPath();
  compassContext.arc(centerX, centerY, 30, 0, Math.PI * 2);
  compassContext.fill();
  
  // Draw border circle
  compassContext.strokeStyle = 'rgba(0, 255, 0, 0.8)';
  compassContext.lineWidth = 2;
  compassContext.beginPath();
  compassContext.arc(centerX, centerY, 30, 0, Math.PI * 2);
  compassContext.stroke();
  
  // Draw large directional arrow pointing to target
  const arrowLength = 22;
  const arrowX = centerX + Math.sin(angle) * arrowLength;
  const arrowY = centerY - Math.cos(angle) * arrowLength;
  
  // Arrow shaft (bright green line)
  compassContext.strokeStyle = 'rgb(0, 255, 0)';
  compassContext.lineWidth = 4;
  compassContext.beginPath();
  compassContext.moveTo(centerX, centerY);
  compassContext.lineTo(arrowX, arrowY);
  compassContext.stroke();
  
  // Arrow head (large triangle)
  const headSize = 10;
  compassContext.fillStyle = 'rgb(0, 255, 0)';
  compassContext.beginPath();
  compassContext.moveTo(arrowX, arrowY);
  compassContext.lineTo(
    arrowX - headSize * Math.sin(angle - Math.PI / 6),
    arrowY + headSize * Math.cos(angle - Math.PI / 6)
  );
  compassContext.lineTo(
    arrowX - headSize * Math.sin(angle + Math.PI / 6),
    arrowY + headSize * Math.cos(angle + Math.PI / 6)
  );
  compassContext.closePath();
  compassContext.fill();
  
  // Draw distance text below arrow
  const distanceText = distance.toFixed(1) + 'm';
  compassContext.fillStyle = 'rgba(0, 255, 0, 0.9)';
  compassContext.font = 'bold 11px sans-serif';
  compassContext.textAlign = 'center';
  compassContext.textBaseline = 'top';
  compassContext.fillText(distanceText, centerX, centerY + 32);
}

/**
 * Hide the HUD arrow
 */
function hideCompassHUD() {
  if (compassCanvas) {
    compassCanvas.style.display = 'none';
  }
}

/**
 * Show the HUD arrow
 */
function showCompassHUD() {
  initializeCompassHUD();
  if (compassCanvas) {
    compassCanvas.style.display = 'block';
  }
}

/**
 * Clear the arrow target and hide HUD
 */
function clearCompass() {
  compassTarget = null;
  hideCompassHUD();
}

// Export HUD module interface
window._AR_HUD = {
  initializeCompassHUD,
  setCompassTarget,
  updateCompassHUD,
  showCompassHUD,
  hideCompassHUD,
  clearCompass
};

console.log('[AR_HUD] HUD module loaded successfully (arrow mode, inside modal)');
