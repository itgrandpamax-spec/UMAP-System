from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.core.exceptions import ValidationError
from django.db import models
from .models import Schedule, Room, Floor, RoomProfile
from .room_manager import RoomNameManager
import json
import os
import signal
import re
import tempfile
import pdfplumber
import random
from contextlib import contextmanager
from datetime import datetime, timedelta
from django.db import IntegrityError
import traceback
from django.contrib import messages
from openpyxl import Workbook
from . import schedule_export


@contextmanager
def timeout(seconds):
    """Context manager for timeouts. Works on Unix systems, no-op on Windows."""
    if os.name == 'nt':  # Windows: no signal alarm
        yield
        return

    import signal

    def timeout_handler(signum, frame):
        raise TimeoutError(f"Processing took more than {seconds} seconds")

    original_handler = signal.signal(signal.SIGALRM, timeout_handler)
    try:
        signal.alarm(seconds)
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, original_handler)


def _parse_days(raw):
    """
    Convert day abbreviations into list of full day names.
    Examples handled:
      Common patterns:
      - "MTH" -> ["Monday","Thursday"]
      - "TF"  -> ["Tuesday","Friday"]
      - "W"   -> ["Wednesday"]
      - "TTH", "T-TH", "T/TH" -> ["Tuesday", "Thursday"]
      - "MWF" -> ["Monday", "Wednesday", "Friday"]
      - "MW" -> ["Monday", "Wednesday"]
      
      COR formats:
      - "M/W/F" -> ["Monday", "Wednesday", "Friday"] 
      - "T/TH" -> ["Tuesday", "Thursday"]
      - "M/TH" -> ["Monday", "Thursday"]
      - "/ W /" -> ["Wednesday"]
      - "SUN" -> ["Sunday"]
      
      Single letters:
      - "M" -> ["Monday"]
      - "T" -> ["Tuesday"]
      - "W" -> ["Wednesday"]
      - "TH" -> ["Thursday"]
      - "F" -> ["Friday"]
      - "S" -> ["Saturday"]
    """
    if not raw:
        return []

    raw_u = (raw or "").upper()
    # remove whitespace and delimiters for analysis but keep the original tokens for other heuristics
    tmp = re.sub(r'[^A-Z]', '', raw_u)

    days = []
    # Handle common combinations first
    combinations = {
        'MWF': ['Monday', 'Wednesday', 'Friday'],
        'MW': ['Monday', 'Wednesday'],
        'TR': ['Tuesday', 'Thursday'],
        'TTH': ['Tuesday', 'Thursday'],
        'T-TH': ['Tuesday', 'Thursday'],
        'T/TH': ['Tuesday', 'Thursday'],
        'TF': ['Tuesday', 'Friday'],
        'MTH': ['Monday', 'Thursday'],
    }
    
    # Sort by length in reverse order to match longer combinations first
    for pattern, day_list in sorted(combinations.items(), key=lambda x: len(x[0]), reverse=True):
        if pattern in raw_u:
            for day in day_list:
                if day not in days:
                    days.append(day)
            tmp = re.sub(pattern, '', tmp)
    # handle explicit words first
    if 'SUNDAY' in raw_u or 'SUN' in tmp:
        days.append('Sunday')
        tmp = tmp.replace('SUN', '')
    if 'MONDAY' in raw_u or 'MON' in tmp:
        days.append('Monday')
        tmp = tmp.replace('MON', '')
    if 'TUESDAY' in raw_u or 'TUE' in tmp:
        days.append('Tuesday')
        tmp = tmp.replace('TUE', '')
    if 'WEDNESDAY' in raw_u or 'WED' in tmp:
        days.append('Wednesday')
        tmp = tmp.replace('WED', '')
    if 'THURSDAY' in raw_u or 'TH' in tmp:
        # catch TH before single-letter processing
        days.append('Thursday')
        tmp = tmp.replace('TH', '')
    if 'FRIDAY' in raw_u or 'F' in tmp:
        days.append('Friday')
        tmp = tmp.replace('F', '')
    if 'SATURDAY' in raw_u or 'SAT' in tmp:
        days.append('Saturday')
        tmp = tmp.replace('SAT', '')

    # If still letters remain, map single letters M/T/W/F/S -> weekdays
    single_map = {'M': 'Monday', 'T': 'Tuesday', 'W': 'Wednesday', 'F': 'Friday', 'S': 'Saturday'}
    for ch in tmp:
        if ch in single_map and single_map[ch] not in days:
            days.append(single_map[ch])

    # If still empty but original raw contains slashes with isolated letters, try split-by-slash approach
    if not days:
        tokens = [t.strip() for t in re.split(r'[/\n,;]+', raw_u) if t.strip()]
        for token in tokens:
            token_letters = re.sub(r'[^A-Z]', '', token)
            # token may be like "T F" or "TF"
            if token_letters == '':
                continue
            # replace TH first
            if 'TH' in token_letters:
                if 'Thursday' not in days:
                    days.append('Thursday')
                token_letters = token_letters.replace('TH', '')
            for ch in token_letters:
                if ch in single_map and single_map[ch] not in days:
                    days.append(single_map[ch])

    # final fallback: if nothing parsed, return empty (caller can fallback to Monday if desired)
    return days


