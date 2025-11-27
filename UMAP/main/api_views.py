from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from .models import Floor, Room, RoomProfile, SavedLocation, UserActivity
from .views import extract_floor_number


def get_building_data(request):
    """API endpoint to get building data for the interactive SVG map"""
    try:
        # Get unique buildings and their floors, sorted by floor number
        buildings_data = {}
        floors = sorted(Floor.objects.all(), key=lambda f: (f.building, extract_floor_number(f.name)))
        
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
                try:
                    if hasattr(room, 'profile') and room.profile:
                        room_data = {
                            'id': room.id,
                            'number': room.profile.number,
                            'name': room.profile.name,
                            'type': room.profile.type,
                            'description': room.profile.description or '',
                            'coordinates': room.profile.coordinates or {},
                            'floor': floor.name
                        }
                        buildings_data[floor.building]['rooms'].append(room_data)
                except Exception as room_error:
                    # Log room parsing errors but continue
                    print(f"Error processing room {room.id}: {str(room_error)}")
                    continue
        
        return JsonResponse({
            'status': 'success',
            'buildings': buildings_data
        })
        
    except Exception as e:
        import traceback
        print(f"Error in get_building_data: {str(e)}")
        print(traceback.format_exc())
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
            },
            'floor_id': room.floor.id
        }
        
        # Get image URL from RoomProfile.images
        image_url = None
        if room.profile.images:
            images = room.profile.get_images()
            if images:
                image_url = images[0]
            
        if image_url:
            room_data['image_url'] = image_url
        
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


