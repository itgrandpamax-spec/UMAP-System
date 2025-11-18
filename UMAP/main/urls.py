from django.urls import path
from . import views, schedule_views, admin_schedule_views, admin_statistics_views, api_views, auth_views

urlpatterns = [
    path('', views.default_view, name='default_view'),
    path('map/zoomed/', views.users_mainzoomed_view, name='users_mainzoomed'),
    
    # Authentication routes
    path('login/', auth_views.login_view, name='login'),
    path('login/ajax/', auth_views.login_ajax, name='login_ajax'),
    path('signup/', auth_views.signup_view, name='signup'),
    path('signup/ajax/', auth_views.signup_ajax, name='signup_ajax'),
    path('logout/', views.logout_view, name='logout'),
    
    # Schedule routes
    path('schedule/', schedule_views.schedule_view, name='schedule_view'),
    path('schedule/add/', schedule_views.add_class, name='add_class'),
    path('schedule/delete/<int:schedule_id>/', schedule_views.delete_class, name='delete_class'),
    path('schedule/delete-all/', schedule_views.delete_all_schedules, name='delete_all_schedules'),
    path('schedule/export/<str:format_type>/', schedule_views.export_schedule, name='export_schedule'),
    path('schedule/upload/', schedule_views.upload_schedule, name='upload_schedule'),
    
    # AJAX endpoints
    path('api/delete/<str:model_name>/<int:item_id>/', views.delete_item, name='delete_item'),
    path('api/floor/<int:floor_id>/rooms/', views.get_floor_rooms, name='get_floor_rooms'),
    path('api/buildings/', api_views.get_building_data, name='get_building_data'),
    path('api/rooms/<int:room_id>/', api_views.get_room_details, name='get_room_details'),
    path('api/room/<int:room_id>/', views.get_room_data, name='get_room_data'),
    path('api/room/<int:room_id>/photos/', views.get_room_photos, name='get_room_photos'),
    path('api/room/<int:room_id>/ratings/', views.get_room_ratings, name='get_room_ratings'),
    path('api/room/<int:room_id>/rate/', views.submit_room_rating, name='submit_room_rating'),
    path('api/delete/roomimage/<int:image_id>/', views.delete_roomimage, name='delete_roomimage'),
    path('api/import-rooms-csv/', views.import_rooms_from_csv, name='import_rooms_csv'),
    path('api/search-rooms/', views.search_rooms_and_locations, name='search_rooms'),

    path('user_main/', views.user_main_view, name='user_main_view'),
    path('user_profile/', views.user_profile_view, name='user_profile'),

    path('admin_profile/', views.admin_profile_view, name='admin_profile_view'),
    path('admin_main/', views.admin_main_view, name='admin_main_view'),
    path('admin_users/', views.admin_user_list_view, name='admin_user_list'),
    path('admin_floors/', views.admin_floor_list_view, name='admin_floor_list'),
    path('admin_rooms/', views.admin_rooms_list_view, name='admin_rooms_list'),
    path('admin_CRUD_Users/', views.admin_CRUD_Users_view, name='admin_CRUD_Users'),
    path('admin_CRUD_Floors/', views.admin_CRUD_Floors_view, name='admin_CRUD_Floors'),
    path('admin_CRUD_Rooms/', views.admin_CRUD_Rooms_view, name='admin_CRUD_Rooms'),
    path('admin_schedules/', admin_schedule_views.admin_schedules_dashboard, name='admin_schedules_dashboard'),
    path('admin_schedules/user/<int:user_id>/', admin_schedule_views.view_user_schedule, name='view_user_schedule'),
    path('admin_statistics/', admin_statistics_views.admin_statistics, name='admin_statistics'),
    path('admin_ratings/', views.admin_ratings_view, name='admin_ratings'),
    path('admin_ratings/delete/<int:feedback_id>/', views.delete_feedback, name='delete_feedback'),
]
