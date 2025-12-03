// ========= SVG ZOOM & PAN WITH SMOOTH ANIMATION =========
// Features: Smooth animated zoom, double-tap center, pinch-zoom, fit-to-building
// Focuses on UMAK, soft-clamps around UMAK, keeps all buildings clickable.

class SVGManipulator {
    constructor(selector = '[id^="umapSVG"]') {
        this.selector = selector;
        this.svgObjects = [];
        this.padding = 500;              // Looser clamp padding around UMAK
        this.minZoom = 0.1;             // Allow zooming in much further (10% of SVG width)
        this.maxZoom = 2.0;             // Allow zooming out much further (200% of SVG width)
        this.animationDuration = 600;   // ms for smooth transitions
        this.animationFrameId = null;

        document.addEventListener("DOMContentLoaded", () => this.init());
    }

    init() {
        const objs = document.querySelectorAll(this.selector);
        objs.forEach(obj => this.setupObject(obj));
    }

    setupObject(svgObject) {
        // OBJECT elements load their SVG separately
        const tryLoad = () => {
            const doc = svgObject.contentDocument;
            if (!doc) return setTimeout(tryLoad, 50);
            this.initialize(svgObject, doc);
        };

        svgObject.addEventListener("load", tryLoad);
        tryLoad();
    }

    animate(startVals, endVals, duration, callback) {
        const startTime = performance.now();
        
        const step = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function: ease-out-cubic for smooth deceleration
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            const current = {};
            for (const key in startVals) {
                current[key] = startVals[key] + (endVals[key] - startVals[key]) * easeProgress;
            }
            
            callback(current, progress);
            
            if (progress < 1) {
                this.animationFrameId = requestAnimationFrame(step);
            }
        };
        
