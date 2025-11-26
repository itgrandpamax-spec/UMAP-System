from django.core.management.base import BaseCommand
from main.models import Floor, RoomProfile
from main.room_manager import RoomNameManager


class Command(BaseCommand):
    help = 'Update room names from DataDicForSVG.csv reference file in static folder'

    def add_arguments(self, parser):
        parser.add_argument('--floor-name', type=str, help='Specific floor name to update (e.g., "9th Floor")')

    def handle(self, *args, **options):
        # Load room names from CSV using RoomNameManager
        room_names = RoomNameManager.load_room_names()
        
        if not room_names:
            self.stdout.write(
                self.style.ERROR('No room names loaded. Please ensure DataDicForSVG.csv exists in main/static/UMAP_App/csv/')
            )
            return
        
        self.stdout.write(
            self.style.SUCCESS(f'Loaded {len(room_names)} room names from CSV')
        )
        
        # Get floors to update
        floor_name = options.get('floor_name')
        if floor_name:
            floors = Floor.objects.filter(name=floor_name)
        else:
            floors = Floor.objects.all()
        
        if not floors.exists():
            self.stdout.write(
                self.style.WARNING(f'No floors found')
            )
            return
        
        # Update room names
        total_updated = 0
        for floor in floors:
            self.stdout.write(f'\nUpdating floor: {floor.name}')
            
            rooms = RoomProfile.objects.filter(room__floor=floor)
            
            for room in rooms:
                if room.number in room_names:
                    new_name = room_names[room.number]
                    if room.name != new_name:
                        old_name = room.name
                        room.name = new_name
                        room.save()
                        self.stdout.write(
                            f'  ✓ {room.number}: {old_name} → {new_name}'
                        )
                        total_updated += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Successfully updated {total_updated} room names'
            )
        )