def _extract_time_ranges(time_cell_text):
    """Return list of (start_time_obj, end_time_obj) pairs found in a cell text.
    
    Handles various time formats:
    - 12-hour format with AM/PM:
        - 9:00 AM - 10:30 AM
        - 9AM - 10:30AM
        - 9:00AM-10:30AM
        
    - 24-hour format:
        - 0900-1030
        - 09:00-10:30
        - 0900 - 1030
        
    - Mixed formats:
        - 9:00-14:30
        - 0900-2:30PM
        
    Also handles various separators and spacing:
        - Hyphen: -
        - En dash: –
        - Space around separators or none
    
    Handles dot (.) as a separator between multiple time ranges
    """
    if not time_cell_text:
        return []

    # Normalize the text
    time_cell_text = str(time_cell_text).upper().strip()
    
    # Split by dots that are followed/preceded by digits (to separate multiple time ranges)
    # Keep the dots in the parts so patterns can still work
    time_segments = []
    current_segment = ""
    for i, char in enumerate(time_cell_text):
        current_segment += char
        # Split on dot if next character is a digit (or start of new segment)
        if char == "." and i + 1 < len(time_cell_text) and time_cell_text[i + 1].isdigit():
            if current_segment.strip():
                time_segments.append(current_segment.rstrip(".").strip())
            current_segment = ""
    if current_segment.strip():
        time_segments.append(current_segment.strip())
    
    # If no segments created, use the whole text
    if not time_segments:
        time_segments = [time_cell_text]
    
    # Common patterns in CORs and class schedules
    patterns = [
        # 12-hour format with AM/PM
        r'(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))',
        # 24-hour format HHMM-HHMM
        r'(\d{2})(\d{2})\s*[-–]\s*(\d{2})(\d{2})',
        # HH:MM-HH:MM (could be 12 or 24 hour)
        r'(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})',
        # Mixed format: HH:MM-HH:MMAM/PM
        r'(\d{1,2}(?::\d{2})?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))',
        # Basic format: H-H (AM/PM inherited)
        r'(\d{1,2})\s*[-–]\s*(\d{1,2})\s*([AaPp][Mm])'
    ]
    
    pairs = []
    for segment in time_segments:
        for pattern in patterns:
            matches = re.findall(pattern, segment, flags=re.I)
            for match in matches:
                try:
                    if len(match) == 2:  # Pattern with AM/PM
                        st = datetime.strptime(match[0].strip(), "%I:%M %p").time()
                        et = datetime.strptime(match[1].strip(), "%I:%M %p").time()
                    elif len(match) == 4:  # Military time pattern HHMM-HHMM
                        st = datetime.strptime(f"{match[0]}:{match[1]}", "%H:%M").time()
                        et = datetime.strptime(f"{match[2]}:{match[3]}", "%H:%M").time()
                    else:  # HH:MM-HH:MM pattern
                        st = datetime.strptime(match[0], "%H:%M").time()
                        et = datetime.strptime(match[1], "%H:%M").time()
                    pairs.append((st, et))
                except ValueError:
                    continue

    # If no matches found but text contains times, try multiple parsing approaches
    if not pairs and re.search(r'\d', time_cell_text):
        # Try to find any time formats with flexible patterns
        time_matches = re.findall(
            r'(\d{1,2}(?::\d{2})?(?:\s*[AaPp][Mm])?|\d{4})', 
            time_cell_text
        )
        
        if len(time_matches) >= 2:
            time_formats = [
                "%I:%M %p",    # 12-hour with minutes and AM/PM
                "%I%p",        # 12-hour without minutes (e.g., 9AM)
                "%I:%M%p",     # 12-hour with minutes, no space (9:00AM)
                "%H:%M",       # 24-hour with minutes
                "%H%M"         # Military time (e.g., 0900)
            ]
            
            # Try each format pair
            for fmt in time_formats:
                try:
                    st = datetime.strptime(time_matches[0].strip(), fmt).time()
                    et = datetime.strptime(time_matches[1].strip(), fmt).time()
                    if et > st:  # Only add if end time is after start time
                        pairs.append((st, et))
                        break
                except ValueError:
                    continue
            
            # If still no match, try mixed formats (e.g., "9:00-14:30" or "0900-2:30PM")
            if not pairs:
                try:
                    # Try first time as 24-hour and second as 12-hour
                    st = datetime.strptime(time_matches[0].strip(), "%H%M").time()
                    et = datetime.strptime(time_matches[1].strip(), "%I:%M %p").time()
                    if et > st:
                        pairs.append((st, et))
                except ValueError:
                    try:
                        # Try first time as 12-hour and second as 24-hour
                        st = datetime.strptime(time_matches[0].strip(), "%I:%M %p").time()
                        et = datetime.strptime(time_matches[1].strip(), "%H%M").time()
                        if et > st:
                            pairs.append((st, et))
                    except ValueError:
                        pass

    return pairs


