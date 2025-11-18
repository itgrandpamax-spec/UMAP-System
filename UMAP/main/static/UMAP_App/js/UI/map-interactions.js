document.addEventListener('DOMContentLoaded', () => {
    const svgObject = document.getElementById('umapSVG');

    svgObject.addEventListener('load', function() {
        const svgDoc = svgObject.contentDocument;
        
        // Building elements that should be clickable
        const buildingIds = [
            'building1', 'building2', 'building3', 'hpsb'
            // Add other building IDs here
        ];

        // Add click events to each building
        buildingIds.forEach(id => {
            const element = svgDoc.getElementById(id);
            if (element) {
                // Add hover styles
                element.style.cursor = 'pointer';
                element.style.transition = 'all 0.2s ease';

                element.addEventListener('mouseenter', () => {
                    element.style.filter = 'brightness(1.2)';
                    element.style.transform = 'scale(1.01)';
                });

                element.addEventListener('mouseleave', () => {
                    element.style.filter = '';
                    element.style.transform = '';
                });

                // Add click handler
                element.addEventListener('click', () => {
                    // Show building info
                    showBuildingLocations(id);
                    
                    // Highlight selected building
                    buildingIds.forEach(bid => {
                        const bldg = svgDoc.getElementById(bid);
                        if (bldg) {
                            if (bid === id) {
                                bldg.style.filter = 'brightness(1.3) drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))';
                            } else {
                                bldg.style.filter = 'brightness(0.7)';
                            }
                        }
                    });
                });
            }
        });

        // Reset building highlights when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target !== svgObject && !e.target.closest('#locationSidebar')) {
                buildingIds.forEach(bid => {
                    const bldg = svgDoc.getElementById(bid);
                    if (bldg) {
                        bldg.style.filter = '';
                    }
                });
            }
        });
    });
});