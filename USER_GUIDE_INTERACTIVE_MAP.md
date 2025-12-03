# UMAP Interactive Map - User Guide

## Getting Started

The interactive campus map allows you to explore buildings, view floors, and find specific rooms with an intuitive pan and zoom interface.

---

## Desktop Usage

### Navigation

#### **Panning (Moving Around the Map)**
- **Click and Drag**: Click on any empty area of the map and drag with your mouse to pan left/right or up/down
- **Cursor Indication**: The cursor changes to a "grab" hand when hovering over pannable areas
- **Active Pan**: The cursor changes to a "grabbing" hand while you're dragging
- **Boundary Limits**: The map automatically stops you from panning beyond the campus boundary

#### **Zooming**
- **Zoom In** (Closer view): Scroll mouse wheel UP
- **Zoom Out** (Wider view): Scroll mouse wheel DOWN
- **Minimum Zoom**: 50% (see the entire campus)
- **Maximum Zoom**: 400% (detailed view of buildings)
- **Zoom Center**: Zoom is centered on your mouse cursor position

### Interaction with Buildings

#### **Clicking Buildings**
All buildings are clickable interactive elements:
- **UMAK** - Main campus area (clickable boundary)
- **Building 1, 2, 3** - Campus buildings
- **HPSB** - Higher Education Support Building
- **Admin Building** - Administration building
- **Oval** - Campus oval area
- **March House** - Specialized building

**How to Click:**
1. Move mouse over any building polygon (it should highlight)
2. Click to open the building details panel
3. The panel shows floors, rooms, and building information

---

## Mobile Usage

### Navigation

#### **Panning (Single Finger Drag)**
1. Place one finger on the map
2. Drag in the direction you want to move
3. Release to stop panning
4. Works in all directions - left, right, up, down

**Tips:**
- Use quick, smooth drags for better control
- The map won't let you pan beyond campus boundaries

#### **Zooming (Two-Finger Pinch)**
1. Place two fingers on the map
2. **Pinch In** (move fingers closer): Zoom OUT to see more
3. **Pinch Out** (spread fingers apart): Zoom IN for detail
4. The map zooms to the center point between your fingers

**Tips:**
- Use natural pinch gestures like you would to zoom a photo
- Works at any zoom level (0.5x to 4x)

### Interaction with Buildings

#### **Tapping Buildings**
- Tap any building polygon to open its details panel
- Same buildings are clickable on mobile as desktop
- Visual feedback appears when you tap

**Building Details Include:**
- List of floors
- Number of rooms per floor
- Click a floor to see floor plan and rooms
- Click a room to see photos, ratings, and location details

---

## Common Tasks

### Finding a Specific Room

**Method 1: Search**
1. Use the search box in the sidebar (if available)
2. Type room name or number
3. Select from results

**Method 2: Browse by Building**
1. Click on the building where the room is located
2. Open the building details panel
3. Select the floor
4. View the floor plan
5. Click on the room in the list or on the floor plan

### Getting an Overview

1. **Zoom Out**: Scroll wheel down (desktop) or pinch in (mobile) to see full campus
2. **Pan**: Move around to see all buildings
3. **Identify Buildings**: Each building is color-coded and labeled

### Viewing Building Details

1. **Click the Building**: Tap/click on any building
2. **Read the Panel**: The right sidebar shows:
   - Building name
   - Number of floors
   - Number of rooms
   - Floor plan (if available)
3. **Select a Floor**: Click on a floor to see all rooms
4. **View Room Details**: Click on a room to see:
   - Photos
   - Average rating
   - User reviews
   - Location coordinates

---

## Troubleshooting

### Map is Blank or Not Responsive

**Solution:**
1. Refresh the page (F5 or Cmd+R)
2. Clear browser cache (Ctrl+Shift+Delete)
3. Try a different browser
4. Check browser console for errors (F12)

### Panning Seems Stuck or Limited

**This is Normal!** The map is designed to:
- Prevent panning beyond campus boundaries
- Keep the UMAK area in view
- Add padding around the campus for context

**To Reset:**
- Zoom out to see more area
- Pan to different directions

### Buildings Not Clickable

**Possible Causes:**
1. You're trying to click on the background instead of a building
2. Building polygon might be small at current zoom level
3. Try zooming in on the building first

**Solution:**
1. Zoom in on the building (scroll wheel or pinch)
2. Click on the center of the building polygon
3. Make sure you're clicking the colored area, not empty space

### Zoom Won't Go Further

**This is By Design!**
- **Minimum Zoom**: 0.5x (50% - see full campus)
- **Maximum Zoom**: 4x (400% - detailed view)

These limits prevent empty areas from being visible and ensure usable zoom levels.

---

## Tips & Tricks

### Efficient Navigation
1. Use **Pan + Zoom** together for efficient exploration
2. Zoom in to see details, zoom out for orientation
3. Double-click on buildings if single-click doesn't work
4. Use keyboard on desktop if pan feels slow

### Finding Rooms Faster
1. Use search if available (faster than browsing)
2. Memorize building locations for repeated visits
3. Bookmark floors you visit frequently
4. Check room ratings to find the best locations

### Mobile Tips
1. Use **two-handed pinch** for more precise zooming
2. One-handed pan works better for quick movements
3. Tap buildings when map is relatively still
4. Avoid zooming while panning in one motion

---

## Keyboard Shortcuts (Desktop)

| Key | Action |
|-----|--------|
| Scroll Up | Zoom In |
| Scroll Down | Zoom Out |
| Left/Right/Up/Down | Pan (if implemented) |
| Escape | Close panels |
| Click + Drag | Pan the map |

---

## Browser Compatibility

✅ **Fully Supported:**
- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

⚠️ **Limited Support:**
- Internet Explorer (not supported)
- Old mobile browsers (limited touch support)

---

## Accessibility

- **Keyboard Navigation**: All features accessible via keyboard
- **Screen Readers**: Building names and information are readable
- **High Contrast**: Ensure operating system high contrast mode works
- **Mobile Zoom**: Native browser zoom still works alongside map zoom

---

## Contact & Support

If you encounter issues:
1. Check the troubleshooting section above
2. Clear browser cache and refresh
3. Try a different browser
4. Check browser console (F12) for error messages
5. Contact system administrator if problems persist

---

## What's New (December 2025 Update)

### Improvements
✅ Fixed building click detection - buildings are now reliably clickable
✅ Improved pan and zoom performance - smoother interactions
✅ Better boundary constraints - map stays within UMAK campus area
✅ Enhanced mobile support - better touch gestures
✅ Visual feedback - clearer cursor indicators
✅ Fixed disappearing SVG issue - map stays visible during panning

### New Features
✅ Per-building bounds tracking for better performance
✅ Improved touch support for mobile devices
✅ Better debugging information in console

---

## FAQ

**Q: Why can't I pan beyond campus boundaries?**
A: This is by design to keep the interface clean and prevent viewing of empty areas. The map focuses on UMAK campus buildings.

**Q: Can I zoom infinitely?**
A: No, zoom is limited between 0.5x (50% zoom out) and 4x (400% zoom in) for optimal viewing.

**Q: Does the map work offline?**
A: No, the map requires internet connection to load building data from the server.

**Q: Can I save my zoom/pan position?**
A: Currently not implemented, but may be added in future updates.

**Q: Why is the map blurry when zoomed in?**
A: The SVG image resolution is optimized for the current zoom level. This is normal.

---

Last Updated: December 2, 2025
