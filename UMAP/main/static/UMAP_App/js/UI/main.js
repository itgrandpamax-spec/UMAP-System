// Building location data
const buildingLocations = {
    'HPSB': {
        title: 'HPSB',
        subtitle: 'High Performance Smart Building',
        description: 'A state-of-the-art building featuring modern classrooms, computer laboratories, and advanced facilities. Known for its eco-friendly design and smart technology integration.',
        floors: '4',
        rooms: '30+',
        locations: [
            {
                name: 'Computer Laboratory 1',
                description: 'Advanced computer lab equipped with high-performance workstations and specialized software.',
                floor: '2nd Floor',
                room: '1009',
                features: ['40 Workstations', 'Air-conditioned', 'Projector System'],
                hasNavigation: true,
                coordinates: {x: 120, y: 240}
            },
            {
                name: 'Smart Classroom A',
                description: 'Modern classroom with interactive displays and collaborative learning spaces.',
                floor: '2nd Floor',
                room: '1008',
                features: ['Interactive Whiteboard', 'Video Conference Setup', 'Smart Lighting'],
                hasNavigation: true,
                coordinates: {x: 150, y: 240}
            },
            {
                name: 'Research Laboratory',
                description: 'Dedicated space for student research and specialized projects.',
                floor: '3rd Floor',
                room: '1010',
                features: ['Research Equipment', 'Study Areas', 'Project Spaces'],
                hasNavigation: true,
                coordinates: {x: 180, y: 360}
            }
        ]
    }
};

// Fetch additional building data from backend if available
async function fetchBuildingData() {
    try {
        const response = await fetch('/api/buildings/');
        const data = await response.json();
        
        if (data.status === 'success') {
            Object.values(data.buildings).forEach(building => {
                const buildingObj = {
                    title: building.name,
                    subtitle: `${building.floors.length} Floor${building.floors.length > 1 ? 's' : ''}`,
                    roomCount: `${building.rooms.length} rooms`,
                    description: '',
                    floors: building.floors.length,
                    rooms: building.rooms.length,
                    locations: building.rooms.map(room => ({
                        name: room.name,
                        floor: room.floor,
                        description: room.type,
                        features: []
                    }))
                };
                
                // Add with building name as key
                buildingLocations[building.name] = buildingObj;
                
                // Also add with common SVG ID patterns to ensure all buildings work
                buildingLocations[building.name.toLowerCase()] = buildingObj;
                buildingLocations[building.name.toUpperCase()] = buildingObj;
                
                // Add with "Building" prefix variations (e.g., "Building1" -> map to actual building)
                const simpleName = building.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                if (simpleName) {
                    buildingLocations[simpleName] = buildingObj;
                }
            });
            
            console.log('Building data loaded:', buildingLocations);
        } else {
            console.error('Error fetching building data:', data.message);
        }
    } catch (error) {
        console.error('Error fetching building data:', error);
    }
}

function createLocationCard(location) {
    if (!location.features) return '';
    
    const features = location.features.map(feature => 
        `<span class="px-2 py-1 bg-blue-900/30 text-blue-300 text-xs rounded-full border border-blue-800/50">
            ${feature}
        </span>`
    ).join('');

    return `
        <div class="location-card group">
            <div class="card-content">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 class="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">
                            ${location.name}
                        </h3>
                        <p class="text-sm text-blue-400/80">${location.floor}</p>
                    </div>
                    <button class="text-gray-400 hover:text-white p-2 hover:bg-gray-700/50 rounded-lg transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M9 5l7 7-7 7"/>
                        </svg>
                    </button>
                </div>
                <p class="text-gray-300 text-sm leading-relaxed">${location.description}</p>
                ${features}
            </div>
        </div>
    `;
}

