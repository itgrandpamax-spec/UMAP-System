from django.http import JsonResponse
from .models import Floor, Room, RoomProfile

def get_building_data(request):
    """API endpoint to get building data for the interactive SVG map"""
    try:
        # Get unique buildings and their floors
        buildings_data = {}
        floors = Floor.objects.all()
        
        for floor in floors:
            if floor.building not in buildings_data:
                buildings_data[floor.building] = {
                    'name': floor.building,
                    'floors': [],
                    'rooms': []
                }
            
            # Add floor info
            buildings_data[floor.building]['floors'].append({
                'id': floor.id,
                'name': floor.name
            })
            
            # Add rooms for this floor
            rooms = Room.objects.filter(floor=floor).select_related('profile')
            for room in rooms:
                if hasattr(room, 'profile'):
                    room_data = {
                        'id': room.id,
                        'number': room.profile.number,
                        'name': room.profile.name,
                        'type': room.profile.type,
                        'coordinates': room.profile.coordinates,
                        'floor': floor.name
                    }
                    buildings_data[floor.building]['rooms'].append(room_data)
        
        return JsonResponse({
            'status': 'success',
            'buildings': buildings_data
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

def get_room_details(request, room_id):
    """API endpoint to get detailed information about a specific room"""
    try:
        room = Room.objects.select_related('profile', 'floor').get(id=room_id)
        
        if not hasattr(room, 'profile'):
            return JsonResponse({
                'status': 'error',
                'message': 'Room profile not found'
            }, status=404)
        
        room_data = {
            'id': room.id,
            'number': room.profile.number,
            'name': room.profile.name,
            'type': room.profile.type,
            'description': room.profile.description,
            'floor': {
                'id': room.floor.id,
                'name': room.floor.name,
                'building': room.floor.building
            }
        }
        
        if room.profile.images:
            room_data['image_url'] = room.profile.images.url
            
        return JsonResponse({
            'status': 'success',
            'room': room_data
        })
        
    except Room.DoesNotExist:
        return JsonResponse({
            'status': 'error',
            'message': 'Room not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)