def _clean_room_text(raw_room):
    """
    Normalize room text by removing day-of-week mentions and returning building+room when possible.
    
    Common COR formats handled:
    - Building codes with room numbers:
        - "HPSB - 1009" -> "HPSB - 1009"
        - "GCA-301" -> "GCA-301"
        - "AS 204" -> "AS 204"
        
    - Virtual/remote indicators:
        - "HPSB - 1009/ VR-MON" -> "HPSB - 1009"
        - "/ VR-WED" -> "TBA"
        - "ONLINE CLASS" -> "TBA"
        
    - Mixed formats:
        - "Room 301/GCA" -> "GCA-301"
        - "AS204/TTH" -> "AS 204"
        - "RM. B12-A" -> "B12-A"
    """
    if not raw_room:
        return "TBA"
    s = str(raw_room).strip().upper()  # Convert to uppercase for consistency
    if not s:
        return "TBA"
        
    # Handle common virtual/online indicators
    virtual_patterns = [
        r'\bVR\b',
        r'\bVIRTUAL\b', 
        r'\bONLINE\b',
        r'\bREMOTE\b',
        r'\bZOOM\b'
    ]
    if any(re.search(pattern, s) for pattern in virtual_patterns):
        if not re.search(r'\d', s):  # If no room number present
            return "TBA"
    
    # Handle empty or purely virtual rooms
    if s in ('VR', 'VIRTUAL', 'ONLINE', 'REMOTE', 'TBA', 'N/A'):
        return "TBA"

    # split tokens by common delimiters
    tokens = [t.strip() for t in re.split(r'[/,;\n]+', s) if t.strip()]

    # Pattern for matching day abbreviations and tokens, including COR formats
    day_pattern = re.compile(
        r"(?i)\b(?:"
        r"MON(?:DAY)?|"
        r"TUE(?:S(?:DAY)?)?|"
        r"WED(?:NESDAY)?|"
        r"THU(?:RS(?:DAY)?)?|TH|"
        r"FRI(?:DAY)?|"
        r"SAT(?:URDAY)?|"
        r"SUN(?:DAY)?|"
        r"MTH|"
        r"TF|"
        r"MWF|"
        r"MW|"
        r"TR|"
        r"M|T|W|F|S"
        r")\b"
    )

    # Try to extract building code and room number
    building_room_pattern = re.compile(
        r'(?:'
        r'([A-Z]+)[-\s]*(\d+[A-Z]?(?:-[A-Z0-9]+)?)|'  # Format: AS 204, GCA-301, B12-A
        r'(?:ROOM|RM\.?)\s*(\d+[A-Z]?(?:-[A-Z0-9]+)?)|'  # Format: Room 301, RM. B12-A
        r'(\d+[A-Z]?(?:-[A-Z0-9]+)?)'  # Just the room number
        r')', 
        re.I
    )
    
    # First try finding building+room combinations
    for t in tokens:
        match = building_room_pattern.search(day_pattern.sub('', t))
        if match:
            groups = match.groups()
            if groups[0]:  # Building code with room
                return f"{groups[0].upper()} {groups[1]}"
            elif groups[2]:  # Room with explicit label
                # Check if previous token might be a building code
                prev_token_idx = tokens.index(t) - 1
                if prev_token_idx >= 0:
                    prev = tokens[prev_token_idx].upper()
                    if re.match(r'^[A-Z]{2,}$', prev):  # Looks like a building code
                        return f"{prev} {groups[2]}"
                return groups[2]
            elif groups[3]:  # Just room number
                # Check for building code in other tokens
                for other in tokens:
                    if other != t and re.match(r'^[A-Z]{2,}$', other.upper()):
                        return f"{other.upper()} {groups[3]}"
                return groups[3]
    
    # If no building+room found, look for any token with digits
    for t in tokens:
        if re.search(r'\d', t):
            cleaned = day_pattern.sub('', t)  # Remove day mentions
            cleaned = re.sub(r'[-–—]+', '-', cleaned)  # Normalize dashes
            cleaned = re.sub(r'\s*[-–—]\s*', '-', cleaned)  # Remove spaces around dashes
            cleaned = re.sub(r'\s{2,}', ' ', cleaned).strip(' -:,.')
            if cleaned:
                return cleaned
    
    # As a fallback, look for any building code
    for t in tokens:
        if re.match(r'^[A-Z]{2,}$', t.upper()) and not day_pattern.search(t):
            return t.upper()
    
    # If still nothing found that makes sense, return TBA
    return "TBA"