// Track room views for both authenticated users and guests
function trackRoomView(roomId, roomData = null) {
    // Check if user is authenticated via body data attribute
    const isAuthenticated = document.body.dataset.authenticated === 'true';
    
    console.log('=== trackRoomView called ===');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('roomId:', roomId);
    console.log('roomData:', roomData);
    console.log('body dataset:', document.body.dataset);
    
    if (isAuthenticated) {
        // Send tracking to server for authenticated users
        console.log('Route: AUTHENTICATED - Sending to server API');
        const csrfToken = getCookie('csrftoken');
        console.log('CSRF token:', csrfToken);
        
        fetch(`/api/room/${roomId}/track-view/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            }
        })
        .then(response => {
            console.log('Track view response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers));
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Track view response data:', data);
            console.log('=== trackRoomView complete ===');
        })
        .catch(err => {
            console.error('=== ERROR in trackRoomView ===');
            console.error('Failed to track view:', err);
            console.error('Error message:', err.message);
            console.error('Stack:', err.stack);
        });
    } else {
        // Cache recent views locally for guests using sessionStorage (resets on page close)
        console.log('Route: GUEST - Saving to sessionStorage');
        console.log('roomData for guest:', roomData);
        const recentViews = JSON.parse(sessionStorage.getItem('recentRoomViews') || '[]');
        
        // Add current room view with timestamp and available room data
        let imageUrl = null;
        if (roomData) {
            // Try multiple possible image URL locations
            imageUrl = roomData.image_url || 
                      roomData.images?.[0]?.image || 
                      roomData.images?.url ||
                      (roomData.room_images?.length > 0 ? roomData.room_images[0].image : null) ||
                      null;
            console.log('Extracted imageUrl:', imageUrl);
        }
        
        const roomView = {
            id: roomId,
            timestamp: new Date().toISOString(),
            // Store room details if available to avoid re-fetching
            name: roomData?.name || roomData?.room_name || null,
            number: roomData?.number || roomData?.room_number || roomId,
            floorName: roomData?.floor?.name || roomData?.floor_name || null,
            type: roomData?.type || roomData?.room_type || 'Room',
            imageUrl: imageUrl
        };
        
        // Remove if already exists to move it to front
        const filtered = recentViews.filter(view => view.id != roomId);
        
        // Add to front and keep only last 10
        filtered.unshift(roomView);
        sessionStorage.setItem('recentRoomViews', JSON.stringify(filtered.slice(0, 10)));
        console.log('=== trackRoomView complete (guest) ===');
    }
}

// Helper function to get CSRF token
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// SVG Map Event Handlers
document.addEventListener('DOMContentLoaded', () => {
    // Get the appropriate SVG based on screen size
    const isMobileView = window.innerWidth < 768;
    const svg = document.getElementById(isMobileView ? 'umapSVG-mobile' : 'umapSVG');
    const fogOverlay = document.getElementById('fogOverlay');
    const zoomBtn = document.getElementById('zoomBtn');
    
    if (!svg) {
        console.error('SVG element not found');
        return;
    }
    
    // Prevent pull to refresh on mobile
    document.body.addEventListener('touchmove', function(e) {
        const touchY = e.touches[0].clientY;
        if (window.scrollY === 0 && touchY > 0) {
            e.preventDefault();
        }
    }, { passive: false });

    // Add touch handling to all scrollable containers
    const scrollableContainers = document.querySelectorAll('.overflow-y-auto, .overflow-auto, #locationSidebar');
    scrollableContainers.forEach(container => {
        container.addEventListener('touchstart', function(e) {
            this.allowUp = this.scrollTop > 0;
            this.allowDown = this.scrollTop < this.scrollHeight - this.clientHeight;
            this.lastY = e.touches[0].clientY;
        });

        container.addEventListener('touchmove', function(e) {
            const up = e.touches[0].clientY > this.lastY;
            const down = !up;
            this.lastY = e.touches[0].clientY;

            if ((up && this.allowUp) || (down && this.allowDown)) {
                e.stopPropagation();
            } else {
                e.preventDefault();
            }
        }, { passive: false });
    });
    
    // Function to initialize SVG interactivity
    const initializeSVG = () => {
        try {
            const svgDoc = svg.contentDocument;
            if (!svgDoc) {
                console.warn('SVG document not accessible yet');
                return false;
            }
            
            const svgElement = svgDoc.querySelector('svg');
            if (!svgElement) {
                console.warn('SVG element not found in document');
                return false;
            }
        
            // Make SVG responsive
            svgElement.style.width = '100%';
            svgElement.style.height = '100%';
            svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

            // Find all building elements with various possible ID patterns
            const buildings = Array.from(svgDoc.querySelectorAll('path[id], polygon[id], g[id]')).filter(el => {
                const id = el.id.toLowerCase();
                return id.includes('building') || 
                       id.includes('bldg') || 
                       id === 'hpsb' || 
                       id === 'admin' || 
                       id === 'oval' || 
                       id.match(/^building\d+$/);
            });
            
            // Log found buildings for debugging
            console.log('Found buildings:', buildings.map(b => b.id));
            
            // Initialize building data
            fetchBuildingData();
            
            console.log('Total buildings found:', buildings.length);
            console.log('Building elements:', buildings);
            
            buildings.forEach(building => {
                // Set up building interactions
                const defaultStyle = window.getComputedStyle(building);
                const defaultFill = defaultStyle.fill;
                
                // Make building interactive
                building.style.cursor = 'pointer';
                building.style.transition = 'all 0.3s ease';
                
                // Store original fill color
                building.dataset.originalFill = defaultFill;
                
                const highlight = () => {
                    if (!building.classList.contains('selected')) {
                        building.style.fill = 'rgba(59, 130, 246, 0.5)';
                        building.style.filter = 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))';
                    }
                };
                
                const unhighlight = () => {
                    if (!building.classList.contains('selected')) {
                        building.style.fill = building.dataset.originalFill;
                        building.style.filter = '';
                    }
                };

                // Handle both mouse and touch events
                building.addEventListener('mouseenter', highlight);
                building.addEventListener('mouseleave', unhighlight);
                building.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    highlight();
                });
                
                const handleBuildingSelect = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log('Building clicked:', building.id);
                    
                    // Reset previous selections
                    buildings.forEach(b => {
                        b.classList.remove('selected');
                        b.style.fill = b.dataset.originalFill || '';
                        b.style.filter = '';
                    });
                    
                    // Set this building as selected
                    building.classList.add('selected');
                    building.style.fill = 'rgba(255, 152, 0, 0.7)';
                    building.style.filter = 'drop-shadow(0 0 12px rgba(255, 152, 0, 0.5))';
                    
                    // Calculate panel position for non-mobile
                    let position = null;
                    if (window.innerWidth > 768) {
                        const rect = building.getBoundingClientRect();
                        position = {
                            x: rect.left + (rect.width / 2),
                            y: rect.top + (rect.height / 2)
                        };
                    }
                    
                    // Show building info panel
                    const buildingName = building.id.toLowerCase();
                    const displayName = buildingName
                        .replace(/^(building|bldg)/, 'Building ')
                        .replace(/^hpsb$/, 'HPSB')
                        .replace(/^admin$/, 'ADMIN')
                        .replace(/^oval$/, 'Oval');
                        
                    showBuildingPanel({
                        id: building.id,
                        name: displayName,
                        position: position
                    });
                };

                building.addEventListener('click', handleBuildingSelect);
                building.addEventListener('touchend', handleBuildingSelect);
            });

            // Enable panning with drag threshold to avoid interfering with clicks
            // Dragging functionality is disabled for SVG
            // Users can still interact with buildings and other elements normally
            
            return true;
        } catch (error) {
            console.error('Error initializing SVG:', error);
            return false;
        }
    };
    
    // Try to initialize immediately
    if (!initializeSVG()) {
        // If not ready, attach load event listener
        svg.addEventListener('load', () => {
            console.log('SVG load event fired, initializing...');
            initializeSVG();
        });
        
        // Also try again after a short delay as fallback
        setTimeout(() => {
            if (!initializeSVG()) {
                console.warn('SVG still not ready after timeout, will try again');
                setTimeout(initializeSVG, 1000);
            }
        }, 500);
    } else {
        console.log('SVG initialized immediately');
    }
});

// Building Panel Functions
function showBuildingPanel(data) {
    const buildingId = data.id;
    const panel = document.getElementById('buildingPanel');
    
    // Store the ID for reference
    panel.dataset.buildingId = buildingId;
    
    // Format display name for the panel title
    let displayTitle = data.name;
    if (data.name === 'ADMIN') displayTitle = 'Admin Building';
    
    // First, update with the display name
    document.getElementById('panelBuildingTitle').textContent = displayTitle;
    document.getElementById('panelBuildingSubtitle').textContent = 'Loading information...';
    document.getElementById('panelBuildingDescription').textContent = '';
    document.getElementById('panelFloorCount').textContent = '--';
    document.getElementById('panelRoomCount').textContent = '--';
    
    console.log('showBuildingPanel called for:', {buildingId, apiName: data.name, displayTitle});
    
    // Fetch building data from API to get floor/room counts AND the exact API building name
    fetch(`/api/buildings/`)
        .then(response => response.json())
        .then(apiResponse => {
            if (apiResponse.status === 'success' && apiResponse.buildings) {
                let buildingData = null;
                let exactBuildingName = null;
                
                const searchName = (data.name || buildingId).toLowerCase().trim();
                console.log('Searching for building matching:', searchName);
                console.log('Available buildings in API:', Object.keys(apiResponse.buildings));
                
                // Strategy 1: Exact case-insensitive match
                for (let key in apiResponse.buildings) {
                    const keyLower = key.toLowerCase().trim();
                    if (keyLower === searchName) {
                        buildingData = apiResponse.buildings[key];
                        exactBuildingName = key;
                        console.log('Found via exact match:', exactBuildingName);
                        break;
                    }
                }
                
                // Strategy 2: Substring match (building name is contained in or contains search name)
                if (!buildingData) {
                    for (let key in apiResponse.buildings) {
                        const keyLower = key.toLowerCase().trim();
                        if (keyLower.includes(searchName) || searchName.includes(keyLower)) {
                            buildingData = apiResponse.buildings[key];
                            exactBuildingName = key;
                            console.log('Found via substring match:', exactBuildingName);
                            break;
                        }
                    }
                }
                
                if (buildingData && exactBuildingName) {
                    const floorCount = buildingData.floors ? buildingData.floors.length : 0;
                    const roomCount = buildingData.rooms ? buildingData.rooms.length : 0;
                    
                    document.getElementById('panelBuildingTitle').textContent = displayTitle;
                    document.getElementById('panelBuildingSubtitle').textContent = `${floorCount} Floor${floorCount !== 1 ? 's' : ''}`;
                    document.getElementById('panelBuildingDescription').textContent = buildingData.description || '';
                    document.getElementById('panelFloorCount').textContent = floorCount;
                    document.getElementById('panelRoomCount').textContent = roomCount;
                    
                    // CRITICAL: Store the EXACT API building name for later retrieval
                    panel.dataset.apiBuildingName = exactBuildingName;
                    
                    console.log('✓ Panel updated successfully:', {buildingId, exactBuildingName, floorCount, roomCount});
                } else {
                    console.error('✗ Building not found in API:', {searchName, availableBuildings: Object.keys(apiResponse.buildings)});
                    // Fallback: still set the API building name to the searched name so at least something works
                    panel.dataset.apiBuildingName = data.name;
                    document.getElementById('panelBuildingSubtitle').textContent = 'Building Information';
                }
            }
        })
        .catch(error => {
            console.error('Error fetching building data:', error);
            // Fallback
            panel.dataset.apiBuildingName = data.name;
            document.getElementById('panelBuildingSubtitle').textContent = 'Building Information';
        });

    // Position and show panel
    const isMobile = window.innerWidth <= 768;
    
    panel.style.transition = 'none'; // Remove transition temporarily
    
    if (isMobile) {
        // Mobile: floating modal - centered on screen with margin, positioned lower
        panel.style.position = 'fixed';
        panel.style.left = '50%';
        panel.style.top = '55%';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.width = 'calc(100% - 32px)';
        panel.style.maxWidth = '500px';
        panel.style.zIndex = '1000';
        panel.style.maxHeight = '75vh';
    } else {
        // Desktop: floating centered modal
        panel.style.position = 'fixed';
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.width = 'auto';
        panel.style.maxWidth = '400px';
        panel.style.zIndex = '1000';
        panel.style.maxHeight = '90vh';
    }

    // Show panel with opacity animation
    setTimeout(() => {
        panel.style.transition = 'opacity 0.2s ease-out';
        panel.style.opacity = '1';
        panel.style.pointerEvents = 'auto';
        panel.classList.add('visible');
    }, 50);
}

// Function to hide the building panel
window.hideBuildingPanel = function() {
    const panel = document.getElementById('buildingPanel');
    panel.style.opacity = '0';
    panel.classList.remove('visible');
    panel.style.pointerEvents = 'none';
    
    // Reset building highlights
    const isMobileView = window.innerWidth < 768;
    const svgElement = document.getElementById(isMobileView ? 'umapSVG-mobile' : 'umapSVG');
    const svgDoc = svgElement ? svgElement.contentDocument : null;
    if (svgDoc) {
        const buildings = svgDoc.querySelectorAll('[id^="Building"], [id="HPSB"]');
        buildings.forEach(building => {
            building.classList.remove('selected');
            building.style.fill = '';
            building.style.filter = '';
        });
    }
}

// Function to toggle the full locations list
window.toggleLocationsList = function() {
    const panel = document.getElementById('buildingPanel');
    const buildingId = panel.dataset.buildingId;
    if (buildingId) {
        showBuildingLocations(buildingId);
        hideBuildingPanel();
    }
}

// Function to view building details (floors/rooms)
window.viewBuildingDetails = function(view) {
    const panel = document.getElementById('buildingPanel');
    const buildingId = panel.dataset.buildingId;
    const apiBuildingName = panel.dataset.apiBuildingName;
    
    console.log('viewBuildingDetails called:', {view, buildingId, apiBuildingName});
    
    if (!buildingId || !apiBuildingName) {
        console.error('Missing building data in panel');
        return;
    }

    if (view === 'floors') {
        showFloorsPanel(apiBuildingName);
    } else if (view === 'rooms') {
        showRoomsPanel(apiBuildingName);
    }
}

// Show floors in the sidebar
window.showFloorsPanel = function(buildingName) {
    const sidebar = document.getElementById('locationSidebar');
    const locationCards = document.getElementById('locationCards');
    
    if (!sidebar) {
        console.error('Sidebar element not found');
        return;
    }
    
    // Update header
    document.getElementById('buildingTitle').textContent = buildingName;
    document.getElementById('buildingSubtitle').textContent = 'Floors';
    document.getElementById('buildingRoomCount').textContent = '';
    document.getElementById('buildingDescription').textContent = '';
    
    locationCards.innerHTML = '<div class="text-slate-400 text-center py-4">Loading floors...</div>';
    updateSearchMode('floors');
    
    // Show sidebar immediately
    sidebar.classList.add('show');
    hideBuildingPanel();
    
    console.log('showFloorsPanel called for building:', buildingName);
    
    // Fetch floors from backend
    fetch(`/api/buildings/`)
        .then(response => response.json())
        .then(apiData => {
            console.log('API Response:', apiData);
            console.log('Buildings in API:', Object.keys(apiData.buildings || {}));
            
            if (apiData.status === 'success' && apiData.buildings) {
                let buildingData = null;
                let foundKey = null;
                
                // Find the building with exact match first (case-sensitive)
                if (apiData.buildings[buildingName]) {
                    buildingData = apiData.buildings[buildingName];
                    foundKey = buildingName;
                    console.log('Found via exact match:', foundKey);
                }
                
                // If not found, try case-insensitive match
                if (!buildingData) {
                    const searchName = buildingName.toLowerCase();
                    for (let key in apiData.buildings) {
                        if (key.toLowerCase() === searchName) {
                            buildingData = apiData.buildings[key];
                            foundKey = key;
                            console.log('Found via case-insensitive match:', foundKey);
                            break;
                        }
                    }
                }
                
                if (buildingData && buildingData.floors && buildingData.floors.length > 0) {
                    console.log('Building data found with floors:', buildingData.floors.length);
                    
                    // Create floor cards
                    locationCards.innerHTML = '';
                    buildingData.floors.forEach((floor) => {
                        // Count rooms in this floor
                        const roomsInFloor = buildingData.rooms.filter(r => r.floor === floor.name);
                        
                        const floorCard = document.createElement('div');
                        floorCard.className = 'location-card group cursor-pointer';
                        floorCard.innerHTML = `
                            <div class="flex justify-between items-start">
                                <div class="flex-1">
                                    <h3 class="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">
                                        ${floor.name}
                                    </h3>
                                    <p class="text-sm text-slate-400">${roomsInFloor.length} rooms</p>
                                </div>
                                <i class="fas fa-chevron-right text-slate-500 group-hover:text-blue-400 transition-colors mt-1"></i>
                            </div>
                        `;
                        
                        floorCard.addEventListener('click', (e) => {
                            e.stopPropagation();
                            showRoomsInFloor(foundKey, floor.name, roomsInFloor);
                        });
                        
                        locationCards.appendChild(floorCard);
                    });
                    
                    initializeLocationSearch();
                    console.log('Floors loaded successfully');
                } else {
                    locationCards.innerHTML = '<div class="text-slate-400 text-center py-4">No floors found for this building</div>';
                    console.log('No floor data found for building:', buildingName);
                }
            } else {
                locationCards.innerHTML = '<div class="text-slate-400 text-center py-4">Unable to load building data</div>';
                console.error('Invalid API response');
            }
        })
        .catch(error => {
            console.error('Error fetching floors:', error);
            locationCards.innerHTML = '<div class="text-slate-400 text-center py-4">Error loading floors</div>';
        });
}

// Show rooms in a specific floor
window.showRoomsInFloor = function(buildingName, floorName, rooms) {
    const sidebar = document.getElementById('locationSidebar');
    const locationCards = document.getElementById('locationCards');
    
    document.getElementById('buildingTitle').textContent = buildingName;
    document.getElementById('buildingSubtitle').textContent = floorName;
    document.getElementById('buildingRoomCount').textContent = `${rooms.length} rooms on this floor`;
    document.getElementById('buildingDescription').textContent = '';
    
    locationCards.innerHTML = '';
    updateSearchMode('rooms');
    
    // Create room cards
    rooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'location-card group cursor-pointer';
        roomCard.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">
                        ${room.name}
                    </h3>
                    <p class="text-sm text-slate-400">Room ${room.number}</p>
                    <p class="text-xs text-slate-500">${room.type}</p>
                </div>
                <i class="fas fa-door-open text-slate-500 text-sm mt-1"></i>
            </div>
            <div id="room-rating-${room.id}" class="text-xs text-slate-400">Loading ratings...</div>
        `;
        
        // Add click handler to show room preview
        roomCard.addEventListener('click', (e) => {
            e.stopPropagation();
            showRoomPreview(room.id);
        });
        
        locationCards.appendChild(roomCard);
        
        // Fetch and display ratings for this room
        fetch(`/api/room/${room.id}/ratings/`)
            .then(r => r.json())
            .then(data => {
                const ratingDiv = document.getElementById(`room-rating-${room.id}`);
                if (ratingDiv) {
                    const avgRating = data.average_rating || 0;
                    const totalRatings = data.total_ratings || 0;
                    if (totalRatings > 0) {
                        const starsHtml = generateStarDisplay(avgRating);
                        ratingDiv.innerHTML = `<div class="flex items-center gap-1"><div class="flex gap-0.5 text-yellow-400">${starsHtml}</div><span class="text-slate-400">${avgRating.toFixed(1)} (${totalRatings})</span></div>`;
                    } else {
                        ratingDiv.innerHTML = '<span class="text-slate-500 italic">No ratings yet</span>';
                    }
                }
            })
            .catch(err => {
                const ratingDiv = document.getElementById(`room-rating-${room.id}`);
                if (ratingDiv) ratingDiv.innerHTML = '<span class="text-slate-500 italic">Rating unavailable</span>';
            });
    });
    
    // Add back button inside locationCards container
    const backBtn = document.createElement('button');
    backBtn.className = 'w-full mt-4 px-4 py-2 bg-slate-700/50 hover:bg-slate-700/70 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-2';
    backBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Back to Floors';
    backBtn.addEventListener('click', () => {
        showFloorsPanel(buildingName);
    });
    locationCards.appendChild(backBtn);
    
    initializeLocationSearch();
    sidebar.classList.add('show');
}

