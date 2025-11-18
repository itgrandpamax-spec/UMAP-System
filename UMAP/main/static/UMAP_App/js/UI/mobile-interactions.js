// Mobile Interaction Enhancements
class MobileInteractions {
    constructor() {
        this.setupTouchScroll();
        this.setupHapticFeedback();
        this.setupMobileTooltips();
        this.setupLoadingStates();
        this.setupGestureHandling();
    }

    setupTouchScroll() {
        // Allow preventDefault on touchmove to give control over scrolling
        // This prevents the intervention error
        document.addEventListener('touchmove', (e) => {
            // Allow preventDefault to work on non-passive events
            // This gives us control over scrolling when needed
        }, { passive: false });
    }

    setupHapticFeedback() {
        document.querySelectorAll('.haptic-feedback').forEach(element => {
            element.addEventListener('touchstart', () => {
                if ('vibrate' in navigator) {
                    navigator.vibrate(10);
                }
            });
        });
    }

    setupMobileTooltips() {
        document.querySelectorAll('[data-tooltip]').forEach(element => {
            element.addEventListener('touchstart', (e) => {
                const tooltip = document.createElement('div');
                tooltip.className = 'mobile-tooltip';
                tooltip.textContent = element.dataset.tooltip;
                document.body.appendChild(tooltip);
                
                setTimeout(() => tooltip.style.opacity = '1', 10);
                setTimeout(() => {
                    tooltip.style.opacity = '0';
                    setTimeout(() => tooltip.remove(), 200);
                }, 1500);
            });
        });
    }

    setupLoadingStates() {
        const showLoading = () => {
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = '<div class="loading-spinner"></div>';
            document.body.appendChild(overlay);
        };

        const hideLoading = () => {
            const overlay = document.querySelector('.loading-overlay');
            if (overlay) overlay.remove();
        };

        // Detect navigation events - only show loading for actual page navigation
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            // Only show loading for links with href attribute (actual navigation)
            if (link && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
                // Check if it's an actual page navigation (has href)
                const href = link.getAttribute('href');
                if (href && !href.startsWith('#')) {
                    showLoading();
                }
            }
        });

        // Handle form submissions - BUT EXCLUDE login/signup forms
        // (they handle their own loading states with button spinners)
        document.querySelectorAll('form').forEach(form => {
            // Skip auth forms - they have their own loading state management
            if (form.id !== 'loginForm' && form.id !== 'signupForm' && !form.classList.contains('auth-form')) {
                form.addEventListener('submit', () => showLoading());
            }
        });
    }

    setupGestureHandling() {
        document.querySelectorAll('.swipeable').forEach(element => {
            let startX;
            let startY;
            let startTime;
            
            element.addEventListener('touchstart', (e) => {
                startX = e.touches[0].pageX;
                startY = e.touches[0].pageY;
                startTime = Date.now();
            });

            element.addEventListener('touchend', (e) => {
                const deltaX = e.changedTouches[0].pageX - startX;
                const deltaY = e.changedTouches[0].pageY - startY;
                const deltaTime = Date.now() - startTime;

                // Detect swipe
                if (deltaTime < 250) {
                    if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 30) {
                        const event = new CustomEvent('swipe', {
                            detail: {
                                direction: deltaX > 0 ? 'right' : 'left'
                            }
                        });
                        element.dispatchEvent(event);
                    }
                }
            });
        });
    }
}

// Initialize mobile interactions when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth <= 767) {
        new MobileInteractions();
    }
});