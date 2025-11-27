from django.contrib import messages
from django.shortcuts import redirect, render, get_object_or_404
from django.urls import reverse
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.decorators import login_required, user_passes_test
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator
from django.db.models import Q
from .forms import (
    UserRegistrationForm, FloorForm, RoomForm, RoomProfileForm,
    AdminUserForm, AdminProfileForm, UserProfileForm
)
from .models import User, Floor, Room, RoomProfile, Profile, Schedule, UserActivity, Feedback, SavedLocation

def is_admin(user):
    return user.is_staff or user.is_superuser

def extract_floor_number(floor_name: str) -> int:
    """
    Extract floor number from floor name.
    Handles formats like "9th Floor", "10th Floor", "1st Floor", etc.
    
    Args:
        floor_name: Floor name (e.g., "9th Floor", "10th Floor")
    
    Returns:
        Floor number as integer (e.g., 9, 10)
    """
    import re
    if not floor_name or not isinstance(floor_name, str):
        return 1
    
    match = re.search(r'(\d+)(?:st|nd|rd|th)?', floor_name)
    if match:
        try:
            return int(match.group(1))
        except (ValueError, IndexError):
            return 1
    return 1

def extract_room_number(room_id: str, floor_number: int) -> str:
    """
    Extract room number from SVG room ID based on floor number.
    
    Format: {BUILDING_ID}{FLOOR_ID}{ROOM_NUMBER}
    Building ID: "10" (always 2 digits for HPSB)
    
    For floors 1-9 (single-digit floor):
        Floor ID: Single digit (1-9)
        Room Number: Last 3 digits
        Example: 10912 → Building=10, Floor=9, Room=912
    
    For floors 10-12 (two-digit floor):
        Floor ID: Two digits (10, 11, 12)
        Room Number: Last 4 digits
        Example: 101030 → Building=10, Floor=10, Room=1030
        Example: 101001 → Building=10, Floor=10, Room=1001
    
    Args:
        room_id: Full SVG element ID (e.g., "10912", "101030")
        floor_number: Floor number (1-12)
    
    Returns:
        Extracted room number as string (e.g., "912", "1030")
    """
    if not room_id or not isinstance(room_id, str):
        return room_id
    
    room_id = room_id.strip()
    
    if floor_number <= 9:
        # Single-digit floor: extract last 3 digits
        # Format: 10FNN → get last 3 digits
        if len(room_id) >= 3:
            room_number = room_id[-3:]  # Last 3 digits
            return room_number.lstrip('0') or '0'  # Remove leading zeros, keep at least "0"
        else:
            return room_id
    else:
        # Two-digit floor (10-12): extract last 4 digits
        # Format: 10FFNN → get last 4 digits
        if len(room_id) >= 4:
            room_number = room_id[-4:]  # Last 4 digits
            return room_number.lstrip('0') or '0'  # Remove leading zeros, keep at least "0"
        else:
            return room_id

def track_activity(user, activity_type, details=None, request=None):
    """
    Utility function to track user activities
    """
    if details is None:
        details = {}
        
    activity = UserActivity(
        user=user,
        activity_type=activity_type,
        details=details
    )
    
    if request:
        activity.ip_address = request.META.get('REMOTE_ADDR')
        
    activity.save()

def default_view(request):
    # Check if user is authenticated and is admin/superuser
    if request.user.is_authenticated:
        if request.user.is_staff or request.user.is_superuser:
            # Redirect admin users to admin main
            return redirect('admin_main_view')
        
        # For regular users, show their schedule and rooms
        user_schedules = Schedule.objects.filter(user=request.user).select_related('room__floor')
        context = {
            'user_schedules': user_schedules,
            'recent_rooms': Room.objects.filter(
                schedules__user=request.user
            ).distinct()[:5]
        }
        return render(request, 'UMAP_App/Users/Users_main.html', context)
    
    # Get show_login flag from session
    show_login = request.session.pop('show_login', False)
    show_signup = request.session.pop('show_signup', False)
    logged_out_from_another_device = request.session.pop('logged_out_from_another_device', False)
    
    # Create an empty form for the template context
    context = {
        'show_login': show_login or logged_out_from_another_device,  # Also show login if logged out from another device
        'show_signup': show_signup,
        'form': {'username': {'value': ''}, 'errors': {}}  # Empty form with required structure
    }
    
    # If not authenticated, render main page with login form
    return render(request, 'UMAP_App/Users/Users_main.html', context)

def users_mainzoomed_view(request):
    """Zoomed map view with interactive building features."""
    context = {}
    if request.user.is_authenticated:
        # Get user's schedule and relevant rooms
        user_schedules = Schedule.objects.filter(user=request.user).select_related('room__floor')
        context.update({
            'user_schedules': user_schedules,
            'recent_rooms': Room.objects.filter(
                schedules__user=request.user
            ).distinct()[:5]
        })
    return render(request, 'UMAP_App/Users/Users_mainzoomed.html', context)

def logout_view(request):
    if request.user.is_authenticated:
        track_activity(request.user, UserActivity.ActivityType.LOGOUT, request=request)
    auth_logout(request)
    return redirect('default_view')

def signup_view(request):
    if request.method == 'POST':
        post_data = request.POST.copy()  # Make a mutable copy
        # Set user type to regular by default for security
        post_data['type'] = 'regular'
        form = UserRegistrationForm(post_data)
        if form.is_valid():
            try:
                user = form.save()
                # Track user creation with detailed information
                details = {
                    'username': user.username,
                    'email': user.email,
                    'full_name': f"{user.first_name} {user.last_name}".strip() or 'Not provided',
                    'type': 'Regular User',
                    'action': 'Account Created'
                }
                track_activity(user, UserActivity.ActivityType.USER_CREATE, 
                             details=details,
                             request=request)
                messages.success(request, 'Registration successful. Please login.')
                # Automatically log the user in after successful registration
                auth_login(request, user)
                return redirect('user_main_view')
            except Exception as e:
                messages.error(request, str(e))
                request.session['show_signup'] = True
        else:
            # Get all error messages
            error_message = '; '.join([f"{field}: {error[0]}" for field, error in form.errors.items()])
            messages.error(request, f'Registration failed: {error_message}')
            request.session['show_signup'] = True
    # In case of GET request or failed POST, redirect to the better-designed login page
    return redirect('default_view')