// Keep the old showBuildingLocations function for the full sidebar (updated to show floors first)
window.showBuildingLocations = function(buildingId) {
    const panel = document.getElementById('buildingPanel');
    const apiBuildingName = panel.dataset.apiBuildingName;
    if (!apiBuildingName) return;
    showFloorsPanel(apiBuildingName);
}

// Search/Filter functionality for locations
let allLocationCards = [];
let currentSearchMode = null; // 'floors' or 'rooms'

window.initializeLocationSearch = function() {
    const searchInput = document.getElementById('locationSearchInput');
    const locationCards = document.getElementById('locationCards');
    const noResultsMsg = document.getElementById('noSearchResults');
    const resultCount = document.getElementById('searchResultCount');
    
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (searchTerm === '') {
            // Show all cards if search is empty
            Array.from(locationCards.children).forEach(card => {
                card.style.display = 'block';
            });
            noResultsMsg.classList.add('hidden');
            resultCount.textContent = currentSearchMode === 'floors' 
                ? 'Showing all floors' 
                : 'Showing all rooms';
            return;
        }
        
        let visibleCount = 0;
        Array.from(locationCards.children).forEach(card => {
            const titleElement = card.querySelector('h3');
            const subtitleElement = card.querySelector('p');
            const title = titleElement ? titleElement.textContent.toLowerCase() : '';
            const subtitle = subtitleElement ? subtitleElement.textContent.toLowerCase() : '';
            
            // Match against title, room number, floor name, or room type
            const matches = title.includes(searchTerm) || subtitle.includes(searchTerm);
            
            if (matches) {
                card.style.display = 'block';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        // Show/hide no results message
        if (visibleCount === 0) {
            noResultsMsg.classList.remove('hidden');
            resultCount.textContent = 'No results found';
        } else {
            noResultsMsg.classList.add('hidden');
            resultCount.textContent = `Found ${visibleCount} ${currentSearchMode === 'floors' ? 'floor' : 'room'}${visibleCount > 1 ? 's' : ''}`;
        }
    });
};

// Update the search mode and reset search when switching between floors/rooms
window.updateSearchMode = function(mode) {
    currentSearchMode = mode;
    const searchInput = document.getElementById('locationSearchInput');
    const resultCount = document.getElementById('searchResultCount');
    if (searchInput) {
        searchInput.value = '';
        resultCount.textContent = mode === 'floors' ? 'Showing all floors' : 'Showing all rooms';
    }
};

// Function to hide the location sidebar
window.hideLocationSidebar = function() {
    const sidebar = document.getElementById('locationSidebar');
    sidebar.classList.remove('show');
}

// Close panels when clicking outside
document.addEventListener('click', (e) => {
    const panel = document.getElementById('buildingPanel');
    const sidebar = document.getElementById('locationSidebar');
    const isPanelClick = panel.contains(e.target);
    const isSidebarClick = sidebar.contains(e.target);
    const isMapClick = e.target.closest('#umapSVG, #umapSVG-mobile');
    
    // Only close building panel if clicking outside both panel and sidebar and map
    if (!isPanelClick && !isSidebarClick && !isMapClick && panel.style.opacity === '1') {
        hideBuildingPanel();
    }
    
    // Only close sidebar if clicking on the map or completely outside (not on sidebar, not on panel, not on map)
    if (isMapClick || (!isSidebarClick && !isPanelClick && sidebar.classList.contains('show'))) {
        if (isMapClick) {
            hideLocationSidebar();
        }
    }
});

document.addEventListener("DOMContentLoaded", () => {
  // Sidebar toggle
  const toggleBtn = document.getElementById("toggleSidebar");
  const sidebar = document.getElementById("sidebar");
  
  if (toggleBtn && sidebar) {
    let sidebarVisible = true;
    toggleBtn.addEventListener("click", () => {
      sidebarVisible = !sidebarVisible;
      sidebar.style.transform = sidebarVisible ? "translateX(0)" : "translateX(-100%)";
    });
  }

  // Map Search functionality
  const mapSearchInput = document.getElementById('mapSearchInput');
  const mapSearchResults = document.getElementById('mapSearchResults');
  const mapSearchResultsList = document.getElementById('mapSearchResultsList');
  let mapSearchTimeout;

  if (mapSearchInput) {
    mapSearchInput.addEventListener('input', function() {
      clearTimeout(mapSearchTimeout);
      const query = this.value.trim();

      if (query.length < 2) {
        mapSearchResults.classList.add('hidden');
        return;
      }

      mapSearchTimeout = setTimeout(() => {
        fetch(`/api/search-rooms/?q=${encodeURIComponent(query)}`)
          .then(response => response.json())
          .then(data => {
            mapSearchResultsList.innerHTML = '';
            
            if (!data.results || data.results.length === 0) {
              mapSearchResultsList.innerHTML = '<div class="p-3 text-slate-400 text-sm text-center">No results found</div>';
              mapSearchResults.classList.remove('hidden');
              return;
            }

            data.results.forEach(result => {
              const resultEl = document.createElement('a');
              resultEl.href = '#';
              resultEl.className = 'block px-4 py-3 hover:bg-slate-700/50 transition-colors duration-150 text-sm';
              
              if (result.type === 'room') {
                // Fetch ratings for this room
                fetch(`/api/room/${result.id}/ratings/`)
                  .then(r => r.json())
                  .then(ratingData => {
                    const avgRating = ratingData.average_rating || 0;
                    const totalRatings = ratingData.total_ratings || 0;
                    const starsHtml = generateStarDisplay(avgRating);
                    
                    resultEl.innerHTML = `
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="text-white font-medium">${result.name}</div>
                          <div class="text-xs text-slate-400">Room ${result.number} • ${result.room_type}</div>
                          <div class="text-xs text-slate-500">${result.building} - ${result.floor}</div>
                          <div class="text-xs text-yellow-400 mt-1">${starsHtml}<span class="text-slate-400 ml-1">(${totalRatings})</span></div>
                        </div>
                        <i class="fas fa-door-open text-slate-500 text-xs mt-1"></i>
                      </div>
                    `;
                  })
                  .catch(error => {
                    console.error('Error loading rating for search result:', error);
                    // Show without rating if error
                    resultEl.innerHTML = `
                      <div class="flex items-start justify-between">
                        <div>
                          <div class="text-white font-medium">${result.name}</div>
                          <div class="text-xs text-slate-400">Room ${result.number} • ${result.room_type}</div>
                          <div class="text-xs text-slate-500">${result.building} - ${result.floor}</div>
                        </div>
                        <i class="fas fa-door-open text-slate-500 text-xs mt-1"></i>
                      </div>
                    `;
                  });
              } else if (result.type === 'floor') {
                resultEl.innerHTML = `
                  <div class="flex items-start justify-between">
                    <div>
                      <div class="text-white font-medium">${result.name}</div>
                      <div class="text-xs text-slate-400">${result.building}</div>
                      <div class="text-xs text-slate-500">${result.room_count} rooms</div>
                    </div>
                    <i class="fas fa-building text-slate-500 text-xs mt-1"></i>
                  </div>
                `;
              }

              resultEl.addEventListener('click', (e) => {
                e.preventDefault();
                
                // If it's a room, open the preview modal
                if (result.type === 'room') {
                  mapSearchInput.value = '';
                  mapSearchResults.classList.add('hidden');
                  showRoomPreview(result.id);
                } 
                // If it's a floor/building, show that building's floors
                else if (result.type === 'floor') {
                  mapSearchInput.value = '';
                  mapSearchResults.classList.add('hidden');
                  // Navigate to that building/floor
                  showFloorsPanel(result.id, { title: result.building });
                }
              });

              mapSearchResultsList.appendChild(resultEl);
            });

            mapSearchResults.classList.remove('hidden');
          })
          .catch(error => {
            console.error('Search error:', error);
            mapSearchResultsList.innerHTML = '<div class="p-3 text-red-400 text-sm text-center">Search error</div>';
            mapSearchResults.classList.remove('hidden');
          });
      }, 300);
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
      if (!mapSearchInput.contains(e.target) && !mapSearchResults.contains(e.target)) {
        mapSearchResults.classList.add('hidden');
      }
    });
  }

  // Login Modal setup
  const loginOverlay = document.getElementById("loginOverlay");
  const loginModal = document.getElementById("loginModal");
  const openLoginBtn = document.getElementById("openLoginBtn");
  const closeLoginBtn = document.getElementById("closeLoginModal");

  function showLoginModal() {
    loginOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      loginModal.style.opacity = "1";
      loginModal.style.transform = "scale(1)";
    });
  }

  function hideLoginModal() {
    loginModal.style.opacity = "0";
    loginModal.style.transform = "scale(0.95)";
    document.body.style.overflow = "";
    setTimeout(() => {
      loginOverlay.classList.add("hidden");
    }, 200);
  }

  if (openLoginBtn) {
    openLoginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showLoginModal();
    });
  }

  const openLoginBtnMobile = document.getElementById("openLoginBtnMobile");
  if (openLoginBtnMobile) {
    openLoginBtnMobile.addEventListener("click", (e) => {
      e.preventDefault();
      showLoginModal();
    });
  }

  if (closeLoginBtn) {
    closeLoginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      hideLoginModal();
    });
  }

  if (loginOverlay) {
    loginOverlay.addEventListener("click", (e) => {
      if (e.target === loginOverlay) {
        hideLoginModal();
      }
    });
  }

  // Close modal on escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !loginOverlay.classList.contains("hidden")) {
      hideLoginModal();
    }
  });

  // Login/Signup Tabs
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const goSignup = document.getElementById("goSignup");
  const goLogin = document.getElementById("goLogin");

  function showLogin() {
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
    loginTab.classList.add("toggle-active");
    signupTab.classList.remove("toggle-active");
  }

  function showSignup() {
    signupForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    signupTab.classList.add("toggle-active");
    loginTab.classList.remove("toggle-active");
  }

  if (loginTab && signupTab) {
    loginTab.addEventListener("click", showLogin);
    signupTab.addEventListener("click", showSignup);
  }
  if (goSignup) goSignup.addEventListener("click", e => { e.preventDefault(); showSignup(); });
  if (goLogin) goLogin.addEventListener("click", e => { e.preventDefault(); showLogin(); });
});

