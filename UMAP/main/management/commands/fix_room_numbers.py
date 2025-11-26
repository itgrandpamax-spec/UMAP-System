from django.core.management.base import BaseCommand
from django.db.models import Q
from main.models import RoomProfile, Room


def extract_room_number(room_id: str, floor_number: int) -> str:
    """
    Extract room number from SVG room ID based on floor number.
    
    For floors 1-9: extract last 3 digits
    For floors 10-12: extract last 4 digits
    """
    if not room_id or not isinstance(room_id, str):
        return room_id
    
    room_id = room_id.strip()
    
    if floor_number <= 9:
        # Single-digit floor: extract last 3 digits
        if len(room_id) >= 3:
            room_number = room_id[-3:]  # Last 3 digits
            return room_number.lstrip('0') or '0'
        else:
            return room_id
    else:
        # Two-digit floor (10-12): extract last 4 digits
        if len(room_id) >= 4:
            room_number = room_id[-4:]  # Last 4 digits
            return room_number.lstrip('0') or '0'
        else:
            return room_id


class Command(BaseCommand):
    help = 'Fix room numbers and names to use correct format (last 3 or 4 digits instead of 2, and name matches number)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Get all room profiles
        room_profiles = RoomProfile.objects.select_related('room', 'room__floor').all()
        
        updated_count = 0
        
        self.stdout.write(self.style.SUCCESS(f'Total room profiles: {room_profiles.count()}'))
        
        for room_profile in room_profiles:
            floor_name = room_profile.room.floor.name if room_profile.room.floor else None
            floor_number = None
            
            # Try to extract floor number from floor name
            # Handle formats like "9th Floor", "10th Floor", "1st Floor", etc.
            if floor_name:
                import re
                match = re.search(r'(\d+)(?:st|nd|rd|th)?', floor_name)
                if match:
                    try:
                        floor_number = int(match.group(1))
                    except (ValueError, IndexError):
                        self.stdout.write(self.style.WARNING(
                            f'Could not parse floor number from: {floor_name}'
                        ))
                        continue
                else:
                    self.stdout.write(self.style.WARNING(
                        f'Could not parse floor number from: {floor_name}'
                    ))
                    continue
                
                # Extract correct room number
                correct_room_number = extract_room_number(room_profile.name, floor_number)
                correct_room_name = f"Room {correct_room_number}"
                
                # Check if updates are needed
                needs_update = False
                
                if room_profile.number != correct_room_number:
                    needs_update = True
                
                if room_profile.name != correct_room_name and (not room_profile.type or room_profile.type in ["Classroom", ""]):
                    needs_update = True
                
                if needs_update:
                    old_number = room_profile.number
                    old_name = room_profile.name
                    
                    if not dry_run:
                        room_profile.number = correct_room_number
                        # Only update name if it doesn't have a special room type
                        if not room_profile.type or room_profile.type in ["Classroom", ""]:
                            room_profile.name = correct_room_name
                            room_profile.type = "Classroom"
                        room_profile.save()
                    
                    updated_count += 1
                    self.stdout.write(
                        f'Room {room_profile.id}: {old_number} → {correct_room_number}, '
                        f'{old_name} → {correct_room_name} (Floor {floor_number})'
                    )
        
        if dry_run:
            self.stdout.write(self.style.WARNING(
                f'\n[DRY RUN] Would update {updated_count} room profiles'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'\nSuccessfully updated {updated_count} room profiles'
            ))
