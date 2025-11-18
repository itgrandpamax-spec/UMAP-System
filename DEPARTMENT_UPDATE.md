# Department Update Summary

This update has made the following changes to your UMAP system:

## Files Updated:

1. **Login.html** - Account creation form
   - Updated Department field to College/Institute dropdown
   - Added all 12 colleges and 10 institutes
   - Organized with `<optgroup>` for better UX

2. **Users_Profile.html** - User profile page
   - Updated Department select to show all colleges/institutes
   - Same comprehensive list as account creation form
   - Mobile-friendly styling maintained

3. **Admin_CRUD_Users.html** - Admin user management form
   - Uses form choices from forms.py

4. **forms.py** - Django forms
   - Updated `UserRegistrationForm.department` choices
   - Updated `AdminProfileForm.department` choices
   - Both now include all 22 college/institute options

5. **migrations/0010_update_departments.py** - Data migration
   - Automatically migrates existing users' departments:
     - IT → CCIS (College of Computing and Information Sciences)
     - CS → CCIS (College of Computing and Information Sciences)
     - Engineering → CCSE (College of Construction Sciences and Engineering)
     - Business → CBFS (College of Business and Financial Sciences)
     - Arts → CLAS (College of Liberal Arts and Sciences)

## Next Steps:

To apply these changes to your database, run:

```bash
cd c:\Users\Cj\Documents\UMAP\ refurbished\ 1.2\UMAP
python manage.py migrate
```

This will:
1. Update all existing user profiles with the new department codes
2. Ensure the database is ready for the new college/institute options

## Department Mapping:

### Colleges (12):
- CLAS – College of Liberal Arts and Sciences
- CHK – College of Human Kinetics
- CBFS – College of Business and Financial Sciences
- CCIS – College of Computing and Information Sciences
- CITE – College of Innovative Teacher Education
- HSU – Higher School ng UMak
- CGPP – College of Governance and Public Policy
- CCSE – College of Construction Sciences and Engineering
- CET – College of Engineering Technology
- CTHM – College of Tourism and Hospitality Management
- CCAPS – College of Continuing, Advanced and Professional Studies
- SOL – School of Law

### Institutes (10):
- IAD – Institute of Arts and Designs
- IOA – Institute of Accountancy
- IOP – Institute of Pharmacy
- ION – Institute of Nursing
- IIHS – Institute of Imaging and Health Sciences
- ITEST – Institute of Technical Education and Skills Training
- ISDNB – Institute of Social Development and Nation Building
- IOPsy – Institute of Psychology
- ISW – Institute of Social Work
- IDEM – Institute of Disaster and Emergency Management
