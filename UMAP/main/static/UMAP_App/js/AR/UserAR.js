/**
 * AR Navigation Modal - All functionality for User_AR modal in Users_main.html
 * This module handles room selection, AR initialization, and navigation
 * 
 * NOTE: Variable declarations (arSelectedCurrentRoom, arSelectedDestinationRoom, arAllRooms)
 * are managed in main.js. This file uses window references to avoid conflicts.
 */

console.log('[UserAR] UserAR.js initializing...');

// Initialize window references if not already present (declared in main.js)
if (typeof window.arSelectedCurrentRoom === 'undefined') {
    window.arSelectedCurrentRoom = null;
}
if (typeof window.arSelectedDestinationRoom === 'undefined') {
    window.arSelectedDestinationRoom = null;
}
if (typeof window.arAllRooms === 'undefined') {
    window.arAllRooms = [];
}
if (typeof window.is3DPreviewInitialized === 'undefined') {
    window.is3DPreviewInitialized = false;
}

/**
 * Initialize AR modal when Users_main.html loads
 */
window.initializeARModal = function() {
    console.log('[UserAR] Initializing AR Modal...');
    
    // Load rooms from API
    window.loadARRoomsData();
    
    // Load bootstrap for AR modules
    window.loadARModules();
};

/**
 * Load AR rooms from API endpoint
 */
window.loadARRoomsData = function() {
    console.log('[UserAR] Loading rooms from /api/ar/rooms/');
    
    return new Promise((resolve, reject) => {
        fetch('/api/ar/rooms/', {
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('[UserAR] API Response:', data);
            
            // Handle the API response format: {status, rooms, total_rooms}
            let roomsArray = [];
            if (data && data.rooms && Array.isArray(data.rooms)) {
                roomsArray = data.rooms;
            } else if (Array.isArray(data)) {
                // Fallback if API returns array directly
                roomsArray = data;
            } else {
                throw new Error('Invalid API response format: expected rooms array');
            }
            
            console.log('[UserAR] Received', roomsArray.length, 'rooms from API');
            window.arAllRooms = roomsArray.map(room => {
                // Parse coordinates if they're stored as string "x,y,z"
                let coords = room.coordinates;
                if (typeof coords === 'string') {
                    const parts = coords.split(',').map(p => parseFloat(p.trim()));
                    coords = { x: parts[0] || 0, y: parts[1] || 0, z: parts[2] || 0 };
                } else if (typeof coords === 'object' && coords !== null) {
                    coords = {
                        x: parseFloat(coords.x) || 0,
                        y: parseFloat(coords.y) || 0,
                        z: parseFloat(coords.z) || 0
                    };
                } else {
                    coords = { x: 0, y: 0, z: 0 };
                }
                
                return {
                    id: room.id,
                    number: String(room.number),
                    name: room.name || 'Unknown',
                    type: room.type || 'Standard',
                    building: room.building || 'Unknown',
                    floor: room.floor || 'Unknown',
                    floor_id: room.floor_id,
                    x: coords.x,
                    y: coords.y,
                    z: coords.z,
                    coordinates: coords,
                    images: room.images || []
                };
            });
            
            // Set global window.rooms for AR modules
            window.rooms = window.arAllRooms;
            
            // Populate dropdowns
            window.populateARRoomDropdowns();
            console.log('[UserAR] Rooms loaded and dropdowns populated');
            resolve(window.arAllRooms);
        })
        .catch(error => {
            console.error('[UserAR] Error loading rooms:', error);
            alert('Failed to load rooms. Please try again.');
            reject(error);
        });
    });
};

/**
 * Load AR bootstrap and modules
 */
window.loadARModules = function() {
    console.log('[UserAR] AR modules (bootstrap.js) already loaded as module script in HTML');
    // Bootstrap is now loaded directly in Users_main.html as <script type="module">
    // This function is kept for compatibility but does nothing
};

/**
 * Open AR modal
 */