@login_required
def save_location(request, room_id):
    """API endpoint to save a location for the user"""
    try:
        # Check if user is authenticated
        if not request.user.is_authenticated:
            return JsonResponse({
                'status': 'error',
                'message': 'Please login to save locations',
                'error': 'authentication required'
            }, status=401)
        
        room = Room.objects.get(id=room_id)
        
        # Create or get the saved location
        saved, created = SavedLocation.objects.get_or_create(
            user=request.user,
            room=room
        )
        
        return JsonResponse({
            'status': 'success',
            'message': 'Location saved successfully' if created else 'Location already saved',
            'saved': True,
            'room_id': room_id
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


@login_required
def remove_location(request, room_id):
    """API endpoint to remove a saved location for the user"""
    try:
        room = Room.objects.get(id=room_id)
        
        # Delete the saved location
        deleted_count, _ = SavedLocation.objects.filter(
            user=request.user,
            room=room
        ).delete()
        
        return JsonResponse({
            'status': 'success',
            'message': 'Location removed successfully' if deleted_count > 0 else 'Location was not saved',
            'saved': False,
            'room_id': room_id
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


@login_required
def check_saved_location(request, room_id):
    """API endpoint to check if a location is saved by the user"""
    try:
        room = Room.objects.get(id=room_id)
        
        is_saved = SavedLocation.objects.filter(
            user=request.user,
            room=room
        ).exists()
        
        return JsonResponse({
            'status': 'success',
            'is_saved': is_saved,
            'room_id': room_id
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

@login_required
def track_room_view(request, room_id):
    """Track when a user views a room"""
    try:
        print(f"\n=== TRACK_ROOM_VIEW ===")
        print(f"User: {request.user}")
        print(f"Room ID: {room_id}")
        print(f"User authenticated: {request.user.is_authenticated}")
        
        room = Room.objects.select_related('profile', 'floor').get(id=room_id)
        
        print(f"Room found: {room}")
        print(f"Room profile: {room.profile}")
        print(f"Room floor: {room.floor}")
        
        # Create activity log for room view
        activity = UserActivity.objects.create(
            user=request.user,
            activity_type=UserActivity.ActivityType.ROOM_VIEW,
            details={
                'room_id': room.id,
                'room_name': room.profile.name if room.profile else f'Room {room.id}',
                'building': room.floor.building,
                'floor': room.floor.name
            }
        )
        
        print(f"Activity created: {activity}")
        print(f"Activity ID: {activity.id}")
        print(f"=== END TRACK_ROOM_VIEW ===\n")
        
        return JsonResponse({
            'status': 'success',
            'message': 'Room view tracked',
            'activity_id': activity.id
        })
        
    except Room.DoesNotExist:
        print(f"ERROR: Room {room_id} not found")
        return JsonResponse({
            'status': 'error',
            'message': 'Room not found'
        }, status=404)
    except Exception as e:
        print(f"ERROR in track_room_view: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
def get_user_recent(request):
    """API endpoint to get authenticated user's recent locations"""
    try:
        from datetime import datetime, timedelta
        from django.utils.timesince import timesince
        
        print(f"\n=== GET_USER_RECENT ===")
        print(f"User: {request.user}")
        print(f"User ID: {request.user.id}")
        print(f"User authenticated: {request.user.is_authenticated}")
        
        # Get recent room and floor views for the user (last 10 unique places)
        all_activities = UserActivity.objects.filter(user=request.user).order_by('-timestamp')
        print(f"Total activities for user: {all_activities.count()}")
        
        recent_activities = UserActivity.objects.filter(
            user=request.user,
            activity_type__in=[UserActivity.ActivityType.ROOM_VIEW, UserActivity.ActivityType.FLOOR_VIEW]
        ).select_related('user').order_by('-timestamp')[:50]
        
        print(f"Found {recent_activities.count()} room/floor view activities")
        
        for activity in recent_activities[:5]:
            print(f"  Activity: {activity.id} - Type: {activity.activity_type} - Time: {activity.timestamp}")
        
        # Track unique rooms and floors to avoid duplicates
        seen_rooms = set()
        seen_floors = set()
        recent_places = []
        
        for activity in recent_activities:
            if len(recent_places) >= 10:
                break
                
            details = activity.details or {}
            print(f"Processing activity type: {activity.activity_type}, details: {details}")
            
            if activity.activity_type == UserActivity.ActivityType.ROOM_VIEW:
                room_id = details.get('room_id')
                print(f"  Room view - room_id: {room_id}")
                if room_id and room_id not in seen_rooms:
                    seen_rooms.add(room_id)
                    try:
                        room = Room.objects.select_related('floor', 'profile').prefetch_related('room_images').get(id=room_id)
                        print(f"    Room found: {room}")
                        
                        # Get image URL
                        image_url = None
                        if room.room_images.exists():
                            image_url = room.room_images.first().image.url
                        elif room.profile and room.profile.images:
                            image_url = room.profile.images.url
                        
                        print(f"    Image URL: {image_url}")
                        
                        recent_places.append({
                            'type': 'room',
                            'id': room.id,
                            'name': room.profile.name if room.profile else f'Room {room.id}',
                            'number': room.profile.number if room.profile else 'N/A',
                            'building': room.floor.building,
                            'floor': room.floor.name,
                            'floor_id': room.floor.id,
                            'description': room.profile.description if room.profile else '',
                            'image_url': image_url,
                            'time_ago': timesince(activity.timestamp) + ' ago'
                        })
                        print(f"    Added to recent_places (total: {len(recent_places)})")
                    except Room.DoesNotExist:
                        print(f"    ERROR: Room {room_id} not found")
                        pass
                        
            elif activity.activity_type == UserActivity.ActivityType.FLOOR_VIEW:
                floor_id = details.get('floor_id')
                print(f"  Floor view - floor_id: {floor_id}")
                if floor_id and floor_id not in seen_floors:
                    seen_floors.add(floor_id)
                    try:
                        floor = Floor.objects.get(id=floor_id)
                        recent_places.append({
                            'type': 'floor',
                            'id': floor.id,
                            'name': floor.name,
                            'building': floor.building,
                            'room_count': floor.rooms.count(),
                            'time_ago': timesince(activity.timestamp) + ' ago'
                        })
                        print(f"    Added floor {floor_id} to recent_places")
                    except Floor.DoesNotExist:
                        print(f"    ERROR: Floor {floor_id} not found")
                        pass
        
        print(f"Returning {len(recent_places)} recent places")
        print(f"=== END GET_USER_RECENT ===\n")
        
        return JsonResponse({
            'status': 'success',
            'recent_places': recent_places,
            'total_recent': len(recent_places)
        })
        
    except Exception as e:
        print(f"ERROR in get_user_recent: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"=== END GET_USER_RECENT (ERROR) ===\n")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)