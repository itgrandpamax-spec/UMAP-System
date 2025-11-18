import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMAP.settings')
django.setup()

from main.models import Schedule, User

print('Total schedules:', Schedule.objects.count())
print('Users with schedules:', User.objects.filter(schedules__isnull=False).distinct().count())
print('\nSample schedules:')
for s in Schedule.objects.all()[:10]:
    print(f"  - {s}")

print('\nUsers and their schedule counts:')
for user in User.objects.annotate(count=__import__('django.db.models', fromlist=['Count']).Count('schedules')).filter(count__gt=0):
    print(f"  - {user.username}: {user.schedules.count()} schedules")