// Room Preview Functions
window.showRoomPreview = function(roomId) {
    const modal = document.getElementById('roomPreviewModal');
    
    // Show modal immediately with loading state
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    modal.dataset.currentRoomId = roomId;
    
    // Reset rating UI
    const selectedRating = document.getElementById('selectedRating');
    const ratingComment = document.getElementById('ratingComment');
    if (selectedRating) selectedRating.value = '0';
    if (ratingComment) ratingComment.value = '';
    document.querySelectorAll('.star-rating i').forEach(star => {
        star.classList.remove('fas');
        star.classList.add('far');
    });
    
    // Fetch room data, photos, and ratings in parallel for better performance
    Promise.all([
        fetch(`/api/room/${roomId}/`).then(r => r.json()),
        fetch(`/api/room/${roomId}/photos/`).then(r => r.json()),
        fetch(`/api/room/${roomId}/ratings/`).then(r => r.json())
    ])
    .then(([roomData, photosData, ratingsData]) => {
        // Track room view with complete room data for guests
        if (roomData && roomData.room) {
            trackRoomView(roomId, roomData.room);
        } else {
            trackRoomView(roomId);
        }
        // Clear previous photos only, keep ratings container structure intact
        const prevPhotosGrid = document.getElementById('roomPhotosGrid');
        if (prevPhotosGrid) prevPhotosGrid.innerHTML = '';
        
        // Reset ratings to loading state
        const noRatingsMsg = document.getElementById('noRatingsMessage');
        const recentRatingsContainer = document.getElementById('recentRatingsContainer');
        if (recentRatingsContainer && noRatingsMsg) {
            recentRatingsContainer.innerHTML = '';
            recentRatingsContainer.appendChild(noRatingsMsg);
            noRatingsMsg.style.display = 'block';
        }
        
        // Batch DOM updates to minimize reflows
        
        // Helper function to safely set text content
        const setText = (id, value) => {
            const elem = document.getElementById(id);
            if (elem) elem.textContent = value;
        };
        
        // Helper function to safely set HTML
        const setHTML = (id, value) => {
            const elem = document.getElementById(id);
            if (elem) elem.innerHTML = value;
        };
        
        // Update text content (fast)
        setText('roomModalTitle', roomData.name);
        setText('roomModalSubtitle', `Room ${roomData.number} • ${roomData.floor || 'Unknown Floor'}`);
        setText('roomModalNumber', roomData.number || 'N/A');
        setText('roomModalType', roomData.type || 'Standard');
        setText('roomModalFloor', roomData.floor || 'N/A');
        setText('roomModalDescription', roomData.description || 'No description available');
        
        // Update ratings display
        const avgRating = ratingsData.average_rating || 0;
        const totalRatings = ratingsData.total_ratings || 0;
        
        setText('roomAverageRating', avgRating.toFixed(1));
        setText('roomRatingCount', totalRatings);
        
        // Display average rating stars
        const avgStarsHtml = generateStarDisplay(avgRating);
        setHTML('roomAverageStars', avgStarsHtml);
        
        // Show/hide rating form based on authentication
        const rateRoomContainer = document.getElementById('rateRoomContainer');
        const loginPromptContainer = document.getElementById('loginPromptContainer');
        
        if (rateRoomContainer && loginPromptContainer) {
            if (ratingsData.is_authenticated) {
                rateRoomContainer.classList.remove('hidden');
                loginPromptContainer.classList.add('hidden');
                
                // If user has already rated, pre-populate the form
                if (ratingsData.user_rating) {
                    const selectedRating = document.getElementById('selectedRating');
                    const ratingComment = document.getElementById('ratingComment');
                    if (selectedRating) selectedRating.value = ratingsData.user_rating.rating;
                    if (ratingComment) ratingComment.value = ratingsData.user_rating.comment;
                    
                    // Update star display
                    const userRating = ratingsData.user_rating.rating;
                    document.querySelectorAll('.star-rating').forEach((btn, index) => {
                        const star = btn.querySelector('i');
                        if (star) {
                            if (index < userRating) {
                                star.classList.remove('far');
                                star.classList.add('fas');
                            } else {
                                star.classList.remove('fas');
                                star.classList.add('far');
                            }
                        }
                    });
                }
            } else {
                rateRoomContainer.classList.add('hidden');
                loginPromptContainer.classList.remove('hidden');
            }
        }
        
        // Handle photos with document fragment for better performance
        const photosGrid = document.getElementById('roomPhotosGrid');
        const noPhotosMsg = document.getElementById('noPhotosMessage');
        
        if (photosGrid && noPhotosMsg && photosData.photos && photosData.photos.length > 0) {
            noPhotosMsg.style.display = 'none';
            
            // Use document fragment to batch DOM inserts
            const fragment = document.createDocumentFragment();
            
            photosData.photos.forEach(photo => {
                const photoDiv = document.createElement('div');
                photoDiv.className = 'relative group overflow-hidden rounded-lg';
                photoDiv.innerHTML = `
                    <img src="${photo.url}" alt="${photo.caption}" class="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy">
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-end p-2">
                        <p class="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">${photo.caption}</p>
                    </div>
                `;
                fragment.appendChild(photoDiv);
            });
            
            photosGrid.innerHTML = '';
            photosGrid.appendChild(fragment);
        } else {
            if (noPhotosMsg) noPhotosMsg.style.display = 'block';
            if (photosGrid) photosGrid.innerHTML = '';
        }
        
        // Update ratings display
        displayRoomRatings(ratingsData.feedbacks);
        
        // Update save button state
        const saveBtn = document.getElementById('saveRoomBtn');
        if (saveBtn) {
            updateSaveButtonState(roomId, saveBtn);
        }
    })
    .catch(error => {
        console.error('Error loading room preview:', error);
        const desc = document.getElementById('roomModalDescription');
        const noPhotos = document.getElementById('noPhotosMessage');
        if (desc) desc.textContent = 'Error loading room details';
        if (noPhotos) noPhotos.style.display = 'block';
    });
}

