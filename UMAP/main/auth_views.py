from django.contrib import messages
from django.shortcuts import redirect
from django.contrib.auth import authenticate, login as auth_login
from django.http import JsonResponse
from django.core.exceptions import ValidationError
from .models import User, UserActivity, Profile
import json

def track_activity(user, activity_type, details=None, request=None):
    """Utility function to track user activities"""
    if details is None:
        details = {}
    activity = UserActivity(
        user=user,
        activity_type=activity_type,
        details=details
    )
    if request:
        activity.ip_address = request.META.get('REMOTE_ADDR')
    activity.save()

def login_ajax(request):
    """Handle AJAX login requests"""
    if request.method != "POST":
        return JsonResponse({
            'status': 'error',
            'errors': {'non_field_errors': ['Invalid request method']}
        }, status=400)

    try:
        # Parse form data (FormData is automatically available in request.POST)
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        # Validate required fields
        if not username or not password:
            return JsonResponse({
                'status': 'error',
                'errors': {
                    'non_field_errors': ['Please enter both username and password']
                }
            })

        # Try to authenticate with username
        user = authenticate(request, username=username, password=password)
        
        # If that fails, try with email
        if user is None:
            try:
                user_obj = User.objects.get(email=username)
                user = authenticate(request, username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None
        
        # Check if user exists to give appropriate error message
        if user is None:
            user_exists = User.objects.filter(username=username).exists() or \
                        User.objects.filter(email=username).exists()
            
            if user_exists:
                return JsonResponse({
                    'status': 'error',
                    'errors': {
                        'non_field_errors': ['Invalid password. Please try again.']
                    }
                })
            else:
                return JsonResponse({
                    'status': 'error',
                    'errors': {
                        'non_field_errors': ['This account does not exist. Please check your username/email or sign up.']
                    }
                })

        # Check if user is active
        if not user.is_active:
            return JsonResponse({
                'status': 'error',
                'errors': {
                    'non_field_errors': ['This account has been deactivated. Please contact an administrator.']
                }
            })

        # Login successful
        auth_login(request, user)
        track_activity(user, UserActivity.ActivityType.LOGIN, request=request)

        # Determine redirect URL
        redirect_url = '/admin_main/' if user.is_staff or user.is_superuser else '/'
        
        return JsonResponse({
            'status': 'success',
            'message': f"Welcome back, {user.first_name if user.first_name else username}!",
            'redirect_url': redirect_url
        })

    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'errors': {
                'non_field_errors': ['An error occurred during login']
            }
        })

def signup_ajax(request):
    """Handle AJAX signup requests"""
    if request.method != "POST":
        return JsonResponse({
            'status': 'error',
            'errors': {'non_field_errors': ['Invalid request method']}
        }, status=400)

    try:
        # Parse form data (FormData is automatically available in request.POST)
        
        # Basic validation
        required_fields = ['username', 'email', 'password1', 'password2', 
                         'first_name', 'last_name', 'student_id', 
                         'department', 'year_level']
        errors = {}
        
        for field in required_fields:
            if not request.POST.get(field):
                errors[field] = f'{field.replace("_", " ").title()} is required'

        if errors:
            return JsonResponse({'status': 'error', 'errors': errors})

        # Password validation
        password1 = request.POST.get('password1')
        password2 = request.POST.get('password2')
        
        if password1 != password2:
            errors['password2'] = 'Passwords do not match'
        elif len(password1) < 8:
            errors['password1'] = 'Password must be at least 8 characters long'
        
        if errors:
            return JsonResponse({'status': 'error', 'errors': errors})

        # Check if username exists
        if User.objects.filter(username=request.POST.get('username')).exists():
            errors['username'] = 'This username is already taken'
        
        # Check if email exists
        if User.objects.filter(email=request.POST.get('email')).exists():
            errors['email'] = 'This email is already registered'
            
        if errors:
            return JsonResponse({'status': 'error', 'errors': errors})

        # Create user
        try:
            user = User.objects.create_user(
                username=request.POST.get('username'),
                email=request.POST.get('email'),
                password=request.POST.get('password1'),
                first_name=request.POST.get('first_name'),
                last_name=request.POST.get('last_name'),
            )
            
            # Create profile (it won't exist automatically)
            profile = Profile.objects.create(
                user=user,
                email=request.POST.get('email'),
                student_id=request.POST.get('student_id'),
                department=request.POST.get('department'),
                year_level=int(request.POST.get('year_level'))
            )
            
            # Track user creation
            details = {
                'username': user.username,
                'email': user.email,
                'full_name': f"{user.first_name} {user.last_name}".strip(),
                'type': 'Regular User',
                'action': 'Account Created'
            }
            track_activity(user, UserActivity.ActivityType.USER_CREATE, 
                         details=details, request=request)

            # Auto login after signup
            auth_login(request, user)
            
            return JsonResponse({
                'status': 'success',
                'message': 'Account created successfully!',
                'redirect_url': '/'
            })

        except ValidationError as e:
            return JsonResponse({
                'status': 'error',
                'errors': {
                    'non_field_errors': [str(e)]
                }
            })

    except Exception as e:
        import traceback
        print(f"Signup error: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            'status': 'error',
            'errors': {
                'non_field_errors': [f'An error occurred during signup: {str(e)}']
            }
        })

def login_view(request):
    """Handle GET (show form) and POST (authenticate) for login."""
    if request.user.is_authenticated:
        if request.user.is_superuser or request.user.is_staff:
            return redirect('admin_main_view')
        else:
            return redirect('user_main_view')

    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")
        
        # Handle AJAX requests
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return login_ajax(request)
        
        if not username or not password:
            messages.error(request, "Please enter both username and password.")
            request.session['show_login'] = True
            return redirect('default_view')
        
        try:
            # Try to authenticate with username
            user = authenticate(request, username=username, password=password)
            
            # If that fails, try with email
            if user is None:
                try:
                    user_obj = User.objects.get(email=username)
                    user = authenticate(request, username=user_obj.username, password=password)
                except User.DoesNotExist:
                    user = None
            
            if user is not None:
                if not user.is_active:
                    messages.error(request, "This account has been deactivated. Please contact an administrator.")
                else:
                    # Log the user in
                    auth_login(request, user)
                    track_activity(user, UserActivity.ActivityType.LOGIN, request=request)
                    messages.success(request, f"Welcome back, {user.first_name if user.first_name else user.username}!")
                    
                    if user.is_superuser or user.is_staff:
                        return redirect('admin_main_view')
                    return redirect('user_main_view')
            else:
                # Check if user exists to give appropriate error message
                user_exists = User.objects.filter(username=username).exists() or \
                            User.objects.filter(email=username).exists()
                
                if user_exists:
                    messages.error(request, "Invalid password. Please try again.")
                    # Preserve username but don't preserve password
                    request.session['preserved_username'] = username
                else:
                    messages.error(request, "This account does not exist. Please check your username/email or sign up.")
                
            request.session['show_login'] = True
            return redirect('default_view')
                
        except Exception as e:
            print(f"Login error: {str(e)}")  # Debugging line
            messages.error(request, "An error occurred during login. Please try again.")
            request.session['show_login'] = True
            return redirect('default_view')

    return redirect('default_view')

def signup_view(request):
    """Handle signup requests - GET shows form, POST processes signup"""
    if request.method == "POST":
        # Handle AJAX requests
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return signup_ajax(request)
        
        # Non-AJAX POST - redirect to form with signup tab active
        request.session['show_signup'] = True
        return redirect('default_view')
    
    # GET request - show signup form
    return redirect('default_view')