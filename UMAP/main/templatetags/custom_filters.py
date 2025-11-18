from django import template

register = template.Library()

@register.filter(name='split')
def split_filter(value, arg):
    """Split a string into a list based on a delimiter"""
    return value.split(arg)

@register.filter(name='to_list')
def to_list_filter(value):
    """Convert a comma-separated string to a list"""
    return value.split(',')