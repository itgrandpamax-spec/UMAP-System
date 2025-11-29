from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0018_schedule_room_text'),
    ]

    operations = [
        migrations.AddField(
            model_name='roomprofile',
            name='svg_room_id',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
    ]
