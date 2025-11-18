from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.core.paginator import Paginator, PageNotAnInteger, EmptyPage
from django.db.models import Count, F
from django.db import models
from .models import Schedule, Profile, User
from datetime import datetime, timedelta
from django.contrib import messages


def is_admin(user):
    return user.is_staff or user.is_superuser


def calculate_weekly_hours(schedules):
    total_minutes = 0
    for schedule in schedules:
        try:
            start = datetime.combine(datetime.today(), schedule.start)
            end = datetime.combine(datetime.today(), schedule.end)
            minutes = (end - start).total_seconds() / 60
            total_minutes += minutes
        except (TypeError, AttributeError):
            continue
    return round(total_minutes / 60, 1)


@login_required
@user_passes_test(is_admin)
def admin_schedules_dashboard(request):
    try:
        # Get all schedules count
        total_schedules_count = Schedule.objects.count()
        
        # Get all distinct subjects
        total_subjects_count = Schedule.objects.values('subject').distinct().count()
        
        # Get users with schedules - don't filter yet
        users_with_schedules = User.objects.filter(schedules__isnull=False).distinct()
        active_users_count = users_with_schedules.count()
        
        print(f"DEBUG: Total schedules: {total_schedules_count}")
        print(f"DEBUG: Total subjects: {total_subjects_count}")
        print(f"DEBUG: Users with schedules: {active_users_count}")
        
        # Build user stats manually
        user_list = []
        for user in users_with_schedules:
            schedules = user.schedules.all()
            user.schedule_count = schedules.count()
            user.total_hours = calculate_weekly_hours(schedules)
            user.subjects = list(set(schedules.values_list('subject', flat=True)))
            user_list.append(user)
        
        # Sort by schedule count
        user_list.sort(key=lambda x: x.schedule_count, reverse=True)
        
        # Setup pagination
        page = request.GET.get('page', 1)
        paginator = Paginator(user_list, 10)  # 10 users per page

        try:
            user_schedules = paginator.page(page)
        except PageNotAnInteger:
            user_schedules = paginator.page(1)
        except EmptyPage:
            user_schedules = paginator.page(paginator.num_pages)

        context = {
            'user_schedules': user_schedules,
            'total_schedules': total_schedules_count,
            'active_users': active_users_count, 
            'total_subjects': total_subjects_count,
            'page_obj': user_schedules,
        }

        return render(request, 'UMAP_App/Admin/Admin_Schedules_Dashboard.html', context)     

    except Exception as e:
        import traceback
        print(f"DEBUG: Error in dashboard: {str(e)}")
        print(f"TRACEBACK: {traceback.format_exc()}")
        messages.error(request, f"Error loading dashboard: {str(e)}")
        return redirect('admin_main_view')


@login_required
@user_passes_test(is_admin)
def view_user_schedule(request, user_id):
    try:
        user = get_object_or_404(User.objects.select_related('profile'), id=user_id)
        # Define day order
        day_order = {
            'Monday': 0,
            'Tuesday': 1,
            'Wednesday': 2,
            'Thursday': 3,
            'Friday': 4,
            'Saturday': 5,
            'Sunday': 6
        }

        # Get all schedules and count before sorting
        schedules_queryset = user.schedules.all().select_related('room', 'room__profile')    
        total_classes = schedules_queryset.count()
        total_hours = calculate_weekly_hours(schedules_queryset)
        unique_subjects = schedules_queryset.values('subject').distinct().count()

        # Convert to list and sort
        schedules = sorted(schedules_queryset, key=lambda x: (day_order.get(x.day, 7), x.start))
        
        context = {
            'viewed_user': user,
            'schedules': schedules,
            'total_hours': total_hours,
            'unique_subjects': unique_subjects,
            'total_classes': total_classes
        }

        return render(request, 'UMAP_App/Admin/Admin_User_Schedule.html', context)

    except User.DoesNotExist:
        messages.error(request, "User not found.")
        return redirect('admin_schedules_dashboard')
    except Exception as e:
        messages.error(request, f"Error viewing schedule: {str(e)}")
        return redirect('admin_schedules_dashboard')
