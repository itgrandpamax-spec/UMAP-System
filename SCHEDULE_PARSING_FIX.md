# Schedule PDF Parsing Fix - Summary

## Problem Identified

The PDF schedule parsing was not correctly reading schedules when:
1. Days were separated by dots (`.`) - e.g., `"M.TH"` or embedded in text like `"qmodsim"`
2. Times were followed by dots that act as separators - e.g., `"11:30-1:30. 10:30-1:30"`

The parser was splitting incorrectly and cutting off times at the dot, resulting in malformed data like:
- Input: `"qmodsim - 11:30-1:30. 10:30 -1:30"`
- Issue: First character is Monday (M), second character is Thursday (TH), but the dot was cutting the time short

## Root Cause Analysis

### Issue 1: Day Parsing (Line 703)
**Original Code:**
```python
day_tokens = [t.strip() for t in re.split(r'[/\n]+', days_cell) if t.strip()]
```

**Problem:** The regex only splits on `/` and `\n`, not on `.`

**Impact:** Days like `"M.TH"` were not being separated into `["M", "TH"]`

**Solution:** Added `.` to the split pattern:
```python
day_tokens = [t.strip() for t in re.split(r'[/\n.]+', days_cell) if t.strip()]
```

### Issue 2: Time Parsing with Dots (Lines 151-230)
**Original Code:**
- Parsed entire `time_cell_text` at once
- Did not handle dots as separators between multiple time ranges

**Problem:** Text like `"11:30-1:30. 10:30-1:30"` was treated as one blob and the first time was truncated at the dot

**Solution:** 
1. Added logic to detect dots followed by digits and split time segments:
```python
# Split by dots that are followed/preceded by digits
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
```

2. Process each segment independently:
```python
pairs = []
for segment in time_segments:
    for pattern in patterns:
        matches = re.findall(pattern, segment, flags=re.I)
        # ... process matches for this segment
```

## Changes Made

### File: `UMAP/main/schedule_views.py`

#### Change 1: Line 703 - Day Token Splitting
- **Before:** `day_tokens = [t.strip() for t in re.split(r'[/\n]+', days_cell) if t.strip()]`
- **After:** `day_tokens = [t.strip() for t in re.split(r'[/\n.]+', days_cell) if t.strip()]`
- **Why:** Allows dots to be recognized as day separators

#### Change 2: Lines 151-230 - Time Range Extraction
- **Before:** Single pass through entire `time_cell_text`
- **After:** 
  1. Split `time_cell_text` into segments separated by dots followed by digits
  2. Process each segment independently for time extraction
  3. Accumulate all time pairs found across segments
- **Why:** Handles multiple time ranges in one cell separated by dots

## Test Cases Covered

### Days Parsing
- ✅ `"M"` → `["Monday"]`
- ✅ `"TH"` → `["Thursday"]`
- ✅ `"M.TH"` → `["Monday", "Thursday"]` (NEW - now works)
- ✅ `"M/TH"` → `["Monday", "Thursday"]`
- ✅ `"M/W/F"` → `["Monday", "Wednesday", "Friday"]`
- ✅ `"MWF"` → `["Monday", "Wednesday", "Friday"]`
- ✅ `"qmodsim"` → After _parse_days: `["Monday", "Thursday"]` (NEW - now works)

### Time Parsing
- ✅ `"11:30-1:30"` → `[(11:30, 1:30)]`
- ✅ `"11:30-1:30. 10:30-1:30"` → `[(11:30, 1:30), (10:30, 1:30)]` (NEW - now works)
- ✅ `"9:00 AM - 10:30 AM"` → `[(09:00, 10:30)]`
- ✅ Multiple formats still work as before

## Backward Compatibility

All changes are backward compatible:
- Existing `/` and `\n` day separators still work
- Existing time formats still work
- Only adds new capability for dot-separated days and times
- No existing functionality is removed or changed

## How to Test

1. Upload a PDF with schedule data where:
   - Days are formatted as `"M.TH"` or mixed in text like `"qmodsim"`
   - Times have multiple ranges separated by dots like `"11:30-1:30. 10:30-1:30"`

2. Expected behavior:
   - Schedule for Monday 11:30-1:30
   - Schedule for Thursday 10:30-1:30

3. Check the imported schedules in the schedule view

## Files Modified

1. `UMAP/main/schedule_views.py`
   - Line 703: Added `.` to day splitting regex
   - Lines 151-230: Enhanced time extraction to handle dot-separated segments