@login_required
@user_passes_test(is_admin)
def admin_user_list_view(request):
    from django.utils import timezone
    from datetime import timedelta
    from django.db.models import Q
    
    # Get filter parameters from query string
    search_query = request.GET.get('search', '').strip()
    role_filter = request.GET.get('role', '').strip()
    status_filter = request.GET.get('status', '').strip()
    
    # Start with all users
    users = User.objects.all().select_related('profile').order_by('id')
    
    # Apply search filter
    if search_query:
        users = users.filter(
            Q(username__icontains=search_query) |
            Q(email__icontains=search_query) |
            Q(first_name__icontains=search_query) |
            Q(last_name__icontains=search_query)
        )
    
    # Apply role filter
    if role_filter == 'admin':
        users = users.filter(Q(is_superuser=True) | Q(is_staff=True))
    elif role_filter == 'regular':
        users = users.filter(is_superuser=False, is_staff=False)
    
    # Apply status filter
    if status_filter == 'active':
        users = users.filter(is_active=True)
    elif status_filter == 'inactive':
        users = users.filter(is_active=False)
    
    # Get total and active users for stats (before pagination)
    total_users = User.objects.all().count()
    active_users = User.objects.filter(is_active=True).count()
    
    # Calculate new users this week
    today = timezone.now()
    week_ago = today - timedelta(days=7)
    new_users_count = User.objects.filter(
        date_joined__gte=week_ago
    ).count()
    
    # Paginate results
    paginator = Paginator(users, 5)  # 5 users per page
    page = request.GET.get('page', 1)
    users_page = paginator.get_page(page)
    
    return render(request, 'UMAP_App/Admin/Admin_User_List.html', {
        'users': users_page,
        'total_users': total_users,
        'active_users': active_users,
        'new_users_count': new_users_count,
        'search_query': search_query,
        'role_filter': role_filter,
        'status_filter': status_filter
    })

@login_required
@user_passes_test(is_admin)
def admin_profile_view(request):
    try:
        # Ensure profile exists or create one
        profile, created = Profile.objects.get_or_create(
            user=request.user,
            defaults={
                'email': request.user.email,
                'department': 'IT',  # Default department
                'year_level': 1      # Default year
            }
        )

        if request.method == 'POST':
            # Handle old profile picture deletion if new one is uploaded
            old_picture = None
            if profile.profile_pic and request.FILES.get('profile_pic'):
                old_picture = profile.profile_pic

            # Update user fields (name only - email is read-only for regular users)
            request.user.first_name = request.POST.get('first_name', '')
            request.user.last_name = request.POST.get('last_name', '')
            request.user.save()

            # Update profile fields (student_id is read-only for regular users)
            profile.department = request.POST.get('department', '')
            profile.year_level = request.POST.get('year_level', 1)
            profile.description = request.POST.get('description', '')

            # Handle profile picture upload
            if request.FILES.get('profile_pic'):
                # Validate file type
                allowed_types = ['image/jpeg', 'image/png', 'image/gif']
                uploaded_file = request.FILES['profile_pic']
                
                if uploaded_file.content_type not in allowed_types:
                    messages.error(request, 'Please upload a valid image file (JPEG, PNG, or GIF)')
                    return redirect('admin_profile_view')
                
                if uploaded_file.size > 25 * 1024 * 1024:  # 25MB limit
                    messages.error(request, 'File size must be no more than 25MB')
                    return redirect('admin_profile_view')
                
                profile.profile_pic = uploaded_file

            try:
                profile.save()
                
                # Delete old profile picture file if it was replaced
                if old_picture:
                    import os
                    if os.path.isfile(old_picture.path):
                        os.remove(old_picture.path)
                
                messages.success(request, 'Profile updated successfully!')
            except Exception as e:
                messages.error(request, f'Error saving profile: {str(e)}')
            
            return redirect('admin_profile_view')
        
        return render(request, 'UMAP_App/Admin/Admin_Profile.html', {'profile': profile})

    except Exception as e:
        messages.error(request, f'Error accessing profile: {str(e)}')
        return redirect('admin_main_view')

@login_required
@user_passes_test(is_admin)
def admin_floor_list_view(request):
    from django.db.models import Count
    
    # Fetch floors with room count annotation for efficiency
    floors = Floor.objects.annotate(
        room_count=Count('rooms')
    ).order_by('building')
    
    # Get unique buildings, ordered
    buildings = list(floors.values_list('building', flat=True).distinct().order_by('building'))
    
    # Calculate building statistics - avoid duplicates by using a dict
    building_stats_dict = {}
    for building_name in buildings:
        if building_name not in building_stats_dict:
            building_floors = floors.filter(building=building_name)
            floor_count = building_floors.count()
            room_count = building_floors.aggregate(total=Count('rooms'))['total']
            
            building_stats_dict[building_name] = {
                'name': building_name,
                'floors': floor_count,
                'rooms': room_count
            }
    
    building_stats = list(building_stats_dict.values())
    
    # Sort floors by floor number (lowest to highest) for display
    floors_sorted = sorted(floors, key=lambda f: (f.building, extract_floor_number(f.name)))
    
    context = {
        'floors': floors_sorted,
        'buildings': buildings,
        'building_stats': building_stats,
        'total_floors': len(floors_sorted),
        'total_rooms': Room.objects.count(),
        'total_buildings': len(building_stats)
    }
    return render(request, 'UMAP_App/Admin/Admin_Floor_List.html', context)

@login_required
@user_passes_test(is_admin)
def admin_rooms_list_view(request):
    rooms = Room.objects.select_related('floor', 'profile').all().order_by('-id')
    floor_id = request.GET.get('floor')
    building = request.GET.get('building')
    search_query = request.GET.get('search', '').strip()
    selected_floor = None
    selected_building = building  # Track the selected building
    
    # If a floor is selected, extract the building from it
    if floor_id:
        try:
            selected_floor = Floor.objects.get(id=floor_id)
            # If no building was explicitly selected, use the one from the floor
            if not building:
                building = selected_floor.building
                selected_building = building
        except Floor.DoesNotExist:
            selected_floor = None
    
    # Filter by building
    if building:
        rooms = rooms.filter(floor__building=building)
    
    # Filter by floor
    if floor_id:
        rooms = rooms.filter(floor_id=floor_id)
    
    # Search in room name, number, and description
    if search_query:
        rooms = rooms.filter(
            Q(profile__name__icontains=search_query) |
            Q(profile__number__icontains=search_query) |
            Q(profile__description__icontains=search_query)
        )
    
    # Pagination
    paginator = Paginator(rooms, 10)  # Show 10 rooms per page
    page_number = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_number)
    
    # Get all unique buildings
    buildings = Floor.objects.values_list('building', flat=True).distinct().order_by('building')
    
    # Get floors, optionally filtered by building
    floors_qs = Floor.objects.all()
    if building:
        floors_qs = floors_qs.filter(building=building)
    
    # Sort floors by floor number (lowest to highest)
    floors_qs = sorted(floors_qs, key=lambda f: (f.building, extract_floor_number(f.name)))
    
    context = {
        'rooms': page_obj.object_list,
        'page_obj': page_obj,
        'is_paginated': page_obj.has_other_pages(),
        'floors': floors_qs,
        'buildings': buildings,
        'selected_floor': selected_floor,
        'selected_building': selected_building,
        'search_query': search_query,
        'total_rooms': rooms.count()
    }
    return render(request, 'UMAP_App/Admin/Admin_Rooms.html', context)