function generateStarDisplay(rating) {
    let starsHtml = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            starsHtml += '<i class="fas fa-star text-yellow-400 text-sm"></i> ';
        } else if (i === fullStars && hasHalfStar) {
            starsHtml += '<i class="fas fa-star-half-alt text-yellow-400 text-sm"></i> ';
        } else {
            starsHtml += '<i class="far fa-star text-yellow-400 text-sm"></i> ';
        }
    }
    return starsHtml;
}

function displayRoomRatings(feedbacks) {
    const container = document.getElementById('recentRatingsContainer');
    const noRatingsMsg = document.getElementById('noRatingsMessage');
    
    if (!container) return;
    
    if (feedbacks && feedbacks.length > 0) {
        // Clear container completely and rebuild
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        feedbacks.slice(0, 5).forEach(feedback => {
            const ratingDiv = document.createElement('div');
            ratingDiv.className = 'bg-slate-800/30 rounded-lg p-3 border border-slate-700/30';
            
            const starsHtml = generateStarDisplay(feedback.rating);
            const profilePicHtml = feedback.profile_picture 
                ? `<img src="${feedback.profile_picture}" alt="${feedback.user}" class="w-8 h-8 rounded-full object-cover">`
                : `<div class="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-medium">${feedback.user.charAt(0).toUpperCase()}</div>`;
            
            ratingDiv.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-start gap-2">
                        <div class="mt-0.5">
                            ${profilePicHtml}
                        </div>
                        <div>
                            <div class="text-sm font-medium text-white">${feedback.user}</div>
                            <div class="text-xs text-slate-400">${feedback.date}</div>
                        </div>
                    </div>
                    <div class="text-yellow-400 text-xs flex gap-0.5">${starsHtml}</div>
                </div>
                ${feedback.comment ? `<p class="text-xs md:text-sm text-slate-300">${feedback.comment}</p>` : ''}
            `;
            fragment.appendChild(ratingDiv);
        });
        
        container.appendChild(fragment);
    } else {
        // Show no ratings message
        container.innerHTML = '';
        if (noRatingsMsg) {
            const msgClone = noRatingsMsg.cloneNode(true);
            msgClone.style.display = 'block';
            container.appendChild(msgClone);
        } else {
            container.innerHTML = '<p class="text-slate-400 text-sm italic text-center py-4">No ratings yet. Be the first to rate this room!</p>';
        }
    }
}

window.closeRoomPreview = function() {
    const modal = document.getElementById('roomPreviewModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

window.showGuide = function(guideType) {
    const modals = {
        'buildings': 'buildingsGuideModal',
        'classrooms': 'classroomsGuideModal',
        'emergency': 'emergencyGuideModal'
    };
    
    const modalId = modals[guideType];
    if (modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

window.closeGuide = function() {
    const modals = ['buildingsGuideModal', 'classroomsGuideModal', 'emergencyGuideModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        modal.classList.add('hidden');
    });
    document.body.style.overflow = 'auto';
}

window.locateRoom = function() {
    const modal = document.getElementById('roomPreviewModal');
    const roomId = modal.dataset.currentRoomId;
    
    // Get room name and number from already-displayed modal (cached data)
    const roomName = document.getElementById('roomModalTitle').textContent;
    const roomNumber = document.getElementById('roomModalNumber').textContent;
    const coordinates = {
        x: document.getElementById('roomModalCoordX').textContent,
        y: document.getElementById('roomModalCoordY').textContent,
        z: document.getElementById('roomModalCoordZ').textContent
    };
    const floor = document.getElementById('roomModalFloor').textContent;
    
    console.log('Room location data:', { roomId, roomName, roomNumber, coordinates, floor });
    
    // Dispatch custom event for AR navigation integration
    const event = new CustomEvent('navigateToRoom', { 
        detail: { 
            roomId: roomId,
            roomName: roomName,
            roomNumber: roomNumber,
            coordinates: coordinates,
            floor: floor
        } 
    });
    window.dispatchEvent(event);
    
    // Show confirmation with room details
    alert(`Starting navigation to ${roomName} (Room ${roomNumber})`);
}

// Rating system functions
document.querySelectorAll('.star-rating').forEach(button => {
    button.addEventListener('click', function() {
        const rating = this.dataset.rating;
        document.getElementById('selectedRating').value = rating;
        
        // Update star display
        document.querySelectorAll('.star-rating').forEach((btn, index) => {
            const star = btn.querySelector('i');
            if (index < rating) {
                star.classList.remove('far');
                star.classList.add('fas');
            } else {
                star.classList.remove('fas');
                star.classList.add('far');
            }
        });
    });
    
    // Hover effect
    button.addEventListener('mouseover', function() {
        const rating = this.dataset.rating;
        document.querySelectorAll('.star-rating').forEach((btn, index) => {
            const star = btn.querySelector('i');
            if (index < rating) {
                star.classList.remove('far');
                star.classList.add('fas');
            } else {
                star.classList.remove('fas');
                star.classList.add('far');
            }
        });
    });
});

document.getElementById('ratingStars')?.addEventListener('mouseout', function() {
    const selectedRating = document.getElementById('selectedRating').value;
    document.querySelectorAll('.star-rating').forEach((btn, index) => {
        const star = btn.querySelector('i');
        if (index < selectedRating) {
            star.classList.remove('far');
            star.classList.add('fas');
        } else {
            star.classList.remove('fas');
            star.classList.add('far');
        }
    });
});

window.submitRoomRating = function() {
    const roomId = document.getElementById('roomPreviewModal').dataset.currentRoomId;
    const rating = parseInt(document.getElementById('selectedRating').value);
    const comment = document.getElementById('ratingComment').value.trim();
    
    if (rating === 0) {
        alert('Please select a rating');
        return;
    }
    
    fetch(`/api/room/${roomId}/rate/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value || ''
        },
        body: JSON.stringify({
            rating: rating,
            comment: comment
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.status === 'success') {
            alert('Rating submitted successfully!');
            // Reload ratings
            loadRoomRatings(roomId);
        } else if (data.error && data.error.includes('Authentication')) {
            alert('Please sign in to rate this room');
            showLoginModal();
        } else {
            alert('Error: ' + (data.error || 'Failed to submit rating'));
        }
    })
    .catch(error => {
        console.error('Error submitting rating:', error);
        alert('Error submitting rating');
    });
}

function loadRoomRatings(roomId) {
    fetch(`/api/room/${roomId}/ratings/`)
        .then(r => r.json())
        .then(data => {
            const avgRating = data.average_rating || 0;
            const totalRatings = data.total_ratings || 0;
            
            document.getElementById('roomAverageRating').textContent = avgRating.toFixed(1);
            document.getElementById('roomRatingCount').textContent = totalRatings;
            
            const avgStarsHtml = generateStarDisplay(avgRating);
            document.getElementById('roomAverageStars').innerHTML = avgStarsHtml;
            
            displayRoomRatings(data.feedbacks);
        })
        .catch(error => console.error('Error loading ratings:', error));
}

// Close modal when clicking outside
document.getElementById('roomPreviewModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'roomPreviewModal') {
        closeRoomPreview();
    }
});

