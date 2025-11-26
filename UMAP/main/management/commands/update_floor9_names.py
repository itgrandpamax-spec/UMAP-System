from django.core.management.base import BaseCommand
from main.models import Floor, RoomProfile

class Command(BaseCommand):
    help = 'Update floor 9 room names to match reference data'

    # Reference data from CSV
    REFERENCE_DATA = {
        '901': 'Multi Media Room',
        '902': 'Zoology Room',
        '903': 'Zoology Room',
        '904': 'Central Lab',
        '905': 'Science Research Lab',
        '906': 'Physics Lab',
        '907': 'Physics Lab',
        '908': 'Microbiology Lab',
        '909': 'Chemistry Room',
        '910': 'Chemistry Room',
        '911': 'Orthopedic Room',
        '912': 'Autoclave',
        '913': 'Storage',
        '914': 'Formula Room',
        '915': 'Nursery',
        '916': 'Delivery Room',
        '917': 'Private Room',
        '918': 'Nurses Station',
        '919': 'Storage',
        '920': 'Emergency Room',
        '921': 'Isolation Room',
        '922': 'Rural Health Setting',
        '923': 'Rural Health Office',
        '924': 'Ward',
        '925': 'Sim Hos Halls',
        '926': 'Leasable Space',
        '927': 'Elec Room',
        '928': 'Janitors Closet',
        '929': 'Female Cr Left',
        '930': 'Male Cr Left',
        '931': 'Right Elevator',
        '932': 'Left Elevator',
        '934': 'Janitors Closet',
        '935': 'Female Cr Right',
        '936': 'Male Cr Right',
    }

    def handle(self, *args, **options):
        floor = Floor.objects.get(name='9th Floor')
        
        updated_count = 0
        
        for room_number, room_name in self.REFERENCE_DATA.items():
            room_profiles = RoomProfile.objects.filter(
                room__floor=floor,
                number=room_number
            )
            
            if room_profiles.exists():
                for profile in room_profiles:
                    old_name = profile.name
                    profile.name = room_name
                    profile.save()
                    self.stdout.write(
                        f'✓ {room_number}: {old_name} → {room_name}'
                    )
                    updated_count += 1
            else:
                self.stdout.write(
                    self.style.WARNING(f'✗ Room {room_number} not found')
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Successfully updated {updated_count} rooms on Floor 9'
            )
        )
