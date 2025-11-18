# Generated migration to update department values for existing users

from django.db import migrations

def update_departments(apps, schema_editor):
    """
    Update existing user departments from old values to new college/institute codes.
    Mapping:
    - IT -> CCIS (College of Computing and Information Sciences)
    - CS -> CCIS (College of Computing and Information Sciences)
    - Engineering -> CCSE (College of Construction Sciences and Engineering)
    - Business -> CBFS (College of Business and Financial Sciences)
    - Arts -> CLAS (College of Liberal Arts and Sciences)
    """
    Profile = apps.get_model('main', 'Profile')
    
    # Department mapping from old values to new codes
    department_mapping = {
        'IT': 'CCIS',
        'CS': 'CCIS',
        'Engineering': 'CCSE',
        'Business': 'CBFS',
        'Arts': 'CLAS',
    }
    
    for old_dept, new_dept in department_mapping.items():
        profiles = Profile.objects.filter(department=old_dept)
        count = profiles.count()
        if count > 0:
            profiles.update(department=new_dept)
            print(f"Updated {count} profile(s) from '{old_dept}' to '{new_dept}'")

def reverse_departments(apps, schema_editor):
    """
    Reverse the department updates (optional, for rollback)
    """
    Profile = apps.get_model('main', 'Profile')
    
    # Reverse mapping
    reverse_mapping = {
        'CCIS': 'IT',
        'CCSE': 'Engineering',
        'CBFS': 'Business',
        'CLAS': 'Arts',
    }
    
    for new_dept, old_dept in reverse_mapping.items():
        profiles = Profile.objects.filter(department=new_dept)
        count = profiles.count()
        if count > 0:
            profiles.update(department=old_dept)
            print(f"Reversed {count} profile(s) from '{new_dept}' to '{old_dept}'")

class Migration(migrations.Migration):

    dependencies = [
        ('main', '0009_roomimage'),
    ]

    operations = [
        migrations.RunPython(update_departments, reverse_departments),
    ]
