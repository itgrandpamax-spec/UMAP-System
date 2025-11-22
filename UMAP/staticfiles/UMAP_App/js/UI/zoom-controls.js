// Zoom control system
class MapZoomController {
    constructor(svgElement, options = {}) {
        this.svg = svgElement;
        this.minZoom = options.minZoom || 0.5;  // Minimum zoom level
        this.maxZoom = options.maxZoom || 4;    // Maximum zoom level
        this.zoomStep = options.zoomStep || 0.2; // How much to zoom per step
        this.currentZoom = 1;                    // Start at normal zoom
        
        this.svgDoc = null;
        this.viewBox = { x: 0, y: 0, width: 0, height: 0 };
        this.isDragging = false;
        this.lastMousePosition = { x: 0, y: 0 };
        
        // Initialize after SVG loads
        this.svg.addEventListener('load', () => this.initialize());
    }

    initialize() {
        this.svgDoc = this.svg.contentDocument;
        const svgRoot = this.svgDoc.documentElement;
        
        // Store original viewBox
        const viewBox = svgRoot.getAttribute('viewBox');
        if (viewBox) {
            const [x, y, width, height] = viewBox.split(' ').map(Number);
            this.viewBox = { x, y, width, height };
        }

        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize pan and zoom controls
        this.initializeControls();
    }

    setupEventListeners() {
        // Mouse wheel zoom
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const direction = e.deltaY > 0 ? -1 : 1;
            this.zoom(direction, { x: e.clientX, y: e.clientY });
        });

        // Touch zoom (pinch)
        let lastTouchDistance = 0;
        this.svg.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                lastTouchDistance = this.getTouchDistance(e.touches);
            }
        });

        this.svg.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const currentDistance = this.getTouchDistance(e.touches);
                const delta = currentDistance - lastTouchDistance;
                const direction = delta > 0 ? 1 : -1;
                const center = this.getTouchCenter(e.touches);
                this.zoom(direction * 0.1, center);
                lastTouchDistance = currentDistance;
            }
        });

        // Pan controls
        this.svg.addEventListener('mousedown', (e) => {
            this.startDrag(e.clientX, e.clientY);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.drag(e.clientX, e.clientY);
            }
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Touch pan
        this.svg.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.startDrag(touch.clientX, touch.clientY);
            }
        });

        this.svg.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.isDragging) {
                const touch = e.touches[0];
                this.drag(touch.clientX, touch.clientY);
            }
        });

        this.svg.addEventListener('touchend', () => {
            this.isDragging = false;
        });
    }

    initializeControls() {
        // Find zoom buttons
        const zoomInBtn = document.querySelector('[data-zoom="in"]');
        const zoomOutBtn = document.querySelector('[data-zoom="out"]');
        const resetBtn = document.querySelector('[data-zoom="reset"]');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoom(1));
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoom(-1));
        }
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetZoom());
        }
    }

    zoom(direction, center = null) {
        const newZoom = this.currentZoom + (direction * this.zoomStep);
        
        // Check zoom limits
        if (newZoom < this.minZoom || newZoom > this.maxZoom) {
            return;
        }

        // Calculate zoom center
        let zoomCenter = center;
        if (!zoomCenter) {
            const bbox = this.svg.getBoundingClientRect();
            zoomCenter = {
                x: bbox.width / 2,
                y: bbox.height / 2
            };
        }

        // Calculate new viewBox values
        const scale = this.currentZoom / newZoom;
        const bbox = this.svg.getBoundingClientRect();
        const mousePointSVG = {
            x: ((zoomCenter.x - bbox.left) / bbox.width) * this.viewBox.width + this.viewBox.x,
            y: ((zoomCenter.y - bbox.top) / bbox.height) * this.viewBox.height + this.viewBox.y
        };

        this.viewBox.width *= scale;
        this.viewBox.height *= scale;
        this.viewBox.x = mousePointSVG.x - (mousePointSVG.x - this.viewBox.x) * scale;
        this.viewBox.y = mousePointSVG.y - (mousePointSVG.y - this.viewBox.y) * scale;

        // Update viewBox
        this.updateViewBox();
        this.currentZoom = newZoom;
    }

    startDrag(x, y) {
        this.isDragging = true;
        this.lastMousePosition = { x, y };
    }

    drag(x, y) {
        if (!this.isDragging) return;

        const dx = x - this.lastMousePosition.x;
        const dy = y - this.lastMousePosition.y;

        const bbox = this.svg.getBoundingClientRect();
        const scaleX = this.viewBox.width / bbox.width;
        const scaleY = this.viewBox.height / bbox.height;

        this.viewBox.x -= dx * scaleX;
        this.viewBox.y -= dy * scaleY;

        this.updateViewBox();
        this.lastMousePosition = { x, y };
    }

    resetZoom() {
        this.currentZoom = 1;
        const svgRoot = this.svgDoc.documentElement;
        const originalViewBox = svgRoot.getAttribute('data-original-viewbox');
        if (originalViewBox) {
            const [x, y, width, height] = originalViewBox.split(' ').map(Number);
            this.viewBox = { x, y, width, height };
            this.updateViewBox();
        }
    }

    updateViewBox() {
        const svgRoot = this.svgDoc.documentElement;
        const viewBoxStr = `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`;
        svgRoot.setAttribute('viewBox', viewBoxStr);
    }

    getTouchDistance(touches) {
        const dx = touches[1].clientX - touches[0].clientX;
        const dy = touches[1].clientY - touches[0].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getTouchCenter(touches) {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    const svgObject = document.getElementById('umapSVG');
    if (svgObject) {
        const zoomController = new MapZoomController(svgObject, {
            minZoom: 0.5,  // Maximum zoom out (50%)
            maxZoom: 4,    // Maximum zoom in (400%)
            zoomStep: 0.2  // Zoom 20% per step
        });

        // Store controller instance globally if needed
        window.mapZoomController = zoomController;
    }
});