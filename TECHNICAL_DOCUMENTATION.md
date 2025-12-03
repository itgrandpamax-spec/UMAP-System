# UMAP SVG Manipulator - Technical Documentation

## Overview

The SVGManipulator is a JavaScript class that handles all interactive map functionality including pan, zoom, boundary constraints, and click-through for building selection. It's designed to work with both desktop and mobile interfaces.

---

## Architecture

### Class Structure

```
SVGManipulator
├── Constructor(svgSelector)
├── Initialization
│   ├── init()
│   ├── setupSVG()
│   └── setupSVGInteraction()
├── Event Handlers
│   ├── Desktop
│   │   ├── handleMouseDown()
│   │   ├── handleMouseMove()
│   │   ├── handleMouseUp()
│   │   └── handleWheel()
│   └── Mobile
│       ├── handleTouchStart()
│       ├── handleTouchMove()
│       └── handleTouchEnd()
├── Transform Logic
│   ├── updateTransform()
│   ├── constrainToBounds()
│   └── applyTransform()
├── Interaction Detection
│   ├── handleElementClick()
│   ├── isInteractiveElement()
│   └── calculateBounds()
├── Utility Methods
│   ├── getSVGDocument()
│   ├── getTouchDistance()
│   ├── zoomIn()
│   ├── zoomOut()
│   ├── resetView()
│   ├── focusOnElement()
│   └── getState()
```

---

## Configuration

### Constructor Options

```javascript
const manipulator = new SVGManipulator('[id^="umapSVG"]');

// Configuration (in constructor):
this.bounds = {
    referenceElement: 'UMAK',      // SVG element ID for boundary
    minScale: 0.5,                 // Minimum zoom (0.5x = 50% zoom out)
    maxScale: 4,                   // Maximum zoom (4x = 400% zoom in)
    padding: 150                   // Padding around reference element (px)
};
```

### State Object

```javascript
this.state = {
    scale: 1,                      // Current zoom level
    translateX: 0,                 // X pan position
    translateY: 0,                 // Y pan position
    isPanning: false,              // Currently panning
    startX: 0,                     // Pan start X
    startY: 0,                     // Pan start Y
    lastX: 0,                      // Previous X position
    lastY: 0,                      // Previous Y position
    touchDistance: 0,              // Distance between two touches (pinch)
    isTouch: false,                // Using touch input
    lastClickTime: 0,              // For click detection
    lastClickTarget: null          // Last clicked element
};
```

---

## Event Flow

### Desktop Pan (Click + Drag)

```
1. mousedown event
   ├─ Check if clicking interactive element
   ├─ Store starting coordinates
   └─ Set isPanning = true

2. mousemove event (repeated while mouse down)
   ├─ Calculate delta (movement)
   ├─ Call updateTransform(new position)
   └─ Apply transform via CSS

3. mouseup event
   ├─ Set isPanning = false
   └─ Restore cursor
```

### Desktop Zoom (Mouse Wheel)

```
1. wheel event
   ├─ Calculate zoom direction (up/down)
   ├─ Calculate new scale (0.9x or 1.1x)
   ├─ Get mouse position relative to SVG
   ├─ Calculate zoom offset
   └─ Call updateTransform(same position, new scale)
```

### Mobile Pan (Single Touch)

```
1. touchstart event (1 touch)
   ├─ Check if clicking interactive element
   ├─ Store touch starting position
   └─ Set isPanning = true

2. touchmove event (repeated)
   ├─ Calculate touch delta
   └─ Call updateTransform(new position)

3. touchend event
   ├─ Set isPanning = false
   └─ Clean up touch state
```

### Mobile Zoom (Two-Finger Pinch)

```
1. touchstart event (2+ touches)
   ├─ Calculate distance between first two touches
   ├─ Store starting scale
   └─ Set isPanning = false

2. touchmove event (2+ touches)
   ├─ Calculate new distance
   ├─ Calculate zoom ratio (new/old distance)
   ├─ Get midpoint between touches
   └─ Call updateTransform(position, new scale)

3. touchend event
   └─ Clean up touch state
```

