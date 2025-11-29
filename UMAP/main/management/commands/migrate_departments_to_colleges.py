from django.core.management.base import BaseCommand
from main.models import Profile, College


class Command(BaseCommand):
    help = 'Migrates existing user departments to college acronyms'

    def handle(self, *args, **options):
        # Mapping of old department values to new college acronyms
        department_to_college = {
            'IT': 'CCIS',
            'Engineering': 'CCSE',
            'Business': 'CBFS',
            'Arts': 'IAD',
        }

        updated_count = 0
        skipped_count = 0

        for profile in Profile.objects.filter(department__in=department_to_college.keys()):
            old_dept = profile.department
            college_acronym = department_to_college[old_dept]
            
            try:
                college = College.objects.get(acronym=college_acronym)
                profile.college = college
                profile.save()
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Updated user "{profile.user.username}": {old_dept} → {college_acronym} ({college.name})'
                    )
                )
                updated_count += 1
            except College.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'✗ College not found for acronym: {college_acronym}')
                )
                skipped_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Successfully migrated {updated_count} user profiles to college system!'
            )
        )
        if skipped_count > 0:
            self.stdout.write(
                self.style.WARNING(f'⊘ Skipped {skipped_count} profiles due to missing college codes')
            )
