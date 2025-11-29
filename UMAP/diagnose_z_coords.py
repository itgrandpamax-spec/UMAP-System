#!/usr/bin/env python
"""
Diagnose and fix Z coordinate matching issues
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMAP.settings')
django.setup()

from main.models import RoomProfile, Floor
from main.room_manager import RoomNameManager

print("=" * 80)
print("DIAGNOSING Z COORDINATE LOADING ISSUES")
print("=" * 80)

# Load CSV data
room_coords_map = RoomNameManager.load_room_coordinates()
print(f"\nCSV contains {len(room_coords_map)} room IDs")
print("Sample CSV entries:")
for i, (room_id, coords) in enumerate(list(room_coords_map.items())[:10]):
    print(f"  {room_id}: X={coords.get('x')}, Y={coords.get('y')}, Z={coords.get('z')}")

# Check floor 9 specifically
print("\n" + "=" * 80)
print("FLOOR 9 ANALYSIS")
print("=" * 80)

floor_9 = Floor.objects.filter(name__icontains='9 Floor').first()
if floor_9:
    print(f"\nFloor: {floor_9.name}")
    rooms = RoomProfile.objects.filter(room__floor=floor_9)
    print(f"Total rooms on floor: {rooms.count()}")
    
    rooms_with_z = 0
    rooms_without_z = 0
    missing_matches = []
    
    print("\nSample rooms and their Z coordinates:")
    for room in rooms[:20]:
        coords = room.coordinates or {}
        z_val = coords.get('z')
        
        print(f"  Room {room.number:6} ({room.name:30}): Z={z_val}")
        
        if z_val is not None and z_val != 0:
            rooms_with_z += 1
        else:
            rooms_without_z += 1
            missing_matches.append(room.number)
    
    print(f"\nRooms with non-zero Z: {rooms_with_z}")
    print(f"Rooms with Z=0 or None: {rooms_without_z}")
    
    if missing_matches:
        print(f"\nRooms without Z (first 10): {missing_matches[:10]}")
        print("\nTrying to find these in CSV:")
        for room_num in missing_matches[:5]:
            # Try various matching strategies
            print(f"\n  Looking for room {room_num}:")
            
            # Direct match
            if room_num in room_coords_map:
                print(f"    ✓ Found as '{room_num}' in CSV: Z={room_coords_map[room_num].get('z')}")
            
            # Padded matches
            for padded in [room_num.zfill(4), room_num.zfill(5), room_num.zfill(6)]:
                if padded in room_coords_map:
                    print(f"    ✓ Found as '{padded}' in CSV: Z={room_coords_map[padded].get('z')}")
            
            # Check if it's in CSV with floor prefix
            for key in room_coords_map.keys():
                if str(room_num) in str(key):
                    print(f"    ✓ Partial match: '{key}' in CSV: Z={room_coords_map[key].get('z')}")
                    break

print("\n" + "=" * 80)
