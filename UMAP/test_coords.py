#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMAP.settings')
django.setup()

from main.models import RoomProfile, Floor

# Get floor 9
floors = Floor.objects.filter(name__contains='9')
for floor in floors:
    print(f"\n=== Floor: {floor.name} ===")
    rooms = RoomProfile.objects.filter(room__floor=floor).order_by('id')[:5]
    for room in rooms:
        print(f"\nRoom {room.number} - {room.name}:")
        print(f"  Coordinates: {room.coordinates}")
        print(f"  Type: {type(room.coordinates)}")
        if isinstance(room.coordinates, dict):
            print(f"  X: {room.coordinates.get('x', 'MISSING')}")
            print(f"  Y: {room.coordinates.get('y', 'MISSING')}")
            print(f"  Z: {room.coordinates.get('z', 'MISSING')}")