@login_required
@user_passes_test(is_admin)
def admin_CRUD_Users_view(request):
    if request.method == "POST":
        user_id = request.POST.get('user_id')
        if user_id:
            user = get_object_or_404(User, id=user_id)
            user_form = AdminUserForm(request.POST, instance=user)
            profile_form = AdminProfileForm(request.POST, request.FILES, instance=user.profile)
        else:
            user_form = AdminUserForm(request.POST)
            profile_form = AdminProfileForm(request.POST, request.FILES)

        if user_form.is_valid() and profile_form.is_valid():
            user = user_form.save()
            profile = profile_form.save(commit=False)
            profile.user = user
            profile.save()
            messages.success(request, 'User updated successfully.')
            return redirect('admin_user_list')
    else:
        user_id = request.GET.get('user_id')
        if user_id:
            user = get_object_or_404(User, id=user_id)
            user_form = AdminUserForm(instance=user)
            profile_form = AdminProfileForm(instance=user.profile)
        else:
            user_form = AdminUserForm()
            profile_form = AdminProfileForm()

    context = {
        'user_form': user_form,
        'profile_form': profile_form,
        'users': User.objects.select_related('profile').all()
    }
    return render(request, 'UMAP_App/Admin/Admin_CRUD_Users.html', context)

@login_required
@user_passes_test(is_admin)
@login_required
@user_passes_test(is_admin)
def create_rooms_from_floor_svg(request, floor_id):
    """Manually create rooms from an existing floor's SVG file"""
    from .svg_parser import SVGParser
    import tempfile
    import os
    from django.http import JsonResponse
    
    try:
        floor = Floor.objects.get(id=floor_id)
        
        if not floor.floorplan_svg:
            return JsonResponse({
                'success': False,
                'message': 'No SVG file found for this floor'
            }, status=400)
        
        # Parse SVG to extract rooms
        try:
            parser = SVGParser(floor.floorplan_svg.path)
            rooms = parser.extract_rooms()
            
            created_count = 0
            skipped_count = 0
            
            # Create Room and RoomProfile for each extracted room
            for svg_room in rooms:
                # Check if room already exists
                existing_room = Room.objects.filter(
                    floor=floor,
                    profile__number=svg_room.room_id
                ).exists()
                
                if existing_room:
                    skipped_count += 1
                    continue
                
                try:
                    # Create Room instance
                    room = Room.objects.create(floor=floor)
                    
                    # Extract correct room number based on floor number
                    floor_number = parser.floor_number or extract_floor_number(floor.name)
                    room_number = extract_room_number(svg_room.room_id, floor_number)
                    
                    # Determine room name: use CSV name > room type > default
                    if svg_room.room_name:
                        # Use name from CSV reference
                        room_name = svg_room.room_name
                        room_type = svg_room.room_type or "Classroom"
                    elif svg_room.room_type:
                        # Use room type if no CSV name available
                        room_name = svg_room.room_type
                        room_type = svg_room.room_type
                    else:
                        # Default fallback
                        room_name = f"Room {room_number}"
                        room_type = "Classroom"
                    
                    # Create RoomProfile with extracted room number
                    room_profile = RoomProfile.objects.create(
                        room=room,
                        number=room_number,
                        name=room_name,
                        description=f"Color: {svg_room.color}" if svg_room.color else "",
                        type=room_type,
                        coordinates={
                            'x': svg_room.x,
                            'y': svg_room.y,
                            'width': svg_room.width,
                            'height': svg_room.height
                        }
                    )
                    created_count += 1
                except Exception as e:
                    print(f"Error creating room {svg_room.room_id}: {str(e)}")
                    skipped_count += 1
            
            if created_count > 0:
                return JsonResponse({
                    'success': True,
                    'message': f'Successfully created {created_count} rooms from SVG',
                    'created': created_count,
                    'skipped': skipped_count
                })
            else:
                return JsonResponse({
                    'success': True,
                    'message': f'No new rooms created ({skipped_count} already existed)',
                    'created': 0,
                    'skipped': skipped_count
                })
        
        except Exception as e:
            import traceback
            error_msg = f'SVG parsing error: {str(e)}'
            print(f"[SVG Parse Error] {error_msg}\n{traceback.format_exc()}")
            return JsonResponse({
                'success': False,
                'message': error_msg
            }, status=400)
    
    except Floor.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Floor not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Error: {str(e)}'
        }, status=500)