def _find_existing_room_by_number(room_number: str):
    """
    Find an existing Room in the database by room number.
    Returns: Room object if found, else None
    
    This ensures schedules only match existing rooms in the system.
    """
    if not room_number or room_number == "TBA":
        return None
    
    try:
        # Try to find room by exact match on profile number
        room = Room.objects.filter(profile__number=room_number).first()
        if room:
            return room
        
        # Try case-insensitive match
        room = Room.objects.filter(profile__number__iexact=room_number).first()
        if room:
            return room
        
        return None
        
    except Exception as e:
        print(f"Error looking up room {room_number}: {e}")
        return None


def _has_overlap(user, day, start, end):

    """
    Return True if the given time range overlaps any existing Schedule for the same user and day.
    Overlap test: existing.start < new_end and existing.end > new_start
    """
    from datetime import time as _time
    qs = Schedule.objects.filter(user=user, day=day)
    # If no existing, no overlap
    if not qs.exists():
        return False
    # Check for any overlap
    for ex in qs:
        if (ex.start < end) and (ex.end > start):
            return True
    return False


@login_required
@login_required(login_url='login')
def schedule_view(request):
    print("\n=== Schedule View Debug ===")
    print("Current user:", request.user.username)
    print("Current user ID:", request.user.id)
    
    # Get all schedules for current user, ordered by start time
    schedules = Schedule.objects.filter(user=request.user).order_by('start')
    
    # Debug information
    print("\nAll schedules in database:")
    all_schedules = Schedule.objects.all()
    total_count = all_schedules.count()
    user_count = schedules.count()
    
    print(f"Total schedules in database: {total_count}")
    print(f"Schedules for current user: {user_count}")
    
    if total_count > 0 and user_count == 0:
        # This would indicate schedules exist but none belong to current user
        print("\nSchedules by user:")
        for result in Schedule.objects.values('user__username').annotate(count=models.Count('id')).order_by('user__username'):
            print(f"- {result['user__username']}: {result['count']} schedules")
            
    # Initialize schedule data list
    schedule_data = []
    colors = ['blue', 'green', 'purple', 'red', 'yellow']
    color_index = 0
    
    for s in schedules:
        try:
            # Format times as HH:MM
            start = s.start.strftime('%H:%M') if s.start else '00:00'
            end = s.end.strftime('%H:%M') if s.end else '00:00'
            
            # Assign a color if none is set
            if not s.color or s.color not in colors:
                s.color = colors[color_index]
                color_index = (color_index + 1) % len(colors)
                s.save()

            # Get room number, falling back to TBA if not available
            room_text = "TBA"
            if s.room_text:
                # Use the stored original room text (e.g., "HPSB 1009")
                room_text = s.room_text
            elif s.room:
                try:
                    room_text = s.room.profile.number if hasattr(s.room, 'profile') else str(s.room)
                except:
                    pass

            # Create schedule item with converted field names to match frontend
            schedule_item = {
                "id": s.id,
                "course_code": s.course_code or "",
                "subject_name": s.subject or "",  # Convert subject → subject_name
                "day": s.day,
                "start_time": start,  # Convert start → start_time
                "end_time": end,      # Convert end → end_time
                "room": room_text,    # Use original room text or room number
                "color": s.color or colors[0]  # Fallback to first color if none set
            }
            schedule_data.append(schedule_item)
        except Exception as e:
            print(f"Error processing schedule {s.id}:", str(e))

    # Convert schedule data to JSON and debug output
    json_data = json.dumps(schedule_data)
    print("\nSchedule data for current user:")
    print("- Number of schedules:", len(schedule_data))
    print("- JSON data being sent to template:", json_data)
    
    # Render template with JSON-encoded schedule data
    return render(request, "UMAP_App/Users/Users_Schedule.html", {
        "schedule_data": json_data
    })


