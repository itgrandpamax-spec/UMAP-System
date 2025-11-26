from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import User, Profile, Floor, Room, RoomProfile, RoomImage, Schedule, Feedback

class UserRegistrationForm(UserCreationForm):
    email = forms.EmailField(required=True)
    first_name = forms.CharField(required=True)
    last_name = forms.CharField(required=True)
    student_id = forms.CharField(required=True)
    department = forms.ChoiceField(
        choices=[
            ('', '-- Select Department --'),
            ('IT', 'Information Technology'),
            ('Engineering', 'Engineering'),
            ('Business', 'Business'),
            ('Arts', 'Arts')
        ],
        required=True
    )
    year_level = forms.ChoiceField(
        choices=[
            ('1', '1st Year'),
            ('2', '2nd Year'),
            ('3', '3rd Year'),
            ('4', '4th Year')
        ],
        required=True
    )
    type = forms.ChoiceField(
        choices=User.UserType.choices,
        initial=User.UserType.REGULAR,
        required=True
    )

    class Meta:
        model = User
        fields = ('username', 'first_name', 'last_name', 'email', 'password1', 'password2', 'type')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields:
            self.fields[field].widget.attrs.update({
                'class': 'mt-1 w-full rounded-lg border border-slate-600 p-2 bg-slate-800/50 text-white focus:border-blue-500 focus:outline-none'
            })

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']
        user.first_name = self.cleaned_data['first_name']
        user.last_name = self.cleaned_data['last_name']
        user.type = User.UserType.REGULAR  # Force regular user type for security
        
        if commit:
            user.save()
            # Create associated profile
            Profile.objects.create(
                user=user,
                email=self.cleaned_data['email'],
                department=self.cleaned_data['department'],
                year_level=int(self.cleaned_data['year_level']),
                student_id=self.cleaned_data['student_id']
            )
        return user

# Floor Management Form
class FloorForm(forms.ModelForm):
    class Meta:
        model = Floor
        fields = ['name', 'building', 'model_file', 'csv_file', 'floorplan_svg']
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500',
                'placeholder': 'Enter floor name'
            }),
            'building': forms.Select(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500'
            }, choices=[
                ('HPSB', 'HPSB Building'),
                ('ADMIN', 'Admin Building'),
                ('AB1', 'Academic Building 1'),
                ('AB2', 'Academic Building 2'),
            ]),
            'model_file': forms.FileInput(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500',
                'accept': '.glb'
            }),
            'csv_file': forms.FileInput(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500',
                'accept': '.csv'
            }),
            'floorplan_svg': forms.FileInput(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500',
                'accept': '.svg'
            })
        }

# Room Forms
class RoomForm(forms.ModelForm):
    class Meta:
        model = Room
        fields = ['floor']
        widgets = {
            'floor': forms.Select(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500'
            })
        }

class RoomProfileForm(forms.ModelForm):
    class Meta:
        model = RoomProfile
        fields = ['number', 'name', 'type', 'description', 'images', 'coordinates']
        widgets = {
            'number': forms.TextInput(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500',
                'placeholder': 'Enter room number'
            }),
            'name': forms.TextInput(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500',
                'placeholder': 'Enter room name'
            }),
            'type': forms.Select(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500'
            }, choices=[
                ('classroom', 'Classroom'),
                ('faculty', 'Faculty Room'),
                ('laboratory', 'Laboratory'),
                ('office', 'Office'),
                ('emergency', 'Emergency Exit'),
                ('other', 'Other')
            ]),
            'description': forms.Textarea(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500',
                'rows': '4',
                'placeholder': 'Enter room description'
            }),
            'coordinates': forms.HiddenInput(),
        }


class RoomImageForm(forms.ModelForm):
    class Meta:
        model = RoomImage
        fields = ['image', 'caption']
        widgets = {
            'image': forms.FileInput(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500 file:bg-blue-600 file:text-white file:border-0 file:rounded file:cursor-pointer',
                'accept': 'image/*'
            }),
            'caption': forms.TextInput(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500',
                'placeholder': 'Enter caption (optional)'
            }),
        }