// Save Location Functions
window.toggleSaveLocation = function() {
    const modal = document.getElementById('roomPreviewModal');
    const roomId = modal.dataset.currentRoomId;
    const btn = document.getElementById('saveRoomBtn');
    
    if (!roomId) {
        console.error('Room ID not found');
        return;
    }
    
    // Check current save state
    const isSaved = btn.classList.contains('saved');
    
    if (isSaved) {
        // Remove from saved
        removeSavedLocation(roomId, btn);
    } else {
        // Add to saved
        saveLocation(roomId, btn);
    }
}

window.saveLocation = function(roomId, btn) {
    const url = `/api/room/${roomId}/save/`;
    
    fetch(url, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Update button state
            btn.classList.add('saved');
            btn.classList.remove('far');
            btn.classList.add('fas');
            btn.querySelector('i').classList.remove('far');
            btn.querySelector('i').classList.add('fas');
            btn.style.color = '#f59e0b';
            btn.style.backgroundColor = 'rgba(217, 119, 6, 0.3)';
            
            // Update button text color for better visibility
            const span = btn.querySelector('span');
            if (span) {
                span.textContent = 'Saved';
            }
            
            showNotification('Location saved successfully!', 'success');
        } else if (data.error && data.error.includes('authentication') || data.error.includes('login')) {
            showNotification('Please sign in to save locations', 'error');
        } else {
            showNotification('Error: ' + (data.message || 'Failed to save location'), 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error saving location', 'error');
    });
}

