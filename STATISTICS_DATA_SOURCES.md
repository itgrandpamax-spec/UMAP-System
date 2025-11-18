# Admin Statistics Dashboard - Data Sources & Calculations

## Overview
The Admin Statistics Dashboard displays real-time analytics with 30+ metrics across 6 major sections. All data is **dynamic** and pulls directly from the database on each page load.

---

## 📊 Section 1: System Health Panel (9 metrics)

| Metric | Data Source | How It Works | Dynamic? |
|--------|-------------|-------------|----------|
| **Total Users** | `User.objects.count()` | Counts all registered users in the system | ✅ Yes |
| **Total Rooms** | `Room.objects.count()` | Counts all room records | ✅ Yes |
| **Total Floors** | `Floor.objects.count()` | Counts all floor records | ✅ Yes |
| **Total Schedules** | `Schedule.objects.count()` | Counts all class schedules uploaded | ✅ Yes |
| **Total Ratings** | `Feedback.objects.count()` | Counts all room ratings/feedback submitted | ✅ Yes |
| **Logins Today** | `UserActivity.filter(activity_type='login', timestamp__date=today).count()` | Filters UserActivity records with type 'login' for today's date | ✅ Yes |
| **Failed Logins** | `UserActivity.filter(activity_type='login_failed').count()` | Counts failed login attempts (if tracked) | ⚠️ Currently 0 |
| **New Users Today** | `User.filter(date_joined__date=today).count()` | Counts users created today | ✅ Yes |
| **Ratings Today** | `Feedback.filter(creation_date__date=today).count()` | Counts feedback records created today | ✅ Yes |

**Data Freshness**: Real-time - updates on every page load

---

## ⭐ Section 2: Ratings Overview

### Top 5 Highest Rated Rooms
```python
Room.objects.annotate(
    avg_rating=Avg('feedbacks__rating'),
    rating_count=Count('feedbacks')
).filter(rating_count__gt=0).order_by('-avg_rating')[:5]
```
- **Data**: Room name, number, average rating, total rating count
- **Filter**: Only rooms with at least 1 rating
- **Order**: By highest average rating first
- **Dynamic**: ✅ Yes - updates as ratings change

### Rooms with Most Comments
```python
Room.objects.annotate(
    comment_count=Count('feedbacks', filter=Q(feedbacks__comment__isnull=False))
).filter(comment_count__gt=0).order_by('-comment_count')[:5]
```
- **Data**: Room name, number, comment count
- **Filter**: Only counts non-empty comments
- **Dynamic**: ✅ Yes

### Average Building Rating
```python
# Manual aggregation by building
for feedback in Feedback.objects.select_related('room__floor'):
    building = feedback.room.floor.building
    building_ratings[building]['ratings'].append(feedback.rating)
```
- **Data**: Building name, average rating, total feedback count
- **Calculation**: Sum of all ratings ÷ number of ratings per building
- **Dynamic**: ✅ Yes

---

## 📈 Section 3: User Activity Analytics

### Most Active Users (This Week)
```python
UserActivity.objects.filter(
    timestamp__gte=week_ago
).values('user__username', 'user__first_name', 'user__last_name').annotate(
    activity_count=Count('id')
).order_by('-activity_count')[:5]
```
- **Data Source**: `UserActivity` table
- **Time Range**: Last 7 days
- **What Counts**: ALL UserActivity records (logins, logouts, room views, schedule uploads, etc.)
- **Dynamic**: ✅ Yes

⚠️ **IMPORTANT NOTE**: This counts ALL activities, not just logins. Each action (login, logout, room view, schedule upload, etc.) creates a UserActivity record. The issue you noticed where "2 activities per login" likely means:
1. One `LOGIN` activity record when user logs in
2. Possibly another activity record from another action immediately after

**Recommendation**: If you want to track only logins, we should filter by `activity_type='login'`

### Peak Usage Hours
```python
# Count activities by hour
for activity in UserActivity.objects.all():
    hour = activity.timestamp.hour
    hour_activity[hour] = hour_activity.get(hour, 0) + 1
```
- **Data**: Hour of day (00-23) and activity count
- **Shows**: Top 5 busiest hours
- **Dynamic**: ✅ Yes

### Recent Comments (Last 10)
```python
Feedback.objects.filter(
    comment__isnull=False
).exclude(comment='').select_related('user', 'room__profile', 'room__floor').order_by('-creation_date')[:10]
```
- **Data**: User name, room name, building, comment text, rating, timestamp
- **Filter**: Only feedback with non-empty comments
- **Order**: Newest first
- **Dynamic**: ✅ Yes

---

## 🔥 Section 4: Room Usage Heatmap

### Most Viewed Rooms
```python
Room.objects.annotate(
    view_count=Count('schedules')
).order_by('-view_count')[:5]
```
- **What "Views" Means**: Number of schedules assigned to that room
- **Data**: Room name, number, schedule count
- **Dynamic**: ✅ Yes

