from django.core.management.base import BaseCommand
from main.models import College


class Command(BaseCommand):
    help = 'Seeds the database with valid college acronyms'

    def handle(self, *args, **options):
        colleges = [
            ('CLAS', 'College of Liberal Arts and Sciences'),
            ('CCIS', 'College of Computing and Information Sciences'),
            ('CBFS', 'College of Business and Financial Sciences'),
            ('CITE', 'College of Information Technology and Engineering'),
            ('CCAPS', 'College of Arts and Physical Sciences'),
            ('CCSE', 'College of Construction Sciences and Engineering'),
            ('CET', 'College of Education and Teaching'),
            ('CGPP', 'College of Government and Public Policy'),
            ('CTHM', 'College of Tourism and Hospitality Management'),
            ('CHK', 'College of Health and Kinesiology'),
            ('SOL', 'School of Law'),
            ('IOP', 'Institute of Orthodontics and Prosthetics'),
            ('ION', 'Institute of Nursing'),
            ('IIHS', 'Institute of International Humanitarian Studies'),
            ('IOA', 'Institute of Architecture'),
            ('ITEST', 'Institute of Technology and Engineering Studies'),
            ('ISDNB', 'Institute of Science and Development in Natural Biology'),
            ('IAD', 'Institute of Applied Design'),
            ('IOPsy', 'Institute of Psychology'),
            ('HSU', 'Higher School of UMak'),
        ]

        created_count = 0
        for acronym, name in colleges:
            college, created = College.objects.get_or_create(
                acronym=acronym,
                defaults={'name': name}
            )
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Created college: {acronym} - {name}')
                )
                created_count += 1
            else:
                self.stdout.write(
                    self.style.WARNING(f'⊘ College already exists: {acronym}')
                )

        self.stdout.write(
            self.style.SUCCESS(f'\n✓ Successfully seeded {created_count} new colleges!')
        )
