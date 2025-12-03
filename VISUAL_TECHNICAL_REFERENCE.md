# User AR - Visual & Technical Reference Guide

## 🎨 UI Layout Overview

```
╔════════════════════════════════════════════════════╗
║                  AR NAVIGATION MODAL                ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║  [LOGO] AR Navigation                         [✕]  ║  ← Header (60px)
║         Navigate using Augmented Reality           ║
║                                                    ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║  🏢 Building Preview                              ║
║  ┌──────────────────────────────────────────┐     ║
║  │  [3D Model Preview Box - 280px height]  │     ║
║  │       (Cube icon + placeholder text)    │     ║
║  └──────────────────────────────────────────┘     ║
║                                                    ║
║  [Where are you?] [Where do you want to go?]      ║
║  ┌─────────────────────────────────────────┐      ║
║  │-- Select current location -- ▼          │      ║
║  └─────────────────────────────────────────┘      ║
║  ┌─────────────────────────────────────────┐      ║
║  │-- Select destination -- ▼               │      ║
║  └─────────────────────────────────────────┘      ║
║                                                    ║
║  📍 Your Current Location (shown if selected)      ║
║  ┌─────────────┬──────────────────────────┐       ║
║  │Room Number  │Type                      │       ║
║  │    912      │Classroom                 │       ║
║  ├─────────────────────────────────────────┤       ║
║  │Floor                                   │       ║
║  │9th Floor, HPSB                         │       ║
║  └─────────────────────────────────────────┘       ║
║                                                    ║
║  🎯 Destination (shown if selected)                ║
║  ┌─────────────┬──────────────────────────┐       ║
║  │Room Number  │Type                      │       ║
║  │   1001      │Laboratory                │       ║
║  ├─────────────────────────────────────────┤       ║
║  │Floor                                   │       ║
║  │10th Floor, HPSB                        │       ║
║  └─────────────────────────────────────────┘       ║
║                                                    ║
║  ℹ️  Select your current location and destination  ║
║     to start AR navigation. Only the two selected ║
║     rooms will be shown in AR mode.               ║
║                                                    ║
║  ┌────────────────────────────────────────┐       ║
║  │        ▶ Start AR Session              │       ║  (Disabled/Enabled)
║  └────────────────────────────────────────┘       ║
║                                                    ║
╚════════════════════════════════════════════════════╝
```

## 🔄 State Machine

```
Initial State
    ↓
[User selects current room]
    ↓
    └─→ Show current location card
        └─→ Button still disabled (need destination)
            ↓
[User selects destination]
    ↓
    └─→ Show destination card
        └─→ Check: different rooms?
            ├─ YES → Button ENABLED ✓
            └─ NO → Button DISABLED

User can change selections at any time
    ↓
When button ENABLED → User clicks "Start AR Session"
    ↓
[AR Flow Initiates]
    ├─ Set window._AR_NAV_CURRENT_ROOM
    ├─ Set window._AR_NAV_DESTINATION_ROOM
    ├─ Set window._AR_NAV_ACTIVE_ROOMS
    └─ Call window.startARFlow()
        ↓
        AR Session with 2 Points Only
        ├─ Point A: Blue marker (current location)
        ├─ Point B: Green marker (destination)
        └─ Navigation arrow points to destination
```

## 📊 Data Structure

### Room Object (from database)
```javascript
{
  id: 1234,                          // Primary key
  number: "912",                     // Room number
  name: "Room 912",                  // Display name
  type: "Classroom",                 // Type
  description: "Classroom for CS courses",
  building: "HPSB",                  // Building abbreviation
  floor: "9th Floor",                // Floor name
  floor_id: 5,                       // Floor FK
  
  // 3D Coordinates (extracted from JSON)
  x: 22.97786814,                    // X coordinate
  y: -25.18278138,                   // Y coordinate
  z: 13.12335958,                    // Z coordinate
  
  images: [                          // Room photos
    "/media/rooms/1234/photo1.jpg",
    "/media/rooms/1234/photo2.jpg"
  ]
}
```

### Global State
```javascript
// Rooms Array (populated on page load)
allRooms = [
  { id: 1, number: "912", name: "Room 912", x: 22.98, y: -25.18, z: 13.12, ...},
  { id: 2, number: "1001", name: "Room 1001", x: -150.50, y: -21.38, z: 118.11, ...},
  // ... more rooms
]

// Selected Rooms
selectedCurrentRoom = {
  id: 1,
  number: "912",
  name: "Room 912",
  x: 22.97786814,
  y: -25.18278138,
  z: 13.12335958,
  // ... full room object
}

selectedDestinationRoom = {
  id: 2,
  number: "1001",
  name: "Room 1001",
  x: -150.50,
  y: -21.38,
  z: 118.11,
  // ... full room object
}
```

## 🎯 Coordinate System

