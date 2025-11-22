"""
Session management middleware to enforce single device login per user
"""
import django.utils.timezone
from django.shortcuts import redirect
from django.urls import reverse
from django.contrib.sessions.models import Session
from django.contrib.auth import logout
from .models import UserSession


class SingleDeviceSessionMiddleware:
    """
    Middleware to enforce single active session per user.
    If a user logs in on a new device, previous sessions are invalidated.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Check if user is authenticated
        if request.user.is_authenticated:
            session_key = request.session.session_key
            
            # Check if this session is still valid in UserSession model
            try:
                user_session = UserSession.objects.get(
                    user=request.user,
                    session_key=session_key,
                    is_active=True
                )
                # Update last activity time
                user_session.last_activity = django.utils.timezone.now()
                user_session.save(update_fields=['last_activity'])
            except UserSession.DoesNotExist:
                # Session not found or marked inactive - user was logged out from another device
                logout(request)
                
                # Set a flag to show the logout notice
                request.session['logged_out_from_another_device'] = True
                request.session.save()
                
                # Redirect to login page with notice
                return redirect(reverse('default_view'))
        
        response = self.get_response(request)
        return response