---

## Boundary Constraints

### constrainToBounds() Logic

The boundary system ensures the user can only pan/zoom within the UMAK area (campus boundary).

```
1. Get UMAK element bounding box (from SVG)
   └─ Contains: x, y, width, height

2. Scale UMAK coordinates by current zoom level
   ├─ scaledX = refElement.x * scale
   ├─ scaledY = refElement.y * scale
   ├─ scaledWidth = refElement.width * scale
   └─ scaledHeight = refElement.height * scale

3. Add configurable padding around UMAK
   ├─ paddingX = bounds.padding * scale
   └─ paddingY = bounds.padding * scale

4. Calculate min/max pan bounds
   ├─ minX = -(scaledX + scaledWidth + paddingX - viewportWidth)
   ├─ maxX = -(scaledX - paddingX)
   ├─ minY = -(scaledY + scaledHeight + paddingY - viewportHeight)
   └─ maxY = -(scaledY - paddingY)

5. Clamp requested position to bounds
   ├─ finalX = max(minX, min(maxX, requestedX))
   └─ finalY = max(minY, min(maxY, requestedY))
```

### Visual Explanation

```
┌─────────────────────────────────────┐
│          Viewport/Screen            │
│  ┌──────────────────────────────┐  │
│  │  Padding (configurable)      │  │
│  │  ┌────────────────────────┐  │  │
│  │  │   UMAK Campus Area     │  │  │
│  │  │   (Reference Element)  │  │  │
│  │  └────────────────────────┘  │  │
│  │  ◄─ User can pan to here     │  │
│  └──────────────────────────────┘  │
│  ◄─ But not beyond                 │
└─────────────────────────────────────┘

User can see: UMAK + padding
User cannot pan: Beyond padding
```

---

## Interactive Element Detection

### isInteractiveElement() Method

Detects whether an element is clickable (building) vs pannable (background).

```javascript
isInteractiveElement(element) {
    // Traverse up the DOM tree
    let current = element;
    let depth = 0;
    const maxDepth = 5;  // Prevent infinite loops

    while (current && current !== document && depth < maxDepth) {
        const id = (current.id || '').toLowerCase();
        const className = getClassName(current);

        // Check for known interactive IDs
        if (id.startsWith('building') ||
            id === 'hpsb' ||
            id === 'admin' ||
            id === 'oval' ||
            id === 'march' ||
            id === 'umak' ||
            id.startsWith('room') ||
            className.includes('interactive')) {
            return true;
        }

        current = current.parentElement;
        depth++;
    }

    return false;
}
```

### Building ID Recognition

Recognized building element IDs (case-insensitive):
- `Building*` - Any building element (Building1, Building2, Building3)
- `HPSB` - HPSB building
- `Admin` / `AdminBuilding` - Administration building
- `Oval` - Oval area
- `March` / `MarchHouse` - March House
- `UMAK` - Main campus area
- `Room*` - Room elements

---

## Transform Application

### CSS Transform Implementation

```javascript
applyTransform(svg) {
    const transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    svg.style.transform = transform;
    svg.style.transformOrigin = '0 0';
    svg.style.transformBox = 'fill-box';
}
```

### Why These Settings?

- **transform**: Main 3D transformation for performance
- **translate()**: Moves the SVG (pan operation)
- **scale()**: Zooms the SVG (zoom operation)
- **transformOrigin: '0 0'**: Ensures transform origin is top-left
- **transformBox: 'fill-box'**: Uses SVG content box for transforms

### Performance Note

CSS transforms are GPU-accelerated, making this approach very performant compared to direct DOM manipulation.

---

## SVG Document Access

### Supporting Different SVG Loading Methods

```javascript
getSVGDocument(svg) {
    if (svg.tagName.toUpperCase() === 'OBJECT') {
        // SVG loaded via <object> tag
        return svg.contentDocument;
    }
    // Inline SVG or SVG loaded directly
    return svg;
}
```

