#!/usr/bin/env python
import os
import sys
import django

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMAP.settings')
sys.path.insert(0, r'c:\Users\Cj\Documents\UMAP refurbished 1.2\UMAP')
django.setup()

from main.schedule_views import _parse_days

# Test cases
test_cases = [
    ("M", ["Monday"]),
    ("TH", ["Thursday"]),
    ("Monday", ["Monday"]),
    ("Thursday", ["Thursday"]),
    ("MTH", ["Monday", "Thursday"]),
    ("M.TH", ["Monday", "Thursday"]),
    ("MWF", ["Monday", "Wednesday", "Friday"]),
    ("S", ["Saturday"]),
    ("SAT", ["Saturday"]),
    ("THURSDAY", ["Thursday"]),
]

print("Testing _parse_days() function:")
print("-" * 60)

all_pass = True
for input_val, expected in test_cases:
    result = _parse_days(input_val)
    passed = result == expected
    all_pass = all_pass and passed
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"{status}: _parse_days('{input_val}') = {result}")
    if not passed:
        print(f"       Expected: {expected}")

print("-" * 60)
print(f"Overall: {'ALL TESTS PASSED' if all_pass else 'SOME TESTS FAILED'}")