window.removeSavedLocation = function(roomId, btn) {
    const url = `/api/room/${roomId}/unsave/`;
    
    fetch(url, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Update button state
            btn.classList.remove('saved');
            btn.querySelector('i').classList.add('far');
            btn.querySelector('i').classList.remove('fas');
            btn.style.color = '';
            btn.style.backgroundColor = '';
            
            // Update button text color
            const span = btn.querySelector('span');
            if (span) {
                span.textContent = 'Save';
            }
            
            showNotification('Location removed from saved', 'success');
        } else {
            showNotification('Error: ' + (data.message || 'Failed to remove location'), 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error removing location', 'error');
    });
}

window.updateSaveButtonState = function(roomId, btn) {
    if (!roomId || !btn) return;
    
    const url = `/api/room/${roomId}/check-saved/`;
    
    fetch(url, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success' && data.is_saved) {
            btn.classList.add('saved');
            btn.querySelector('i').classList.remove('far');
            btn.querySelector('i').classList.add('fas');
            btn.style.color = '#f59e0b';
            btn.style.backgroundColor = 'rgba(217, 119, 6, 0.3)';
        } else {
            btn.classList.remove('saved');
            btn.querySelector('i').classList.add('far');
            btn.querySelector('i').classList.remove('fas');
            btn.style.color = '';
            btn.style.backgroundColor = '';
        }
    })
    .catch(error => console.error('Error checking saved state:', error));
}