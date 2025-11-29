from django.contrib import admin
from .models import User, Admin, Profile, Floor, Room, RoomProfile, Schedule, Feedback, SavedLocation, UserActivity, UserSession


# ---- USER ADMIN ----
@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'username', 'email', 'type', 'is_active', 'is_staff', 'status')
    list_filter = ('type', 'status', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email')
    ordering = ('id',)


# ---- ADMIN PROFILE ADMIN ----
@admin.register(Admin)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'edit_history')
    search_fields = ('user__username',)
    ordering = ('id',)


# ---- PROFILE ADMIN ----
@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'email', 'college', 'year_level')
    search_fields = ('user__username', 'email', 'college__acronym')
    ordering = ('id',)


# ---- FLOOR ADMIN ----
@admin.register(Floor)
class FloorAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'building', 'creation_date', 'has_csv')
    search_fields = ('name', 'building')
    list_filter = ('building',)
    ordering = ('creation_date',)
    fields = ('name', 'building', 'model_file', 'csv_file', 'creation_date')
    readonly_fields = ('creation_date',)
    
    def has_csv(self, obj):
        return 'Yes' if obj.csv_file else 'No'
    has_csv.short_description = 'Has CSV'


# ---- ROOM ADMIN ----
@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('id', 'floor', 'creation_date')
    list_filter = ('floor__building',)
    search_fields = ('floor__name',)
    ordering = ('id',)


# ---- ROOM PROFILE ADMIN ----
@admin.register(RoomProfile)
class RoomProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'number', 'name', 'type', 'get_coordinates')
    search_fields = ('number', 'name', 'type')
    ordering = ('id',)
    readonly_fields = ('get_coordinates_display',)
    fieldsets = (
        ('Room Information', {
            'fields': ('room', 'number', 'name', 'type', 'description')
        }),
        ('Coordinates', {
            'fields': ('get_coordinates_display',),
            'classes': ('wide',)
        }),
    )
    
    def get_coordinates(self, obj):
        """Display coordinates in list view with full precision"""
        if obj.coordinates:
            try:
                coords = obj.coordinates if isinstance(obj.coordinates, dict) else {}
                x = coords.get('x')
                y = coords.get('y')
                z = coords.get('z')
                # Format values - handle both None and 0
                if x is not None:
                    x_str = f"{float(x):.2f}"
                else:
                    x_str = "N/A"
                    
                if y is not None:
                    y_str = f"{float(y):.2f}"
                else:
                    y_str = "N/A"
                    
                if z is not None:
                    z_str = f"{float(z):.2f}"
                else:
                    z_str = "N/A"
                
                return f"X: {x_str} | Y: {y_str} | Z: {z_str}"
            except Exception as e:
                return f"Error: {str(e)[:20]}"
        return "No coords"
    get_coordinates.short_description = 'Coordinates (X, Y, Z)'
    
    def get_coordinates_display(self, obj):
        """Display full coordinates in detail view with full precision"""
        if obj.coordinates:
            try:
                coords = obj.coordinates if isinstance(obj.coordinates, dict) else {}
                x = coords.get('x', 'N/A')
                y = coords.get('y', 'N/A')
                z = coords.get('z', 'N/A')
                width = coords.get('width', 'N/A')
                height = coords.get('height', 'N/A')
                return f"""X: {x}
Y: {y}
Z: {z}
Width: {width}
Height: {height}"""
            except:
                return str(obj.coordinates)
        return "No coordinates"
    get_coordinates_display.short_description = 'Coordinate Details'


# ---- SCHEDULE ADMIN ----
@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'room', 'course_code', 'subject', 'day', 'start', 'end')
    list_filter = ('day', 'course_code', 'subject')
    search_fields = ('course_code', 'subject', 'user__username')
    ordering = ('day', 'start')


# ---- FEEDBACK ADMIN ----
@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'room', 'rating', 'creation_date')
    list_filter = ('rating', 'creation_date')
    search_fields = ('user__username', 'room__id', 'comment')
    ordering = ('-creation_date',)


# ---- SAVED LOCATIONS ADMIN ----
@admin.register(SavedLocation)
class SavedLocationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'room', 'saved_date')
    list_filter = ('saved_date',)
    search_fields = ('user__username', 'room__profile__name')
    ordering = ('-saved_date',)


# ---- USER ACTIVITY ADMIN ----
@admin.register(UserActivity)
class UserActivityAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'activity_type', 'timestamp', 'ip_address')
    list_filter = ('activity_type', 'timestamp')
    search_fields = ('user__username', 'ip_address')
    ordering = ('-timestamp',)
    readonly_fields = ('timestamp', 'user', 'activity_type', 'details', 'ip_address')


# ---- USER SESSION ADMIN ----
@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'device_info', 'ip_address', 'login_time', 'is_active')
    list_filter = ('is_active', 'login_time')
    search_fields = ('user__username', 'ip_address', 'device_info')
    ordering = ('-login_time',)
    readonly_fields = ('login_time', 'last_activity')
