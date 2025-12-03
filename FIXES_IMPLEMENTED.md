# UMAP SVG Map Fixes - December 2, 2025

## Issues Resolved

### 1. **ReferenceError: buildingLocations is not defined**
**Problem:** The `buildingLocations` object was declared as a `const` at module scope, but was being referenced before the module fully loaded, causing a ReferenceError at line 44 of main.js.

**Solution:**
- Changed `const buildingLocations = {}` to `window.buildingLocations = window.buildingLocations || {}`
- This ensures the variable is globally accessible and initialized before use
- Added a `DOMContentLoaded` event listener to call `fetchBuildingData()` after the DOM is ready
- This prevents race conditions where building panel functions try to access the data before it's loaded

**File Modified:** `main.js` (lines 1-50)

---

### 2. **SVG Panning & Zooming Not Working Properly**
**Problem:** When trying to drag/pan the SVG map, it would disappear or show blank areas. The panning logic had issues with:
- Incorrect boundary calculations
- SVG elements disappearing beyond viewport bounds
- Cursor not providing proper visual feedback

**Solution:**
- Completely rewrote the `SVGManipulator` class with:
  - **Proper Bounds Calculation**: The viewport is now constrained to the UMAK element (campus boundary) with configurable padding
  - **Persistent State per SVG**: Each SVG element has its own bounds stored in `boundsPerSVG` object
  - **Improved Transform Logic**: Better calculation of pan limits based on viewport size and current zoom level
  - **Debug Logging**: Added detailed console logs to track bounds and transform calculations

**Key Changes:**
```javascript
// Before: Global bounds for all SVGs
this.bounds.element = { x, y, width, height, ... }

// After: Per-SVG bounds tracking
this.boundsPerSVG[svg.id || svg] = { x, y, width, height, ... }
```

**File Modified:** `SVGManipulator.js` (entire file rewritten, ~493 lines)

---

### 3. **Building Click Handlers Not Working During Pan**
**Problem:** Clicking on buildings (UMAK, Building 1, HPSB, etc.) while panning was unreliable. The SVGManipulator was preventing clicks on interactive elements.

**Solution:**
- Enhanced `isInteractiveElement()` method to properly detect all building types:
  - Checks ID against comprehensive list: `building*`, `hpsb`, `admin`, `adminbuilding`, `oval`, `march`, `marchhouse`, `umak`
  - Uses parent traversal with depth limit to avoid infinite loops
  - Properly handles both string and SVGAnimatedString className types
- Modified `handleElementClick()` to execute on capture phase (`true` flag in addEventListener)
- Added proper display name formatting for all building types

**File Modified:** `SVGManipulator.js` (lines 86-120, 406-445)

---

### 4. **Mobile View Not Supporting Touch Panning/Pinch Zooming**
**Problem:** Mobile users couldn't drag and pan the SVG or pinch to zoom, and buildings weren't clickable on mobile.

**Solution:**
- Implemented proper touch event handlers:
  - **Single Touch (Pan)**: `touchstart` → `touchmove` → `touchend` for dragging
  - **Two-Finger Pinch (Zoom)**: Detect distance between two touches and scale accordingly
  - **Touch Event Prevention**: Properly use `preventDefault()` to prevent default browser behaviors
  - Both desktop and mobile share the same boundary constraints and click-through logic

**Touch Handling Code:**
```javascript
handleTouchStart(e, svg) {
    if (e.touches.length === 1) {
        // Single touch - pan
        if (this.isInteractiveElement(e.target)) return;
        // ... pan setup
    } else if (e.touches.length === 2) {
        // Two finger - zoom
        e.preventDefault();
        // ... zoom setup
    }
}
```

**File Modified:** `SVGManipulator.js` (lines 263-315)

---

### 5. **Viewport Not Constrained to UMAK Bounds**
**Problem:** Users could pan and zoom beyond the UMAK area (campus map), making the interface confusing and allowing viewing of empty space.

**Solution:**
- Implemented `constrainToBounds()` method that:
  - Gets reference element (UMAK) bounding box
  - Calculates minimum and maximum pan values based on UMAK position and size
  - Factors in current zoom scale to adjust constraints
  - Includes configurable padding around UMAK for context viewing
  - Prevents zooming beyond `minScale` (0.5x) and `maxScale` (4x)

**Bounds Calculation:**
```javascript
constrainToBounds(x, y, scale, svg) {
    const bounds = this.boundsPerSVG[svg.id || svg];
    if (!bounds) return { x, y };
    
    const svgRect = svg.getBoundingClientRect();
    const viewportWidth = svgRect.width;
    const viewportHeight = svgRect.height;
    
    // Scale UMAK element position and size by current zoom
    const scaledRefX = refElement.x * scale;
    const scaledRefWidth = refElement.width * scale;
    
    // Add padding
    const paddingX = this.bounds.padding * scale;
    
    // Calculate min/max pan
    const minX = -(scaledRefX + scaledRefWidth + paddingX - viewportWidth);
    const maxX = -(scaledRefX - paddingX);
    
    return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: Math.max(minY, Math.min(maxY, y))
    };
}
```