def admin_CRUD_Floors_view(request):
    from .svg_parser import SVGParser
    import tempfile
    import os
    
    if request.method == "POST":
        floor_id = request.POST.get('floor_id')
        if floor_id:
            floor = get_object_or_404(Floor, id=floor_id)
            form = FloorForm(request.POST, request.FILES, instance=floor)
        else:
            form = FloorForm(request.POST, request.FILES)

        if form.is_valid():
            # Save the form with the model file, csv file, and floorplan SVG
            floor = form.save()
            
            # Handle the model file if it's provided
            model_file = request.FILES.get('model_file')
            if model_file:
                floor.model_file = model_file
                floor.save()
            
            # Handle the CSV file if it's provided
            csv_file = request.FILES.get('csv_file')
            if csv_file:
                floor.csv_file = csv_file
                floor.save()
            
            # Handle the floorplan SVG file if it's provided
            floorplan_svg = request.FILES.get('floorplan_svg')
            if floorplan_svg:
                floor.floorplan_svg = floorplan_svg
                floor.save()
                
                # Parse SVG and auto-create rooms
                # Check if checkbox is in POST data (unchecked checkboxes don't appear in POST)
                auto_create_rooms = 'auto_create_rooms' in request.POST
                print(f"[Floor Creation] auto_create_rooms checkbox: {auto_create_rooms}, POST data: {request.POST.get('auto_create_rooms')}")
                if auto_create_rooms:
                    try:
                        # Save SVG to temporary file for parsing
                        with tempfile.NamedTemporaryFile(suffix='.svg', delete=False) as tmp_file:
                            for chunk in floorplan_svg.chunks():
                                tmp_file.write(chunk)
                            tmp_path = tmp_file.name
                        
                        try:
                            # Parse SVG to extract rooms
                            # Extract floor number for parser (needed for temp files that don't have HPSB# in name)
                            floor_number = extract_floor_number(floor.name)
                            parser = SVGParser(tmp_path, floor_number=floor_number, building_id='10')
                            rooms = parser.extract_rooms()
                            
                            created_count = 0
                            skipped_count = 0
                            
                            # Create Room and RoomProfile for each extracted room
                            for svg_room in rooms:
                                # Check if room already exists
                                existing_room = Room.objects.filter(
                                    floor=floor,
                                    profile__number=svg_room.room_id
                                ).exists()
                                
                                if existing_room:
                                    skipped_count += 1
                                    continue
                                
                                try:
                                    # Create Room instance
                                    room = Room.objects.create(floor=floor)
                                    
                                    # Extract correct room number based on floor number
                                    floor_number = parser.floor_number or extract_floor_number(floor.name)
                                    room_number = extract_room_number(svg_room.room_id, floor_number)
                                    
                                    # Determine room name: use CSV name > room type > default
                                    if svg_room.room_name:
                                        # Use name from CSV reference
                                        room_name = svg_room.room_name
                                        room_type = svg_room.room_type or "Classroom"
                                    elif svg_room.room_type:
                                        # Use room type if no CSV name available
                                        room_name = svg_room.room_type
                                        room_type = svg_room.room_type
                                    else:
                                        # Default fallback
                                        room_name = f"Room {room_number}"
                                        room_type = "Classroom"
                                    
                                    # Create RoomProfile with extracted room number
                                    room_profile = RoomProfile.objects.create(
                                        room=room,
                                        number=room_number,
                                        name=room_name,
                                        description=f"Color: {svg_room.color}" if svg_room.color else "",
                                        type=room_type,
                                        coordinates={
                                            'x': svg_room.x,
                                            'y': svg_room.y,
                                            'width': svg_room.width,
                                            'height': svg_room.height
                                        }
                                    )
                                    created_count += 1
                                except Exception as e:
                                    print(f"Error creating room {svg_room.room_id}: {str(e)}")
                                    skipped_count += 1
                            
                            if created_count > 0:
                                messages.success(request, f'✅ Floor saved successfully! Created {created_count} rooms from SVG.')
                                # Redirect to rooms list with floor pre-selected to show created rooms
                                return redirect(f"{reverse('admin_rooms_list')}?floor={floor.id}")
                            else:
                                messages.info(request, f'Floor saved. {skipped_count} rooms already existed (not duplicated).')
                        finally:
                            # Clean up temporary file
                            try:
                                os.unlink(tmp_path)
                            except:
                                pass
                    except Exception as e:
                        import traceback
                        error_msg = f'SVG parsing error: {str(e)}'
                        print(f"[SVG Parse Error] {error_msg}\n{traceback.format_exc()}")
                        messages.error(request, f'Floor saved but SVG parsing failed: {error_msg}')
                        return redirect('admin_floor_list')
            else:
                # No SVG file provided or auto_create_rooms not enabled
                if floorplan_svg and auto_create_rooms:
                    # This shouldn't happen, but just in case
                    messages.warning(request, 'Floor saved. SVG file provided but rooms were not auto-created.')
                else:
                    messages.success(request, 'Floor saved successfully.')
            
            return redirect('admin_floor_list')
        else:
            messages.error(request, 'Error saving floor: ' + str(form.errors))
    else:
        floor_id = request.GET.get('floor_id')
        if floor_id:
            floor = get_object_or_404(Floor, id=floor_id)
            form = FloorForm(instance=floor)
        else:
            form = FloorForm()
        
        # If parsing SVG for preview (AJAX request)
        if request.method == "GET" and request.GET.get('preview_svg'):
            from django.http import JsonResponse
            floor_id = request.GET.get('preview_svg')
            floor = get_object_or_404(Floor, id=floor_id)
            
            if floor.floorplan_svg:
                try:
                    parser = SVGParser(floor.floorplan_svg.path)
                    rooms = parser.extract_rooms()
                    return JsonResponse({
                        'success': True,
                        'room_count': len(rooms),
                        'rooms': [room.to_dict() for room in rooms]
                    })
                except Exception as e:
                    return JsonResponse({
                        'success': False,
                        'error': str(e)
                    })
            return JsonResponse({'success': False, 'error': 'No SVG file'})

    context = {
        'form': form,
        'floors': sorted(Floor.objects.all(), key=lambda f: (f.building, extract_floor_number(f.name)))
    }
    return render(request, 'UMAP_App/Admin/Admin_CRUD_Floors.html', context)

@login_required
@user_passes_test(is_admin)
def admin_CRUD_Rooms_view(request):
    if request.method == "POST":
        room_id = request.POST.get('room_id')
        if room_id:
            room = get_object_or_404(Room, id=room_id)
            room_form = RoomForm(request.POST, instance=room)
            profile_form = RoomProfileForm(request.POST, request.FILES, instance=room.profile)
        else:
            room_form = RoomForm(request.POST)
            profile_form = RoomProfileForm(request.POST, request.FILES)

        if room_form.is_valid() and profile_form.is_valid():
            room = room_form.save()
            profile = profile_form.save(commit=False)
            profile.room = room
            profile.save()
            
            # Handle multiple photo uploads
            photos = request.FILES.getlist('photos')
            if photos and profile:
                image_urls = []
                for photo in photos:
                    if photo:  # Only save if file was selected
                        # Save photo to profile's media folder
                        profile.images = profile.images if isinstance(profile.images, list) else []
                        # In a real scenario, you'd save the file and add its URL
                        # For now, we'll add it to the images list
                        profile.add_image(photo.url if hasattr(photo, 'url') else str(photo))
            
            messages.success(request, 'Room saved successfully.')
            return redirect('admin_rooms_list')
    else:
        room_id = request.GET.get('room_id')
        if room_id:
            room = get_object_or_404(Room, id=room_id)
            room_form = RoomForm(instance=room)
            profile_form = RoomProfileForm(instance=room.profile)
        else:
            room_form = RoomForm()
            profile_form = RoomProfileForm()

    context = {
        'room_form': room_form,
        'profile_form': profile_form,
        'rooms': Room.objects.select_related('floor', 'profile').all().order_by('floor__building', 'floor__name')
    }
    return render(request, 'UMAP_App/Admin/Admin_CRUD_Rooms.html', context)

def login_view(request):
    """Handle GET (show form) and POST (authenticate) for login."""
    if request.user.is_authenticated:
        if request.user.is_superuser or request.user.is_staff:
            return redirect('admin_main_view')
        else:
            return redirect('user_main_view')

    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")
        print(f"Login attempt for user: {username}") # Debugging line
        
        if not username or not password:
            messages.error(request, "Please enter both username and password.")
            request.session['show_login'] = True
            return redirect('login')
        
        try:
            # First try to authenticate with username
            user = authenticate(request, username=username, password=password)
            
            # If that fails, try with email
            if user is None:
                try:
                    user_obj = User.objects.get(email=username)
                    user = authenticate(request, username=user_obj.username, password=password)
                except User.DoesNotExist:
                    user = None
            
            if user is not None:
                if not user.is_active:
                    messages.error(request, "Your account has been deactivated. Please contact our administrator for assistance.")
                    request.session['show_login'] = True
                    return redirect('login')
                
                # Log the user in
                auth_login(request, user)
                track_activity(user, UserActivity.ActivityType.LOGIN, request=request)
                messages.success(request, f"Welcome back, {user.first_name if user.first_name else user.username}!")
                
                # Clear preserved username after successful login
                if 'preserved_username' in request.session:
                    del request.session['preserved_username']
                
                if user.is_superuser or user.is_staff:
                    return redirect('admin_main_view')
                else:
                    return redirect('user_main_view')
            else:
                # Check if user exists to give appropriate error message
                user_exists = User.objects.filter(username=username).exists() or \
                            User.objects.filter(email=username).exists()
                
                if user_exists:
                    messages.error(request, "Invalid password. Please try again.")
                else:
                    messages.error(request, "This account does not exist. Please check your username/email or sign up.")
                
                request.session['show_login'] = True
                return redirect('login')
                
        except Exception as e:
            print(f"Login error: {str(e)}") # Debugging line
            messages.error(request, "An error occurred during login. Please try again.")
            request.session['show_login'] = True
            return redirect('login')

    # For GET requests, show the login page
    return redirect('default_view')

