import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMAP.settings')
import django
django.setup()

from main.models import UserActivity
from django.db.models import Count
from django.utils import timezone
from datetime import timedelta

print("=" * 60)
print("ACTIVITY TYPE DISTRIBUTION")
print("=" * 60)
activity_counts = UserActivity.objects.values('activity_type').annotate(count=Count('id')).order_by('-count')
for item in activity_counts:
    print(f"{item['activity_type']:20} : {item['count']:5} records")

print("\n" + "=" * 60)
print("LOGIN ACTIVITIES (LAST 7 DAYS)")
print("=" * 60)
week_ago = timezone.now() - timedelta(days=7)
login_by_user = UserActivity.objects.filter(
    activity_type='login', 
    timestamp__gte=week_ago
).values('user__username').annotate(count=Count('id')).order_by('-count')

for item in login_by_user:
    print(f"{item['user__username']:20} : {item['count']:3} logins")

print("\n" + "=" * 60)
print("RECENT LOGIN DETAILS (LAST 10)")
print("=" * 60)
recent_logins = UserActivity.objects.filter(
    activity_type='login'
).select_related('user').order_by('-timestamp')[:10]

for activity in recent_logins:
    print(f"{activity.user.username:15} | {activity.timestamp}")
