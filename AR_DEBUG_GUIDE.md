# Quick AR Debugging Guide

## Console Filters to Check

### All AR logs:
```javascript
// In browser console, filter for [AR
```

### Renderer initialization:
```
[AR_RENDERER] initThree() starting...
[AR_RENDERER] Canvas element found: true
[AR_RENDERER] Three.js module imported successfully
[AR_RENDERER] Three.js initialized successfully
```

### Room loading:
```
[AR] Starting to load rooms data from /api/ar/rooms/
[AR] API response received, status: 200, ok: true
[AR] Found 240 rooms in API response
[AR] Processed 240 rooms successfully
```

### 3D rendering start:
```
[AR] Attempting automatic 3D renderer initialization
[AR] Three.js renderer ready, loading GLB model
[AR] GLB model loaded successfully
[AR] 3D render loop started
```

### Marker rendering (after selecting both rooms):
```
[AR] Both rooms selected, rendering markers and arrow
[AR_MARKERS] highlightTwoRooms called with:
[AR_MARKERS] Created Point A marker for: [Room Name]
[AR_MARKERS] Created Point B marker for: [Room Name]
[AR_MARKERS] Created arrow from Point A to Point B
```

---

## Common Issues & Quick Fixes

### Issue: "Failed to parse JSON response"
**Solution:** 
- Refresh page (clears any stale responses)
- Check browser network tab - should see `/api/ar/rooms/` returning 200
- If getting HTML response, check if you're logged in

### Issue: Placeholder showing instead of 3D
**Solution:**
- Wait 2-3 seconds after page load (GLB file takes time to download)
- Check console for `[AR_RENDERER]` logs
- Check if `/static/UMAP_App/glb/Umak_3d.glb` file exists
- Verify in Network tab that GLB is being downloaded

### Issue: Rooms dropdown empty
**Solution:**
- Open modal, check console for `[AR] API response received`
- If you see 404, check if `/api/ar/rooms/` endpoint exists
- Check Django URL routing: `path('api/ar/rooms/', ...)`

### Issue: Markers not showing after room selection
**Solution:**
- Select two DIFFERENT rooms
- Check console for `[AR_MARKERS] highlightTwoRooms called`
- Verify Three.js renderer is ready before selecting rooms
- Check if both dropdowns have values

---

## Files Changed

```
UMAP/main/templates/UMAP_App/Users/
  └─ User_AR.html (AUTO-INIT, RENDER LOOP)

UMAP/main/static/UMAP_App/js/
  ├─ UI/main.js (API ERROR HANDLING)
  └─ AR/renderer.js (LOGGING)
```

---

## How to Test Each Component

### 1. Test API directly
```bash
curl http://localhost:8000/api/ar/rooms/ | python -m json.tool | head -50
```
Expected: 240 rooms in JSON format

### 2. Test Modal in Users_main.html
- Find a room with "Locate" button
- Click it
- Should see AR modal with room dropdowns populated

### 3. Test User_AR.html direct navigation
- Visit `/user_ar/` directly
- Should see 3D model preview in videobox
- Should NOT see "3D Model Preview" placeholder

### 4. Test Marker Rendering
- In User_AR.html, select Point A room
- Select different Point B room  
- Should see 2 markers (blue + green) with arrow

---

## Performance Indicators

✅ **Good Signs:**
- Console shows [AR] and [AR_RENDERER] logs
- 3D renders within 2-3 seconds of page load
- Smooth 60fps rotation when using mouse
- Markers appear immediately after room selection
- No console errors in red

❌ **Bad Signs:**
- No [AR] logs appear
- Placeholder stays showing for 10+ seconds
- Console shows red errors
- "Failed to parse JSON" message
- Dropdowns stay empty
- White/black canvas with no content

---

## Network Performance

**Typical Load Times:**
- Page load: < 1s
- Rooms API call: < 500ms (240 rooms = ~700KB)
- GLB model download: 1-3s (depending on internet, model size ~5MB)
- Total time to see 3D: 2-4 seconds

**If taking longer:**
- Check network tab for slow requests
- May need to optimize GLB file size
- Check internet speed / CDN latency

---

## Quick Console Commands

```javascript
// Check if renderer initialized
window._AR_RENDERER

// Check loaded rooms
window.rooms.length

// Check selected rooms
window._AR_NAV_CURRENT_ROOM
window._AR_NAV_DESTINATION_ROOM

// Manually trigger render loop (if stuck)
if (window._AR_RENDERER.renderer) {
  window._AR_RENDERER.renderer.render(
    window._AR_RENDERER.scene, 
    window._AR_RENDERER.camera
  );
}

// Check if markers module loaded
window._AR_MARKERS

// Manually load rooms
fetch('/api/ar/rooms/').then(r => r.json()).then(d => console.log(d))
```

