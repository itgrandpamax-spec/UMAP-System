"""
SVG Parser for Floor Plans
Extracts room information (IDs, dimensions, coordinates) from SVG files
"""

import xml.etree.ElementTree as ET
from typing import List, Dict, Tuple, Optional
import re
import os
import csv


class SVGRoom:
    """Represents a room extracted from SVG"""
    def __init__(self, room_id: str, shape_type: str, x: float, y: float, 
                 width: float = 0, height: float = 0, color: Optional[str] = None,
                 room_type: Optional[str] = None, room_name: Optional[str] = None):
        self.room_id = room_id
        self.shape_type = shape_type  # 'rect', 'path', 'circle', etc.
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.color = color  # Fill color from SVG (e.g., '#FF8D4F')
        self.room_type = room_type  # Determined by color (e.g., 'Fire Exit', 'Elevator/Stairs')
        self.room_name = room_name  # Room name from CSV reference
        self.center_x = x + (width / 2) if width else x
        self.center_y = y + (height / 2) if height else y
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization"""
        return {
            'room_id': self.room_id,
            'shape_type': self.shape_type,
            'x': round(self.x, 2),
            'y': round(self.y, 2),
            'width': round(self.width, 2),
            'height': round(self.height, 2),
            'center_x': round(self.center_x, 2),
            'center_y': round(self.center_y, 2),
            'color': self.color,
            'room_type': self.room_type,
            'room_name': self.room_name,
        }
    
    def __repr__(self):
        return f"SVGRoom(id={self.room_id}, type={self.shape_type}, room_type={self.room_type}, name={self.room_name}, pos=({self.x}, {self.y}))"


class SVGParser:
    """Parser for extracting room information from SVG floor plans"""
    
    # Exclude common structural elements (not rooms)
    EXCLUDED_IDS = {
        'Rectangle 4', 'Elevator_1',
        'path-73-inside-1_100_21',  # SVG mask/clip paths
    }
    
    # Color mappings for room types (SVG fill colors)
    COLOR_MAPPINGS = {
        # Fire Exits - Orange colors (various shades)
        '#FF8D4F': 'Fire Exit',  # Orange
        '#FF8847': 'Fire Exit',  # Orange variant
        '#FF7F50': 'Fire Exit',  # Coral
        '#FF6B35': 'Fire Exit',  # Dark orange
        '#FF9966': 'Fire Exit',  # Light orange
        '#FFA500': 'Fire Exit',  # Standard orange
        '#FF8C00': 'Fire Exit',  # Dark orange variant
        '#E67E22': 'Fire Exit',  # Carrot orange
        '#D35400': 'Fire Exit',  # Burnt orange
        '#772C15': 'Fire Exit',  # Dark brown (fill)
        '#A0522D': 'Fire Exit',  # Sienna brown
        
        # Elevators & Stairs - Green colors
        '#68EC89': 'Elevator/Stairs',  # Green
        '#1D4427': 'Elevator/Stairs',  # Dark green
        '#2ECC71': 'Elevator/Stairs',  # Emerald
        '#27AE60': 'Elevator/Stairs',  # Forest green
        '#52BE80': 'Elevator/Stairs',  # Light green
        
        # Boys Bathroom - Blue colors
        '#C6CFF8': 'Boys Bathroom',  # Light blue
        '#142B2C': 'Boys Bathroom',  # Dark blue
        '#3498DB': 'Boys Bathroom',  # Sky blue
        '#2980B9': 'Boys Bathroom',  # Dark sky blue
        
        # Girls Bathroom - Purple colors
        '#A66DBE': 'Girls Bathroom',  # Purple
        '#9370DB': 'Girls Bathroom',  # Medium purple
        '#BA55D3': 'Girls Bathroom',  # Orchid
        '#8E44AD': 'Girls Bathroom',  # Dark purple
    }
    
    def __init__(self, svg_file_path: str, floor_number: int = None, building_id: str = None):
        """Initialize parser with SVG file path
        
        Args:
            svg_file_path: Path to the SVG file
            floor_number: Optional floor number (use if filename doesn't contain HPSB#)
            building_id: Optional building ID (default: "10" for HPSB)
        """
        self.svg_file_path = svg_file_path
        self.tree = None
        self.root = None
        self.rooms: List[SVGRoom] = []
        self.building_id = building_id  # Will extract from filename or use provided value
        self.floor_number = floor_number  # Will extract from filename or use provided value
        self.room_name_map = {}  # Map of room number to name from CSV
        self._extract_building_floor_info()
        self._load_room_names_from_csv()
        self._parse_file()
    
    def _extract_building_floor_info(self):
        """Extract building ID and floor number from file path"""
        # Example: HPSB10.svg -> building_id="10", floor_number=10
        # If already set via constructor, skip file parsing
        if self.floor_number and self.building_id:
            return
        
        import re
        filename = os.path.basename(self.svg_file_path)
        match = re.search(r'HPSB(\d+)', filename)
        if match:
            if not self.floor_number:
                self.floor_number = int(match.group(1))
            if not self.building_id:
                # HPSB building ID is always "10"
                self.building_id = "10"
        else:
            # Filename doesn't contain HPSB pattern
            # Use provided values or defaults
            if not self.building_id:
                self.building_id = "10"  # Default to HPSB building
    
    def _load_room_names_from_csv(self):
        """Load room names from DataDicForSVG.csv using RoomNameManager"""
        try:
            from .room_manager import RoomNameManager
            
            # Load room names using the centralized manager
            self.room_name_map = RoomNameManager.load_room_names()
        
        except Exception as e:
            print(f"Warning: Error loading room names from CSV: {str(e)}")
    
    def _get_room_name_from_id(self, element_id: str) -> Optional[str]:
        """Extract room number from SVG element ID and look up name in CSV"""
        try:
            # Remove any text suffix (e.g., "10912 Autoclave" -> "10912")
            clean_id = element_id.split()[0]
            
            # Handle special room types by name
            lower_id = element_id.lower()
            if 'fire' in lower_id and 'exit' in lower_id:
                return 'Fire Exit'
            elif 'elevator' in lower_id or 'stairs' in lower_id:
                return 'Elevator/Stairs'
            
            # Handle numeric fire exit IDs (1-24)
            if clean_id.isdigit():
                num = int(clean_id)
                if 1 <= num <= 24:
                    # This is a fire exit - try floor context lookup first
                    if self.floor_number:
                        fire_exit_key = f"{self.floor_number}_{clean_id}"
                        if fire_exit_key in self.room_name_map:
                            return self.room_name_map[fire_exit_key]
                    return 'Fire Exit'
            
            # Extract room number based on floor for regular rooms
            if self.floor_number and self.building_id and clean_id.isdigit():
                if self.floor_number <= 9:
                    # Single digit floor: 10{F}NN format
                    # Extract last 3 digits as room number
                    if len(clean_id) >= 3:
                        room_number = clean_id[-3:]
                else:
                    # Double digit floor: 10{FF}NN format
                    # Extract last 4 digits as room number
                    if len(clean_id) >= 4:
                        room_number = clean_id[-4:]
                
                # Look up name in map
                if room_number in self.room_name_map:
                    return self.room_name_map[room_number]
        
        except Exception as e:
            pass
        
        return None
    
    def _parse_file(self):
        """Parse the SVG file"""
        try:
            self.tree = ET.parse(self.svg_file_path)
            self.root = self.tree.getroot()
        except Exception as e:
            raise ValueError(f"Error parsing SVG file: {str(e)}")
    
    def extract_rooms(self) -> List[SVGRoom]:
        """Extract all rooms from the SVG"""
        self.rooms = []
        
        if self.root is None:
            return self.rooms
        
        # Register namespace
        namespace = {'svg': 'http://www.w3.org/2000/svg'}
        
        # Find all elements with IDs (potential rooms)
        for element in self.root.iter():
            element_id = element.get('id', '').strip()
            
            # Skip empty IDs and excluded elements
            if not element_id or self._is_excluded(element_id):
                continue
            
            room = self._parse_element(element, element_id)
            if room:
                self.rooms.append(room)
        
        # Sort rooms by ID for consistency
        self.rooms.sort(key=lambda r: r.room_id)
        return self.rooms
    
    def _is_excluded(self, element_id: str) -> bool:
        """Check if element should be excluded based on room ID format
        
        Priority:
        1. If room exists in CSV, ALWAYS accept it
        2. Reject structural elements
        3. Accept special room keywords
        4. Accept numeric fire exits (1-24)
        5. Validate room ID format for regular rooms
        """
        # Check exact matches in exclude list
        if element_id in self.EXCLUDED_IDS:
            return True
        
        lower_id = element_id.lower()
        clean_id = element_id.split()[0]  # Remove text suffix if present
        
        # === PRIORITY 1: Check if room exists in CSV ===
        # If it's in the CSV, accept it regardless of ID format
        if clean_id in self.room_name_map:
            return False  # ACCEPT: Room is in CSV
        
        # Check if it's a numeric ID that could be a fire exit (1-24)
        if clean_id.isdigit():
            num = int(clean_id)
            if 1 <= num <= 24:
                # Could be a fire exit - check with floor context
                fire_exit_key = f"{self.floor_number}_{clean_id}" if self.floor_number else None
                if fire_exit_key and fire_exit_key in self.room_name_map:
                    return False  # ACCEPT: Fire exit is in CSV
                # Even if not in CSV, accept potential fire exits
                return False
        
        # Check for structural elements
        excluded_patterns = ['rectangle', 'path-', 'mask', 'g id']
        for pattern in excluded_patterns:
            if lower_id.startswith(pattern):
                return True
        
        # Reject IDs with excluded keywords
        excluded_keywords = ['wall', 'door', 'background', 'frame', 'outline', 
                            'grid', 'floor', 'level', 'section', 'boundary', 'hpsb']
        for keyword in excluded_keywords:
            if keyword in lower_id:
                return True
        
        # Accept special rooms by keyword
        special_keywords = ['fire', 'exit', 'elevator', 'stairs', 'bathroom']
        for keyword in special_keywords:
            if keyword in lower_id:
                return False  # ACCEPT special rooms
        
        # === Validate room ID format for regular rooms ===
        if self.building_id and self.floor_number and clean_id.isdigit():
            if self.floor_number <= 9:
                # Single digit floor: 10{F}NN format (5 digits)
                floor_str = str(self.floor_number)
                expected_prefix = f"{self.building_id}{floor_str}"
                expected_len = 5
                
                if len(clean_id) == expected_len and clean_id.startswith(expected_prefix):
                    return False  # ACCEPT: Valid format
                else:
                    return True  # REJECT: Invalid format
            else:
                # Double digit floor: 10{FF}NN format (6 digits)
                floor_str = str(self.floor_number).zfill(2)
                expected_prefix = f"{self.building_id}{floor_str}"
                expected_len = 6
                
                if len(clean_id) == expected_len and clean_id.startswith(expected_prefix):
                    return False  # ACCEPT: Valid format
                else:
                    return True  # REJECT: Invalid format
        
        # By default, exclude unknown IDs
        return True
    
    def _get_color_from_element(self, element) -> Optional[str]:
        """Extract fill color from SVG element"""
        # Try fill attribute first
        fill = element.get('fill')
        if fill and fill != 'none':
            return fill.lower()
        
        # Try stroke attribute as fallback
        stroke = element.get('stroke')
        if stroke and stroke != 'none':
            return stroke.lower()
        
        return None
    
    def _get_room_type_from_color(self, color: Optional[str]) -> Optional[str]:
        """Map color to room type"""
        if not color:
            return None
        
        # Normalize color to lowercase for comparison
        color_lower = color.lower()
        
        # Direct hex color match (case-insensitive)
        for color_key, room_type in self.COLOR_MAPPINGS.items():
            if color_lower == color_key.lower():
                return room_type
        
        # Also check for rgb() format colors - convert to approximate hex
        if 'rgb' in color_lower:
            # This would need conversion logic - for now, check if orange-ish for fire exits
            if any(keyword in color_lower for keyword in ['255', '140', '142', '143', '144', '145']):
                # Orange-ish RGB
                return 'Fire Exit'
        
        return None
    
    def _parse_element(self, element, element_id: str) -> Optional[SVGRoom]:
        """Parse a single SVG element to extract room info"""
        tag = element.tag.split('}')[-1]  # Remove namespace
        
        # Extract color information
        color = self._get_color_from_element(element)
        room_type = self._get_room_type_from_color(color)
        
        # Look up room name from CSV
        room_name = self._get_room_name_from_id(element_id)
        
        try:
            room = None
            if tag == 'rect':
                room = self._parse_rect(element, element_id)
            elif tag == 'path':
                room = self._parse_path(element, element_id)
            elif tag == 'circle':
                room = self._parse_circle(element, element_id)
            elif tag == 'polygon' or tag == 'polyline':
                room = self._parse_polygon(element, element_id)
            elif tag == 'ellipse':
                room = self._parse_ellipse(element, element_id)
            
            # Add color, room type, and room name to room if successfully parsed
            if room:
                room.color = color
                room.room_type = room_type
                room.room_name = room_name
            
            return room
        except Exception as e:
            print(f"Warning: Could not parse element {element_id}: {str(e)}")
        
        return None
    
    def _parse_rect(self, element, element_id: str) -> Optional[SVGRoom]:
        """Parse rectangle element"""
        try:
            x = float(element.get('x', 0))
            y = float(element.get('y', 0))
            width = float(element.get('width', 0))
            height = float(element.get('height', 0))
            
            if width > 0 and height > 0:
                return SVGRoom(element_id, 'rect', x, y, width, height)
        except (ValueError, TypeError):
            pass
        return None
    
    def _parse_path(self, element, element_id: str) -> Optional[SVGRoom]:
        """Parse path element and extract bounding box"""
        try:
            d = element.get('d', '')
            if not d:
                return None
            
            # Extract coordinates from path data
            coords = self._extract_coords_from_path(d)
            if not coords:
                return None
            
            # Calculate bounding box
            x_coords = [c[0] for c in coords]
            y_coords = [c[1] for c in coords]
            
            min_x, max_x = min(x_coords), max(x_coords)
            min_y, max_y = min(y_coords), max(y_coords)
            
            width = max_x - min_x
            height = max_y - min_y
            
            if width > 0 and height > 0:
                return SVGRoom(element_id, 'path', min_x, min_y, width, height)
        except Exception:
            pass
        return None
    
    def _parse_circle(self, element, element_id: str) -> Optional[SVGRoom]:
        """Parse circle element"""
        try:
            cx = float(element.get('cx', 0))
            cy = float(element.get('cy', 0))
            r = float(element.get('r', 0))
            
            if r > 0:
                return SVGRoom(element_id, 'circle', cx - r, cy - r, r * 2, r * 2)
        except (ValueError, TypeError):
            pass
        return None
    
    def _parse_polygon(self, element, element_id: str) -> Optional[SVGRoom]:
        """Parse polygon or polyline element"""
        try:
            points_str = element.get('points', '')
            if not points_str:
                return None
            
            coords = self._extract_coords_from_points(points_str)
            if not coords:
                return None
            
            x_coords = [c[0] for c in coords]
            y_coords = [c[1] for c in coords]
            
            min_x, max_x = min(x_coords), max(x_coords)
            min_y, max_y = min(y_coords), max(y_coords)
            
            width = max_x - min_x
            height = max_y - min_y
            
            if width > 0 and height > 0:
                tag = element.tag.split('}')[-1]
                return SVGRoom(element_id, tag, min_x, min_y, width, height)
        except Exception:
            pass
        return None
    
    def _parse_ellipse(self, element, element_id: str) -> Optional[SVGRoom]:
        """Parse ellipse element"""
        try:
            cx = float(element.get('cx', 0))
            cy = float(element.get('cy', 0))
            rx = float(element.get('rx', 0))
            ry = float(element.get('ry', 0))
            
            if rx > 0 and ry > 0:
                return SVGRoom(element_id, 'ellipse', cx - rx, cy - ry, rx * 2, ry * 2)
        except (ValueError, TypeError):
            pass
        return None
    
    def _extract_coords_from_path(self, d: str) -> List[Tuple[float, float]]:
        """Extract coordinates from SVG path data"""
        coords = []
        
        # Remove command letters and extra spaces
        # SVG path commands: M(move), L(line), H(horiz), V(vert), Z(close), C(curve), etc.
        # We'll extract all number pairs regardless of command
        
        # Replace command letters with space so we can extract numbers
        import re
        # Keep only numbers, decimals, signs, and whitespace/commas
        cleaned = re.sub(r'[A-Za-z]', ' ', d)
        
        # Find all coordinate pairs (handle both space and comma separated)
        pattern = r'(-?[0-9.]+)\s+(-?[0-9.]+)'
        matches = re.findall(pattern, cleaned)
        
        for match in matches:
            try:
                x = float(match[0])
                y = float(match[1])
                coords.append((x, y))
            except ValueError:
                continue
        
        return coords if coords else []
    
    def _extract_coords_from_points(self, points_str: str) -> List[Tuple[float, float]]:
        """Extract coordinates from points attribute"""
        coords = []
        
        # Split by whitespace or comma
        points = re.split(r'[\s,]+', points_str.strip())
        
        for i in range(0, len(points) - 1, 2):
            try:
                x = float(points[i])
                y = float(points[i + 1])
                coords.append((x, y))
            except (ValueError, IndexError):
                continue
        
        return coords
    
    def get_rooms_as_dict(self) -> List[Dict]:
        """Get all rooms as dictionary list"""
        return [room.to_dict() for room in self.rooms]
    
    def get_room_count(self) -> int:
        """Get total number of rooms found"""
        return len(self.rooms)
    
    def get_rooms_by_id_format(self) -> Dict[str, SVGRoom]:
        """Get rooms indexed by ID"""
        return {room.room_id: room for room in self.rooms}


def parse_svg_file(svg_file_path: str) -> Tuple[List[SVGRoom], int]:
    """
    Convenience function to parse SVG and extract rooms
    
    Args:
        svg_file_path: Path to SVG file
    
    Returns:
        Tuple of (rooms list, room count)
    """
    try:
        parser = SVGParser(svg_file_path)
        rooms = parser.extract_rooms()
        return rooms, len(rooms)
    except Exception as e:
        print(f"Error parsing SVG: {str(e)}")
        return [], 0
