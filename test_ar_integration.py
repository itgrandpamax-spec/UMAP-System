#!/usr/bin/env python
"""
Test script to validate AR modal data integration
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMAP.settings')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'UMAP'))
django.setup()

from django.test import RequestFactory
from main.api_views import get_ar_rooms_data
import json

def test_ar_rooms_api():
    """Test the get_ar_rooms_data API endpoint"""
    print("=" * 60)
    print("Testing AR Rooms Data API")
    print("=" * 60)
    
    factory = RequestFactory()
    request = factory.get('/api/ar/rooms/')
    response = get_ar_rooms_data(request)
    
    # Parse response
    data = json.loads(response.content.decode('utf-8'))
    
    print(f"\n✓ API Response Status: {response.status_code}")
    print(f"✓ API Status: {data.get('status')}")
    print(f"✓ Total Rooms: {data.get('total_rooms')}")
    
    if data.get('rooms'):
        print(f"\n--- Sample Room Data (First 3 rooms) ---")
        for i, room in enumerate(data['rooms'][:3], 1):
            print(f"\n  Room {i}:")
            print(f"    ID: {room.get('id')}")
            print(f"    Number: {room.get('number')}")
            print(f"    Name: {room.get('name')}")
            print(f"    Type: {room.get('type')}")
            print(f"    Building: {room.get('building')}")
            print(f"    Floor: {room.get('floor')}")
            print(f"    X: {room.get('x')}")
            print(f"    Y: {room.get('y')}")
            print(f"    Z: {room.get('z')}")
            print(f"    Coordinates: {room.get('coordinates')}")
    
    # Validate data structure
    print(f"\n--- Data Validation ---")
    
    if data.get('status') != 'success':
        print("✗ FAIL: API status is not 'success'")
        return False
    
    if not data.get('rooms'):
        print("✗ FAIL: No rooms in response")
        return False
    
    if not isinstance(data['rooms'], list):
        print("✗ FAIL: Rooms is not a list")
        return False
    
    # Check first room structure
    first_room = data['rooms'][0]
    required_fields = ['id', 'number', 'name', 'type', 'building', 'floor', 'x', 'y', 'z', 'coordinates']
    
    for field in required_fields:
        if field not in first_room:
            print(f"✗ FAIL: Missing field '{field}' in room data")
            return False
    
    print("✓ All required fields present")
    
    # Check coordinate structure
    coords = first_room['coordinates']
    if not isinstance(coords, dict):
        print(f"✗ FAIL: Coordinates is not a dict, got {type(coords)}")
        return False
    
    coord_fields = ['x', 'y', 'z']
    for field in coord_fields:
        if field not in coords:
            print(f"✗ FAIL: Missing '{field}' in coordinates object")
            return False
        if not isinstance(coords[field], (int, float)):
            print(f"✗ FAIL: Coordinate '{field}' is not a number, got {type(coords[field])}")
            return False
    
    print("✓ Coordinates structure valid (all x, y, z are numbers)")
    
    # Check consistency between top-level and nested coordinates
    for field in coord_fields:
        if first_room[field] != coords[field]:
            print(f"✗ FAIL: Mismatch in {field}: {first_room[field]} vs {coords[field]}")
            return False
    
    print("✓ Top-level coordinates match nested structure")
    
    print("\n" + "=" * 60)
    print("✓ ALL TESTS PASSED!")
    print("=" * 60)
    return True

if __name__ == '__main__':
    success = test_ar_rooms_api()
    sys.exit(0 if success else 1)
