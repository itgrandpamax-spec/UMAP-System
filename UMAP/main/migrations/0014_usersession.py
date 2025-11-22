# Generated migration for UserSession model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0013_savedlocation_delete_passwordresetcode'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('session_key', models.CharField(max_length=40, unique=True)),
                ('device_info', models.CharField(blank=True, max_length=255)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True)),
                ('login_time', models.DateTimeField(auto_now_add=True)),
                ('last_activity', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sessions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name_plural': 'User Sessions',
                'ordering': ['-login_time'],
            },
        ),
    ]