### Why This Matters

Different ways to load SVGs:
1. **Inline SVG**: `<svg>...</svg>` - Direct access
2. **Object Tag**: `<object data="map.svg">` - Via contentDocument
3. **Image Tag**: `<img src="map.svg">` - No DOM access
4. **Background Image**: CSS - No DOM access

SVGManipulator supports #1 and #2, which are the interactive methods.

---

## State Management

### Per-SVG Bounds Tracking

```javascript
this.boundsPerSVG = {}  // Stores bounds for each SVG

calculateBounds(svg) {
    const svgDoc = this.getSVGDocument(svg);
    const refElement = svgDoc.getElementById('UMAK');
    
    if (refElement) {
        const bbox = refElement.getBBox();
        this.boundsPerSVG[svg.id || svg] = {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height,
            centerX: bbox.x + bbox.width / 2,
            centerY: bbox.y + bbox.height / 2
        };
    }
}
```

### Why Per-SVG Tracking?

- Supports multiple SVG elements on page (desktop + mobile versions)
- Each SVG might have different dimensions
- Each SVG needs independent state
- Prevents interference between multiple map instances

---

## Debugging

### Console Logs

Enable debugging by checking browser console (F12):

```javascript
// Initialization
"SVGManipulator initialized with 1 SVG elements"
"Setting up SVG #0: umapSVG"
"SVG #0 (umapSVG) load event fired"

// Bounds
"Bounds calculated for UMAK: {x: 10595, y: 4828, width: 4258, ...}"

// Interaction
"Interactive element detected: Building1"
"Building clicked: Building1"

// Errors
"Could not calculate bounds: [error details]"
"Reference element UMAK not found in SVG"
```

### Getting State

```javascript
// In browser console:
window.svgManipulator.getState()
// Returns: {scale: 1.5, translateX: 100, translateY: 50, ...}
```

### Manual Control

```javascript
// In browser console:
window.svgManipulator.zoomIn()
window.svgManipulator.zoomOut()
window.svgManipulator.resetView()
window.svgManipulator.focusOnElement('Building1')
```

---

## Performance Considerations

### Optimization Techniques

1. **CSS Transforms**: GPU-accelerated, very fast
2. **Event Throttling**: Not currently implemented, could improve on lower-end devices
3. **Transform Origin**: Fixed at 0,0 to avoid recalculation
4. **Document Fragment**: Unused but available pattern for batch DOM updates
5. **Event Delegation**: Uses capture phase for click detection

### Potential Improvements

```javascript
// Add throttled mouse move handler
handleMouseMove = throttle((e, svg) => {
    // ... handler code
}, 16);  // ~60fps

// Add event delegation for SVG elements
setupEventDelegation(svg) {
    svgDoc.addEventListener('click', (e) => {
        // Single handler for all interactive elements
    }, true);  // Capture phase
}
```

---

## Error Handling

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| SVG not responsive | SVG not loaded | Check `DOMContentLoaded` event |
| Boundaries too restrictive | UMAK not found | Verify SVG has UMAK element |
| Clicks not working | Interactive detection fails | Check element ID formatting |
| Zoom stuck | Scale at limits | Check minScale/maxScale config |
| Pan stuck | At boundary limit | Check padding and viewport size |

### Error Messages

```javascript
// Missing reference element
console.warn('Could not calculate bounds:', error)
console.warn('Reference element UMAK not found in SVG')

// SVG loading issue
console.log('SVG #0 (umapSVG) content not yet available, retrying...')

// Interaction issues
console.log('Interactive element detected: [element-id]')
```

---

## Integration with main.js

### Initialization Sequence

```
1. Page loads
2. DOM Content Loaded
3. SVGManipulator initializes
   ├─ Finds SVG elements
   ├─ Waits for SVG to load
   └─ Sets up event handlers
4. fetchBuildingData() called
   └─ Loads building list from API
5. User clicks building
   ├─ SVGManipulator detects click
   ├─ Calls showBuildingPanel()
   └─ main.js handles display
```

