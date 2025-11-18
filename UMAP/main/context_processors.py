def auth_forms(request):
    """Context processor to add empty form structure for auth templates."""
    return {
        'form': {
            'username': {'value': request.session.get('preserved_username', '')},
            'errors': {}
        },
        'signup_form': {
            'username': {'value': ''},
            'email': {'value': ''},
            'errors': {}
        }
    }