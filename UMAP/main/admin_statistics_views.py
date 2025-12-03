from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required, user_passes_test
from django.db.models import Count, Avg, Q, F
from django.utils import timezone
from datetime import timedelta
from .models import (
    User, Schedule, Feedback, Room, Floor, UserActivity, 
    RoomProfile, Profile, SavedLocation
)


def is_admin(user):
    return user.is_staff or user.is_superuser


@login_required
@user_passes_test(is_admin)
def admin_statistics(request):
    """Comprehensive statistics dashboard for admins"""
    
    try:
        context = {}
        
        # ============ RATINGS OVERVIEW ============
        # Top 5 highest rated rooms
        top_rated_rooms = Room.objects.annotate(
            avg_rating=Avg('feedbacks__rating'),
            rating_count=Count('feedbacks')
        ).filter(
            rating_count__gt=0
        ).order_by('-avg_rating')[:5]
        
        context['top_rated_rooms'] = [
            {
                'name': room.profile.name if room.profile else f'Room {room.id}',
                'number': room.profile.number if room.profile else 'N/A',
                'rating': round(room.avg_rating, 1) if room.avg_rating else 0,
                'count': room.rating_count
            }
            for room in top_rated_rooms
        ]
        
        # Rooms with most comments
        most_commented_rooms = Room.objects.annotate(
            comment_count=Count('feedbacks', filter=Q(feedbacks__comment__isnull=False))
        ).filter(
            comment_count__gt=0
        ).order_by('-comment_count')[:5]
        
        context['most_commented_rooms'] = [
            {
                'name': room.profile.name if room.profile else f'Room {room.id}',
                'number': room.profile.number if room.profile else 'N/A',
                'comments': room.comment_count
            }
            for room in most_commented_rooms
        ]
        
        # Most saved rooms
        most_saved_rooms = Room.objects.annotate(
            save_count=Count('saved_by_users')
        ).filter(
            save_count__gt=0
        ).order_by('-save_count')[:5]
        
        context['most_saved_rooms'] = [
            {
                'name': room.profile.name if room.profile else f'Room {room.id}',
                'number': room.profile.number if room.profile else 'N/A',
                'saves': room.save_count,
                'building': room.floor.building if room.floor else 'N/A'
            }
            for room in most_saved_rooms
        ]
        
        # Average building rating
        building_ratings = {}
        for feedback in Feedback.objects.select_related('room__floor'):
            building = feedback.room.floor.building
            if building not in building_ratings:
                building_ratings[building] = {'ratings': [], 'count': 0}
            building_ratings[building]['ratings'].append(feedback.rating)
            building_ratings[building]['count'] += 1
        
        context['building_ratings'] = [
            {
                'name': building,
                'rating': round(sum(data['ratings']) / len(data['ratings']), 1),
                'count': data['count']
            }
            for building, data in sorted(building_ratings.items(), 
                                        key=lambda x: sum(x[1]['ratings']) / len(x[1]['ratings']) 
                                        if x[1]['ratings'] else 0, reverse=True)
        ]
        
        # Average floor rating
        floor_ratings = {}
        for feedback in Feedback.objects.select_related('room__floor'):
            if feedback.room.floor:
                floor_key = (feedback.room.floor.id, feedback.room.floor.name, feedback.room.floor.building)
                if floor_key not in floor_ratings:
                    floor_ratings[floor_key] = {'ratings': [], 'count': 0}
                floor_ratings[floor_key]['ratings'].append(feedback.rating)
                floor_ratings[floor_key]['count'] += 1
        
        context['floor_ratings'] = [
            {
                'name': floor_key[1],
                'building': floor_key[2],
                'rating': round(sum(data['ratings']) / len(data['ratings']), 1),
                'count': data['count']
            }
            for floor_key, data in sorted(floor_ratings.items(), 
                                         key=lambda x: sum(x[1]['ratings']) / len(x[1]['ratings']) 
                                         if x[1]['ratings'] else 0, reverse=True)
        ]
        
        # ============ USER ACTIVITY ANALYTICS ============
        today = timezone.now().date()
        week_ago = timezone.now() - timedelta(days=7)
        
        # Most active users this week (counting all activity types)
        # If you want to count only logins, add: .filter(activity_type='login')
        most_active_users_qs = UserActivity.objects.filter(
            timestamp__gte=week_ago
        ).values('user__username', 'user__first_name', 'user__last_name').annotate(
            activity_count=Count('id')
        ).order_by('-activity_count')[:5]
        
        context['most_active_users'] = [
            {
                'username': user['user__username'],
                'first_name': user['user__first_name'],
                'last_name': user['user__last_name'],
                'activity_count': user['activity_count']
            }
            for user in most_active_users_qs
        ]
        
        # Total ratings submitted today
        ratings_today = Feedback.objects.filter(
            creation_date__date=today
        ).count()
        context['ratings_today'] = ratings_today
        
        # Recent comments (last 10)
        recent_comments = Feedback.objects.filter(
            comment__isnull=False
        ).exclude(
            comment=''
        ).select_related('user', 'room__profile', 'room__floor').order_by('-creation_date')[:10]
        
        context['recent_comments'] = [
            {
                'user': comment.user.get_full_name() or comment.user.username,
                'room': comment.room.profile.name if comment.room.profile else f'Room {comment.room.id}',
                'building': comment.room.floor.building,
                'comment': comment.comment,
                'rating': comment.rating,
                'timestamp': comment.creation_date
            }
            for comment in recent_comments
        ]
        
        # Peak usage hours (from UserActivity)
        hour_activity = {}
        for activity in UserActivity.objects.all():
            hour = activity.timestamp.hour
            hour_activity[hour] = hour_activity.get(hour, 0) + 1
        
        peak_hours = sorted(hour_activity.items(), key=lambda x: x[1], reverse=True)[:5]
        context['peak_hours'] = [
            {
                'hour': f'{hour:02d}:00',
                'count': count,
                'percentage': round((count / sum(hour_activity.values()) * 100), 1) if hour_activity else 0
            }
            for hour, count in peak_hours
        ]
        
        # ============ ROOM USAGE HEATMAP ============
        # Rooms with most views
        most_viewed_rooms = Room.objects.annotate(
            view_count=Count('schedules')
        ).order_by('-view_count')[:5]
        
        context['most_viewed_rooms'] = [
            {
                'name': room.profile.name if room.profile else f'Room {room.id}',
                'number': room.profile.number if room.profile else 'N/A',
                'views': room.view_count
            }
            for room in most_viewed_rooms
        ]
        
        # Floors with heavy traffic
        floor_traffic = Floor.objects.annotate(
            room_count=Count('rooms'),
            schedule_count=Count('rooms__schedules')
        ).order_by('-schedule_count')
        
        context['floor_traffic'] = [
            {
                'name': floor.name,
                'building': floor.building,
                'rooms': floor.room_count,
                'traffic': floor.schedule_count
            }
            for floor in floor_traffic[:5]
        ]
        
        # Underused rooms (rooms with 0 schedules)
        underused_rooms = Room.objects.annotate(
            schedule_count=Count('schedules')
        ).filter(
            schedule_count=0
        )[:10]
        
        context['underused_rooms'] = [
            {
                'name': room.profile.name if room.profile else f'Room {room.id}',
                'number': room.profile.number if room.profile else 'N/A',
                'building': room.floor.building
            }
            for room in underused_rooms
        ]
        
        # ============ SCHEDULE INSIGHTS ============
        # Classes per building
        classes_per_building = {}
        for schedule in Schedule.objects.select_related('room__floor'):
            building = schedule.room.floor.building
            classes_per_building[building] = classes_per_building.get(building, 0) + 1
        
        context['classes_per_building'] = [
            {'building': building, 'count': count}
            for building, count in sorted(classes_per_building.items(), 
                                         key=lambda x: x[1], reverse=True)
        ]
        
        # Most occupied day
        day_counts = Schedule.objects.values('day').annotate(count=Count('id')).order_by('-count')
        context['most_occupied_day'] = day_counts.first() if day_counts.exists() else None
        
        # Most common class time range
        time_ranges = {}
        for schedule in Schedule.objects.all():
            hour = schedule.start.hour
            period = f'{hour:02d}:00 - {hour+1:02d}:00'
            time_ranges[period] = time_ranges.get(period, 0) + 1
        
        # Convert to 12-hour format
        def convert_to_12hour(time_str):
            parts = time_str.split(' - ')
            start_hour = int(parts[0][:2])
            end_hour = int(parts[1][:2])
            
            def format_hour(h):
                if h == 0:
                    return '12 AM'
                elif h < 12:
                    return f'{h} AM'
                elif h == 12:
                    return '12 PM'
                else:
                    return f'{h-12} PM'
            
            return f'{format_hour(start_hour)} - {format_hour(end_hour)}'
        
        context['common_time_ranges'] = sorted(
            [(convert_to_12hour(time), count) for time, count in time_ranges.items()],
            key=lambda x: x[1], 
            reverse=True
        )[:5]
        
        # ============ DATA COMPLETENESS CHECKS ============
        # Rooms missing coordinates
        rooms_missing_coords = RoomProfile.objects.filter(
            Q(coordinates__isnull=True) | Q(coordinates={})
        ).count()
        context['rooms_missing_coords'] = rooms_missing_coords
        
        # Floors missing 3D models
        floors_missing_models = Floor.objects.filter(
            model_file__isnull=True
        ).count()
        context['floors_missing_models'] = floors_missing_models
        
        # Users missing profile info
        users_missing_profile = Profile.objects.filter(
            Q(description__isnull=True) | Q(description='') |
            Q(profile_pic__isnull=True)
        ).count()
        context['users_missing_profile'] = users_missing_profile
        
        # Rooms missing descriptions
        rooms_missing_description = RoomProfile.objects.filter(
            Q(description__isnull=True) | Q(description='')
        ).count()
        context['rooms_missing_description'] = rooms_missing_description
        
        # ============ SYSTEM HEALTH PANEL ============
        # Failed login attempts (attempting to track from UserActivity)
        failed_logins = UserActivity.objects.filter(
            activity_type__in=['login_failed']
        ).count()
        context['failed_logins'] = failed_logins
        
        # Successful logins today
        logins_today = UserActivity.objects.filter(
            activity_type='login',
            timestamp__date=today
        ).count()
        context['logins_today'] = logins_today
        
        # New users today
        new_users_today = User.objects.filter(
            date_joined__date=today
        ).count()
        context['new_users_today'] = new_users_today
        
        # Overall system stats
        context['total_users'] = User.objects.count()
        context['total_rooms'] = Room.objects.count()
        context['total_floors'] = Floor.objects.count()
        context['total_schedules'] = Schedule.objects.count()
        context['total_ratings'] = Feedback.objects.count()
        context['total_activities'] = UserActivity.objects.count()
        
        return render(request, 'UMAP_App/Admin/Admin_Statistics.html', context)
        
    except Exception as e:
        import traceback
        error_msg = f"Error in admin_statistics: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        # Log to console for debugging
        import sys
        print(error_msg, file=sys.stderr)
        raise  # Re-raise to show the actual error instead of hiding it with redirect
