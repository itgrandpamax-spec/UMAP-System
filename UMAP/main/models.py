from django.db import models
from django.contrib.auth.models import AbstractUser



# USER MODEL
class User(AbstractUser):
    class UserType(models.TextChoices):
        REGULAR = 'regular', 'Regular'
        ADMIN = 'admin', 'Admin'

    type = models.CharField(max_length=10, choices=UserType.choices, default=UserType.REGULAR)
    status = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.username} ({self.get_type_display()})"
        
    def display_name(self):
        """Return the user's full name if available, otherwise username"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.username



# ADMIN MODEL (optional extension of User)
class Admin(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='admin_profile')
    edit_history = models.TextField(blank=True)

    def __str__(self):
        return f"Admin: {self.user.username}"



# USER PROFILE
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    email = models.EmailField(unique=True)
    student_id = models.CharField(max_length=50, blank=True)
    department = models.CharField(max_length=100, blank=True)
    year_level = models.PositiveIntegerField(null=True, blank=True)
    description = models.TextField(blank=True, max_length=100)
    profile_pic = models.ImageField(upload_to='profiles/', blank=True, null=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"



# FLOOR MODEL
class Floor(models.Model):
    name = models.CharField(max_length=100)
    building = models.CharField(max_length=100)
    model_file = models.FileField(upload_to='floors/models/', null=True, blank=True)
    csv_file = models.FileField(upload_to='floors/csv/', null=True, blank=True)
    creation_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.building})"
    
    @property
    def model_url(self):
        if self.model_file:
            return self.model_file.url
        return None
    
    @property
    def csv_url(self):
        if self.csv_file:
            return self.csv_file.url
        return None



# ROOM MODEL
class Room(models.Model):
    floor = models.ForeignKey(Floor, on_delete=models.CASCADE, related_name='rooms')
    creation_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Room {self.id} - Floor: {self.floor.name}"



# ROOM PROFILE MODEL
class RoomProfile(models.Model):
    room = models.OneToOneField(Room, on_delete=models.CASCADE, related_name='profile')
    number = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    images = models.ImageField(upload_to='rooms/', blank=True, null=True)
    coordinates = models.JSONField(default=dict)

    def __str__(self):
        return f"{self.name} ({self.number})"


# ROOM IMAGE MODEL (for multiple images per room)
class RoomImage(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='room_images')
    image = models.ImageField(upload_to='rooms/images/')
    caption = models.CharField(max_length=200, blank=True)
    upload_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.room.profile.name if self.room.profile else 'Room'}"

    class Meta:
        ordering = ['upload_date']



# CLASS SCHEDULE MODEL
class Schedule(models.Model):
    COLOR_CHOICES = [
        ('blue', 'Blue'),
        ('green', 'Green'),
        ('purple', 'Purple'),
        ('red', 'Red'),
        ('yellow', 'Yellow')
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='schedules')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='schedules')
    course_code = models.CharField(max_length=50)
    subject = models.CharField(max_length=100)
    day = models.CharField(max_length=20)
    start = models.TimeField()
    end = models.TimeField()
    color = models.CharField(max_length=20, choices=COLOR_CHOICES, default='blue')

    def __str__(self):
        return f"{self.subject} ({self.course_code}) - {self.day}"



# FEEDBACK MODEL
class Feedback(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedbacks')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='feedbacks')
    creation_date = models.DateTimeField(auto_now_add=True)
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, max_length=100)

    def __str__(self):
        return f"Feedback by {self.user.username} on Room {self.room.id}"

# SAVED LOCATIONS MODEL
class SavedLocation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_locations')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='saved_by_users')
    saved_date = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('user', 'room')  # Prevent duplicate saves
        ordering = ['-saved_date']
    
    def __str__(self):
        return f"{self.user.username} - {self.room.profile.name if self.room.profile else 'Room'}"


# USER ACTIVITY MODEL
class UserActivity(models.Model):
    class ActivityType(models.TextChoices):
        SCHEDULE_ADD = 'schedule_add', 'Added Schedule'
        SCHEDULE_DELETE = 'schedule_delete', 'Deleted Schedule'
        ROOM_VIEW = 'room_view', 'Viewed Room'
        FLOOR_VIEW = 'floor_view', 'Viewed Floor'
        USER_CREATE = 'user_create', 'Created User'
        USER_DELETE = 'user_delete', 'Deleted User'
        USER_MODIFY = 'user_modify', 'Modified User'
        USER_UPDATE = 'user_update', 'Updated User'
        ROOM_CREATE = 'room_create', 'Created Room'
        ROOM_DELETE = 'room_delete', 'Deleted Room'
        ROOM_MODIFY = 'room_modify', 'Modified Room'
        FLOOR_CREATE = 'floor_create', 'Created Floor'
        FLOOR_DELETE = 'floor_delete', 'Deleted Floor'
        FLOOR_MODIFY = 'floor_modify', 'Modified Floor'
        LOGIN = 'login', 'User Login'
        LOGOUT = 'logout', 'User Logout'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=ActivityType.choices)
    details = models.JSONField(default=dict)  # Store additional details as JSON
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name_plural = 'User Activities'

    def __str__(self):
        return f"{self.user.username} - {self.get_activity_type_display()} - {self.timestamp}"


# USER SESSION MODEL - Track active sessions per user
class UserSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    session_key = models.CharField(max_length=40, unique=True)
    device_info = models.CharField(max_length=255, blank=True)  # Browser/device info
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)  # Full user agent string
    login_time = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-login_time']
        verbose_name_plural = 'User Sessions'
    
    def __str__(self):
        return f"{self.user.username} - {self.device_info or 'Unknown Device'} - {self.login_time}"
    
    @staticmethod
    def get_user_agent_info(user_agent):
        """Extract device info from user agent string"""
        import re
        # Simple device detection
        if 'Mobile' in user_agent or 'Android' in user_agent or 'iPhone' in user_agent:
            device = 'Mobile'
        elif 'Tablet' in user_agent or 'iPad' in user_agent:
            device = 'Tablet'
        else:
            device = 'Desktop'
        
        # Browser detection
        if 'Chrome' in user_agent:
            browser = 'Chrome'
        elif 'Firefox' in user_agent:
            browser = 'Firefox'
        elif 'Safari' in user_agent:
            browser = 'Safari'
        elif 'Edge' in user_agent:
            browser = 'Edge'
        else:
            browser = 'Unknown'
        
        return f"{device} - {browser}"