# Admin User Management Forms
class AdminUserForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'type', 'is_active']
        widgets = {
            'username': forms.TextInput(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500'
            }),
            'first_name': forms.TextInput(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500'
            }),
            'last_name': forms.TextInput(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500'
            }),
            'type': forms.Select(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500'
            }),
            'is_active': forms.CheckboxInput(attrs={
                'class': 'form-checkbox h-5 w-5 border-slate-600 bg-slate-800/50 text-blue-500'
            })
        }

class AdminProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ['department', 'year_level', 'description', 'profile_pic']
        widgets = {
            'department': forms.Select(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500'
            }, choices=[
                ('', '-- Select Department --'),
                ('IT', 'Information Technology'),
                ('Engineering', 'Engineering'),
                ('Business', 'Business'),
                ('Arts', 'Arts')
            ]),
            'year_level': forms.Select(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500'
            }, choices=[
                (1, '1st Year'),
                (2, '2nd Year'),
                (3, '3rd Year'),
                (4, '4th Year')
            ]),
            'description': forms.Textarea(attrs={
                'class': 'w-full border rounded-md p-2 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500',
                'rows': '3',
                'maxlength': '100'
            })
        }

class ScheduleForm(forms.ModelForm):
    class Meta:
        model = Schedule
        fields = ['course_code', 'subject', 'room', 'day', 'start', 'end', 'color']
        widgets = {
            'course_code': forms.TextInput(attrs={
                'class': 'w-full bg-navy-lighter border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'placeholder': 'Enter course code'
            }),
            'subject': forms.TextInput(attrs={
                'class': 'w-full bg-navy-lighter border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'placeholder': 'Enter subject name'
            }),
            'room': forms.Select(attrs={
                'class': 'w-full bg-navy-lighter border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            }),
            'day': forms.Select(attrs={
                'class': 'w-full bg-navy-lighter border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            }, choices=[
                ('Monday', 'Monday'),
                ('Tuesday', 'Tuesday'),
                ('Wednesday', 'Wednesday'),
                ('Thursday', 'Thursday'),
                ('Friday', 'Friday'),
                ('Saturday', 'Saturday'),
                ('Sunday', 'Sunday')
            ]),
            'start': forms.TimeInput(attrs={
                'class': 'w-full bg-navy-lighter border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'type': 'time'
            }),
            'end': forms.TimeInput(attrs={
                'class': 'w-full bg-navy-lighter border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'type': 'time'
            }),
            'color': forms.Select(attrs={
                'class': 'w-full bg-navy-lighter border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            }, choices=[
                ('blue', 'Blue'),
                ('green', 'Green'),
                ('purple', 'Purple'),
                ('red', 'Red'),
                ('yellow', 'Yellow')
            ])
        }

class ScheduleUploadForm(forms.Form):
    schedule_pdf = forms.FileField(
        label='Upload Schedule PDF',
        help_text='Upload your class schedule in PDF format',
        widget=forms.FileInput(attrs={
            'accept': '.pdf',
            'class': 'hidden',  # Hidden because we use a custom button UI
            'id': 'uploadInput'
        })
    )

class RoomRatingForm(forms.ModelForm):
    class Meta:
        model = Feedback
        fields = ['rating', 'comment']
        widgets = {
            'rating': forms.NumberInput(attrs={
                'min': '1',
                'max': '5',
                'type': 'hidden',
                'class': 'hidden'
            }),
            'comment': forms.Textarea(attrs={
                'class': 'w-full border rounded-lg p-3 mt-1 border-slate-600 bg-slate-800/50 text-white focus:border-blue-500 focus:outline-none',
                'placeholder': 'Share your feedback (optional)',
                'rows': '3',
                'maxlength': '500'
            })
        }