window.openARModal = function() {
    console.log('[UserAR] Opening AR Modal');
    
    const modal = document.getElementById('arNavigationModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.remove('hidden');
        
        // Initialize if not already done
        if (window.arAllRooms.length === 0) {
            window.loadARRoomsData().then(() => {
                window.populateARRoomDropdowns();
                window.preSelectARDestinationRoom();
            });
        } else {
            window.populateARRoomDropdowns();
            window.preSelectARDestinationRoom();
        }
    }
};

/**
 * Close AR modal
 */
window.closeARModal = function() {
    console.log('[UserAR] Closing AR Modal');
    
    const modal = document.getElementById('arNavigationModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
    
    // Reset selections
    window.arSelectedCurrentRoom = null;
    window.arSelectedDestinationRoom = null;
};

/**
 * Populate room dropdown selects
 */
window.populateARRoomDropdowns = function() {
    console.log('[UserAR] Populating dropdown selects with', window.arAllRooms.length, 'rooms');
    
    const currentSelect = document.getElementById('arCurrentRoomSelect');
    const destinationSelect = document.getElementById('arDestinationRoomSelect');

    if (!currentSelect || !destinationSelect) {
        console.error('[UserAR] Dropdown elements not found');
        return;
    }

    // Sort rooms by building and floor
    const sortedRooms = window.arAllRooms.sort((a, b) => {
        if (a.building !== b.building) return a.building.localeCompare(b.building);
        return a.floor.localeCompare(b.floor);
    });

    // Clear existing options
    currentSelect.innerHTML = '<option value="">-- Select current location --</option>';
    destinationSelect.innerHTML = '<option value="">-- Select destination --</option>';

    // Add rooms
    sortedRooms.forEach(room => {
        const optionText = `${room.number} - ${room.name} (${room.building}, ${room.floor})`;
        
        const currentOption = document.createElement('option');
        currentOption.value = room.id;
        currentOption.textContent = optionText;
        currentSelect.appendChild(currentOption);

        const destOption = document.createElement('option');
        destOption.value = room.id;
        destOption.textContent = optionText;
        destinationSelect.appendChild(destOption);
    });
    
    console.log('[UserAR] Dropdowns populated');
};

/**
 * Pre-select destination room from sessionStorage
 */
window.preSelectARDestinationRoom = function() {
    try {
        console.log('[UserAR] Attempting to pre-select destination room from sessionStorage');
        const arDestRoom = sessionStorage.getItem('ar_destination_room');
        if (!arDestRoom) {
            console.log('[UserAR] No destination room in sessionStorage');
            return;
        }

        const destRoom = JSON.parse(arDestRoom);
        const roomNumber = destRoom.number;
        console.log('[UserAR] Found destination room in sessionStorage:', roomNumber);

        // Wait for dropdown to exist
        const destinationSelect = document.getElementById('arDestinationRoomSelect');
        if (!destinationSelect) {
            console.warn('[UserAR] Destination select element not found');
            return;
        }

        // Wait for rooms data to be loaded
        let attempts = 0;
        const checkAndPreSelect = () => {
            const roomsArray = window.arAllRooms;
            
            if (!roomsArray || roomsArray.length === 0) {
                attempts++;
                if (attempts < 20) {
                    console.log('[UserAR] Waiting for rooms data... (attempt', attempts, ')');
                    setTimeout(checkAndPreSelect, 100);
                } else {
                    console.warn('[UserAR] Timeout waiting for rooms data');
                }
                return;
            }
            
            console.log('[UserAR] Searching for room', roomNumber, 'in', roomsArray.length, 'available rooms');
            const matchingRoom = roomsArray.find(r => String(r.number) === String(roomNumber));
            
            if (matchingRoom) {
                // Pre-select in dropdown as DESTINATION
                destinationSelect.value = matchingRoom.id;
                console.log('[UserAR] Set destination select value to:', matchingRoom.id);
                
                // Trigger selection handler to update room details
                window.onARDestinationRoomSelected();
                
                // Trigger conditional 3D preview render after a short delay
                setTimeout(() => {
                    console.log('[UserAR] Triggering 3D preview initialization');
                    window.initializeConditional3DPreview();
                }, 100);
                
                // Clear sessionStorage to avoid re-selection on refresh
                sessionStorage.removeItem('ar_destination_room');
                
                console.log('[UserAR] Pre-selected destination room:', matchingRoom.number);
            } else {
                console.warn('[UserAR] No matching room found for:', roomNumber, 'Available rooms:', roomsArray.map(r => r.number));
            }
        };
        
        checkAndPreSelect();
    } catch (e) {
        console.error('[UserAR] Error pre-selecting destination room:', e);
    }
};

/**
 * Handle current room selection
 */
window.onARCurrentRoomSelected = function() {
    const roomId = document.getElementById('arCurrentRoomSelect').value;
    if (!roomId) {
        window.arSelectedCurrentRoom = null;
        document.getElementById('arCurrentRoomDetails').classList.add('hidden');
        window.updateARButtonState();
        return;
    }

    window.arSelectedCurrentRoom = window.arAllRooms.find(r => String(r.id) === String(roomId));
    if (window.arSelectedCurrentRoom) {
        document.getElementById('arCurrentRoomNumber').textContent = window.arSelectedCurrentRoom.number;
        document.getElementById('arCurrentRoomType').textContent = window.arSelectedCurrentRoom.type || 'Standard';
        document.getElementById('arCurrentRoomFloor').textContent = window.arSelectedCurrentRoom.floor;
        document.getElementById('arCurrentRoomDetails').classList.remove('hidden');
    }
    window.updateARButtonState();
    window.initializeConditional3DPreview();
};

/**
 * Handle destination room selection
 */
window.onARDestinationRoomSelected = function() {
    const roomId = document.getElementById('arDestinationRoomSelect').value;
    if (!roomId) {
        window.arSelectedDestinationRoom = null;
        document.getElementById('arDestinationRoomDetails').classList.add('hidden');
        window.updateARButtonState();
        return;
    }

    window.arSelectedDestinationRoom = window.arAllRooms.find(r => String(r.id) === String(roomId));
    if (window.arSelectedDestinationRoom) {
        document.getElementById('arDestinationRoomNumber').textContent = window.arSelectedDestinationRoom.number;
        document.getElementById('arDestinationRoomType').textContent = window.arSelectedDestinationRoom.type || 'Standard';
        document.getElementById('arDestinationRoomFloor').textContent = window.arSelectedDestinationRoom.floor;
        document.getElementById('arDestinationRoomDetails').classList.remove('hidden');
    }
    window.updateARButtonState();
    window.initializeConditional3DPreview();
};

/**
 * Update AR button enabled state
 */
window.updateARButtonState = function() {
    const startBtn = document.getElementById('arStartButton');
    const isValid = window.arSelectedCurrentRoom && window.arSelectedDestinationRoom && 
                   window.arSelectedCurrentRoom.id !== window.arSelectedDestinationRoom.id;
    startBtn.disabled = !isValid;
};

/**
 * Initialize conditional 3D preview rendering
 * This pre-loads markers when both rooms are selected, before AR starts
 */
window.initializeConditional3DPreview = function() {
    if (!window.arSelectedCurrentRoom || !window.arSelectedDestinationRoom) {
        return;
    }

    if (window.arSelectedCurrentRoom.id === window.arSelectedDestinationRoom.id) {
        return;
    }

    console.log('[UserAR] Both rooms selected, pre-rendering markers for smooth AR start');
    
    // Set active rooms for AR modules
    window._AR_NAV_CURRENT_ROOM = window.arSelectedCurrentRoom;
    window._AR_NAV_DESTINATION_ROOM = window.arSelectedDestinationRoom;
    window._AR_NAV_ACTIVE_ROOMS = [window.arSelectedCurrentRoom, window.arSelectedDestinationRoom];
    
    // Mark that markers should be rendered
    window._AR_MARKERS_PRELOADED = true;

    // Try to initialize 3D rendering with retry logic
    async function renderMarkersWithRetry(attempts = 0, maxAttempts = 10) {
        // Check if Three.js and scene are ready
        if (!window._AR_RENDERER || !window._AR_RENDERER.scene || typeof THREE === 'undefined') {
            if (attempts < maxAttempts) {
                console.log(`[UserAR] Three.js not ready yet (attempt ${attempts + 1}/${maxAttempts})`);
                await new Promise(r => setTimeout(r, 200));
                return renderMarkersWithRetry(attempts + 1, maxAttempts);
            } else {
                console.warn('[UserAR] Three.js initialization timeout');
                return false;
            }
        }

        // Now that Three.js is ready, render the markers using User_render module
        if (window._USER_RENDER && typeof window._USER_RENDER.renderUserNavigationPoints === 'function') {
            console.log('[UserAR] Rendering two room markers for preview using User_render');
            try {
                window._USER_RENDER.renderUserNavigationPoints(
                    window.arSelectedCurrentRoom, 
                    window.arSelectedDestinationRoom
                );
                
                // Initialize HUD arrow pointing to Point B
                if (window._USER_RENDER && typeof window._USER_RENDER.getPointBPosition === 'function') {
                    const pointBPos = window._USER_RENDER.getPointBPosition();
                    if (pointBPos && window._AR_HUD && typeof window._AR_HUD.setCompassTarget === 'function') {
                        window._AR_HUD.setCompassTarget(pointBPos);
                    }
                }
                
                console.log('[UserAR] Markers pre-loaded successfully');
                return true;
            } catch (e) {
                console.error('[UserAR] Error rendering markers:', e);
                return false;
            }
        } else {
            if (attempts < maxAttempts) {
                console.log(`[UserAR] User_render module not ready (attempt ${attempts + 1}/${maxAttempts})`);
                await new Promise(r => setTimeout(r, 200));
                return renderMarkersWithRetry(attempts + 1, maxAttempts);
            }
            return false;
        }
    }

    renderMarkersWithRetry().catch(err => {
        console.error('[UserAR] Error during marker pre-loading:', err);
    });
};

/**
 * Start AR navigation session
 */
window.startARNavigation = function() {
    if (!window.arSelectedCurrentRoom || !window.arSelectedDestinationRoom) {
        alert('Please select both current location and destination');
        return;
    }

    if (window.arSelectedCurrentRoom.id === window.arSelectedDestinationRoom.id) {
        alert('Please select different rooms');
        return;
    }

    // Store selected rooms in window object for AR modules to access
    window._AR_NAV_CURRENT_ROOM = window.arSelectedCurrentRoom;
    window._AR_NAV_DESTINATION_ROOM = window.arSelectedDestinationRoom;
    window._AR_NAV_ACTIVE_ROOMS = [window.arSelectedCurrentRoom, window.arSelectedDestinationRoom];

    console.log('[UserAR] Starting AR navigation:', {
        current: window.arSelectedCurrentRoom,
        destination: window.arSelectedDestinationRoom
    });
    
    // CRITICAL: Clear any admin markers that may have been loaded
    if (window._AR_MARKERS && typeof window._AR_MARKERS.clearAllMarkers === 'function') {
        console.log('[UserAR] Clearing all admin markers before starting user AR');
        window._AR_MARKERS.clearAllMarkers();
    }
    
    // CRITICAL: Clear user render points in case they exist
    if (window._USER_RENDER && typeof window._USER_RENDER.clearUserRenderPoints === 'function') {
        console.log('[UserAR] Clearing any previous user render points');
        window._USER_RENDER.clearUserRenderPoints();
    }

    // Function to wait for AR system with retry logic
    async function initializeARWithRetry(attempts = 0, maxAttempts = 15) {
        // Check for renderer first (most fundamental)
        if (window._AR_RENDERER && window._AR_RENDERER.scene && window._AR_RENDERER.camera && window._AR_RENDERER.renderer) {
            console.log('[UserAR] Three.js renderer ready');
            
            // Try WebXR if available (this will handle the immersive session)
            if (window._AR_WEBXR && window._AR_WEBXR.startARSession) {
                console.log('[UserAR] WebXR ready, starting session');
                try {
                    // Store reference to startARSession so it can auto-teleport after setup
                    window._AR_PENDING_TELEPORT_ROOM = window.arSelectedCurrentRoom;
                    window._AR_WEBXR.startARSession();
                    return true;
                } catch (e) {
                    console.error('[UserAR] Error starting WebXR session:', e);
                }
            }
            
            // Try to start AR flow if available (for non-immersive preview)
            if (window.startARFlow && typeof window.startARFlow === 'function') {
                console.log('[UserAR] AR flow function ready, starting...');
                try {
                    // CRITICAL: Render only the two user navigation points
                    if (window._USER_RENDER && typeof window._USER_RENDER.renderUserNavigationPoints === 'function') {
                        console.log('[UserAR] Rendering user navigation points (Point A & B only)');
                        window._USER_RENDER.renderUserNavigationPoints(
                            window.arSelectedCurrentRoom,
                            window.arSelectedDestinationRoom
                        );
                    }
                    
                    // Auto-teleport to Point A before starting immersive AR
                    if (window._AR_RENDERER && window._AR_RENDERER.modelRoot) {
                        console.log('[UserAR] Teleporting camera to Point A position');
                        const pointAPos = new THREE.Vector3(
                            (window.arSelectedCurrentRoom.x || 0) * 0.9,
                            (window.arSelectedCurrentRoom.z || 0) * 0.9,
                            -((window.arSelectedCurrentRoom.y || 0) * 0.9)
                        );
                        window._AR_RENDERER.modelRoot.position.copy(pointAPos).negate();
                        console.log('[UserAR] Camera positioned at Point A:', pointAPos);
                    }
                    
                    window.startARFlow();
                    return true;
                } catch (e) {
                    console.error('[UserAR] Error starting AR flow:', e);
                }
            }
            
            // Just alert that system is ready and waiting
            console.log('[UserAR] Renderer ready, awaiting AR flow initialization');
            alert('AR system ready. Initializing...');
            return true;
        }
        
        if (attempts < maxAttempts) {
            console.log(`[UserAR] AR components not ready yet (attempt ${attempts + 1}/${maxAttempts})`);
            console.log('[UserAR] Checking:', {
                rendererReady: !!(window._AR_RENDERER && window._AR_RENDERER.scene),
                startARFlowReady: typeof window.startARFlow === 'function',
                webxrReady: !!(window._AR_WEBXR && window._AR_WEBXR.startARSession)
            });
            await new Promise(r => setTimeout(r, 300));
            return initializeARWithRetry(attempts + 1, maxAttempts);
        } else {
            console.error('[UserAR] AR system components not initialized after max retries:', {
                startARFlow: typeof window.startARFlow,
                webxr: typeof window._AR_WEBXR,
                webxrSession: window._AR_WEBXR ? typeof window._AR_WEBXR.startARSession : 'undefined',
                renderer: typeof window._AR_RENDERER,
                rendererScene: window._AR_RENDERER ? typeof window._AR_RENDERER.scene : 'undefined',
                rendererCamera: window._AR_RENDERER ? typeof window._AR_RENDERER.camera : 'undefined'
            });
            alert('AR system initializing... Please try again in a moment.');
            return false;
        }
    }
    
    initializeARWithRetry().catch(err => {
        console.error('[UserAR] Error during AR initialization:', err);
        alert('Unable to start AR. Please try again.');
    });
};

/**
 * Initialize when modal is first opened
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('[UserAR] Page loaded, UserAR.js ready');
    
    // Add click handler to AR Navigate buttons to open modal and pre-select room
    const arNavButtons = document.querySelectorAll('[data-ar-nav-button]');
    arNavButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            window.openARModal();
            window.preSelectARDestinationRoom();
        });
    });
});

console.log('[UserAR] UserAR.js module loaded successfully');