@login_required
def add_class(request):
    from .views import track_activity, UserActivity

    if request.method == "POST":
        try:
            # Extract data from POST
            class_data = {
                'course_code': request.POST.get('course_code'),
                'subject': request.POST.get('subject'),
                'room': request.POST.get('room'),
                'day': request.POST.get('day'),
                'start': request.POST.get('start'),
                'end': request.POST.get('end'),
                'color': request.POST.get('color', 'blue')
            }
            
            # Validate required fields
            required_fields = ['course_code', 'subject', 'room', 'day', 'start', 'end']
            missing_fields = [field for field in required_fields if not class_data.get(field)]
            if missing_fields:
                return JsonResponse({
                    'success': False,
                    'error': f'Missing required fields: {", ".join(missing_fields)}'
                }, status=400)
            
            # Convert times from string to time objects
            try:
                start = datetime.strptime(class_data['start'], '%H:%M').time()
                end = datetime.strptime(class_data['end'], '%H:%M').time()
            except ValueError as e:
                return JsonResponse({
                    'success': False,
                    'error': 'Invalid time format. Please use HH:MM format.'
                }, status=400)

            # Check time validity
            if start >= end:
                return JsonResponse({
                    'success': False,
                    'error': 'End time must be after start time.'
                }, status=400)

            # Check for time overlap
            if _has_overlap(request.user, class_data['day'], start, end):
                return JsonResponse({
                    'success': False,
                    'error': 'You already have a class scheduled at this time.'
                }, status=400)

            # Try to find existing room - if not found, use a placeholder
            room = _find_existing_room_by_number(class_data['room'])
            if not room:
                # Room doesn't exist in system - use placeholder/default room
                # This allows displaying the schedule even if room doesn't exist
                floor = Floor.objects.first()
                if not floor:
                    floor = Floor.objects.create(name="Default Floor", building="Main Building")
                
                # Get or create a TBA/Unknown room that serves as placeholder
                placeholder_room = Room.objects.filter(profile__number="TBA").first()
                if not placeholder_room:
                    placeholder_room = Room.objects.create(floor=floor)
                    RoomProfile.objects.create(
                        room=placeholder_room,
                        number="TBA",
                        name="To Be Announced",
                        type="Unknown"
                    )
                room = placeholder_room
                print(f"ℹ️ Room '{class_data['room']}' not in system - using placeholder")

            # Create new class schedule
            new_class = Schedule.objects.create(
                user=request.user,
                course_code=class_data['course_code'],
                subject=class_data['subject'],
                room=room,
                day=class_data['day'],
                start=start,
                end=end,
                color=class_data['color'],
                room_text=class_data['room']  # Store original room text
            )

            track_activity(request.user, UserActivity.ActivityType.SCHEDULE_ADD, 
                         details={
                             'course_code': class_data['course_code'],
                             'subject': class_data['subject'],
                             'room': class_data['room'],
                             'day': class_data['day']
                         }, 
                         request=request)

            messages.success(request, '✅ Class added successfully!')
            return redirect('schedule_view')

        except Exception as e:
            messages.error(request, f'❌ Error adding class: {str(e)}')
            return redirect('schedule_view')

    messages.error(request, '❌ Invalid request method')
    return redirect('schedule_view')


