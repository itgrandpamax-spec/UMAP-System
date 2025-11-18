#!/usr/bin/env python
"""
Test the regex patterns for parsing schedule data
"""
import re

def test_day_splitting():
    """Test the day token splitting with dots"""
    print("=" * 60)
    print("Testing day token splitting")
    print("=" * 60)
    
    test_cases = [
        ("M.TH", ["M", "TH"]),
        ("M/TH", ["M", "TH"]),
        ("M/W/F", ["M", "W", "F"]),
        ("M\nTH", ["M", "TH"]),
        ("qmodsim", ["qmodsim"]),  # This will be handled by _parse_days
    ]
    
    for input_str, expected in test_cases:
        # Simulate the regex in schedule_views.py line 703
        result = [t.strip() for t in re.split(r'[/\n.]+', input_str) if t.strip()]
        status = "✅ PASS" if result == expected else "❌ FAIL"
        print(f"{status} | Input: '{input_str}' | Expected: {expected} | Got: {result}")

def test_time_segment_splitting():
    """Test the time segment splitting with dots"""
    print("\n" + "=" * 60)
    print("Testing time segment splitting")
    print("=" * 60)
    
    time_cell_text = "11:30-1:30. 10:30 -1:30"
    
    # Simulate the splitting logic from _extract_time_ranges
    time_segments = []
    current_segment = ""
    for i, char in enumerate(time_cell_text):
        current_segment += char
        # Split on dot if next character is a digit
        if char == "." and i + 1 < len(time_cell_text) and time_cell_text[i + 1].isdigit():
            if current_segment.strip():
                time_segments.append(current_segment.rstrip(".").strip())
            current_segment = ""
    if current_segment.strip():
        time_segments.append(current_segment.strip())
    
    # If no segments created, use the whole text
    if not time_segments:
        time_segments = [time_cell_text]
    
    print(f"Input: '{time_cell_text}'")
    print(f"Segments: {time_segments}")
    
    # Expected: ["11:30-1:30", "10:30 -1:30"]
    expected = ["11:30-1:30", "10:30 -1:30"]
    status = "✅ PASS" if time_segments == expected else "❌ FAIL"
    print(f"{status} | Expected: {expected}")

def test_time_patterns():
    """Test time extraction patterns"""
    print("\n" + "=" * 60)
    print("Testing time extraction patterns")
    print("=" * 60)
    
    patterns = [
        (r'(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})', "11:30-1:30", ["('11:30', '1:30')"]),
        (r'(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})', "10:30 - 1:30", ["('10:30', '1:30')"]),
        (r'(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})', "11:30-1:30. 10:30", ["('11:30', '1:30')"]),
    ]
    
    for pattern, input_str, expected_matches in patterns:
        matches = re.findall(pattern, input_str)
        status = "✅ PASS" if str(matches) == expected_matches[0] else "❌ FAIL"
        print(f"{status} | Pattern matches in '{input_str}': {matches}")

if __name__ == "__main__":
    test_day_splitting()
    test_time_segment_splitting()
    test_time_patterns()
    print("\n" + "=" * 60)
    print("Regex testing complete!")
    print("=" * 60)
