"""
Utility functions for loading and managing room data from CSV references
"""
import csv
import os
from django.conf import settings
from typing import Dict, Optional


class RoomNameManager:
    """Manages room name mapping from CSV files"""
    
    _room_names_cache = None
    _room_coords_cache = None
    _csv_file_path = None
    _coords_file_path = None
    
    @staticmethod
    def get_csv_file_path() -> Optional[str]:
        """Get path to DataDicForSVG.csv"""
        if RoomNameManager._csv_file_path:
            return RoomNameManager._csv_file_path
        
        # Try to get CSV from static/UMAP_App/csv folder
        csv_paths = [
            os.path.join(settings.BASE_DIR, 'main', 'static', 'UMAP_App', 'csv', 'DataDicForSVG.csv'),
            os.path.join(settings.BASE_DIR, 'static', 'UMAP_App', 'csv', 'DataDicForSVG.csv'),
        ]
        
        # Add STATICFILES_DIRS if available
        if hasattr(settings, 'STATICFILES_DIRS') and settings.STATICFILES_DIRS:
            csv_paths.append(
                os.path.join(settings.STATICFILES_DIRS[0], 'UMAP_App', 'csv', 'DataDicForSVG.csv')
            )
        
        for path in csv_paths:
            if path and os.path.exists(path):
                RoomNameManager._csv_file_path = path
                return path
        
        return None
    
    @staticmethod
    def get_coords_csv_file_path() -> Optional[str]:
        """Get path to Room_coords.csv"""
        if RoomNameManager._coords_file_path:
            return RoomNameManager._coords_file_path
        
        # Try to get coordinates CSV from static/UMAP_App/csv folder
        coords_paths = [
            os.path.join(settings.BASE_DIR, 'main', 'static', 'UMAP_App', 'csv', 'Room_coords.csv'),
            os.path.join(settings.BASE_DIR, 'static', 'UMAP_App', 'csv', 'Room_coords.csv'),
        ]
        
        # Add STATICFILES_DIRS if available
        if hasattr(settings, 'STATICFILES_DIRS') and settings.STATICFILES_DIRS:
            coords_paths.append(
                os.path.join(settings.STATICFILES_DIRS[0], 'UMAP_App', 'csv', 'Room_coords.csv')
            )
        
        for path in coords_paths:
            if path and os.path.exists(path):
                RoomNameManager._coords_file_path = path
                return path
        
        return None
    
    @staticmethod
    def load_room_names() -> Dict[str, str]:
        """Load room names from CSV, using cache if available"""
        if RoomNameManager._room_names_cache is not None:
            return RoomNameManager._room_names_cache
        
        room_names = {}
        csv_file = RoomNameManager.get_csv_file_path()
        
        if not csv_file:
            print("Warning: DataDicForSVG.csv not found in expected locations")
            RoomNameManager._room_names_cache = {}
            return room_names
        
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if not row or not row.get('Room Number'):
                        continue
                    
                    room_number = row.get('Room Number', '').strip()
                    room_name = row.get('Room Name', '') or row.get('Room Nane', '')
                    room_name = room_name.strip()
                    
                    if room_number and room_name:
                        room_names[room_number] = room_name
                        
                        # Also map by floor for fire exits (e.g., "1_F1" for Fire Exit 1 on Floor 1)
                        level = row.get('Level', '').strip()
                        if 'Fire Exit' in room_name and level:
                            # Extract floor number from level string (e.g., "1 Floor HPSB" -> "1")
                            import re
                            floor_match = re.search(r'(\d+)\s+Floor', level)
                            if floor_match:
                                floor_num = floor_match.group(1)
                                fire_exit_key = f"{floor_num}_{room_number}"
                                room_names[fire_exit_key] = room_name
            
            print(f"✓ Loaded {len(room_names)} room names from CSV (including fire exits)")
            RoomNameManager._room_names_cache = room_names
        
        except Exception as e:
            print(f"Error loading room names from CSV: {str(e)}")
            RoomNameManager._room_names_cache = {}
        
        return room_names
    
    @staticmethod
    def get_room_name(room_number: str) -> Optional[str]:
        """Get room name for a specific room number"""
        room_names = RoomNameManager.load_room_names()
        return room_names.get(room_number)
    
    @staticmethod
    def load_room_coordinates() -> Dict[str, Dict[str, float]]:
        """Load room coordinates from Room_coords.csv
        
        Returns a dictionary mapping room IDs to coordinate dictionaries:
        {
            'room_id': {'x': float, 'y': float, 'z': float},
            ...
        }
        """
        if RoomNameManager._room_coords_cache is not None:
            return RoomNameManager._room_coords_cache
        
        room_coords = {}
        coords_file = RoomNameManager.get_coords_csv_file_path()
        
        if not coords_file:
            print("Warning: Room_coords.csv not found in expected locations")
            RoomNameManager._room_coords_cache = {}
            return room_coords
        
        try:
            with open(coords_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if not row or not row.get('Room Id'):
                        continue
                    
                    room_id = row.get('Room Id', '').strip()
                    
                    try:
                        x = float(row.get('X', 0))
                        y = float(row.get('Y', 0))
                        z = float(row.get('Z', 0))
                        
                        if room_id:
                            room_coords[room_id] = {
                                'x': x,
                                'y': y,
                                'z': z
                            }
                    except (ValueError, TypeError):
                        print(f"Warning: Could not parse coordinates for room {room_id}")
                        continue
            
            print(f"✓ Loaded coordinates for {len(room_coords)} rooms from Room_coords.csv")
            RoomNameManager._room_coords_cache = room_coords
        
        except Exception as e:
            print(f"Error loading room coordinates from CSV: {str(e)}")
            RoomNameManager._room_coords_cache = {}
        
        return room_coords
    
    @staticmethod
    def get_room_coordinates(room_number: str) -> Optional[Dict[str, float]]:
        """Get coordinates for a specific room number
        
        Returns: {'x': float, 'y': float, 'z': float} or None
        """
        room_coords = RoomNameManager.load_room_coordinates()
        return room_coords.get(room_number)
    
    @staticmethod
    def clear_cache():
        """Clear the cache (useful for testing or after CSV updates)"""
        RoomNameManager._room_names_cache = None
        RoomNameManager._room_coords_cache = None
        RoomNameManager._csv_file_path = None
        RoomNameManager._coords_file_path = None