@login_required
def upload_schedule(request):
    if request.method != "POST":
        return redirect("schedule_view")

    pdf_file = request.FILES.get("schedule_pdf")
    if not pdf_file:
        messages.error(request, "❌ No PDF file provided")
        return redirect("schedule_view")

    if not pdf_file.name.lower().endswith(".pdf"):
        messages.error(request, "❌ File must be a PDF")
        return redirect("schedule_view")

    if pdf_file.size > 10 * 1024 * 1024:
        messages.error(request, "❌ File is too large (max 10MB)")
        return redirect("schedule_view")

    # Delete all existing schedules for this user
    Schedule.objects.filter(user=request.user).delete()

    temp_file = None
    schedule_count = 0
    parsed_rows = []  # hold rows for Excel export

    try:
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        for chunk in pdf_file.chunks():
            temp_file.write(chunk)
        temp_file.flush()

        with pdfplumber.open(temp_file.name) as pdf:
            for page in pdf.pages:
                # Try to find table in multiple ways
                table = None
                try:
                    # Try normal table extraction first
                    table = page.extract_table()
                    
                    if not table:
                        # If no table found, try with different settings
                        table = page.extract_table({
                            'vertical_strategy': 'text',
                            'horizontal_strategy': 'text',
                            'intersection_y_tolerance': 10
                        })
                except Exception:
                    pass

                if table and len(table) > 1:
                    # Clean and normalize header row
                    header = [(str(h).strip().upper() if h else "") for h in table[0]]
                    
                    # Skip rows until we find a valid header row
                    header_row_idx = 0
                    for idx, row in enumerate(table):
                        row_text = " ".join(str(cell).strip().upper() for cell in row if cell)
                        if any(key in row_text for key in ["COURSE", "SUBJECT", "TIME", "ROOM"]):
                            header = [(str(h).strip().upper() if h else "") for h in row]
                            header_row_idx = idx
                            break
                    
                    # Remove rows before the header
                    table = table[header_row_idx:]

                    def _find_header_index(headers, keys):
                        """Find index of first matching key in headers using multiple match strategies"""
                        for i, header in enumerate(headers):
                            # Skip empty headers
                            if not header:
                                continue
                            
                            header = str(header).strip().upper()
                            
                            # Try exact match first
                            if header in keys:
                                return i
                            
                            # Try case-insensitive contains
                            for key in keys:
                                if key.upper() in header:
                                    return i
                            
                            # Try matching individual words
                            header_words = set(header.split())
                            for key in keys:
                                key_words = set(key.upper().split())
                                if header_words & key_words:  # Check for any word overlap
                                    return i
                        
                        return None

                    # More flexible header detection for COR format
                    idx_code = _find_header_index(header, ["COURSE CODE", "COURSE NO", "SUBJ CODE", "SUBJECT CODE"]) or 0
                    idx_desc = _find_header_index(header, ["DESCRIPTION", "TITLE", "SUBJECT", "COURSE TITLE"]) or 1
                    idx_time = _find_header_index(header, ["TIME", "SCHEDULE"]) or 2
                    idx_days = _find_header_index(header, ["DAYS", "DAY"]) or 3
                    idx_room = _find_header_index(header, ["ROOM", "RM", "ROOM NO", "VENUE"]) or 4

                    for row in table[1:]:
                        row = [(cell or "").strip() for cell in row] + [""] * 8
                        course_code = row[idx_code]
                        subject = row[idx_desc]
                        time_cell = row[idx_time]
                        days_cell = row[idx_days]
                        room_cell = _clean_room_text(row[idx_room] or "TBA")

                        if not course_code or not subject:
                            continue

                        time_ranges = _extract_time_ranges(time_cell)
                        if not time_ranges:
                            time_ranges = _extract_time_ranges(" ".join(re.split(r'[/\n]+', time_cell)))

                        day_tokens = [t.strip() for t in re.split(r'[/\n.]+', days_cell) if t.strip()]
                        if not day_tokens and days_cell:
                            day_tokens = [days_cell]

                        if not time_ranges:
                            continue

                        # Debug: log what we extracted
                        print(f"DEBUG: course_code={course_code}, subject={subject}")
                        print(f"DEBUG: raw days_cell='{days_cell}'")
                        print(f"DEBUG: time_ranges count={len(time_ranges)}, ranges={[(s.strftime('%H:%M'), e.strftime('%H:%M')) for s, e in time_ranges]}")
                        print(f"DEBUG: day_tokens (after split and filter)={day_tokens}")

                        # If we have multiple time ranges but single day token, parse the day token
                        # to see if it contains multiple days (e.g., "MTH" = Monday & Thursday)
                        expanded_from_single_token = False
                        if len(time_ranges) > 1 and len(day_tokens) == 1:
                            parsed_days_from_single_token = _parse_days(day_tokens[0])
                            if len(parsed_days_from_single_token) == len(time_ranges):
                                # Perfect match: use parsed days directly
                                day_tokens = parsed_days_from_single_token
                                expanded_from_single_token = True
                                print(f"DEBUG: Expanded single day token to {day_tokens}")

                        # Only process time ranges that have corresponding day tokens
                        # Don't cycle through days if we have more time ranges than days
                        for idx_tr, (st, et) in enumerate(time_ranges):
                            if idx_tr >= len(day_tokens):
                                # Stop processing if we've exhausted day tokens
                                # This prevents creating unwanted schedules
                                print(f"DEBUG: Skipping idx_tr={idx_tr} because idx_tr >= len(day_tokens)={len(day_tokens)}")
                                break
                            
                            raw_day = day_tokens[idx_tr]
                            
                            # If we already expanded from a single token, the day_tokens are full day names
                            # and don't need further parsing
                            if expanded_from_single_token:
                                parsed_days = [raw_day]
                            else:
                                parsed_days = _parse_days(raw_day) or ["Monday"]
                            
                            time_str = f"{st.strftime('%H:%M')}-{et.strftime('%H:%M')}"
                            print(f"DEBUG:   idx_tr={idx_tr}: raw_day='{raw_day}', parsed_days={parsed_days}, time={time_str}")

                            for day in parsed_days:
                                try:
                                    if _has_overlap(request.user, day, st, et):
                                        continue

                                    # Define available colors directly
                                    available_colors = ['blue', 'green', 'purple', 'red', 'yellow']
                                    
                                    # Try to find existing room
                                    room = _find_existing_room_by_number(room_cell)
                                    
                                    if not room:
                                        # Room not found - use placeholder instead of creating
                                        floor = Floor.objects.first()
                                        if not floor:
                                            floor = Floor.objects.create(name="Default Floor", building="Main Building")
                                        
                                        placeholder_room = Room.objects.filter(profile__number="TBA").first()
                                        if not placeholder_room:
                                            placeholder_room = Room.objects.create(floor=floor)
                                            RoomProfile.objects.create(
                                                room=placeholder_room,
                                                number="TBA",
                                                name="To Be Announced",
                                                type="Unknown"
                                            )
                                        room = placeholder_room
                                        print(f"ℹ️ Room '{room_cell}' from schedule not in system - displaying as '{room_cell}'")
                                    else:
                                        print(f"✓ Found existing room {room.profile.number} ({room.profile.name})")

                                    try:
                                        print(f"Creating schedule for user {request.user.username} (ID: {request.user.id})")
                                        schedule = Schedule.objects.create(
                                            user=request.user,  # Explicitly set the user
                                            course_code=course_code,
                                            subject=subject,
                                            room=room,
                                            day=day,
                                            start=st,
                                            end=et,
                                            color=random.choice(available_colors),
                                            room_text=room_cell  # Store original room text
                                        )
                                        print(f"Created schedule {schedule.id} for {schedule.user.username}")
                                        schedule_count += 1

                                        # save to parsed rows for Excel
                                    except Exception as e:
                                        print(f"Error creating schedule for user {request.user.username}: {str(e)}")
                                        continue
                                    parsed_rows.append([
                                        course_code,
                                        subject,
                                        day,
                                        st.strftime("%I:%M %p"),
                                        et.strftime("%I:%M %p"),
                                        room_cell
                                    ])
                                except IntegrityError:
                                    continue

        # create Excel with openpyxl if any rows parsed
        if parsed_rows:
            wb = Workbook()
            ws = wb.active
            ws.title = "Schedule"
            ws.append(["Course Code", "Title", "Day", "Start Time", "End Time", "Room"])
            for row in parsed_rows:
                ws.append(row)

            excel_path = os.path.join(tempfile.gettempdir(), f"{request.user.username}_schedule.xlsx")
            wb.save(excel_path)

            request.session["last_schedule_excel"] = excel_path

        if schedule_count > 0:
            messages.success(request, f"✅ Imported {schedule_count} schedules! Excel copy saved too.")
        else:
            messages.warning(request, "⚠️ No valid schedules imported from the PDF.")

    except Exception as e:
        messages.error(request, f"❌ Error processing PDF: {e}")
    finally:
        if temp_file:
            try:
                temp_file.close()
                os.unlink(temp_file.name)
            except Exception:
                pass

    return redirect("schedule_view")