### From CSV (Room_coords.csv)
```
Room Id  | Name    | X            | Y             | Z
---------|---------|--------------|---------------|----------
10101    | Room    | 1.530323093  | -51.97187998  | 0
10102    | Room    | 29.38409487  | -25.08206833  | 0
10201    | Room    | 22.97786814  | -25.18278138  | 13.12335958
...
```

### Stored in Database
```python
# RoomProfile model
coordinates = {
  "x": 22.97786814,
  "y": -25.18278138,
  "z": 13.12335958
}
```

### Used in AR
```javascript
// Point A Position (current location)
pointA = {
  x: 22.97786814,
  y: -25.18278138,
  z: 13.12335958,
  marker: "BLUE",     // User location
  label: "YOU"
}

// Point B Position (destination)
pointB = {
  x: -150.50,
  y: -21.38,
  z: 118.11,
  marker: "GREEN",    // Destination
  label: "DESTINATION"
}

// Navigation Vector
direction = {
  dx: pointB.x - pointA.x,
  dy: pointB.y - pointA.y,
  dz: pointB.z - pointA.z,
  arrow: "points from A to B"  // Visual guidance
}
```

## 🛠️ URL Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/user_ar/` | GET | Required | Load AR selection interface |
| N/A (JS) | - | - | All AR logic runs client-side |

## 🔐 Security & Permissions

- **Authentication:** Login required (`@login_required`)
- **Authorization:** All authenticated users can access
- **CSRF Protection:** Django template tag auto-included
- **Data Validation:** Server-side coordinate validation
- **Error Handling:** Graceful fallbacks for invalid data

## 🌐 Responsive Behavior

### Mobile (< 640px)
- Container: full width with 1rem padding
- Modal: border-radius 1rem (rounded)
- Font sizes: reduced (-0.25rem)
- Dropdowns: 100% width, stack if needed
- Buttons: full width
- Height: auto (scrollable content)

### Tablet (640px - 1024px)
- Container: full width with padding
- Modal: max-width 52rem, centered
- Dropdowns: 2-column grid when space available
- Details cards: responsive grid
- Buttons: can be side-by-side

### Desktop (> 1024px)
- Container: full viewport
- Modal: fixed max-width 52rem, centered
- All elements: full-width responsive
- Details cards: 2-column grid
- Buttons: expanded layout

## 🎨 Color Palette

```css
/* Background */
--bg-primary: rgb(15, 23, 42);      /* Dark slate */
--bg-secondary: rgb(30, 41, 59);    /* Lighter slate */
--bg-tertiary: rgba(51, 65, 85, 0.6);  /* Semi-transparent */

/* Text */
--text-primary: white;               /* Primary text */
--text-secondary: rgb(226, 232, 240); /* Secondary text */
--text-muted: rgb(107, 114, 128);    /* Muted text */

/* Accents */
--accent-primary: rgb(59, 130, 246);  /* Blue */
--accent-light: rgb(96, 165, 250);    /* Light blue */
--accent-muted: rgba(59, 130, 246, 0.1); /* Blue with alpha */

/* Borders */
--border-primary: rgba(71, 85, 105, 0.5); /* Medium border */
--border-light: rgba(71, 85, 105, 0.3);   /* Light border */
```

## ⚡ Performance Optimizations

- **CSS:** Minimal animations, hardware acceleration
- **JavaScript:** Efficient array methods, debouncing
- **DOM:** Minimal updates, class-based styling
- **Network:** Rooms data included in page (no AJAX)
- **Rendering:** Lazy rendering of details cards

## 🐛 Debugging Tips

### Enable Console Logging
```javascript
// In browser console
console.log(allRooms);                    // All available rooms
console.log(selectedCurrentRoom);         // Point A
console.log(selectedDestinationRoom);     // Point B
console.log(window._AR_NAV_ACTIVE_ROOMS); // Active navigation rooms
```

### Check AR Module Status
```javascript
console.log(window._AR_RENDERER);    // Renderer status
console.log(window._AR_MARKERS);     // Marker system
console.log(window._AR_WEBXR);       // WebXR support
```

### Manually Start AR (Dev)
```javascript
// Already selected rooms and want to test AR
startARNavigation();
```

## 📋 Maintenance Checklist

- [ ] Verify coordinate format in database
- [ ] Test with 100+ rooms (performance)
- [ ] Test on real mobile devices (WebXR)
- [ ] Check marker visibility at various distances
- [ ] Verify floor transitions work correctly
- [ ] Test all responsive breakpoints
- [ ] Validate coordinate accuracy in AR space

## 🚀 Deployment Notes

1. Ensure RoomProfile records have valid JSON coordinates
2. Test AR on target devices before production
3. Monitor WebXR API support across browsers
4. Backup database before bulk coordinate updates
5. Consider adding analytics tracking for AR usage
