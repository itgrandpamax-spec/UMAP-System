class ScheduleManager {
    constructor() {
        console.log('ScheduleManager constructor called');
        this.currentDay = 'Monday';
        this.selectedColor = 'blue';
        this.schedulesByDay = {
            'Monday': [],
            'Tuesday': [],
            'Wednesday': [],
            'Thursday': [],
            'Friday': [],
            'Saturday': [],
            'Sunday': []
        };
        
        // Ensure window.scheduleData is available
        if (typeof window.scheduleData === 'undefined') {
            console.error('window.scheduleData is not defined');
            window.scheduleData = [];
        } else {
            console.log('Found window.scheduleData:', window.scheduleData);
        }
        
        this.initialize();
    }

    initialize() {
        console.log('Initializing ScheduleManager...');
        
        // Initialize schedule data
        if (Array.isArray(window.scheduleData) && window.scheduleData.length > 0) {
            console.log(`Found ${window.scheduleData.length} schedules in window.scheduleData`);
            this.organizeScheduleData();
        } else {
            console.log('No schedule data found or empty array in window.scheduleData');
            if (window.scheduleData) {
                console.log('scheduleData content:', window.scheduleData);
            }
        }

        // Initialize event listeners
        this.initializeEventListeners();
        
        // Initialize filters
        this.populateSubjectFilter();
        
        // Show initial day - moved after data organization
        this.switchDay('Monday');
        
        // Log final state
        console.log('Schedule Manager initialization complete');
        Object.entries(this.schedulesByDay).forEach(([day, schedules]) => {
            console.log(`${day}: ${schedules.length} schedules`);
        });
    }

    organizeScheduleData() {
        console.log('Starting schedule data organization');
        
        // Reset schedulesByDay
        Object.keys(this.schedulesByDay).forEach(day => {
            this.schedulesByDay[day] = [];
        });
        
        try {
            window.scheduleData.forEach(schedule => {
                if (!schedule) {
                    console.warn('Found null/undefined schedule entry');
                    return;
                }
                
                console.log('Processing schedule:', {
                    id: schedule.id,
                    day: schedule.day,
                    course: schedule.course_code,
                    subject: schedule.subject,
                    start: schedule.start,
                    end: schedule.end
                });
                
                if (!schedule.day) {
                    console.error('Schedule missing day property:', schedule);
                    return;
                }
                
                if (!this.schedulesByDay.hasOwnProperty(schedule.day)) {
                    console.error('Invalid day value:', schedule.day);
                    return;
                }
                
                this.schedulesByDay[schedule.day].push(schedule);
            });

            // Sort each day's schedules by start time
            Object.keys(this.schedulesByDay).forEach(day => {
                if (this.schedulesByDay[day].length > 0) {
                    this.schedulesByDay[day].sort((a, b) => {
                        if (!a.start || !b.start) {
                            console.warn('Schedule missing start time:', !a.start ? a : b);
                            return 0;
                        }
                        return a.start.localeCompare(b.start);
                    });
                    console.log(`${day}: Organized ${this.schedulesByDay[day].length} schedules`);
                }
            });
            
            console.log('Schedule organization complete');
        } catch (error) {
            console.error('Error organizing schedule data:', error);
            console.error('scheduleData state:', window.scheduleData);
        }
    }

    initializeEventListeners() {
        // Day switching buttons
        document.querySelectorAll('.day-tab').forEach(button => {
            button.addEventListener('click', (e) => {
                const day = e.target.textContent.trim().match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)[0];
                const dayMap = {
                    'Mon': 'Monday',
                    'Tue': 'Tuesday',
                    'Wed': 'Wednesday',
                    'Thu': 'Thursday',
                    'Fri': 'Friday',
                    'Sat': 'Saturday',
                    'Sun': 'Sunday'
                };
                this.switchDay(dayMap[day]);
            });
        });

        // Form submission
        const form = document.getElementById('classForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Color selection
        document.querySelectorAll('[onclick^="selectColor"]').forEach(button => {
            const color = button.getAttribute('onclick').match(/'(.+)'/)[1];
            button.addEventListener('click', () => this.selectColor(color));
        });

        // Filter changes
        ['dayFilter', 'subjectFilter', 'timeFilter'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.applyFilters());
            }
        });
    }

    switchDay(day) {
        console.log('Switching to day:', day);
        console.log(`Found ${this.schedulesByDay[day]?.length || 0} schedules for ${day}`);
        
        if (this.schedulesByDay[day]) {
            console.log('Schedules for ' + day + ':', 
                this.schedulesByDay[day].map(s => ({
                    id: s.id,
                    course: s.course_code,
                    time: `${s.start}-${s.end}`
                }))
            );
        }
        
        this.currentDay = day;

        // Update active tab styling
        document.querySelectorAll('.day-tab').forEach(tab => {
            if (tab.textContent.includes(day.slice(0, 3))) {
                tab.classList.add('active');
                tab.classList.remove('bg-navy-lighter', 'text-gray-300');
            } else {
                tab.classList.remove('active');
                tab.classList.add('bg-navy-lighter', 'text-gray-300');
            }
        });

        // Update title
        const titleElement = document.getElementById('currentDayTitle');
        if (titleElement) {
            titleElement.textContent = day + ' Schedule';
        } else {
            console.error('Could not find element with id "currentDayTitle"');
        }

        // Get schedule list and clear it
        const scheduleList = document.getElementById('scheduleList');
        if (!scheduleList) {
            console.error('Could not find element with id "scheduleList"');
            return;
        }
        scheduleList.innerHTML = '';

        // Get schedules for the selected day
        const daySchedules = this.schedulesByDay[day] || [];
        console.log(`Displaying schedules for ${day}:`, daySchedules);
        console.log('Schedule list element:', scheduleList);

        if (daySchedules.length > 0) {
            // Create and append schedule cards
            daySchedules.forEach(schedule => {
                const scheduleCard = this.createClassElement(schedule);
                scheduleList.appendChild(scheduleCard);
            });
        } else {
            // Show "no classes" message
            const noClassesMsg = document.createElement('div');
            noClassesMsg.className = 'text-center text-gray-400 py-8';
            noClassesMsg.textContent = 'No classes scheduled for ' + day;
            scheduleList.appendChild(noClassesMsg);
        }

        // Update day filter
        const dayFilter = document.getElementById('dayFilter');
        if (dayFilter) {
            dayFilter.value = day;
        }
    }

    createClassElement(classData) {
        const div = document.createElement('div');
        div.className = `schedule-card bg-${classData.color || 'blue'}-600 text-white flex justify-between items-center`;
        
        // Set data attributes
        Object.entries({
            'class-id': classData.id,
            'day': classData.day,
            'start-time': classData.start,
            'end-time': classData.end,
            'subject': classData.subject,
            'course-code': classData.course_code
        }).forEach(([key, value]) => {
            if (value) div.setAttribute(`data-${key}`, value);
        });

        const formatTime = (timeStr) => {
            if (!timeStr) return '';
            const [hours, minutes] = timeStr.split(':');
            let h = parseInt(hours);
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12;
            h = h ? h : 12;
            return `${h}:${minutes} ${ampm}`;
        };

        const displayCourseCode = classData.course_code || 
            (classData.subject?.split(' ').map(word => word[0]).join(''));

        div.innerHTML = `
            <div class="flex-1">
                <h3 class="text-2xl font-bold">${displayCourseCode}</h3>
                <p class="text-lg mt-1 opacity-90">${classData.subject || ''}</p>
                <p class="text-sm mt-2 opacity-75">Room ${classData.room || 'TBA'}</p>
            </div>
            <div class="text-right">
                <p class="text-lg font-medium">${formatTime(classData.start)} - ${formatTime(classData.end)}</p>
            </div>
        `;

        return div;
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                credentials: 'same-origin'
            });

            if (response.ok) {
                // Refresh the page to get updated data
                window.location.reload();
            } else {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const result = await response.json();
                    this.showMessage(result.error || 'Error adding class', 'error');
                } else {
                    console.error('Server response:', await response.text());
                    this.showMessage('Error: Could not add class', 'error');
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
            this.showMessage('Network error: ' + error.message, 'error');
        }
    }

    selectColor(color) {
        this.selectedColor = color;
        document.getElementById('color').value = color;
        
        document.querySelectorAll('[onclick^="selectColor"]').forEach(btn => {
            btn.classList.remove('ring-2', 'ring-white');
        });
        
        document.querySelector(`[onclick="selectColor('${color}')"]`).classList.add('ring-2', 'ring-white');
    }

    populateSubjectFilter() {
        const subjectFilter = document.getElementById('subjectFilter');
        if (!subjectFilter) return;

        const subjects = new Set();
        Object.values(this.schedulesByDay).flat().forEach(schedule => {
            if (schedule.subject) subjects.add(schedule.subject);
        });

        // Clear existing options except "All Subjects"
        while (subjectFilter.options.length > 1) {
            subjectFilter.remove(1);
        }

        // Add subject options
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectFilter.appendChild(option);
        });
    }

    applyFilters() {
        const dayFilter = document.getElementById('dayFilter').value;
        const subjectFilter = document.getElementById('subjectFilter').value;
        const timeFilter = document.getElementById('timeFilter').value;

        if (dayFilter !== 'all') {
            this.switchDay(dayFilter);
        }

        const cards = document.querySelectorAll('.schedule-card');
        cards.forEach(card => {
            let show = true;

            if (dayFilter !== 'all') {
                show = show && card.getAttribute('data-day') === dayFilter;
            }

            if (subjectFilter !== 'all') {
                show = show && card.getAttribute('data-subject') === subjectFilter;
            }

            if (timeFilter !== 'all') {
                const startTime = card.getAttribute('data-start-time');
                const hour = parseInt(startTime.split(':')[0]);
                
                switch(timeFilter) {
                    case 'morning':
                        show = show && (hour >= 8 && hour < 12);
                        break;
                    case 'afternoon':
                        show = show && (hour >= 12 && hour < 17);
                        break;
                    case 'evening':
                        show = show && (hour >= 17 && hour < 20);
                        break;
                }
            }

            card.style.display = show ? 'flex' : 'none';
        });

        this.updateFilterTitle(dayFilter, subjectFilter, timeFilter);
    }

    updateFilterTitle(dayFilter, subjectFilter, timeFilter) {
        let title = dayFilter !== 'all' ? dayFilter : 'All Days';

        if (subjectFilter !== 'all') {
            title += ` - ${subjectFilter}`;
        }

        if (timeFilter !== 'all') {
            const timePeriods = {
                'morning': 'Morning Classes',
                'afternoon': 'Afternoon Classes',
                'evening': 'Evening Classes'
            };
            title += ` - ${timePeriods[timeFilter]}`;
        }

        title += ' Schedule';
        document.getElementById('currentDayTitle').textContent = title;
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `fixed top-4 right-4 px-6 py-3 rounded-xl shadow-lg transform transition-all duration-500 ${
            type === 'success' ? 'bg-green-600' : 
            type === 'error' ? 'bg-red-600' : 
            'bg-blue-600'
        } text-white`;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        // Animate in
        setTimeout(() => {
            messageDiv.style.transform = 'translateY(10px)';
        }, 100);
        
        // Remove after delay
        setTimeout(() => {
            messageDiv.style.transform = 'translateY(-20px)';
            messageDiv.style.opacity = '0';
            setTimeout(() => messageDiv.remove(), 300);
        }, 5000);
    }
}

// Initialize the schedule manager when the DOM is loaded
// Wait for both DOM and schedule data
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure schedule data is set
    setTimeout(() => {
        console.log('Initializing ScheduleManager with data:', window.scheduleData);
        window.scheduleManager = new ScheduleManager();
    }, 100);
});