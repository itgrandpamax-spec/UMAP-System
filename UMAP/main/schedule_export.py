from django.http import HttpResponse, FileResponse
from django.contrib.auth.decorators import login_required
from .models import Schedule
from openpyxl import Workbook
from datetime import datetime, timedelta
import os
import tempfile
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import icalendar
import pytz

@login_required
def export_schedule(request, format_type='excel'):
    """
    Export schedule in various formats:
    - Excel (.xlsx)
    - PDF
    - iCal (.ics)
    """
    schedules = Schedule.objects.filter(user=request.user).order_by('day', 'start')
    
    if not schedules.exists():
        return HttpResponse("No schedules found to export", status=404)
    
    if format_type == 'excel':
        return _export_excel(schedules, request.user.username)
    elif format_type == 'pdf':
        return _export_pdf(schedules, request.user.username)
    elif format_type == 'ical':
        return _export_ical(schedules, request.user.username)
    else:
        return HttpResponse("Unsupported format", status=400)

def _export_excel(schedules, username):
    """Export schedules to Excel format"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Class Schedule"
    
    # Headers
    headers = ["Day", "Course Code", "Subject Title", "Start Time", "End Time", "Room", "Color"]
    ws.append(headers)
    
    # Data rows
    for schedule in schedules:
        row = [
            schedule.day,
            schedule.course_code,
            schedule.subject,
            schedule.start.strftime("%I:%M %p"),
            schedule.end.strftime("%I:%M %p"),
            schedule.room.profile.number if hasattr(schedule.room, 'profile') else str(schedule.room),
            schedule.color
        ]
        ws.append(row)
    
    # Style the worksheet
    for column in range(1, len(headers) + 1):
        ws.column_dimensions[chr(64 + column)].width = 15
    
    # Create response
    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename=schedule_{username}.xlsx'
    wb.save(response)
    return response

def _export_pdf(schedules, username):
    """Export schedules to PDF format"""
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename=schedule_{username}.pdf'
    
    # Create PDF document
    doc = SimpleDocTemplate(response, pagesize=letter)
    elements = []
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    
    # Title
    elements.append(Paragraph(f"Class Schedule - {username}", title_style))
    elements.append(Spacer(1, 20))
    
    # Data for table
    data = [["Day", "Course Code", "Subject", "Time", "Room"]]  # Headers
    
    for schedule in schedules:
        time_str = f"{schedule.start.strftime('%I:%M %p')} - {schedule.end.strftime('%I:%M %p')}"
        row = [
            schedule.day,
            schedule.course_code,
            schedule.subject,
            time_str,
            schedule.room
        ]
        data.append(row)
    
    # Create table
    table = Table(data, colWidths=[80, 100, 150, 120, 80])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    elements.append(table)
    doc.build(elements)
    return response

def _export_ical(schedules, username):
    """Export schedules to iCal format"""
    cal = icalendar.Calendar()
    cal.add('prodid', '-//Campus Navigator//Class Schedule//')
    cal.add('version', '2.0')
    
    # Get the current semester's start and end dates (approximate)
    now = datetime.now()
    semester_start = now - timedelta(days=now.weekday())  # Previous Monday
    semester_end = semester_start + timedelta(weeks=16)  # 16-week semester
    
    # Time zone
    tz = pytz.timezone('Asia/Manila')
    
    for schedule in schedules:
        # Create an event for each class
        event = icalendar.Event()
        
        # Basic event info
        room_number = schedule.room.profile.number if hasattr(schedule.room, 'profile') else str(schedule.room)
        event.add('summary', f"{schedule.course_code} - {schedule.subject}")
        event.add('location', room_number)
        event.add('description', f"Course: {schedule.subject}\\nRoom: {room_number}")
        
        # Convert day string to number (0 = Monday)
        day_map = {
            'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
            'Friday': 4, 'Saturday': 5, 'Sunday': 6
        }
        day_num = day_map[schedule.day]
        
        # First occurrence of the class
        first_class = semester_start + timedelta(days=day_num)
        
        # Create datetime objects for start and end times
        start_dt = datetime.combine(first_class, schedule.start)
        end_dt = datetime.combine(first_class, schedule.end)
        
        # Localize the datetimes
        start_dt = tz.localize(start_dt)
        end_dt = tz.localize(end_dt)
        
        # Add times to event
        event.add('dtstart', start_dt)
        event.add('dtend', end_dt)
        
        # Set up weekly recurrence
        event.add('rrule', {
            'freq': 'weekly',
            'until': semester_end,
            'byday': schedule.day[:2].upper()  # First two letters of the day
        })
        
        cal.add_component(event)
    
    # Create response
    response = HttpResponse(cal.to_ical(), content_type='text/calendar')
    response['Content-Disposition'] = f'attachment; filename=schedule_{username}.ics'
    return response