### Floors with Heavy Traffic
```python
Floor.objects.annotate(
    room_count=Count('rooms'),
    schedule_count=Count('rooms__schedules')
).order_by('-schedule_count')
```
- **Data**: Floor name, building, room count, total schedules on floor
- **Order**: By total schedules (traffic)
- **Dynamic**: ✅ Yes

### Underused Rooms (No Schedules)
```python
Room.objects.annotate(
    schedule_count=Count('schedules')
).filter(schedule_count=0)[:10]
```
- **Data**: Rooms with zero schedules
- **Shows**: 10 unused rooms
- **Dynamic**: ✅ Yes - updates when schedules are added/deleted

---

## 📅 Section 5: Schedule Insights

### Classes per Building
```python
# Manual aggregation
for schedule in Schedule.objects.select_related('room__floor'):
    building = schedule.room.floor.building
    classes_per_building[building] = classes_per_building.get(building, 0) + 1
```
- **Data**: Building name, class count
- **Dynamic**: ✅ Yes

### Most Occupied Day
```python
Schedule.objects.values('day').annotate(count=Count('id')).order_by('-count').first()
```
- **Data**: Day of week with most classes
- **Shows**: e.g., "Monday: 45 classes"
- **Dynamic**: ✅ Yes

### Most Common Class Times
```python
# Hour-based grouping
for schedule in Schedule.objects.all():
    hour = schedule.start.hour
    period = f'{hour:02d}:00 - {hour+1:02d}:00'
    time_ranges[period] = time_ranges.get(period, 0) + 1
```
- **Data**: Time period (e.g., "09:00 - 10:00") and count
- **Shows**: Top 5 busiest time slots
- **Dynamic**: ✅ Yes

---

## 📋 Section 6: Data Completeness Checks

| Check | Query | Purpose | Dynamic? |
|-------|-------|---------|----------|
| **Rooms Missing Coordinates** | `RoomProfile.filter(Q(coordinates__isnull=True) \| Q(coordinates={})).count()` | Identifies rooms without location data needed for mapping | ✅ Yes |
| **Floors Missing 3D Models** | `Floor.filter(model_file__isnull=True).count()` | Counts floors without 3D model files | ✅ Yes |
| **Users Missing Profile Info** | `Profile.filter(Q(description__isnull=True) \| Q(profile_pic__isnull=True)).count()` | Identifies incomplete user profiles | ✅ Yes |
| **Rooms Missing Description** | `RoomProfile.filter(Q(description__isnull=True) \| Q(description='')).count()` | Counts rooms without descriptions | ✅ Yes |

---

## 🔍 User Activity Tracking Issue

### Current Behavior
Every action creates a `UserActivity` record with different `activity_type` values:
- `login` - User login
- `logout` - User logout  
- `room_view` - Viewing a room
- `schedule_add` - Adding a schedule
- `schedule_delete` - Deleting a schedule
- `user_create` - Creating a user account
- `user_modify` - Modifying user data
- `user_delete` - Deleting a user
- `floor_delete` - Deleting a floor
- And more...

### Why You're Seeing Double Activity Counts
The "Most Active Users" metric counts **ALL activity types**, not just logins. If a user logs in and then immediately views a room or uploads a schedule, that's 2-3 activity records.

**Current Count by Type**:
```
login          : 105 records
logout         : 103 records
room_import    :  20 records
floor_delete   :  19 records
user_create    :  12 records
user_modify    :   6 records
user_delete    :   4 records
schedule_add   :   3 records
schedule_delete:   2 records
```

### Solution Options

**Option 1**: Filter to only logins in statistics
```python
UserActivity.objects.filter(
    activity_type='login',
    timestamp__gte=week_ago
).values('user__username').annotate(count=Count('id')).order_by('-activity_count')[:5]
```

**Option 2**: Keep current "all activities" but rename to "Most Active Users (All Actions)"

**Option 3**: Create separate metrics for different activity types

---

## 📊 Summary: What's Dynamic vs Static

| Feature | Status | Update Frequency |
|---------|--------|------------------|
| System Health Metrics | ✅ Dynamic | Real-time (every page load) |
| Top Rated Rooms | ✅ Dynamic | Updates when ratings change |
| Most Active Users | ✅ Dynamic | Real-time (every page load) |
| Peak Hours | ✅ Dynamic | Real-time (every page load) |
| Room Usage | ✅ Dynamic | Real-time (every page load) |
| Schedule Insights | ✅ Dynamic | Real-time (every page load) |
| Data Quality Checks | ✅ Dynamic | Real-time (every page load) |

**All statistics are fully dynamic - no caching is used.**

---

## 🎯 Recommended Actions

1. **Fix Double Activity Counting**: Filter `most_active_users` to show only `activity_type='login'` if you want login-only stats
2. **Add Failed Login Tracking**: Currently showing 0 - implement failed login tracking in auth
3. **Consider Caching**: For large datasets, implement Redis caching to avoid database overload
4. **Add Filters**: Allow admins to filter by date range, building, department, etc.