        this.animationFrameId = requestAnimationFrame(step);
    }

    clampViewBox(viewBox, umakBox, svgBounds) {
        const pad = this.padding;

        const minX = umakBox.x - pad;
        const minY = umakBox.y - pad;

        const maxX = umakBox.x + umakBox.width - viewBox.width + pad;
        const maxY = umakBox.y + umakBox.height - viewBox.height + pad;

        viewBox.x = Math.max(minX, Math.min(viewBox.x, maxX));
        viewBox.y = Math.max(minY, Math.min(viewBox.y, maxY));
    }

    setViewBox(svg, viewBox) {
        svg.setAttribute("viewBox",
            `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    }

    initialize(svgObject, svgDoc) {
        const svg = svgDoc.querySelector("svg");
        if (!svg) return;

        // Prepare viewBox reference
        const viewBox = svg.viewBox.baseVal;

        // SVG bounds (from width/height attributes)
        const svgBounds = {
            width: svg.width.baseVal.value,
            height: svg.height.baseVal.value
        };

        // ========== GET UMAK BOUNDS ==========
        const UMAK = svgDoc.getElementById("UMAK");
        if (!UMAK) return console.warn("UMAK not found in SVG");

        const umakBox = UMAK.getBBox();

        // ========== INITIAL ZOOM: MORE ZOOMED IN ==========
        // Start at 20% zoom into UMAK area (more zoomed than before)
        const initialZoomFactor = 0.20;
        const targetWidth = svgBounds.width * initialZoomFactor;
        const targetHeight = svgBounds.height * initialZoomFactor;

        viewBox.x = umakBox.x + umakBox.width / 2 - targetWidth / 2;
        viewBox.y = umakBox.y + umakBox.height / 2 - targetHeight / 2;
        viewBox.width = targetWidth;
        viewBox.height = targetHeight;

        // Calculate zoom limits based on UMAK bounds
        // minZoom: can zoom in to 10% of SVG width
        this.minZoom = 0.1;
        // maxZoom: can zoom out to show UMAK + padding, but not beyond 1.5x SVG width
        const maxZoomWidth = Math.min(umakBox.width * 1.15, svgBounds.width * 1.5); // UMAK + 15% padding, capped at 1.5x SVG
        this.maxZoom = maxZoomWidth / svgBounds.width;

        this.clampViewBox(viewBox, umakBox, svgBounds);
        this.setViewBox(svg, viewBox);

        // Panning state
        let isPanning = false;
        let startX = 0, startY = 0;
        let panStartX = 0, panStartY = 0;
        let panDistance = 0;  // Track total pan distance
        const MIN_PAN_DISTANCE = 5;  // Minimum pixels to count as pan (not click)
        
        // Building selection state
        let selectedBuilding = null;  // Track which building is selected
        
        // Touch state
        let lastTouchTime = 0;
        let touchStartDistance = 0;
        let touchStartWidth = 0;

        // ========= SMOOTH PAN FUNCTION =========
        const smoothPan = (targetX, targetY) => {
            const startState = {
                x: viewBox.x,
                y: viewBox.y
            };

            this.animate(startState, { x: targetX, y: targetY }, 300, (current) => {
                viewBox.x = current.x;
                viewBox.y = current.y;
                this.clampViewBox(viewBox, umakBox, svgBounds);
                this.setViewBox(svg, viewBox);
            });
        };

        // ========= FOCUS ON BUILDING (FIT TO BUILDING) =========
        const focusOnBuilding = (buildingElement) => {
            try {
                const buildingBox = buildingElement.getBBox();
                
                // Calculate zoom level: building should be ~60% of screen width
                const padding = 1.4; // padding around building
                const targetWidth = buildingBox.width * padding;
                const targetHeight = buildingBox.height * padding;
                
                // Keep aspect ratio
                const finalWidth = targetWidth;
                const finalHeight = (finalWidth / targetWidth) * targetHeight;

                const startState = {
                    x: viewBox.x,
                    y: viewBox.y,
                    width: viewBox.width,
                    height: viewBox.height
                };

                // Center on building (no zoom constraint, just pan to it)
                const endState = {
                    x: buildingBox.x + buildingBox.width / 2 - finalWidth / 2,
                    y: buildingBox.y + buildingBox.height / 2 - finalHeight / 2,
                    width: finalWidth,
                    height: finalHeight
                };

                // Apply without animation - just instant smooth pan/zoom
                this.animate(startState, endState, 400, (current) => {
                    viewBox.x = current.x;
                    viewBox.y = current.y;
                    viewBox.width = current.width;
                    viewBox.height = current.height;
                    this.clampViewBox(viewBox, umakBox, svgBounds);
                    this.setViewBox(svg, viewBox);
                });
            } catch (err) {
                console.warn("Could not focus on building:", err);
            }
        };

        // ========= ZOOM (WHEEL) =========
        svgDoc.addEventListener("wheel", (e) => {
            e.preventDefault();

            // Deselect building when user zooms
            selectedBuilding = null;

            // Cancel any ongoing animation to prevent bouncing
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }

            const zoomIn = e.deltaY < 0;
            const zoomFactor = zoomIn ? 0.85 : 1.15;
            const newWidth = viewBox.width * zoomFactor;
            const newHeight = viewBox.height * zoomFactor;

            // Constrain zoom
            if (newWidth < svgBounds.width * this.minZoom || newWidth > svgBounds.width * this.maxZoom) {
                return; // Don't zoom if at limit
            }

            // Apply zoom immediately without animation to prevent bouncing
            const rect = svgObject.getBoundingClientRect();
            const mx = (e.clientX - rect.left) / rect.width;
            const my = (e.clientY - rect.top) / rect.height;

            const oldWidth = viewBox.width;
            const oldHeight = viewBox.height;
            const deltaW = oldWidth - newWidth;
            const deltaH = oldHeight - newHeight;
            
            viewBox.width = newWidth;
            viewBox.height = newHeight;
            viewBox.x += deltaW * mx;
            viewBox.y += deltaH * my;

            this.clampViewBox(viewBox, umakBox, svgBounds);
            this.setViewBox(svg, viewBox);
        }, { passive: false });

        // ========= MOUSE PAN =========
        svgDoc.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;

            isPanning = true;
            startX = e.clientX;
            startY = e.clientY;
            panStartX = viewBox.x;
            panStartY = viewBox.y;
            
            // Deselect building when user starts panning
            selectedBuilding = null;
        });

        svgDoc.addEventListener("mousemove", (e) => {
            if (!isPanning) return;

            const dx = ((e.clientX - startX) / svgObject.clientWidth) * viewBox.width;
            const dy = ((e.clientY - startY) / svgObject.clientHeight) * viewBox.height;
            
            // Track distance for drag detection
            panDistance = Math.sqrt((e.clientX - startX) ** 2 + (e.clientY - startY) ** 2);

            viewBox.x = panStartX - dx;
            viewBox.y = panStartY - dy;

            this.clampViewBox(viewBox, umakBox, svgBounds);
            this.setViewBox(svg, viewBox);
        });

        svgDoc.addEventListener("mouseup", () => isPanning = false);
        svgDoc.addEventListener("mouseleave", () => isPanning = false);

        // ========= DOUBLE-CLICK TO CENTER & ZOOM =========
        let lastClickTime = 0;
        let lastClickTarget = null;

        svgDoc.addEventListener("click", (e) => {
            // Ignore click if we just finished panning (dragged more than MIN_PAN_DISTANCE)
            if (panDistance > MIN_PAN_DISTANCE) {
                panDistance = 0;
                return;
            }
            
            const currentTime = Date.now();
            const isDoubleClick = currentTime - lastClickTime < 300 && lastClickTarget === e.target;
            lastClickTime = currentTime;
            lastClickTarget = e.target;

            if (isDoubleClick) {
                e.stopPropagation();
                // Cancel any ongoing animation
                if (this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                }
                
                // Double-click: zoom in immediately (no animation to prevent bounce)
                const zoomFactor = 0.7;
                const newWidth = viewBox.width * zoomFactor;
                
                if (newWidth < svgBounds.width * this.minZoom || newWidth > svgBounds.width * this.maxZoom) {
                    return;
                }
                
                const oldHeight = viewBox.height;
                viewBox.width = newWidth;
                viewBox.height = oldHeight * zoomFactor;
                viewBox.x += (oldHeight - viewBox.height) / 2 * (viewBox.width / oldHeight);
                viewBox.y += (oldHeight - viewBox.height) / 2;
                
                this.clampViewBox(viewBox, umakBox, svgBounds);
                this.setViewBox(svg, viewBox);
                return;
            }

            // ========= SINGLE CLICK: FOCUS ON BUILDING (NO PAN DISABLE) =========
            const id = (e.target.id || "").toLowerCase();
            if (!id) {
                // Click on empty area - deselect building
                selectedBuilding = null;
                return;
            }
            if (id === "umak") {
                // Click on UMAK boundary - deselect building
                selectedBuilding = null;
                return;
            }

            const isBuilding =
                id.startsWith("building") ||
                id === "hpsb" ||
                id === "admin" ||
                id === "admin building" ||
                id === "oval" ||
                id === "march" ||
                id === "marchhouse";

            if (isBuilding) {
                // Only focus on building if it's not already selected (prevent double-focus animation)
                if (selectedBuilding !== e.target.id) {
                    selectedBuilding = e.target.id;
                    
                    // Fit to building (smooth pan/zoom, panning still enabled)
                    focusOnBuilding(e.target);

                    // Show building panel
                    if (typeof showBuildingPanel === "function") {
                        showBuildingPanel({
                            id: e.target.id,
                            name: e.target.id,
                            position: null
                        });
                    }
                } else {
                    // Clicking same building again = deselect
                    selectedBuilding = null;
                }
            }
        }, true);

        // ========= TOUCH: PINCH ZOOM =========
        svgDoc.addEventListener("touchstart", (e) => {
            if (e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                touchStartDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                touchStartWidth = viewBox.width;
                // Deselect building when user starts pinch zoom
                selectedBuilding = null;
            } else if (e.touches.length === 1) {
                isPanning = true;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                panStartX = viewBox.x;
                panStartY = viewBox.y;
                // Deselect building when user starts touch pan
                selectedBuilding = null;
            }
        }, { passive: true });

        svgDoc.addEventListener("touchmove", (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                // Apply exponential scaling for more responsive touch (mobile is slower than wheel)
                const rawScale = currentDistance / touchStartDistance;
                const scaleFactor = Math.pow(rawScale, 1.3); // Amplify touch zoom sensitivity
                const newWidth = touchStartWidth / scaleFactor;
                const newHeight = viewBox.height / scaleFactor;

                // Constrain zoom
                if (newWidth < svgBounds.width * this.minZoom || newWidth > svgBounds.width * this.maxZoom) {
                    return;
                }

                const midX = (t1.clientX + t2.clientX) / 2;
                const midY = (t1.clientY + t2.clientY) / 2;

                const oldWidth = viewBox.width;
                const oldHeight = viewBox.height;
                const deltaW = oldWidth - newWidth;
                const deltaH = oldHeight - newHeight;

                const rect = svgObject.getBoundingClientRect();
                const mx = (midX - rect.left) / rect.width;
                const my = (midY - rect.top) / rect.height;

                viewBox.width = newWidth;
                viewBox.height = newHeight;
                viewBox.x += deltaW * mx;
                viewBox.y += deltaH * my;

                this.clampViewBox(viewBox, umakBox, svgBounds);
                this.setViewBox(svg, viewBox);
            } else if (e.touches.length === 1 && isPanning) {
                e.preventDefault();
                const t = e.touches[0];
                // Amplify touch drag sensitivity (1.2x factor) for better mobile responsiveness
                const dx = ((t.clientX - startX) / svgObject.clientWidth) * viewBox.width * 1.2;
                const dy = ((t.clientY - startY) / svgObject.clientHeight) * viewBox.height * 1.2;

                viewBox.x = panStartX - dx;
                viewBox.y = panStartY - dy;

                this.clampViewBox(viewBox, umakBox, svgBounds);
                this.setViewBox(svg, viewBox);
            }
        }, { passive: false });

        svgDoc.addEventListener("touchend", () => {
            isPanning = false;
            touchStartDistance = 0;
        }, { passive: true });

        console.log("SVG Manipulator initialized with smooth animations and fit-to-building");
    }
}

// Initialize
new SVGManipulator();
