// Building Interactions Module
class BuildingInteractions {
    constructor() {
        this.initializeMapEvents();
        this.initializePanels();
    }

    // Helper function to get the visible SVG element
    getVisibleSVG() {
        const svgs = document.querySelectorAll('#umapSVG');
        for (let svg of svgs) {
            if (svg.offsetParent !== null) { // Check if element is visible
                return svg;
            }
        }
        return svgs[0]; // Fallback to first one if none are visible
    }

    async initializeMapEvents() {
        const svg = this.getVisibleSVG();
        
        const setupBuildings = () => {
            try {
                const svgDoc = svg.contentDocument;
                if (!svgDoc) {
                    console.warn('SVG document not accessible yet, will retry');
                    setTimeout(setupBuildings, 100);
                    return;
                }
                
                const svgElement = svgDoc.querySelector('svg');
                const buildings = svgDoc.querySelectorAll('[id^="Building"], [id="HPSB"]');

                if (buildings.length === 0) {
                    console.warn('No buildings found, will retry');
                    setTimeout(setupBuildings, 100);
                    return;
                }

                // Make sure SVG fills the container while maintaining aspect ratio
                if (svgElement) {
                    svgElement.style.width = '100%';
                    svgElement.style.height = '100%';
                    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                }
                
                buildings.forEach(building => {
                    this.setupBuildingInteractions(building);
                });
                
                console.log(`Successfully initialized ${buildings.length} buildings`);
            } catch (error) {
                console.error('Error setting up buildings:', error);
                setTimeout(setupBuildings, 100);
            }
        };
        
        // Try immediate setup first (for already-loaded SVG)
        setupBuildings();
        
        // Also listen for load event (for cases where SVG isn't loaded yet)
        svg.addEventListener('load', setupBuildings);
    }