**File Modified:** `SVGManipulator.js` (lines 339-371)

---

### 6. **Visual Feedback Issues (Cursor, Highlighting)**
**Problem:** Users didn't get clear visual feedback when hovering over panning areas vs. clickable buildings.

**Solution:**
- Implemented cursor feedback:
  - **Grab Cursor**: When hovering over empty space that can be panned
  - **Grabbing Cursor**: When actively dragging the map
  - **Pointer Cursor**: (Already handled by SVG for interactive elements)
- Updated `handleMouseDown()` and `handleMouseMove()` to set appropriate cursors

**File Modified:** `SVGManipulator.js` (lines 182-211)

---

## Configuration Options

You can adjust these settings in `SVGManipulator.js` constructor:

```javascript
this.bounds = {
    referenceElement: 'UMAK',      // SVG element ID to constrain viewport to
    minScale: 0.5,                 // Minimum zoom level (0.5x = 50% zoom out)
    maxScale: 4,                   // Maximum zoom level (4x = 400% zoom in)
    padding: 150                   // Padding around UMAK in pixels
};
```

---

## Supported Interactions

### Desktop
- **Pan**: Click and drag anywhere on the map (except buildings)
- **Zoom In**: Mouse wheel scroll up
- **Zoom Out**: Mouse wheel scroll down
- **Click Building**: Left-click on any building polygon
- **Cursor Feedback**: 
  - "grab" when hovering over pannable area
  - "grabbing" while actively panning
  - "pointer" on buildings

### Mobile
- **Pan**: Single-finger drag anywhere on the map
- **Zoom In/Out**: Two-finger pinch gesture
- **Click Building**: Tap any building polygon
- **No scroll**: Touch events prevented from default scrolling

---

## SVG Building Elements

The following SVG elements are recognized as clickable buildings:
- `UMAK` - Main campus area
- `Building 1`, `Building 2`, `Building 3` - Campus buildings
- `HPSB` - HPSB building
- `Admin`, `AdminBuilding` - Administration building
- `Oval` - Oval area
- `March`, `March House` - March House

---

## Technical Implementation Details

### State Management
The SVGManipulator uses a centralized state object to track:
- `scale`: Current zoom level (1 = 100%)
- `translateX`, `translateY`: Current pan position
- `isPanning`: Whether user is currently panning
- `startX`, `startY`: Initial pan start coordinates
- `touchDistance`: Distance between two touches for pinch zoom

### Transform Application
Transforms are applied using CSS 3D transforms for performance:
```javascript
transform: translate(${translateX}px, ${translateY}px) scale(${scale})
transformOrigin: '0 0'
transformBox: 'fill-box'
```

### SVG Document Access
The code properly handles both:
- Direct SVG elements
- SVG loaded via `<object>` tag with `contentDocument`

This ensures compatibility with different SVG loading methods.

---

## Testing Checklist

- [x] SVG loads without errors
- [x] Pan functionality works on desktop (click and drag)
- [x] Zoom works with mouse wheel
- [x] Buildings remain clickable while panning
- [x] Viewport cannot pan beyond UMAK bounds
- [x] Zoom levels are constrained (0.5x to 4x)
- [x] Touch pan works on mobile (single finger)
- [x] Pinch zoom works on mobile (two fingers)
- [x] Building clicks work on mobile
- [x] Cursor feedback is appropriate
- [x] No console errors or warnings
- [x] Works on both desktop and mobile viewports

---

## Debugging

Enable detailed logging by checking the browser console (F12):

```javascript
// Look for these debug messages:
"SVGManipulator initialized with X SVG elements"
"Setting up SVG #0: umapSVG"
"SVG #0 (umapSVG) load event fired"
"Bounds calculated for UMAK: {...}"
"Interactive element detected: Building 1"
"Building clicked: Building1"
```

---

## Future Enhancements

Possible improvements for future versions:
1. Add zoom buttons (+ / -) for better UX
2. Add reset view button to return to initial bounds
3. Add search/filter for finding specific buildings
4. Add animation transitions when clicking buildings
5. Add keyboard shortcuts (arrows for pan, +/- for zoom)
6. Add URL state preservation (save zoom/pan level)
7. Implement smooth easing for pan/zoom animations

---

## Files Modified

1. **main.js** - Fixed buildingLocations initialization (50 lines added)
2. **SVGManipulator.js** - Completely rewritten with proper pan/zoom/bounds logic (493 lines)

**Total Changes:** ~543 lines of code improvements

---

## Deployment Notes

1. Clear browser cache to ensure new JavaScript files load
2. Test on multiple devices (desktop, tablet, mobile)
3. Test on different browsers (Chrome, Firefox, Safari, Edge)
4. Verify SVG file is loading correctly with inspector tools
5. Check console for any errors during initialization

---

Generated: December 2, 2025
