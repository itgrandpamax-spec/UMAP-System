/**
 * UMAP Interactive Map Controller
 * Handles PNG map initialization, zoom, pan, and click events
 */

class UMAPController {
    constructor() {
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;
        this.scale = 1;
        this.minZoom = 0.5;
        this.maxZoom = 2.0;
        this.translateX = 0;
        this.translateY = 0;

        // Bind methods to maintain context
        this.handleWheel = this.handleWheel.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.updateMapTransform = this.updateMapTransform.bind(this);
    }

    initialize() {
        const map = document.getElementById("umapMap");
        if (!map) {
            console.warn("UMAP Map element not found");
            return;
        }

        // Initialize event listeners
        this.initializeEventListeners();
        
        // Set initial position
        this.translateX = 0;
        this.translateY = 0;
        this.scale = 1;
        this.updateMapTransform();
    }

    initializeEventListeners() {
        const map = document.getElementById("umapMap");
        if (!map) return;

        map.addEventListener("wheel", this.handleWheel, { passive: false });
        map.addEventListener("mousedown", this.handleMouseDown);
        map.addEventListener("mousemove", this.handleMouseMove);
        map.addEventListener("mouseup", this.handleMouseUp);
        map.addEventListener("mouseleave", this.handleMouseUp);
        map.addEventListener("touchmove", this.handleTouchMove, { passive: false });
        map.addEventListener("touchend", this.handleTouchEnd);
    }

    handleWheel(e) {
        e.preventDefault();
        const map = document.getElementById("umapMap");
        const rect = map.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate zoom
        const delta = -e.deltaY;
        const zoomFactor = delta > 0 ? 1.1 : 0.9;
        const newScale = this.scale * zoomFactor;

        // Check zoom bounds
        if (newScale < this.minZoom || newScale > this.maxZoom) return;

        // Calculate new position to zoom toward cursor
        const scaleChange = newScale - this.scale;
        this.translateX -= (x - this.translateX) * (scaleChange / newScale);
        this.translateY -= (y - this.translateY) * (scaleChange / newScale);
        this.scale = newScale;

        this.updateMapTransform();
    }

    handleMouseDown(e) {
        this.isPanning = true;
        this.startX = e.clientX - this.translateX;
        this.startY = e.clientY - this.translateY;
    }

    handleMouseMove(e) {
        if (!this.isPanning) return;

        this.translateX = e.clientX - this.startX;
        this.translateY = e.clientY - this.startY;
        this.updateMapTransform();
    }

    handleMouseUp() {
        this.isPanning = false;
    }

    handleTouchMove(e) {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        if (!this.isPanning) {
            this.isPanning = true;
            this.startX = touch.clientX - this.translateX;
            this.startY = touch.clientY - this.translateY;
            return;
        }

        this.translateX = touch.clientX - this.startX;
        this.translateY = touch.clientY - this.startY;
        this.updateMapTransform();
    }

    handleTouchEnd() {
        this.isPanning = false;
    }

    updateMapTransform() {
        const map = document.getElementById("umapMap");
        if (!map) return;

        map.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    }
}

// Singleton instance
let umapController = null;

// Safe initialization function
function initializeUMAP() {
    if (!umapController) {
        umapController = new UMAPController();
    }
    umapController.initialize();
}

// Initialize on both DOMContentLoaded and pageshow events
document.addEventListener("DOMContentLoaded", initializeUMAP);

// Handle Django post-login redirects and back/forward cache
window.addEventListener("pageshow", function(event) {
    if (event.persisted) {
        initializeUMAP();
    }
});

// Handle dynamic content updates or SPA navigation
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length) {
            const svgObject = document.getElementById("umapSVG");
            if (svgObject && !svgObject._initialized) {
                svgObject._initialized = true;
                initializeUMAP();
            }
        }
    });
});

// Start observing the document body for DOM changes
observer.observe(document.body, { childList: true, subtree: true });

// Reinitialize when switching between auth states
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        initializeUMAP();
    }
});

// Force initialization if the SVG is already present
const svgObject = document.getElementById("umapSVG");
if (svgObject && svgObject.contentDocument) {
    initializeUMAP();
}
