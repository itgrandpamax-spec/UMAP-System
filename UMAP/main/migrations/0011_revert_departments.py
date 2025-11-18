# Generated migration to revert department values back to old system

from django.db import migrations

def revert_departments(apps, schema_editor):
    """
    Revert user departments from new college/institute codes back to old values.
    Reverse Mapping:
    - CCIS -> IT (primary choice)
    - CCSE -> Engineering
    - CBFS -> Business
    - CLAS -> Arts
    - Other codes -> kept as is or mapped to IT
    """
    Profile = apps.get_model('main', 'Profile')
    
    # Reverse mapping - convert new codes back to old ones
    reverse_mapping = {
        'CCIS': 'IT',
        'CCSE': 'Engineering',
        'CBFS': 'Business',
        'CLAS': 'Arts',
        'CHK': 'IT',  # Default to IT for unmapped values
        'CITE': 'IT',
        'HSU': 'IT',
        'CGPP': 'IT',
        'CET': 'Engineering',
        'CTHM': 'IT',
        'CCAPS': 'IT',
        'SOL': 'Arts',
        'IAD': 'Arts',
        'IOA': 'Business',
        'IOP': 'IT',
        'ION': 'IT',
        'IIHS': 'IT',
        'ITEST': 'IT',
        'ISDNB': 'Arts',
        'IOPsy': 'Arts',
        'ISW': 'Arts',
        'IDEM': 'IT',
    }
    
    for new_dept, old_dept in reverse_mapping.items():
        profiles = Profile.objects.filter(department=new_dept)
        count = profiles.count()
        if count > 0:
            profiles.update(department=old_dept)
            print(f"Reverted {count} profile(s) from '{new_dept}' to '{old_dept}'")

def forward_revert(apps, schema_editor):
    """
    This function is intentionally empty as we're reverting.
    If the user wants to go forward again, they'd need to run migration 0010.
    """
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('main', '0010_update_departments'),
    ]

    operations = [
        migrations.RunPython(revert_departments, forward_revert),
    ]