@login_required
@require_http_methods(["GET", "POST", "DELETE"])
def schedule_class_detail(request, class_id):
    try:
        class_item = get_object_or_404(Schedule, id=class_id, user=request.user)

        if request.method == 'DELETE' or (request.method == 'POST' and request.POST.get('_method') == 'DELETE'):
            class_item.delete()
            return JsonResponse({'success': True, 'message': '✅ Schedule deleted successfully'})

        elif request.method == 'POST':
            data = request.POST
            if 'day' in data and 'start' in data:
                class_item.day = data['day']
                class_item.start = datetime.strptime(data['start'], '%H:%M').time()
                class_item.save()
            elif 'duration' in data:
                new_duration = int(data['duration'])
                class_item.end = (datetime.combine(datetime.today(), class_item.start) +
                                     timedelta(hours=new_duration)).time()
                class_item.save()

            return JsonResponse({'success': True})

    except Schedule.DoesNotExist:
        return JsonResponse({'error': 'Class not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@login_required
def delete_class(request, schedule_id):
    try:
        schedule = get_object_or_404(Schedule, id=schedule_id, user=request.user)
        details = {
            'course_code': schedule.course_code,
            'subject': schedule.subject,
            'day': schedule.day
        }
        schedule.delete()
        
        from .views import track_activity, UserActivity
        track_activity(request.user, UserActivity.ActivityType.SCHEDULE_DELETE, 
                      details=details, request=request)
                      
        messages.success(request, "✅ Class deleted successfully")
    except Schedule.DoesNotExist:
        messages.error(request, "❌ Schedule not found")
    except Exception as e:
        messages.error(request, f"❌ Error deleting schedule: {str(e)}")
    return redirect('schedule_view')


@login_required
def delete_all_schedules(request):
    if request.method == 'POST':
        try:
            deleted_count = Schedule.objects.filter(user=request.user).delete()[0]
            messages.success(request, f"✅ Successfully deleted {deleted_count} schedule(s)")
        except Exception as e:
            messages.error(request, f"❌ Error deleting schedules: {str(e)}")

    return redirect('schedule_view')


@login_required
def export_schedule(request, format_type):
    """Export schedule in the specified format (excel, pdf, or ical)"""
    return schedule_export.export_schedule(request, format_type)
