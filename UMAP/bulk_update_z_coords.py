#!/usr/bin/env python
"""
Bulk update all rooms with Z coordinates from Room_coords.csv
"""
import os
import sys
import django
import csv
from pathlib import Path

# Setup Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMAP.settings')
django.setup()

from main.models import RoomProfile
from main.room_manager import RoomNameManager

print("=" * 80)
print("BULK UPDATE: Adding Z Coordinates to All Rooms from CSV")
print("=" * 80)

# Load room coordinates from CSV
room_coords_map = RoomNameManager.load_room_coordinates()
print(f"\nLoaded {len(room_coords_map)} room coordinates from CSV")

if not room_coords_map:
    print("ERROR: Could not load Room_coords.csv")
    sys.exit(1)

# Get all rooms
all_rooms = RoomProfile.objects.all()
print(f"Found {all_rooms.count()} rooms in database")

updated_count = 0
rooms_with_z = 0
rooms_without_z = 0

for room in all_rooms:
    room_num = room.number.strip()
    csv_coords = None
    
    # Try multiple matching strategies (prioritize svg_room_id)
    if room.svg_room_id and room.svg_room_id in room_coords_map:
        csv_coords = room_coords_map[room.svg_room_id]
    elif room_num in room_coords_map:
        csv_coords = room_coords_map[room_num]
    elif f"{room_num}".zfill(4) in room_coords_map:
        csv_coords = room_coords_map[f"{room_num}".zfill(4)]
    elif f"{room_num}".zfill(5) in room_coords_map:
        csv_coords = room_coords_map[f"{room_num}".zfill(5)]
    elif f"{room_num}".zfill(6) in room_coords_map:
        csv_coords = room_coords_map[f"{room_num}".zfill(6)]
    
    # If found in CSV, update the room
    if csv_coords:
        existing_coords = room.coordinates or {}
        if not isinstance(existing_coords, dict):
            existing_coords = {}
        
        # Update with CSV coordinates, keeping width/height from SVG
        updated_coords = {
            'x': csv_coords.get('x', existing_coords.get('x', 0)),
            'y': csv_coords.get('y', existing_coords.get('y', 0)),
            'z': csv_coords.get('z', 0),  # Always update Z from CSV
            'width': existing_coords.get('width', 0),
            'height': existing_coords.get('height', 0),
        }
        
        # Only save if coordinates changed
        if updated_coords != existing_coords:
            room.coordinates = updated_coords
            room.save()
            updated_count += 1
            print(f"✓ Room {room.number:6} ({room.name:30}): Z = {updated_coords['z']}")
        
        if updated_coords.get('z'):
            rooms_with_z += 1
    else:
        if room.coordinates and room.coordinates.get('z'):
            rooms_with_z += 1
        else:
            rooms_without_z += 1

print("\n" + "=" * 80)
print(f"RESULTS:")
print(f"  Updated: {updated_count} rooms")
print(f"  Rooms with Z coordinate: {rooms_with_z}")
print(f"  Rooms without Z coordinate: {rooms_without_z}")
print("=" * 80)