### Data Flow

```
User clicks building
    ↓
handleElementClick() detects building ID
    ↓
Calls showBuildingPanel() from main.js
    ↓
main.js fetches building data
    ↓
Displays building panel with floors/rooms
```

---

## Testing Checklist

- [ ] SVG loads without errors
- [ ] Pan works in all directions
- [ ] Zoom in/out works with mouse wheel
- [ ] Zoom is centered on cursor
- [ ] Cannot pan beyond UMAK bounds
- [ ] Zoom levels constrained (0.5x to 4x)
- [ ] Buildings clickable while panning
- [ ] Building clicks show correct panel
- [ ] Touch pan works (single finger)
- [ ] Pinch zoom works (two fingers)
- [ ] Mobile interactions smooth
- [ ] Cursor feedback appropriate
- [ ] No console errors
- [ ] Works on desktop browsers
- [ ] Works on mobile browsers
- [ ] Responsive to window resize

---

## Future Enhancements

### Planned Features

1. **Click-and-drag building highlighting**
   - Highlight building on hover
   - Show building name tooltip

2. **Smooth animations**
   - Easing functions for zoom
   - Transition animations for pan

3. **Keyboard shortcuts**
   - Arrow keys for pan
   - +/- for zoom
   - Home to reset view

4. **Persistent state**
   - Save zoom/pan level in URL
   - Restore on page reload

5. **Advanced zooming**
   - Double-click to zoom
   - Fit-to-bounds button

6. **Visual improvements**
   - Zoom level indicator
   - Navigation buttons
   - Mini-map

### Implementation Notes

```javascript
// Example: Smooth zoom with easing
zoomInSmooth(duration = 300) {
    const startScale = this.state.scale;
    const endScale = Math.min(this.bounds.maxScale, startScale * 1.2);
    const startTime = Date.now();
    
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easeProgress = easeInOutCubic(progress);
        const currentScale = startScale + (endScale - startScale) * easeProgress;
        
        this.updateTransform(this.state.translateX, this.state.translateY, currentScale);
        
        if (progress < 1) requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
}
```

---

## API Reference

### Public Methods

```javascript
// Zoom control
zoomIn()                    // Zoom in 20%
zoomOut()                   // Zoom out 20%
resetView()                 // Reset to 1x scale at 0,0 translate

// Element control
focusOnElement(elementId)   // Zoom and pan to element

// State management
getState()                  // Get current pan/zoom state
```

### Event Listeners

```javascript
// Mouse
'mousedown'     // Start pan
'mousemove'     // Pan movement
'mouseup'       // End pan
'wheel'         // Zoom
'click'         // Building click (capture phase)

// Touch
'touchstart'    // Start pan/zoom
'touchmove'     // Pan/zoom movement
'touchend'      // End pan/zoom
'touchcancel'   // Cancel interaction
```

---

## Version History

### v2.0 (Current - December 2025)
- ✅ Fixed building click detection
- ✅ Improved pan/zoom performance
- ✅ Added per-SVG bounds tracking
- ✅ Enhanced mobile touch support
- ✅ Better visual feedback (cursors)
- ✅ Fixed SVG disappearing issue

### v1.0 (Previous)
- Basic pan/zoom functionality
- Desktop support only
- Limited mobile support

---

## Contributing

When modifying SVGManipulator:

1. **Maintain backward compatibility**: Public API should remain same
2. **Add debug logs**: Use console.log with descriptive messages
3. **Update documentation**: Document new features and changes
4. **Test thoroughly**: Check desktop and mobile
5. **Check performance**: Use DevTools Performance tab

---

## Support & Troubleshooting

For issues or questions:
1. Check browser console for errors (F12)
2. Verify SVG file has UMAK element
3. Test on different browsers
4. Check network tab for failed requests
5. Review implementation notes above

---

Generated: December 2, 2025
Version: 2.0
Author: AI Assistant
