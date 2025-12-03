/**
 * AR System Bootstrap - Single entry point for all AR modules
 * This ensures proper initialization order and scope management
 */

console.log('[AR_BOOTSTRAP] Starting AR system initialization...');
console.log('[AR_BOOTSTRAP] document.readyState:', document.readyState);
console.log('[AR_BOOTSTRAP] Current URL:', window.location.href);

// Import all AR modules in dependency order
try {
  console.log('[AR_BOOTSTRAP] Importing debug.js...');
  import('./debug.js').then(() => console.log('[AR_BOOTSTRAP] ✓ debug.js imported')).catch(e => console.error('[AR_BOOTSTRAP] ✗ Failed to import debug.js:', e));
  
  console.log('[AR_BOOTSTRAP] Importing sensors.js...');
  import('./sensors.js').then(() => console.log('[AR_BOOTSTRAP] ✓ sensors.js imported')).catch(e => console.error('[AR_BOOTSTRAP] ✗ Failed to import sensors.js:', e));
  
  console.log('[AR_BOOTSTRAP] Importing renderer.js...');
  import('./renderer.js').then(() => console.log('[AR_BOOTSTRAP] ✓ renderer.js imported')).catch(e => console.error('[AR_BOOTSTRAP] ✗ Failed to import renderer.js:', e));
  
  console.log('[AR_BOOTSTRAP] Importing markers.js...');
  import('./markers.js').then(() => console.log('[AR_BOOTSTRAP] ✓ markers.js imported')).catch(e => console.error('[AR_BOOTSTRAP] ✗ Failed to import markers.js:', e));
  
  console.log('[AR_BOOTSTRAP] Importing User_render.js...');
  import('./User_render.js').then(() => console.log('[AR_BOOTSTRAP] ✓ User_render.js imported')).catch(e => console.error('[AR_BOOTSTRAP] ✗ Failed to import User_render.js:', e));
  
  console.log('[AR_BOOTSTRAP] Importing hud.js...');
  import('./hud.js').then(() => console.log('[AR_BOOTSTRAP] ✓ hud.js imported')).catch(e => console.error('[AR_BOOTSTRAP] ✗ Failed to import hud.js:', e));
  
  console.log('[AR_BOOTSTRAP] Importing webxr.js...');
  import('./webxr.js').then(() => console.log('[AR_BOOTSTRAP] ✓ webxr.js imported')).catch(e => console.error('[AR_BOOTSTRAP] ✗ Failed to import webxr.js:', e));
  
  console.log('[AR_BOOTSTRAP] Importing ui.js...');
  import('./ui.js').then(() => console.log('[AR_BOOTSTRAP] ✓ ui.js imported')).catch(e => console.error('[AR_BOOTSTRAP] ✗ Failed to import ui.js:', e));
  
  console.log('[AR_BOOTSTRAP] Importing ar_navigation.js...');
  import('./ar_navigation.js').then(() => console.log('[AR_BOOTSTRAP] ✓ ar_navigation.js imported')).catch(e => console.error('[AR_BOOTSTRAP] ✗ Failed to import ar_navigation.js:', e));
  
  console.log('[AR_BOOTSTRAP] All AR module imports initiated');
} catch (e) {
  console.error('[AR_BOOTSTRAP] ✗ Error initiating module imports:', e);
}

// Verify that critical modules are available
setTimeout(() => {
  console.log('[AR_BOOTSTRAP] ═══ VERIFICATION CHECK (500ms delay) ═══');
  console.log('[AR_BOOTSTRAP] window._AR_RENDERER:', typeof window._AR_RENDERER, window._AR_RENDERER ? '✓' : '✗');
  console.log('[AR_BOOTSTRAP] window._AR_RENDERER.renderer:', window._AR_RENDERER ? typeof window._AR_RENDERER.renderer : 'N/A', window._AR_RENDERER?.renderer ? '✓' : '✗');
  console.log('[AR_BOOTSTRAP] window._AR_RENDERER.scene:', window._AR_RENDERER ? typeof window._AR_RENDERER.scene : 'N/A', window._AR_RENDERER?.scene ? '✓' : '✗');
  console.log('[AR_BOOTSTRAP] window._AR_WEBXR:', typeof window._AR_WEBXR, window._AR_WEBXR ? '✓' : '✗');
  console.log('[AR_BOOTSTRAP] window.startARFlow:', typeof window.startARFlow, typeof window.startARFlow === 'function' ? '✓' : '✗');
  console.log('[AR_BOOTSTRAP] window._AR_MARKERS:', typeof window._AR_MARKERS, window._AR_MARKERS ? '✓' : '✗');
  console.log('[AR_BOOTSTRAP] window._USER_RENDER:', typeof window._USER_RENDER, window._USER_RENDER ? '✓' : '✗');
  console.log('[AR_BOOTSTRAP] window._AR_HUD:', typeof window._AR_HUD, window._AR_HUD ? '✓' : '✗');
  console.log('[AR_BOOTSTRAP] window._AR_UI:', typeof window._AR_UI, window._AR_UI ? '✓' : '✗');
  console.log('[AR_BOOTSTRAP] window._AR_SENSORS:', typeof window._AR_SENSORS, window._AR_SENSORS ? '✓' : '✗');
  console.log('[AR_BOOTSTRAP] window._AR_DEBUG:', typeof window._AR_DEBUG, window._AR_DEBUG ? '✓' : '✗');
  console.log('[AR_BOOTSTRAP] ═══ END VERIFICATION ═══');
}, 500);
