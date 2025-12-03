# User AR Navigation - Quick Start Guide

## 🚀 How to Use

### For Users

1. **Log in** to your UMAP account
2. **Navigate** to `/user_ar/` or click the "AR Navigation" link
3. **Select** "Where are you?" (your current location)
4. **Select** "Where do you want to go?" (your destination)
5. **Review** the room details displayed
6. **Click** "Start AR Session" button
7. **Allow** camera and location permissions when prompted
8. **Follow** the AR markers and navigation arrow to your destination

### For Developers

#### Setting Up

1. **Ensure database has coordinates:**
   ```python
   # RoomProfile must have coordinates JSON
   room_profile.coordinates = {"x": 10.5, "y": 25.3, "z": 15.8}
   room_profile.save()
   ```

2. **Run migrations** (if needed)
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

3. **Test the endpoint:**
   ```bash
   python manage.py runserver
   # Visit: http://localhost:8000/user_ar/
   ```

#### Testing Coordinates

If coordinates are missing or all zeros:

```python
# Django shell
python manage.py shell

from main.models import RoomProfile, Room

# Check a room's coordinates
room = Room.objects.first()
print(room.profile.coordinates)

# Import coordinates from CSV
from main.management.commands.seed_coordinates import Command
cmd = Command()
cmd.handle()  # Seeds from Room_coords.csv
```

## 📝 Code Examples

### Python - Fetching Room Data

```python
from main.models import Room

# Get all rooms with coordinates
rooms = Room.objects.select_related('profile', 'floor').all()

for room in rooms:
    x = room.profile.coordinates.get('x', 0)
    y = room.profile.coordinates.get('y', 0)
    z = room.profile.coordinates.get('z', 0)
    
    print(f"{room.profile.name}: ({x}, {y}, {z})")
```

### JavaScript - Accessing Selected Rooms

```javascript
// After user makes selections:

// Current location (Point A)
const pointA = window._AR_NAV_CURRENT_ROOM;
console.log(`User is in: ${pointA.name}`);
console.log(`Coordinates: ${pointA.x}, ${pointA.y}, ${pointA.z}`);

// Destination (Point B)
const pointB = window._AR_NAV_DESTINATION_ROOM;
console.log(`Going to: ${pointB.name}`);

// Both rooms for AR
const twoPoints = window._AR_NAV_ACTIVE_ROOMS;
console.log(`Navigating between:`, twoPoints);
```

### HTML - Custom Button Integration

```html
<!-- Add link to AR navigation in your template -->
<a href="{% url 'user_ar_view' %}" class="btn btn-primary">
    <i class="fas fa-location-arrow"></i>
    AR Navigation
</a>
```

## 🔧 Customization Options

### Change Modal Width
```css
.ar-modal {
    max-width: 48rem;  /* Default: 52rem */
}
```

### Change 3D Preview Height
```css
.video-box {
    height: 350px;  /* Default: 280px */
}
```

### Modify Button Colors
```css
.btn-primary {
    background: rgb(16, 185, 129);  /* Green instead of blue */
}
```

### Add Custom Room Filters
```javascript
// Filter only classroom types
const classrooms = allRooms.filter(r => r.type === 'Classroom');

// Filter by building
const hpsb = allRooms.filter(r => r.building === 'HPSB');
```

## 🐛 Troubleshooting

### Issue: "Start AR Session" button always disabled
**Solution:** Check that:
1. Both dropdowns have selections
2. Selections are different rooms
3. Database has rooms with valid profiles

```javascript
// Debug in console
console.log(selectedCurrentRoom);
console.log(selectedDestinationRoom);
console.log(selectedCurrentRoom?.id !== selectedDestinationRoom?.id);
```

### Issue: AR doesn't start
**Solution:** Check:
1. Browser supports WebXR (Chrome, Firefox, Safari)
2. Device has gyroscope/accelerometer
3. Permissions granted for camera
4. No JavaScript errors in console

### Issue: Rooms not in dropdown
**Solution:** Verify:
1. Rooms exist in database
2. Rooms have RoomProfile related object
3. Profiles have valid room details

```python
# Django shell
from main.models import Room
rooms = Room.objects.select_related('profile').filter(profile__isnull=False)
print(f"Rooms with profiles: {rooms.count()}")
```

### Issue: Coordinates appear as (0, 0, 0)
**Solution:** Seed coordinates from CSV:

```python
# Django shell
from main.models import RoomProfile, Floor
import csv

# Load from Room_coords.csv
with open('Room_coords.csv') as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            profile = RoomProfile.objects.get(number=row['Room Id'])
            profile.coordinates = {
                'x': float(row['X']),
                'y': float(row['Y']),
                'z': float(row['Z'])
            }
            profile.save()
        except RoomProfile.DoesNotExist:
            continue
```

## 📊 Monitoring & Analytics

### Track AR Usage
```python
# Add to startARNavigation()
# In views.py - add tracking

from main.models import UserActivity

UserActivity.objects.create(
    user=request.user,
    activity_type='ar_navigation_start',
    details={
        'from_room': selectedCurrentRoom['id'],
        'to_room': selectedDestinationRoom['id']
    }
)
```

### Monitor Performance
```javascript
// Measure AR startup time
const start = performance.now();
window.startARFlow();
// ... AR loads ...
const end = performance.now();
console.log(`AR startup: ${end - start}ms`);
```

## 🎓 Learning Resources

### Understanding WebXR
- [MDN Web Docs - WebXR](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API)
- [WebXR Samples](https://immersive-web.github.io/)

### Three.js for 3D
- [Three.js Documentation](https://threejs.org/docs/)
- [Three.js Examples](https://threejs.org/examples/)

### Django Coordinates
- [Django JSONField](https://docs.djangoproject.com/en/stable/ref/models/fields/#jsonfield)
- [Storing 3D Data](https://postgis.net/)

## 📋 Checklist Before Production

- [ ] All rooms have coordinates in database
- [ ] Coordinates format is correct: `{x: number, y: number, z: number}`
- [ ] Tested on target mobile devices
- [ ] WebXR supported on deployment browsers
- [ ] Camera permissions work correctly
- [ ] AR markers visible at intended scale
- [ ] Navigation arrows point correctly
- [ ] Floor transitions work
- [ ] Error messages are user-friendly
- [ ] Performance acceptable (< 2s load time)

## 📞 Support

For issues or questions:
1. Check browser console for errors: `F12` → Console tab
2. Check server logs: `python manage.py runserver` output
3. Review Django debug page if DEBUG=True
4. Test with different rooms to isolate issue
5. Clear browser cache and reload

## 🔄 Future Enhancements

- [ ] Turn-by-turn text directions
- [ ] Floor transition guidance
- [ ] Real-time location tracking
- [ ] Route history/bookmarking
- [ ] Shared navigation with friends
- [ ] Time estimates
- [ ] Alternative route suggestions
- [ ] Accessibility text descriptions
