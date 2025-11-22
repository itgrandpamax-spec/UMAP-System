document.addEventListener('DOMContentLoaded', function() {
    const sheet = document.getElementById('mobileBottomSheet');
    const handle = document.getElementById('sheetHandle');
    
    if (!sheet || !handle) return;
    
    // Prevent pull-to-refresh on mobile
    document.body.style.overscrollBehavior = 'none';

    // Constants
    const minHeight = 80; // Collapsed height (handle + padding)
    const maxHeight = window.innerHeight * 0.9; // 90% of viewport height
    const snapPoints = [
        minHeight,
        window.innerHeight * 0.5,
        maxHeight
    ];
    const threshold = 50; // pixels to determine swipe

    // State variables
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;
    let currentHeight = minHeight;

    // Initialize sheet position
    function initSheet() {
        sheet.style.height = `${minHeight}px`;
        sheet.style.transform = `translateY(${window.innerHeight - minHeight}px)`;
        
        // Add event listeners
        handle.addEventListener('touchstart', handleTouchStart, { passive: false });
        handle.addEventListener('touchmove', handleTouchMove, { passive: false });
        handle.addEventListener('touchend', handleTouchEnd, { passive: false });
        
        // Double tap to expand/collapse
        let lastTap = 0;
        handle.addEventListener('touchend', function(e) {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 500 && tapLength > 0) {
                toggleSheet();
                e.preventDefault();
            }
            lastTap = currentTime;
        });
    }

    function toggleSheet() {
        const isExpanded = currentHeight > snapPoints[0];
        const targetHeight = isExpanded ? snapPoints[0] : snapPoints[2];
        animateSheet(targetHeight);
    }

    function handleTouchStart(e) {
        isDragging = true;
        startY = e.touches[0].clientY;
        startHeight = currentHeight;
        sheet.style.transition = 'none';
        // Don't preventDefault on touchstart - not needed and can cause issues
    }

    function handleTouchMove(e) {
        if (!isDragging) return;
        
        // Don't try to preventDefault - let the browser handle scrolling naturally
        // Attempting preventDefault on non-cancelable events causes intervention errors
        
        const deltaY = e.touches[0].clientY - startY;
        const newHeight = Math.max(minHeight, Math.min(startHeight - deltaY, maxHeight));
        
        setSheetHeight(newHeight);
    }

    function handleTouchEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        
        // Don't preventDefault on touchend - let browser handle naturally

        const velocity = e.changedTouches[0].clientY - startY;
        
        // Find nearest snap point based on current height and velocity
        let targetHeight;
        if (Math.abs(velocity) > threshold) {
            // If swiping fast enough, go to next/previous snap point
            targetHeight = velocity > 0 ? 
                getPreviousSnapPoint(currentHeight) : 
                getNextSnapPoint(currentHeight);
        } else {
            // Otherwise snap to nearest point
            targetHeight = getNearestSnapPoint(currentHeight);
        }
        
        animateSheet(targetHeight);
    }

    function setSheetHeight(height) {
        currentHeight = height;
        sheet.style.height = `${height}px`;
        sheet.style.transform = `translateY(${window.innerHeight - height}px)`;
    }

    function animateSheet(targetHeight) {
        sheet.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        setSheetHeight(targetHeight);
        
        // Reset transition after animation
        setTimeout(() => {
            sheet.style.transition = 'none';
        }, 300);
    }

    function getNearestSnapPoint(height) {
        return snapPoints.reduce((prev, curr) => {
            return (Math.abs(curr - height) < Math.abs(prev - height) ? curr : prev);
        });
    }

    function getPreviousSnapPoint(height) {
        const reversed = [...snapPoints].reverse();
        return reversed.find(point => point < height) || snapPoints[0];
    }

    function getNextSnapPoint(height) {
        return snapPoints.find(point => point > height) || snapPoints[snapPoints.length - 1];
    }

    // Initialize the sheet
    initSheet();
});