@login_required
def admin_main_view(request):
    if not request.user.is_staff and not request.user.is_superuser:
        messages.error(request, "You are not authorized to access the admin page.")
        return redirect('login')
    
    # Get statistics for dashboard
    total_users = User.objects.count()
    total_rooms = Room.objects.count()
    total_floors = Floor.objects.count()
    
    # Get all activities, feedback, and saved locations
    from django.utils import timezone
    from datetime import timedelta
    activities = UserActivity.objects.select_related('user').all().order_by('-timestamp')
    feedbacks = Feedback.objects.select_related('user', 'room').all().order_by('-creation_date')
    saved_locations = SavedLocation.objects.select_related('user', 'room').all().order_by('-saved_date')
    
    # Combine activities, feedbacks, and saved locations
    combined_items = []
    for activity in activities:
        combined_items.append({
            'type': 'activity',
            'item': activity,
            'timestamp': activity.timestamp,
            'user': activity.user
        })
    for feedback in feedbacks:
        combined_items.append({
            'type': 'feedback',
            'item': feedback,
            'timestamp': feedback.creation_date,
            'user': feedback.user
        })
    for saved_location in saved_locations:
        combined_items.append({
            'type': 'saved_location',
            'item': saved_location,
            'timestamp': saved_location.saved_date,
            'user': saved_location.user
        })
    
    # Sort combined items by timestamp (most recent first)
    combined_items.sort(key=lambda x: x['timestamp'], reverse=True)
    
    # Paginate combined items
    paginator = Paginator(combined_items, 10)  # Show 10 items per page
    page = request.GET.get('page', 1)
    recent_activities = paginator.get_page(page)
    
    context = {
        'total_users': total_users,
        'total_rooms': total_rooms,
        'total_floors': total_floors,
        'recent_activities': recent_activities
    }
    
    return render(request, 'UMAP_App/Admin/Admin_main.html', context)

@login_required
def user_main_view(request):
    response = redirect('default_view')
    # Add cache control headers to force a fresh page load
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    return response

@login_required
def user_profile_view(request):
    try:
        # Ensure profile exists or create one
        profile, created = Profile.objects.get_or_create(
            user=request.user,
            defaults={
                'email': request.user.email,
                'department': 'IT',  # Default department
                'year_level': 1      # Default year
            }
        )

        if request.method == 'POST':
            # Handle old profile picture deletion if new one is uploaded
            old_picture = None
            if profile.profile_pic and request.FILES.get('profile_pic'):
                old_picture = profile.profile_pic

            # Update user fields (name only - email is permanent for security)
            request.user.first_name = request.POST.get('first_name', '')
            request.user.last_name = request.POST.get('last_name', '')
            # NOTE: Email is NOT updated from POST data - it's permanent unless changed by admin
            request.user.save()

            # Update profile fields (email and student_id are permanent for security)
            # These can only be changed by admins in the admin panel
            profile.department = request.POST.get('department', '')
            profile.year_level = request.POST.get('year_level', 1)
            profile.description = request.POST.get('description', '')

            # Handle profile picture upload
            if request.FILES.get('profile_pic'):
                # Validate file type
                allowed_types = ['image/jpeg', 'image/png', 'image/gif']
                uploaded_file = request.FILES['profile_pic']
                
                if uploaded_file.content_type not in allowed_types:
                    messages.error(request, 'Please upload a valid image file (JPEG, PNG, or GIF)')
                    return redirect('user_profile')
                
                if uploaded_file.size > 25 * 1024 * 1024:  # 10MB limit
                    messages.error(request, 'File size must be no more than 25MB')
                    return redirect('user_profile')
                
                profile.profile_pic = uploaded_file
                # Track profile picture update
                details = {
                    'action': 'Profile Picture Updated',
                    'file_name': uploaded_file.name,
                    'file_type': uploaded_file.content_type,
                    'file_size': f"{uploaded_file.size / 1024:.2f} KB"
                }
                track_activity(request.user, UserActivity.ActivityType.USER_MODIFY, 
                             details=details, request=request)

            try:
                profile.save()
                
                # Delete old profile picture file if it was replaced
                if old_picture:
                    import os
                    if os.path.isfile(old_picture.path):
                        os.remove(old_picture.path)
                
                messages.success(request, 'Profile updated successfully!')
            except Exception as e:
                messages.error(request, f'Error saving profile: {str(e)}')
            
            return redirect('user_profile')
        
        return render(request, 'UMAP_App/Users/Users_Profile.html')

    except Exception as e:
        messages.error(request, f'Error accessing profile: {str(e)}')
        return redirect('default_view')

# AJAX Utility Views
@login_required
@require_http_methods(["POST"])
def delete_item(request, model_name, item_id):
    """Generic delete view for admin CRUD operations"""
    model_map = {
        'user': User,
        'floor': Floor,
        'room': Room
    }
    
    activity_type_map = {
        'user': UserActivity.ActivityType.USER_DELETE,
        'floor': UserActivity.ActivityType.FLOOR_DELETE,
        'room': UserActivity.ActivityType.ROOM_DELETE
    }
    
    if not request.user.is_staff and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Unauthorized'}, status=403)
        
    model = model_map.get(model_name)
    if not model:
        return JsonResponse({'status': 'error', 'message': 'Invalid model'}, status=400)
        
    try:
        item = model.objects.get(id=item_id)
        details = {}
        
        # Collect relevant details before deletion
        if model_name == 'user':
            details = {
                'action': 'Account Deleted',
                'username': item.username,
                'email': item.email,
                'full_name': item.display_name(),
                'type': 'Superuser' if item.is_superuser else 'Admin' if item.is_staff else 'Regular User',
                'account_status': 'Active' if item.is_active else 'Inactive',
                'deleted_by': request.user.username
            }
        elif model_name == 'floor':
            details = {
                'name': item.name,
                'building': item.building
            }
        elif model_name == 'room':
            details = {
                'number': item.profile.number if hasattr(item, 'profile') else '',
                'name': item.profile.name if hasattr(item, 'profile') else '',
                'floor': item.floor.name if item.floor else ''
            }
            
        track_activity(request.user, activity_type_map[model_name], details=details, request=request)
        item.delete()
        return JsonResponse({'status': 'success'})
    except model.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Item not found'}, status=404)

