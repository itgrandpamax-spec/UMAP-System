// Sensor helpers (moved from ar_navigation.js)
let currentHeading = 0;
let gravity = { x:0, y:-1, z:0 };

if (!window.updateDebug) window.updateDebug = function(text) { try { console.log('DBG:', text); } catch(e){} };

function handleDeviceOrientationEvent(event) {
  let alpha = null;
  if (event.webkitCompassHeading !== undefined) alpha = event.webkitCompassHeading;
  else if (event.alpha !== null && event.alpha !== undefined) alpha = event.alpha;
  if (alpha !== null) {
    currentHeading = alpha * (Math.PI / 180);
    if (window.arrowHelper) window.arrowHelper.setDirection(new THREE.Vector3(Math.sin(currentHeading),0,-Math.cos(currentHeading)));
    if (window.detectPointedRoom) window.detectPointedRoom();
  }
}

if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', handleDeviceOrientationEvent);
else if ('ondeviceorientation' in window) window.addEventListener('deviceorientation', handleDeviceOrientationEvent);

// Helper to request orientation permission on iOS / Safari where required
function requestOrientationPermissionIfNeeded() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(state => {
      if (state === 'granted') {
        updateDebug('Orientation permission granted');
      } else {
        updateDebug('Orientation permission denied');
      }
    }).catch(err => updateDebug('Orientation permission error: ' + err));
  } else {
    updateDebug('Orientation permission not required on this platform');
  }
}

function trySimpleGroundCalibration() {
  if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission().then(permissionState => { if (permissionState === 'granted') { window.addEventListener('devicemotion', onDeviceMotionForCalib, { once: true }); updateDebug('Collecting motion sample...'); } else updateDebug('Motion permission denied'); }).catch(err => updateDebug('Motion request error: ' + err));
  } else if (window.DeviceMotionEvent) {
    calibSamples = []; window.addEventListener('devicemotion', onDeviceMotionForCalibMulti); setTimeout(() => { window.removeEventListener('devicemotion', onDeviceMotionForCalibMulti); finalizeCalibSamples(); }, 2000); updateDebug('Collecting motion samples...');
  } else updateDebug('No DeviceMotion available');
}

// Determine if device is currently pointed at the ground by comparing gravity vector
function isPointingAtGround(thresholdDeg = 25) {
  // gravity is device-space vector pointing toward gravity (approx)
  // assume device z axis points out of the screen; compute angle between device 'down' and camera forward
  // We only have gravity in device coordinates; approximate by checking the pitch: gravity's Z component large negative means screen facing ground
  const g = gravity;
  // angle from vertical = acos(|g.y| / |g|)
  const mag = Math.sqrt(g.x*g.x + g.y*g.y + g.z*g.z);
  if (mag === 0) return false;
  const downDot = Math.abs(g.y) / mag; // rough proxy
  const angle = Math.acos(Math.min(1, Math.max(-1, downDot))) * (180 / Math.PI);
  return angle < thresholdDeg;
}

window._AR_SENSORS = Object.assign(window._AR_SENSORS || {}, { isPointingAtGround });

function onDeviceMotionForCalib(ev) { const a = ev.accelerationIncludingGravity; if (a) { gravity = { x:-a.x, y:-a.y, z:-a.z }; updateDebug(`Calibrated gravity: ${gravity.x.toFixed(2)}, ${gravity.y.toFixed(2)}, ${gravity.z.toFixed(2)}`); } else updateDebug('No accel data'); }
let calibSamples = [];
function onDeviceMotionForCalibMulti(ev) { const a = ev.accelerationIncludingGravity; if (a) calibSamples.push({ x:-a.x, y:-a.y, z:-a.z }); }
function finalizeCalibSamples() { if (calibSamples.length === 0) { updateDebug('No motion samples collected'); return; } const sum = calibSamples.reduce((acc,s)=>({ x:acc.x+s.x, y:acc.y+s.y, z:acc.z+s.z }), { x:0,y:0,z:0 }); gravity = { x: sum.x / calibSamples.length, y: sum.y / calibSamples.length, z: sum.z / calibSamples.length }; updateDebug(`Calibrated gravity (avg): ${gravity.x.toFixed(2)}, ${gravity.y.toFixed(2)}, ${gravity.z.toFixed(2)}`); }

window._AR_SENSORS = { currentHeadingGetter: () => currentHeading, trySimpleGroundCalibration, requestOrientationPermissionIfNeeded };
