from django.core.management.base import BaseCommand
from main.models import RoomProfile


class Command(BaseCommand):
    help = 'Fix special room types (Elevator/Stairs) to use full names instead of abbreviations'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Get all special room types that need fixing
        special_rooms = RoomProfile.objects.filter(type='Elevator/Stairs')
        
        updated_count = 0
        
        self.stdout.write(self.style.SUCCESS(f'Total special rooms: {special_rooms.count()}'))
        
        for room in special_rooms:
            # For Elevator/Stairs, set the room number to the full name
            correct_number = "Elevator/Stairs"
            
            if room.number != correct_number:
                old_number = room.number
                
                if not dry_run:
                    room.number = correct_number
                    room.save()
                
                updated_count += 1
                self.stdout.write(
                    f'Room {room.id}: {old_number} → {correct_number} (Name: {room.name})'
                )
        
        if dry_run:
            self.stdout.write(self.style.WARNING(
                f'\n[DRY RUN] Would update {updated_count} special rooms'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'\nSuccessfully updated {updated_count} special rooms'
            ))