@require_http_methods(["GET"])
def get_floor_data(request, floor_id):
    """Get floor data including SVG URL"""
    try:
        floor = Floor.objects.get(id=floor_id)
        
        # Get floor plan URL - handle missing files
        floorplan_url = None
        if floor.floorplan_svg:
            floorplan_url = floor.floorplan_svg.url
        
        return JsonResponse({
            'status': 'success',
            'floor': {
                'id': floor.id,
                'name': floor.name,
                'building': floor.building,
                'floorplan_url': floorplan_url,
                'has_svg': floorplan_url is not None
            }
        })
    except Floor.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Floor not found'}, status=404)
    except Exception as e:
        import traceback
        print(f"Error in get_floor_data: {str(e)}\n{traceback.format_exc()}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

def get_floor_rooms(request, floor_id):
    """Get rooms for a specific floor"""
    if not Floor.objects.filter(id=floor_id).exists():
        return JsonResponse({'status': 'error', 'message': 'Floor not found'}, status=404)
        
    rooms = Room.objects.filter(floor_id=floor_id).select_related('profile')
    data = []
    for room in rooms:
        try:
            if hasattr(room, 'profile') and room.profile:
                data.append({
                    'id': room.id,
                    'number': room.profile.number,
                    'name': room.profile.name,
                    'type': room.profile.type,
                    'description': room.profile.description or ''
                })
        except Exception as e:
            print(f"Error processing room {room.id}: {str(e)}")
            continue
    
    return JsonResponse({'status': 'success', 'rooms': data})

@login_required
@require_http_methods(["POST"])
def import_rooms_from_csv(request):
    """Import rooms from CSV data"""
    import json
    from django.core.files.base import ContentFile
    
    print("[CSV Import] Request received!")
    print(f"[CSV Import] User: {request.user.username}, is_staff: {request.user.is_staff}, is_superuser: {request.user.is_superuser}")
    
    if not request.user.is_staff and not request.user.is_superuser:
        print("[CSV Import] Authorization failed - not staff or superuser")
        return JsonResponse({'status': 'error', 'message': 'Unauthorized'}, status=403)
    
    try:
        # Always use FormData approach (which is what the frontend sends)
        floor_id = request.POST.get('floor_id')
        rooms_json = request.POST.get('rooms', '[]')
        csv_file = request.FILES.get('csv_file')
        
        print(f"[CSV Import] FormData request - floor_id: {floor_id}, rooms_json length: {len(rooms_json)}, has_file: {csv_file is not None}")
        
        try:
            rooms_data = json.loads(rooms_json)
        except json.JSONDecodeError as e:
            print(f"[CSV Import] JSON decode error: {str(e)}")
            return JsonResponse({'status': 'error', 'message': 'Invalid rooms JSON'}, status=400)
        
        print(f"[CSV Import] Received floor_id: {floor_id}, rooms count: {len(rooms_data)}")
        
        if not floor_id:
            print("[CSV Import] No floor_id provided")
            return JsonResponse({'status': 'error', 'message': 'Floor ID required'}, status=400)
        
        if not rooms_data:
            print("[CSV Import] No rooms data provided")
            return JsonResponse({'status': 'error', 'message': 'No rooms to import'}, status=400)
        
        floor = Floor.objects.get(id=floor_id)
        print(f"[CSV Import] Found floor: {floor.name} (ID: {floor.id})")
        
        imported_count = 0
        
        for i, room_data in enumerate(rooms_data):
            try:
                # Create Room object for this floor
                room = Room.objects.create(floor=floor)
                
                # Create RoomProfile with coordinates
                profile = RoomProfile.objects.create(
                    room=room,
                    number=room_data.get('number', ''),
                    name=room_data.get('name', ''),
                    type='Standard',  # Default type
                    coordinates={
                        'x': room_data.get('x', 0),
                        'y': room_data.get('y', 0),
                        'z': room_data.get('z', 0)
                    }
                )
                if i < 3:  # Log first 3
                    print(f"[CSV Import] Created room #{i+1}: {room.id}, profile: {profile.number}")
                imported_count += 1
            except Exception as e:
                print(f"[CSV Import] Error importing room {room_data.get('number')}: {str(e)}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"[CSV Import] Total imported: {imported_count}")
        
        # Save CSV file to floor
        if imported_count > 0:
            if csv_file:
                # Save the actual uploaded file
                floor.csv_file.save(csv_file.name, csv_file, save=True)
                print(f"[CSV Import] Saved CSV file: {csv_file.name}")
            else:
                # Create CSV content from the imported data
                csv_content = "room_number,Name,x,y,z\n"
                for room_data in rooms_data:
                    csv_content += f"{room_data.get('number')},{room_data.get('name')},{room_data.get('x')},{room_data.get('y')},{room_data.get('z')}\n"
                
                # Save to floor
                floor.csv_file.save('rooms.csv', ContentFile(csv_content.encode('utf-8')), save=True)
                print(f"[CSV Import] Saved generated CSV file")
        
        print(f"[CSV Import] Import complete. Total imported: {imported_count}")
        
        # Track activity
        track_activity(
            request.user,
            'room_import',
            details={
                'floor': floor.name,
                'rooms_imported': imported_count
            },
            request=request
        )
        
        return JsonResponse({
            'status': 'success',
            'message': f'Successfully imported {imported_count} rooms',
            'count': imported_count
        })
    
    except Floor.DoesNotExist:
        print(f"[CSV Import] Floor not found: {floor_id}")
        return JsonResponse({'status': 'error', 'message': 'Floor not found'}, status=404)
    except Exception as e:
        print(f"[CSV Import] Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
        import traceback
        traceback.print_exc()
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


def search_rooms_and_locations(request):
    """Search for rooms and locations by name, number, building. (Public endpoint - no login required)"""
    query = request.GET.get('q', '').strip()
    
    if not query or len(query) < 2:
        return JsonResponse({'results': []})
    
    try:
        from django.db.models import Q
        
        # Search in RoomProfile for room name/number and Floor for building
        results = []
        
        # Search rooms by name or number
        room_profiles = RoomProfile.objects.filter(
            Q(name__icontains=query) | Q(number__icontains=query)
        ).select_related('room__floor')[:20]
        
        for profile in room_profiles:
            results.append({
                'id': profile.room.id,
                'type': 'room',
                'name': profile.name,
                'number': profile.number,
                'building': profile.room.floor.building,
                'floor': profile.room.floor.name,
                'floor_id': profile.room.floor.id,
                'room_type': profile.type,
                'description': profile.description[:100] if profile.description else ''
            })
        
        # Search floors/buildings by name or building name
        floors = Floor.objects.filter(
            Q(name__icontains=query) | Q(building__icontains=query)
        ).distinct()[:10]
        
        for floor in floors:
            results.append({
                'id': floor.id,
                'type': 'floor',
                'name': floor.name,
                'building': floor.building,
                'room_count': floor.rooms.count()
            })
        
        return JsonResponse({'results': results})
    
    except Exception as e:
        print(f"Search error: {str(e)}")
        return JsonResponse({'results': [], 'error': str(e)}, status=500)


def get_room_photos(request, room_id):
    """Get all photos for a room. (Public endpoint - no login required)"""
    try:
        room = get_object_or_404(Room, id=room_id)
        
        photos_data = []
        if room.profile and room.profile.images:
            images = room.profile.get_images()
            for idx, image_url in enumerate(images):
                photos_data.append({
                    'id': idx,
                    'url': image_url,
                    'caption': f'Room Photo {idx + 1}',
                })
        
        return JsonResponse({'photos': photos_data})
    except Exception as e:
        print(f"Error getting photos: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


def get_room_data(request, room_id):
    """Get room data including coordinates, details, and photos. (Public endpoint - no login required)"""
    try:
        room = get_object_or_404(Room, id=room_id)
        
        import json
        coordinates = {}
        
        if room.profile and room.profile.coordinates:
            try:
                coordinates = json.loads(room.profile.coordinates) if isinstance(room.profile.coordinates, str) else room.profile.coordinates
            except:
                pass
        
        # Get photos from RoomProfile.images
        photos_data = []
        image_url = None
        if room.profile and room.profile.images:
            images = room.profile.get_images()
            photos_data = [{
                'id': idx,
                'url': img_url,
                'caption': f'Room Photo {idx + 1}'
            } for idx, img_url in enumerate(images)]
            
            # Get first image URL for display
            if images:
                image_url = images[0]
        
        return JsonResponse({
            'id': room.id,
            'name': room.profile.name if room.profile else '',
            'number': room.profile.number if room.profile else '',
            'type': room.profile.type if room.profile else '',
            'description': room.profile.description if room.profile else '',
            'floor': room.floor.name if room.floor else '',
            'building': room.floor.building if room.floor else '',
            'coordinates': coordinates,
            'photos': photos_data,
            'image_url': image_url
        })
    except Exception as e:
        print(f"Error getting room data: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def delete_roomimage(request, image_id):
    """Delete a room image from the room profile."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        room = get_object_or_404(Room, id=request.POST.get('room_id'))
        
        # Only admin can delete
        if not (request.user.is_staff or request.user.is_superuser):
            return JsonResponse({'error': 'Unauthorized'}, status=403)
        
        # Get the image URL to delete
        image_url = request.POST.get('image_url')
        
        if room.profile and image_url:
            room.profile.remove_image(image_url)
            return JsonResponse({'status': 'success', 'message': 'Image deleted'})
        
        return JsonResponse({'error': 'Image not found'}, status=404)
    except Exception as e:
        print(f"Error deleting image: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


def get_room_ratings(request, room_id):
    """Get all ratings for a room. (Public endpoint - no login required)"""
    try:
        room = get_object_or_404(Room, id=room_id)
        
        from .models import Feedback
        feedbacks = room.feedbacks.all().order_by('-creation_date')
        
        # Calculate average rating
        ratings = feedbacks.filter(rating__isnull=False).values_list('rating', flat=True)
        average_rating = sum(ratings) / len(ratings) if ratings else 0
        
        # Get user's existing rating if authenticated
        user_rating = None
        if request.user.is_authenticated:
            try:
                user_feedback = feedbacks.filter(user=request.user).first()
                if user_feedback:
                    user_rating = {
                        'id': user_feedback.id,
                        'rating': user_feedback.rating,
                        'comment': user_feedback.comment
                    }
            except:
                pass
        
        feedbacks_data = [{
            'id': feedback.id,
            'rating': feedback.rating,
            'comment': feedback.comment,
            'user': feedback.user.display_name() if feedback.user else 'Anonymous',
            'date': feedback.creation_date.strftime('%Y-%m-%d %H:%M'),
            'user_type': feedback.user.get_type_display() if feedback.user else 'Guest',
            'profile_picture': feedback.user.profile.profile_pic.url if feedback.user and hasattr(feedback.user, 'profile') and feedback.user.profile.profile_pic else None
        } for feedback in feedbacks]
        
        return JsonResponse({
            'total_ratings': len(ratings),
            'average_rating': round(average_rating, 1),
            'feedbacks': feedbacks_data,
            'user_rating': user_rating,
            'is_authenticated': request.user.is_authenticated
        })
    except Exception as e:
        print(f"Error getting ratings: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


def submit_room_rating(request, room_id):
    """Submit a rating for a room. (Login required)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    # Check if user is authenticated
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required to rate rooms'}, status=401)
    
    try:
        import json
        data = json.loads(request.body)
        
        room = get_object_or_404(Room, id=room_id)
        rating_value = data.get('rating')
        comment = data.get('comment', '').strip()
        
        # Validate rating
        if not rating_value or rating_value < 1 or rating_value > 5:
            return JsonResponse({'error': 'Rating must be between 1 and 5'}, status=400)
        
        from .models import Feedback
        
        # One rating per user per room (update if exists)
        feedback, created = Feedback.objects.update_or_create(
            user=request.user,
            room=room,
            defaults={'rating': rating_value, 'comment': comment}
        )
        
        return JsonResponse({
            'status': 'success',
            'message': 'Rating submitted successfully',
            'created': created,
            'feedback_id': feedback.id
        })
    except Exception as e:
        print(f"Error submitting rating: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@user_passes_test(is_admin)
def admin_ratings_view(request):
    """Admin dashboard for managing room ratings"""
    # Get all feedbacks with related room and user info
    from .models import Feedback
    
    feedbacks = Feedback.objects.select_related('room', 'room__profile', 'user').order_by('-creation_date')
    
    # Get unique rooms with their average ratings
    rooms = Room.objects.filter(feedbacks__isnull=False).distinct()
    room_stats = []
    
    for room in rooms:
        room_feedbacks = room.feedbacks.all()
        ratings = room_feedbacks.filter(rating__isnull=False).values_list('rating', flat=True)
        average_rating = sum(ratings) / len(ratings) if ratings else 0
        
        room_stats.append({
            'room': room,
            'total_ratings': len(ratings),
            'average_rating': round(average_rating, 1),
            'feedback_count': room_feedbacks.count()
        })
    
    # Pagination
    paginator = Paginator(feedbacks, 20)
    page_number = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_number)
    
    context = {
        'feedbacks': page_obj,
        'room_stats': sorted(room_stats, key=lambda x: x['average_rating'], reverse=True),
        'total_feedbacks': feedbacks.count(),
        'total_rooms_with_ratings': len(room_stats)
    }
    
    return render(request, 'UMAP_App/Admin/Admin_Ratings.html', context)


@login_required
@user_passes_test(is_admin)
def delete_feedback(request, feedback_id):
    """Delete a user's feedback/rating - Admin only"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        from .models import Feedback
        
        feedback = Feedback.objects.filter(id=feedback_id).first()
        if not feedback:
            return JsonResponse({'error': 'Feedback not found'}, status=404)
        
        # Store info for logging
        feedback_info = {
            'id': feedback.id,
            'user': feedback.user.username if feedback.user else 'Anonymous',
            'room': feedback.room.profile.name if hasattr(feedback.room, 'profile') else str(feedback.room),
            'rating': feedback.rating
        }
        
        feedback.delete()
        
        print(f"Admin {request.user.username} deleted feedback: {feedback_info}")
        
        return JsonResponse({
            'status': 'success',
            'message': 'Feedback deleted successfully',
            'feedback_info': feedback_info
        })
    except Feedback.DoesNotExist:
        return JsonResponse({'error': 'Feedback not found'}, status=404)
    except Exception as e:
        print(f"Error deleting feedback {feedback_id}: {str(e)}")
        print(f"Admin user: {request.user.username}")
        return JsonResponse({'error': str(e)}, status=500)


@login_required(login_url='login')
def saved_locations_view(request):
    """Display user's saved locations, organized by building, floor, and room"""
    try:
        # Get all saved locations for the user
        saved_locations = SavedLocation.objects.filter(user=request.user).select_related(
            'room', 'room__floor', 'room__profile'
        ).order_by('-saved_date')
        
        # Organize locations by building > floor > room
        organized_locations = {}
        
        for saved in saved_locations:
            room = saved.room
            floor = room.floor
            building = floor.building
            
            # Initialize building if not exists
            if building not in organized_locations:
                organized_locations[building] = {}
            
            # Initialize floor if not exists
            if floor.id not in organized_locations[building]:
                organized_locations[building][floor.id] = {
                    'floor_name': floor.name,
                    'floor_id': floor.id,
                    'rooms': []
                }
            
            # Get first image from room profile if available
            room_images = room.profile.get_images() if room.profile else []
            first_image = room_images[0] if room_images else None
            
            # Add room to floor
            room_data = {
                'room_id': room.id,
                'room_name': room.profile.name if room.profile else f'Room {room.id}',
                'room_number': room.profile.number if room.profile else 'N/A',
                'room_type': room.profile.type if room.profile else 'Unknown',
                'room_description': room.profile.description if room.profile else '',
                'room_image': first_image,
                'saved_date': saved.saved_date,
                'saved_id': saved.id
            }
            organized_locations[building][floor.id]['rooms'].append(room_data)
        
        # Sort rooms in each floor by name
        for building in organized_locations:
            for floor_id in organized_locations[building]:
                organized_locations[building][floor_id]['rooms'].sort(
                    key=lambda x: x['room_name']
                )
        
        # Convert to list format for template
        buildings_list = []
        for building_name in sorted(organized_locations.keys()):
            floors_list = []
            for floor_id in sorted(organized_locations[building_name].keys(), 
                                  key=lambda x: organized_locations[building_name][x]['floor_name']):
                floor_data = organized_locations[building_name][floor_id]
                floors_list.append({
                    'floor_id': floor_data['floor_id'],
                    'floor_name': floor_data['floor_name'],
                    'rooms': floor_data['rooms'],
                    'room_count': len(floor_data['rooms'])
                })
            
            buildings_list.append({
                'building_name': building_name,
                'floors': floors_list,
                'floor_count': len(floors_list),
                'room_count': sum(len(f['rooms']) for f in floors_list)
            })
        
        context = {
            'buildings': buildings_list,
            'total_saved': saved_locations.count(),
            'has_saved': saved_locations.exists()
        }
        
        return render(request, 'UMAP_App/Users/Users_Saved.html', context)
    
    except Exception as e:
        print(f"Error in saved_locations_view: {str(e)}")
        import traceback
        traceback.print_exc()
        messages.error(request, 'Error loading saved locations')
        return render(request, 'UMAP_App/Users/Users_Saved.html', {
            'buildings': [],
            'total_saved': 0,
            'has_saved': False
        })

def recent_locations_view(request):
    """Display user's recently viewed locations (last 10 unique rooms/floors)
    For authenticated users: shows UserActivity records
    For guests: shows sessionStorage cached data via JavaScript
    """
    try:
        recent_places = []
        organized_places = {}
        
        # Only query database if user is authenticated
        if request.user.is_authenticated:
            # Get recent room and floor views for the user (last 10 unique places)
            recent_activities = UserActivity.objects.filter(
                user=request.user,
                activity_type__in=['room_view', 'floor_view']
            ).select_related('user').order_by('-timestamp')[:50]  # Get more to filter unique
            
            # Track unique rooms and floors to avoid duplicates
            seen_rooms = set()
            seen_floors = set()
            
            for activity in recent_activities:
                if len(recent_places) >= 10:
                    break
                    
                details = activity.details or {}
                
                if activity.activity_type == 'room_view':
                    room_id = details.get('room_id')
                    if room_id and room_id not in seen_rooms:
                        seen_rooms.add(room_id)
                        try:
                            room = Room.objects.select_related('floor', 'profile').get(id=room_id)
                            # Get first image from room profile if available
                            room_images = room.profile.get_images() if room.profile else []
                            image_url = room_images[0] if room_images else None
                            
                            recent_places.append({
                                'type': 'room',
                                'id': room.id,
                                'name': room.profile.name if room.profile else f'Room {room.id}',
                                'number': room.profile.number if room.profile else 'N/A',
                                'building': room.floor.building,
                                'floor': room.floor.name,
                                'floor_id': room.floor.id,
                                'timestamp': activity.timestamp,
                                'description': room.profile.description if room.profile else '',
                                'image_url': image_url
                            })
                        except Room.DoesNotExist:
                            pass
                            
                elif activity.activity_type == 'floor_view':
                    floor_id = details.get('floor_id')
                    if floor_id and floor_id not in seen_floors:
                        seen_floors.add(floor_id)
                        try:
                            floor = Floor.objects.get(id=floor_id)
                            recent_places.append({
                                'type': 'floor',
                                'id': floor.id,
                                'name': floor.name,
                                'building': floor.building,
                                'timestamp': activity.timestamp,
                                'room_count': floor.rooms.count()
                            })
                        except Floor.DoesNotExist:
                            pass
            
            # Organize by building
            for place in recent_places:
                building = place['building']
                if building not in organized_places:
                    organized_places[building] = []
                organized_places[building].append(place)
        
        context = {
            'recent_places': recent_places,
            'organized_places': organized_places,
            'total_recent': len(recent_places),
            'has_recent': len(recent_places) > 0
        }
        
        return render(request, 'UMAP_App/Users/Users_Recent.html', context)
    
    except Exception as e:
        print(f"Error in recent_locations_view: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return empty state rather than showing error message since page renders fine
        return render(request, 'UMAP_App/Users/Users_Recent.html', {
            'recent_places': [],
            'organized_places': {},
            'total_recent': 0,
            'has_recent': False
        })

