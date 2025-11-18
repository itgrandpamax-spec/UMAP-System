#!/usr/bin/env python
"""
Test script to validate schedule PDF parsing fixes
Tests for dot-separated days and times
"""

import sys
import os
import re
from datetime import datetime

# Add the UMAP directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'UMAP'))

# Import the functions we're testing
from main.schedule_views import _parse_days, _extract_time_ranges

def test_parse_days():
    """Test _parse_days function with various formats"""
    print("=" * 60)
    print("Testing _parse_days function")
    print("=" * 60)
    
    test_cases = [
        ("M", ["Monday"]),
        ("TH", ["Thursday"]),
        ("M.TH", ["Monday", "Thursday"]),
        ("M/TH", ["Monday", "Thursday"]),
        ("M/W/F", ["Monday", "Wednesday", "Friday"]),
        ("MWF", ["Monday", "Wednesday", "Friday"]),
        ("MW", ["Monday", "Wednesday"]),
        ("TR", ["Tuesday", "Thursday"]),
        ("TTH", ["Tuesday", "Thursday"]),
        ("T/TH", ["Tuesday", "Thursday"]),
        ("MTH", ["Monday", "Thursday"]),
        ("qmodsim", ["Monday", "Thursday"]),  # Your example
    ]
    
    for input_str, expected in test_cases:
        result = _parse_days(input_str)
        status = "✅ PASS" if result == expected else "❌ FAIL"
        print(f"{status} | Input: '{input_str}' | Expected: {expected} | Got: {result}")

def test_extract_time_ranges():
    """Test _extract_time_ranges function with various formats"""
    print("\n" + "=" * 60)
    print("Testing _extract_time_ranges function")
    print("=" * 60)
    
    test_cases = [
        ("11:30-13:30", [(datetime.strptime("11:30", "%H:%M").time(), datetime.strptime("13:30", "%H:%M").time())]),
        ("11:30-1:30", [(datetime.strptime("11:30", "%H:%M").time(), datetime.strptime("01:30", "%H:%M").time())]),
        ("10:30-1:30", [(datetime.strptime("10:30", "%H:%M").time(), datetime.strptime("01:30", "%H:%M").time())]),
        ("11:30-1:30. 10:30-1:30", [
            (datetime.strptime("11:30", "%H:%M").time(), datetime.strptime("01:30", "%H:%M").time()),
            (datetime.strptime("10:30", "%H:%M").time(), datetime.strptime("01:30", "%H:%M").time())
        ]),
        ("9:00 AM - 10:30 AM", [(datetime.strptime("09:00", "%H:%M").time(), datetime.strptime("10:30", "%H:%M").time())]),
        ("9AM - 10:30AM", [(datetime.strptime("09:00", "%H:%M").time(), datetime.strptime("10:30", "%H:%M").time())]),
    ]
    
    for input_str, expected in test_cases:
        result = _extract_time_ranges(input_str)
        
        # Compare times
        if len(result) == len(expected):
            match = all(
                r[0] == e[0] and r[1] == e[1] 
                for r, e in zip(result, expected)
            )
        else:
            match = False
            
        status = "✅ PASS" if match else "❌ FAIL"
        print(f"{status} | Input: '{input_str}'")
        print(f"       | Expected: {expected}")
        print(f"       | Got: {result}")

if __name__ == "__main__":
    test_parse_days()
    test_extract_time_ranges()
    print("\n" + "=" * 60)
    print("Testing complete!")
    print("=" * 60)
