from django.contrib import messages
from django.shortcuts import redirect, render
from django.contrib.auth import authenticate, login as auth_login
from django.http import JsonResponse
from django.core.exceptions import ValidationError
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from .models import User, UserActivity, Profile
import json

def get_client_ip(request):
    """Get client IP address from request, accounting for proxies"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

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
            
            # Check if user exists to give appropriate error message
            if user is None:
                # First check if user exists but is inactive
                try:
                    inactive_user = User.objects.get(username=username)
                    if not inactive_user.is_active:
                        return JsonResponse({
                            'status': 'error',
                            'errors': {
                                'non_field_errors': ['Your account has been deactivated. Please contact our administrator for assistance.']
                            }
                        })
                except User.DoesNotExist:
                    try:
                        inactive_user = User.objects.get(email=username)
                        if not inactive_user.is_active:
                            return JsonResponse({
                                'status': 'error',
                                'errors': {
                                    'non_field_errors': ['Your account has been deactivated. Please contact our administrator for assistance.']
                                }
                            })
                    except User.DoesNotExist:
                        pass
                
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
                        'non_field_errors': ['Your account has been deactivated. Please contact our administrator for assistance.']
                    }
                })

            # Invalidate all previous sessions for this user
            from .models import UserSession
            UserSession.objects.filter(user=user, is_active=True).update(is_active=False)

            # Login successful
            auth_login(request, user)
            
            # Create a new UserSession record
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            device_info = UserSession.get_user_agent_info(user_agent)
            ip_address = get_client_ip(request)
            
            UserSession.objects.create(
                user=user,
                session_key=request.session.session_key,
                device_info=device_info,
                ip_address=ip_address,
                user_agent=user_agent,
                is_active=True
            )
            
            track_activity(user, UserActivity.ActivityType.LOGIN, request=request)

            # Determine redirect URL
            redirect_url = '/admin_main/' if user.is_staff or user.is_superuser else '/'
            
            return JsonResponse({
                'status': 'success',
                'message': f"Welcome back, {user.first_name if user.first_name else username}!",
                'redirect_url': redirect_url
            })
        
        except User.DoesNotExist as e:
            import traceback
            print(f"User lookup error: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({
                'status': 'error',
                'errors': {'non_field_errors': ['An error occurred during login. Please try again.']}
            }, status=500)

    except Exception as e:
        import traceback
        print(f"Login AJAX error: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            'status': 'error',
            'errors': {
                'non_field_errors': [f'An error occurred during login: {str(e)}']
            }
        }, status=500)

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

    # Check if user was redirected from a protected feature
    next_url = request.GET.get('next', '')
    if next_url:
        if 'schedule' in next_url:
            messages.info(request, "Please log in or create an account to access your schedule.")
            request.session['show_login'] = True
        elif 'saved' in next_url:
            messages.info(request, "Please log in or create an account to access your saved locations.")
            request.session['show_login'] = True

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
                    messages.error(request, "Your account has been deactivated. Please contact our administrator for assistance.")
                else:
                    # Invalidate all previous sessions for this user
                    from .models import UserSession
                    UserSession.objects.filter(user=user, is_active=True).update(is_active=False)
                    
                    # Log the user in
                    auth_login(request, user)
                    
                    # Create a new UserSession record
                    user_agent = request.META.get('HTTP_USER_AGENT', '')
                    device_info = UserSession.get_user_agent_info(user_agent)
                    ip_address = get_client_ip(request)
                    
                    UserSession.objects.create(
                        user=user,
                        session_key=request.session.session_key,
                        device_info=device_info,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        is_active=True
                    )
                    
                    track_activity(user, UserActivity.ActivityType.LOGIN, request=request)
                    messages.success(request, f"Welcome back, {user.first_name if user.first_name else user.username}!")
                    
                    # Redirect to next URL if available, otherwise to user main
                    next_url = request.POST.get('next') or request.GET.get('next')
                    if next_url:
                        return redirect(next_url)
                    
                    if user.is_superuser or user.is_staff:
                        return redirect('admin_main_view')
                    return redirect('user_main_view')
            else:
                # Check if user exists to give appropriate error message
                try:
                    inactive_user = User.objects.get(username=username)
                    if not inactive_user.is_active:
                        messages.error(request, "Your account has been deactivated. Please contact our administrator for assistance.")
                        request.session['show_login'] = True
                        return redirect('default_view')
                except User.DoesNotExist:
                    try:
                        inactive_user = User.objects.get(email=username)
                        if not inactive_user.is_active:
                            messages.error(request, "Your account has been deactivated. Please contact our administrator for assistance.")
                            request.session['show_login'] = True
                            return redirect('default_view')
                    except User.DoesNotExist:
                        pass
                
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

def password_reset_request(request):
    """Handle password reset email request"""
    if request.method == "POST":
        email = request.POST.get('email', '').strip()
        
        # Handle AJAX requests
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            if not email:
                return JsonResponse({
                    'status': 'error',
                    'errors': {'email': 'Please enter your email address'}
                })
            
            try:
                user = User.objects.get(email=email)
                
                # Generate token and UID
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                
                # Build reset link
                reset_link = f"{request.build_absolute_uri('/')[:-1]}/password-reset/{uid}/{token}/"
                
                # Send email
                subject = "Password Reset Request - UMAP"
                message = render_to_string('UMAP_App/auth/password_reset_email.html', {
                    'user': user,
                    'reset_link': reset_link,
                    'domain': request.get_host(),
                })
                
                try:
                    send_mail(
                        subject,
                        message,
                        settings.DEFAULT_FROM_EMAIL,
                        [email],
                        fail_silently=False,
                        html_message=message
                    )
                    print(f"✓ Password reset email sent to {email}")  # Console output for development
                except Exception as e:
                    print(f"✗ Error sending email to {email}: {str(e)}")
                    raise
                
                return JsonResponse({
                    'status': 'success',
                    'message': 'Password reset link has been sent to your email. Please check your inbox and spam folder.'
                })
            
            except User.DoesNotExist:
                # Don't reveal if email exists (security best practice)
                # But still show success message
                return JsonResponse({
                    'status': 'success',
                    'message': 'If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.'
                })
            except Exception as e:
                print(f"✗ Password reset error: {str(e)}")
                return JsonResponse({
                    'status': 'error',
                    'errors': {'email': f'An error occurred: {str(e)}. Please try again or contact support.'}
                })
        
        # Non-AJAX POST
        request.session['show_password_reset'] = True
        return redirect('default_view')
    
    return redirect('default_view')

def password_reset_confirm(request, uidb64, token):
    """Handle password reset confirmation"""
    from django.shortcuts import render
    
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None
    
    token_valid = user is not None and default_token_generator.check_token(user, token)
    
    if token_valid and request.method == "POST":
        password1 = request.POST.get('password1', '')
        password2 = request.POST.get('password2', '')
        
        # Handle AJAX requests
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            errors = {}
            
            if not password1 or not password2:
                errors['non_field_errors'] = ['Please enter a password']
            elif len(password1) < 8:
                errors['password1'] = 'Password must be at least 8 characters long'
            elif password1 != password2:
                errors['password2'] = 'Passwords do not match'
            
            if errors:
                return JsonResponse({'status': 'error', 'errors': errors})
            
            try:
                user.set_password(password1)
                user.save()
                
                # Track activity
                track_activity(user, UserActivity.ActivityType.LOGIN, 
                             details={'action': 'Password Reset'}, request=request)
                
                return JsonResponse({
                    'status': 'success',
                    'message': 'Password has been reset successfully. You can now log in with your new password.',
                    'redirect_url': '/login/'
                })
            except Exception as e:
                return JsonResponse({
                    'status': 'error',
                    'errors': {'non_field_errors': ['An error occurred while resetting your password']}
                })
    
    # Render the password reset form
    return render(request, 'UMAP_App/auth/password_reset_confirm.html', {
        'token_valid': token_valid,
        'uid': uidb64,
        'token': token
    })