    setupBuildingInteractions(building) {
        building.addEventListener('mouseenter', () => {
            building.style.fill = 'rgba(59, 130, 246, 0.5)';
            building.style.filter = 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))';
        });

        building.addEventListener('mouseleave', () => {
            if (!building.classList.contains('selected')) {
                building.style.fill = '';
                building.style.filter = '';
            }
        });

        building.addEventListener('click', async (e) => {
            const rect = building.getBoundingClientRect();
            const position = {
                x: rect.left + (rect.width / 2),
                y: rect.top + (rect.height / 2)
            };
            await this.showBuildingPanel(building.id, position);
            
            const svgDoc = this.getVisibleSVG().contentDocument;
            const buildings = svgDoc.querySelectorAll('[id^="Building"], [id="HPSB"]');
            buildings.forEach(b => {
                b.classList.remove('selected');
                if (b !== building) {
                    b.style.fill = '';
                    b.style.filter = '';
                }
            });
            building.classList.add('selected');
        });
    }

    async fetchBuildingData(buildingId) {
        try {
            const response = await fetch(`/api/buildings/${buildingId}/`);
            if (!response.ok) throw new Error('Failed to fetch building data');
            return await response.json();
        } catch (error) {
            console.error('Error fetching building data:', error);
            return null;
        }
    }

    async fetchBuildingRooms(buildingId) {
        try {
            const response = await fetch(`/api/buildings/${buildingId}/rooms/`);
            if (!response.ok) throw new Error('Failed to fetch building rooms');
            return await response.json();
        } catch (error) {
            console.error('Error fetching building rooms:', error);
            return [];
        }
    }

    createLocationCard(location) {
        return `
            <div class="location-card group">
                <div class="card-content">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h3 class="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">
                                ${location.room_number || location.name}
                            </h3>
                            <p class="text-sm text-blue-400/80">${location.floor_number} Floor</p>
                        </div>
                        <button class="text-gray-400 hover:text-white p-2 hover:bg-gray-700/50 rounded-lg transition-colors" 
                                onclick="buildingInteractions.navigateToRoom('${location.id}')">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>
                    </div>
                    <p class="text-gray-300 text-sm leading-relaxed">${location.description || 'Room details coming soon.'}</p>
                </div>
            </div>
        `;
    }

    async showBuildingPanel(buildingId, position) {
        const building = await this.fetchBuildingData(buildingId);
        if (!building) return;

        const rooms = await this.fetchBuildingRooms(buildingId);

        // Update panel content
        document.getElementById('panelBuildingTitle').textContent = building.name;
        document.getElementById('panelBuildingSubtitle').textContent = building.type || 'Campus Building';
        document.getElementById('panelBuildingDescription').textContent = building.description;
        document.getElementById('panelFloorCount').textContent = building.floor_count || '--';
        document.getElementById('panelRoomCount').textContent = rooms.length || '--';

        // Position and show panel
        const panel = document.getElementById('buildingPanel');
        panel.style.left = `${position.x + 20}px`;
        panel.style.top = `${position.y}px`;

        // Ensure panel stays within viewport
        requestAnimationFrame(() => {
            const rect = panel.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                panel.style.left = `${position.x - rect.width - 20}px`;
            }
            if (rect.bottom > window.innerHeight) {
                panel.style.top = `${window.innerHeight - rect.height - 20}px`;
            }
        });

        // Show panel with animation
        panel.style.opacity = '1';
        panel.style.transform = 'scale(1)';
        panel.style.pointerEvents = 'auto';
        panel.dataset.buildingId = buildingId;
    }

    hideBuildingPanel() {
        const panel = document.getElementById('buildingPanel');
        panel.style.opacity = '0';
        panel.style.transform = 'scale(0.95)';
        panel.style.pointerEvents = 'none';
        
        const svgDoc = this.getVisibleSVG().contentDocument;
        if (svgDoc) {
            const buildings = svgDoc.querySelectorAll('[id^="Building"], [id="HPSB"]');
            buildings.forEach(building => {
                building.style.fill = '';
                building.style.filter = '';
            });
        }
    }

    async showBuildingLocations(buildingId) {
        const building = await this.fetchBuildingData(buildingId);
        if (!building) return;

        const rooms = await this.fetchBuildingRooms(buildingId);

        // Update sidebar content
        document.getElementById('buildingTitle').textContent = building.name;
        document.getElementById('buildingSubtitle').textContent = building.type || 'Campus Building';
        document.getElementById('buildingDescription').textContent = building.description;

        // Clear and populate location cards
        const locationCards = document.getElementById('locationCards');
        locationCards.innerHTML = '';
        rooms.forEach(room => {
            locationCards.innerHTML += this.createLocationCard(room);
        });

        // Show sidebar with animation
        const sidebar = document.getElementById('locationSidebar');
        requestAnimationFrame(() => {
            sidebar.classList.add('show');
        });
    }

    hideLocationSidebar() {
        const sidebar = document.getElementById('locationSidebar');
        sidebar.classList.remove('show');
    }

    async navigateToRoom(roomId) {
        // Add room navigation logic here
        console.log('Navigating to room:', roomId);
    }

    initializePanels() {
        // Close panels when clicking outside
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('buildingPanel');
            const sidebar = document.getElementById('locationSidebar');
            const isPanelClick = panel.contains(e.target);
            const isSidebarClick = sidebar.contains(e.target);
            const isMapClick = e.target.closest('#umapSVG');
            
            if (!isPanelClick && !isMapClick && panel.style.opacity === '1') {
                this.hideBuildingPanel();
            }
            
            if (!isSidebarClick && !isMapClick && sidebar.classList.contains('show')) {
                this.hideLocationSidebar();
            }
        });

        // Toggle full locations list
        window.toggleLocationsList = async () => {
            const panel = document.getElementById('buildingPanel');
            const buildingId = panel.dataset.buildingId;
            if (buildingId) {
                await this.showBuildingLocations(buildingId);
                this.hideBuildingPanel();
            }
        };

        // View building details
        window.viewBuildingDetails = async (view) => {
            const panel = document.getElementById('buildingPanel');
            const buildingId = panel.dataset.buildingId;
            if (!buildingId) return;

            const building = await this.fetchBuildingData(buildingId);
            if (!building) return;

            if (view === 'floors') {
                window.location.href = `/building/${buildingId}/floors/`;
            } else if (view === 'rooms') {
                window.location.href = `/building/${buildingId}/rooms/`;
            }
        };
    }
}

// Initialize building interactions when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.buildingInteractions = new BuildingInteractions();
});