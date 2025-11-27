# Generated migration to consolidate room images into RoomProfile

from django.db import migrations, models


def migrate_room_images(apps, schema_editor):
    """Migrate RoomImage data to RoomProfile.images as JSON list"""
    RoomImage = apps.get_model('main', 'RoomImage')
    RoomProfile = apps.get_model('main', 'RoomProfile')
    
    for profile in RoomProfile.objects.all():
        images_list = []
        try:
            # Get all room images for this room
            room_images = RoomImage.objects.filter(room=profile.room).order_by('upload_date')
            for room_image in room_images:
                if room_image.image:
                    images_list.append(room_image.image.url)
            
            # Update profile with images list if there are images
            if images_list:
                profile.images = images_list
                profile.save()
            else:
                # Set to empty list if no images
                profile.images = []
                profile.save()
        except Exception as e:
            print(f"Error migrating images for room {profile.room.id}: {str(e)}")
            # Ensure empty list
            profile.images = []
            profile.save()


def reverse_migrate(apps, schema_editor):
    """Reverse migration - clear the images JSON field"""
    RoomProfile = apps.get_model('main', 'RoomProfile')
    for profile in RoomProfile.objects.all():
        profile.images = []
        profile.save()


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0016_floor_floorplan_svg'),
    ]

    operations = [
        # Remove the old images ImageField by removing it
        migrations.RemoveField(
            model_name='roomprofile',
            name='images',
        ),
        
        # Add new images JSONField
        migrations.AddField(
            model_name='roomprofile',
            name='images',
            field=models.JSONField(default=list),
        ),
        
        # Run the data migration
        migrations.RunPython(migrate_room_images, reverse_migrate),
        
        # Delete the RoomImage model
        migrations.DeleteModel(
            name='RoomImage',
        ),
    ]

