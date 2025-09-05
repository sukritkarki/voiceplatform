// Stand with Nepal - Main Application JavaScript
// Optimized and modular implementation

// Global variables
let map;
let issues = [];
let filteredIssues = [];
let currentUser = null;
let currentLocation = null;
let issueModal;
let filters = {
    search: '',
    category: '',
    location: '',
    status: '',
    severity: '',
    dateFrom: '',
    dateTo: ''
};

// Performance monitoring
const performanceMonitor = {
    startTime: performance.now(),
    metrics: {
        loadTime: 0,
        apiCalls: 0,
        renderTime: 0
    },
    
    mark(name) {
        performance.mark(name);
    },
    
    measure(name, startMark, endMark) {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name)[0];
        console.log(`${name}: ${measure.duration.toFixed(2)}ms`);
    }
};

// Main application object
const app = {
    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.initializeMap();
        this.checkUserSession();
        this.setupServiceWorker();
        performanceMonitor.mark('app-init-complete');
    },

    setupEventListeners() {
        // Navigation
        this.setupNavigation();
        
        // Issue modal
        this.setupIssueModal();
        
        // Filters
        this.setupFilters();
        
        // Search
        this.setupSearch();
        
        // Quick actions
        this.setupQuickActions();
    },

    setupNavigation() {
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');

        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }

        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    },

    setupIssueModal() {
        issueModal = document.getElementById('issueModal');
        const postIssueBtn = document.getElementById('postIssueBtn');
        const reportIssueBtn = document.getElementById('reportIssueBtn');
        const quickReportBtn = document.getElementById('quickReportBtn');
        const closeBtn = issueModal?.querySelector('.close');
        const issueForm = document.getElementById('issueForm');

        // Open modal buttons
        [postIssueBtn, reportIssueBtn, quickReportBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openIssueModal();
                });
            }
        });

        // Close modal
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeIssueModal();
            });
        }

        // Close on outside click
        if (issueModal) {
            issueModal.addEventListener('click', (e) => {
                if (e.target === issueModal) {
                    this.closeIssueModal();
                }
            });
        }

        // Form submission
        if (issueForm) {
            issueForm.addEventListener('submit', (e) => {
                this.handleIssueSubmission(e);
            });
        }

        // Location cascading dropdowns
        this.setupLocationDropdowns();
    },

    setupFilters() {
        const filterElements = [
            'searchInput',
            'categoryFilter',
            'locationFilter',
            'statusFilter',
            'severityFilter',
            'dateFromFilter',
            'dateToFilter'
        ];

        filterElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.handleFilterChange());
                if (element.type === 'text') {
                    element.addEventListener('input', this.debounce(() => this.handleFilterChange(), 300));
                }
            }
        });

        // Clear filters button
        const clearFiltersBtn = document.getElementById('clearFilters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }

        // Advanced filters toggle
        const toggleAdvancedBtn = document.getElementById('toggleAdvancedFilters');
        const advancedFilters = document.querySelector('.advanced-filters');
        
        if (toggleAdvancedBtn && advancedFilters) {
            toggleAdvancedBtn.addEventListener('click', () => {
                const isVisible = advancedFilters.style.display !== 'none';
                advancedFilters.style.display = isVisible ? 'none' : 'flex';
                toggleAdvancedBtn.innerHTML = isVisible ? 
                    '<i class="fas fa-sliders-h"></i> Advanced Filters' : 
                    '<i class="fas fa-times"></i> Hide Filters';
            });
        }

        // Nearby issues button
        const nearbyBtn = document.getElementById('nearbyIssues');
        if (nearbyBtn) {
            nearbyBtn.addEventListener('click', () => this.loadNearbyIssues());
        }
    },

    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                filters.search = e.target.value;
                this.filterIssues();
            }, 300));
        }
    },

    setupQuickActions() {
        // View issues button
        const viewIssuesBtn = document.getElementById('viewIssuesBtn');
        if (viewIssuesBtn) {
            viewIssuesBtn.addEventListener('click', () => {
                document.getElementById('issues').scrollIntoView({ behavior: 'smooth' });
            });
        }

        // Load more button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreIssues());
        }
    },

    async loadInitialData() {
        performanceMonitor.mark('data-load-start');
        
        try {
            await Promise.all([
                this.loadIssues(),
                this.loadStats(),
                this.getCurrentLocation()
            ]);
            
            performanceMonitor.mark('data-load-end');
            performanceMonitor.measure('data-load', 'data-load-start', 'data-load-end');
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showNotification('Failed to load data. Please refresh the page.', 'error');
        }
    },

    async loadIssues() {
        try {
            this.showLoading('issuesGrid');
            
            // Load from localStorage for demo
            const storedIssues = localStorage.getItem('standwithnepal_issues');
            if (storedIssues) {
                issues = JSON.parse(storedIssues);
            } else {
                // Generate sample issues if none exist
                issues = this.generateSampleIssues();
                localStorage.setItem('standwithnepal_issues', JSON.stringify(issues));
            }
            
            filteredIssues = [...issues];
            this.renderIssues();
            this.updateFilterCount();
            
        } catch (error) {
            console.error('Error loading issues:', error);
            this.showNotification('Failed to load issues', 'error');
        } finally {
            this.hideLoading('issuesGrid');
        }
    },

    async loadStats() {
        try {
            const totalIssuesEl = document.getElementById('totalIssues');
            const resolvedIssuesEl = document.getElementById('resolvedIssues');
            const activeUsersEl = document.getElementById('activeUsers');

            if (totalIssuesEl) totalIssuesEl.textContent = issues.length;
            if (resolvedIssuesEl) {
                const resolved = issues.filter(issue => issue.status === 'resolved').length;
                resolvedIssuesEl.textContent = resolved;
            }
            if (activeUsersEl) activeUsersEl.textContent = '3,456'; // Demo data
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    },

    async getCurrentLocation() {
        if (!navigator.geolocation) return;

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 10000,
                    enableHighAccuracy: true
                });
            });

            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            // Update map center if map is initialized
            if (map) {
                map.setView([currentLocation.lat, currentLocation.lng], 13);
            }

        } catch (error) {
            console.warn('Geolocation failed:', error);
        }
    },

    initializeMap() {
        const mapElement = document.getElementById('issuesMap');
        if (!mapElement) return;

        try {
            // Initialize map
            map = L.map('issuesMap').setView([28.3949, 84.1240], 7);

            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            // Add markers for issues
            this.updateMapMarkers();

        } catch (error) {
            console.error('Map initialization failed:', error);
        }
    },

    updateMapMarkers() {
        if (!map) return;

        // Clear existing markers
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        // Add markers for filtered issues
        filteredIssues.forEach(issue => {
            if (issue.lat && issue.lng) {
                const marker = L.marker([issue.lat, issue.lng]).addTo(map);
                
                const popupContent = `
                    <div class="map-popup">
                        <h4>${issue.title}</h4>
                        <p><strong>Category:</strong> ${this.getCategoryLabel(issue.category)}</p>
                        <p><strong>Status:</strong> ${this.getStatusLabel(issue.status)}</p>
                        <p><strong>Upvotes:</strong> ${issue.upvotes}</p>
                        <button onclick="app.viewIssueDetails('${issue.id}')" class="btn btn-primary btn-sm">View Details</button>
                    </div>
                `;
                
                marker.bindPopup(popupContent);
            }
        });
    },

    handleFilterChange() {
        // Update filters object
        filters.search = document.getElementById('searchInput')?.value || '';
        filters.category = document.getElementById('categoryFilter')?.value || '';
        filters.location = document.getElementById('locationFilter')?.value || '';
        filters.status = document.getElementById('statusFilter')?.value || '';
        filters.severity = document.getElementById('severityFilter')?.value || '';
        filters.dateFrom = document.getElementById('dateFromFilter')?.value || '';
        filters.dateTo = document.getElementById('dateToFilter')?.value || '';

        this.filterIssues();
    },

    filterIssues() {
        filteredIssues = issues.filter(issue => {
            // Search filter
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                const matchesSearch = 
                    issue.title.toLowerCase().includes(searchTerm) ||
                    issue.description.toLowerCase().includes(searchTerm) ||
                    issue.municipality.toLowerCase().includes(searchTerm);
                if (!matchesSearch) return false;
            }

            // Category filter
            if (filters.category && issue.category !== filters.category) {
                return false;
            }

            // Location filter
            if (filters.location && !issue.district.toLowerCase().includes(filters.location.toLowerCase())) {
                return false;
            }

            // Status filter
            if (filters.status && issue.status !== filters.status) {
                return false;
            }

            // Severity filter
            if (filters.severity && issue.severity !== filters.severity) {
                return false;
            }

            // Date filters
            if (filters.dateFrom) {
                const issueDate = new Date(issue.timestamp);
                const fromDate = new Date(filters.dateFrom);
                if (issueDate < fromDate) return false;
            }

            if (filters.dateTo) {
                const issueDate = new Date(issue.timestamp);
                const toDate = new Date(filters.dateTo);
                if (issueDate > toDate) return false;
            }

            return true;
        });

        this.renderIssues();
        this.updateFilterCount();
        this.updateMapMarkers();
    },

    clearFilters() {
        // Reset filter inputs
        document.getElementById('searchInput').value = '';
        document.getElementById('categoryFilter').value = '';
        document.getElementById('locationFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('severityFilter').value = '';
        document.getElementById('dateFromFilter').value = '';
        document.getElementById('dateToFilter').value = '';

        // Reset filters object
        Object.keys(filters).forEach(key => {
            filters[key] = '';
        });

        // Re-filter and render
        this.filterIssues();
    },

    renderIssues() {
        const container = document.getElementById('issuesGrid');
        if (!container) return;

        performanceMonitor.mark('render-start');

        if (filteredIssues.length === 0) {
            container.innerHTML = `
                <div class="no-issues">
                    <i class="fas fa-search fa-3x"></i>
                    <h3>No issues found</h3>
                    <p>Try adjusting your filters or search terms</p>
                    <button class="btn btn-primary" onclick="app.clearFilters()">Clear Filters</button>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();
        
        filteredIssues.forEach(issue => {
            const issueCard = this.createIssueCard(issue);
            fragment.appendChild(issueCard);
        });

        container.innerHTML = '';
        container.appendChild(fragment);

        performanceMonitor.mark('render-end');
        performanceMonitor.measure('render-time', 'render-start', 'render-end');
    },

    createIssueCard(issue) {
        const card = document.createElement('div');
        card.className = `issue-card ${issue.severity}`;
        card.onclick = () => this.viewIssueDetails(issue.id);

        const distance = this.calculateDistance(issue);
        const distanceHtml = distance ? `<span class="distance">${distance}km away</span>` : '';

        card.innerHTML = `
            <div class="issue-header">
                <div>
                    <h3 class="issue-title">${this.escapeHtml(issue.title)}</h3>
                    <span class="issue-category">${this.getCategoryLabel(issue.category)}</span>
                    <span class="severity-badge severity-${issue.severity}">${issue.severity.toUpperCase()}</span>
                </div>
                <span class="status-badge status-${issue.status}">${this.getStatusLabel(issue.status)}</span>
            </div>
            <p class="issue-description">${this.truncateText(this.escapeHtml(issue.description), 120)}</p>
            <div class="issue-meta">
                <div class="issue-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${this.escapeHtml(issue.municipality)}, Ward ${issue.ward}</span>
                    ${distanceHtml}
                </div>
                <div class="issue-stats">
                    <div class="stat">
                        <i class="fas fa-thumbs-up"></i>
                        <span>${issue.upvotes}</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-clock"></i>
                        <span>${this.formatDate(issue.timestamp)}</span>
                    </div>
                </div>
            </div>
            <div class="issue-actions">
                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); app.upvoteIssue('${issue.id}')">
                    <i class="fas fa-thumbs-up"></i> Upvote
                </button>
                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); app.shareIssue('${issue.id}')">
                    <i class="fas fa-share"></i> Share
                </button>
            </div>
        `;

        return card;
    },

    updateFilterCount() {
        const filterCount = document.getElementById('filterCount');
        if (filterCount) {
            const total = issues.length;
            const filtered = filteredIssues.length;
            filterCount.textContent = `Showing ${filtered} of ${total} issues`;
        }
    },

    calculateDistance(issue) {
        if (!currentLocation || !issue.lat || !issue.lng) return null;

        const R = 6371; // Earth's radius in km
        const dLat = (issue.lat - currentLocation.lat) * Math.PI / 180;
        const dLon = (issue.lng - currentLocation.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(currentLocation.lat * Math.PI / 180) * Math.cos(issue.lat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        return distance.toFixed(1);
    },

    viewIssueDetails(issueId) {
        const issue = issues.find(i => i.id === issueId);
        if (!issue) return;

        // Create and show issue details modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content large">
                <span class="close">&times;</span>
                <div class="issue-detail-header">
                    <h2>${this.escapeHtml(issue.title)}</h2>
                    <span class="status-badge status-${issue.status}">${this.getStatusLabel(issue.status)}</span>
                </div>
                <div class="issue-detail-content">
                    <div class="issue-info">
                        <div class="info-row">
                            <strong>Category:</strong> <span>${this.getCategoryLabel(issue.category)}</span>
                        </div>
                        <div class="info-row">
                            <strong>Location:</strong> <span>${this.escapeHtml(issue.municipality)}, Ward ${issue.ward}, ${this.escapeHtml(issue.district)}</span>
                        </div>
                        <div class="info-row">
                            <strong>Severity:</strong> <span class="severity-badge severity-${issue.severity}">${issue.severity.toUpperCase()}</span>
                        </div>
                        <div class="info-row">
                            <strong>Reported:</strong> <span>${this.formatDate(issue.timestamp)}</span>
                        </div>
                        <div class="info-row">
                            <strong>Upvotes:</strong> <span>${issue.upvotes}</span>
                        </div>
                    </div>
                    <div class="issue-description">
                        <h4>Description</h4>
                        <p>${this.escapeHtml(issue.description)}</p>
                    </div>
                    ${issue.image ? `<div class="issue-media"><img src="${issue.image}" alt="Issue image" class="issue-image"></div>` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        // Close modal functionality
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => {
            document.body.removeChild(modal);
            document.body.style.overflow = 'auto';
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                document.body.style.overflow = 'auto';
            }
        };
    },

    openIssueModal() {
        if (issueModal) {
            issueModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    },

    closeIssueModal() {
        if (issueModal) {
            issueModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    },

    async handleIssueSubmission(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const issueData = {
            id: this.generateId(),
            title: formData.get('title'),
            description: formData.get('description'),
            category: formData.get('category'),
            severity: formData.get('severity') || 'medium',
            province: formData.get('province'),
            district: formData.get('district'),
            municipality: formData.get('municipality'),
            ward: formData.get('ward'),
            anonymous: formData.get('anonymous') === 'on',
            status: 'new',
            upvotes: 0,
            timestamp: new Date().toISOString(),
            lat: currentLocation?.lat || null,
            lng: currentLocation?.lng || null
        };

        try {
            // Add to issues array
            issues.unshift(issueData);
            localStorage.setItem('standwithnepal_issues', JSON.stringify(issues));
            
            // Update display
            this.filterIssues();
            this.loadStats();
            
            // Close modal and show success
            this.closeIssueModal();
            this.showNotification('Issue submitted successfully!', 'success');
            
            // Reset form
            e.target.reset();
            
        } catch (error) {
            console.error('Error submitting issue:', error);
            this.showNotification('Failed to submit issue. Please try again.', 'error');
        }
    },

    setupLocationDropdowns() {
        const provinceSelect = document.getElementById('province');
        const districtSelect = document.getElementById('district');
        const municipalitySelect = document.getElementById('municipality');
        const wardSelect = document.getElementById('ward');

        if (!provinceSelect) return;

        const locationData = {
            '3': {
                name: 'Bagmati Province',
                districts: {
                    'Kathmandu': {
                        municipalities: {
                            'Kathmandu Metropolitan City': 32,
                            'Kirtipur Municipality': 10
                        }
                    },
                    'Lalitpur': {
                        municipalities: {
                            'Lalitpur Metropolitan City': 29
                        }
                    }
                }
            },
            '4': {
                name: 'Gandaki Province',
                districts: {
                    'Kaski': {
                        municipalities: {
                            'Pokhara Metropolitan City': 33
                        }
                    }
                }
            }
        };

        provinceSelect.addEventListener('change', (e) => {
            const provinceId = e.target.value;
            this.updateDistrictOptions(districtSelect, locationData[provinceId]?.districts || {});
            this.clearSelect(municipalitySelect);
            this.clearSelect(wardSelect);
        });

        districtSelect.addEventListener('change', (e) => {
            const provinceId = provinceSelect.value;
            const districtName = e.target.value;
            const municipalities = locationData[provinceId]?.districts[districtName]?.municipalities || {};
            this.updateMunicipalityOptions(municipalitySelect, municipalities);
            this.clearSelect(wardSelect);
        });

        municipalitySelect.addEventListener('change', (e) => {
            const provinceId = provinceSelect.value;
            const districtName = districtSelect.value;
            const municipalityName = e.target.value;
            const wardCount = locationData[provinceId]?.districts[districtName]?.municipalities[municipalityName] || 0;
            this.updateWardOptions(wardSelect, wardCount);
        });
    },

    updateDistrictOptions(select, districts) {
        this.clearSelect(select);
        Object.keys(districts).forEach(district => {
            const option = document.createElement('option');
            option.value = district;
            option.textContent = district;
            select.appendChild(option);
        });
    },

    updateMunicipalityOptions(select, municipalities) {
        this.clearSelect(select);
        Object.keys(municipalities).forEach(municipality => {
            const option = document.createElement('option');
            option.value = municipality;
            option.textContent = municipality;
            select.appendChild(option);
        });
    },

    updateWardOptions(select, wardCount) {
        this.clearSelect(select);
        for (let i = 1; i <= wardCount; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Ward ${i}`;
            select.appendChild(option);
        }
    },

    clearSelect(select) {
        if (!select) return;
        select.innerHTML = '<option value="">Select...</option>';
    },

    async upvoteIssue(issueId) {
        const issue = issues.find(i => i.id === issueId);
        if (!issue) return;

        try {
            issue.upvotes++;
            localStorage.setItem('standwithnepal_issues', JSON.stringify(issues));
            
            // Update display
            this.renderIssues();
            this.showNotification('Issue upvoted!', 'success');
            
        } catch (error) {
            console.error('Error upvoting issue:', error);
            this.showNotification('Failed to upvote issue', 'error');
        }
    },

    shareIssue(issueId) {
        const issue = issues.find(i => i.id === issueId);
        if (!issue) return;

        const shareData = {
            title: issue.title,
            text: issue.description,
            url: `${window.location.origin}#issue-${issueId}`
        };

        if (navigator.share) {
            navigator.share(shareData);
        } else {
            // Fallback to clipboard
            navigator.clipboard.writeText(shareData.url).then(() => {
                this.showNotification('Issue link copied to clipboard!', 'success');
            });
        }
    },

    async loadNearbyIssues() {
        if (!currentLocation) {
            this.showNotification('Location access required for nearby issues', 'warning');
            return;
        }

        const nearbyIssues = issues.filter(issue => {
            if (!issue.lat || !issue.lng) return false;
            const distance = this.calculateDistance(issue);
            return distance && parseFloat(distance) <= 10; // Within 10km
        });

        filteredIssues = nearbyIssues;
        this.renderIssues();
        this.updateFilterCount();
        this.updateMapMarkers();

        this.showNotification(`Found ${nearbyIssues.length} nearby issues`, 'info');
    },

    checkUserSession() {
        const user = sessionStorage.getItem('standwithnepal_user');
        if (user) {
            currentUser = JSON.parse(user);
            this.updateUIForLoggedInUser();
        }
    },

    updateUIForLoggedInUser() {
        // Update navigation for logged-in users
        const loginLink = document.querySelector('a[href="login.html"]');
        if (loginLink && currentUser) {
            loginLink.textContent = currentUser.name || 'Profile';
            loginLink.href = 'profile.html';
        }
    },

    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration);
            } catch (error) {
                console.warn('Service Worker registration failed:', error);
            }
        }
    },

    // Utility functions
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    },

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return '1 day ago';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    },

    getCategoryLabel(category) {
        const labels = {
            'road': 'Road & Infrastructure',
            'electricity': 'Electricity',
            'water': 'Water Supply',
            'healthcare': 'Healthcare',
            'corruption': 'Corruption',
            'education': 'Education',
            'environment': 'Environment'
        };
        return labels[category] || category;
    },

    getStatusLabel(status) {
        const labels = {
            'new': 'New',
            'acknowledged': 'Acknowledged',
            'in-progress': 'In Progress',
            'resolved': 'Resolved'
        };
        return labels[status] || status;
    },

    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Loading...</p>
                </div>
            `;
        }
    },

    hideLoading(containerId) {
        // Loading will be replaced by content
    },

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // Add styles if not already present
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 1rem 1.5rem;
                    border-radius: 8px;
                    color: white;
                    z-index: 10000;
                    animation: slideInRight 0.3s ease;
                    max-width: 400px;
                }
                .notification-success { background: #10b981; }
                .notification-error { background: #ef4444; }
                .notification-info { background: #3b82f6; }
                .notification-warning { background: #f59e0b; }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                .notification-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                    flex-shrink: 0;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);

        // Close button functionality
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    },

    generateSampleIssues() {
        const categories = ['road', 'electricity', 'water', 'healthcare', 'corruption', 'education', 'environment'];
        const severities = ['low', 'medium', 'high', 'urgent'];
        const statuses = ['new', 'acknowledged', 'in-progress', 'resolved'];
        const locations = [
            { district: 'Kathmandu', municipality: 'Kathmandu Metropolitan City', ward: 10, lat: 27.7172, lng: 85.3240 },
            { district: 'Lalitpur', municipality: 'Lalitpur Metropolitan City', ward: 5, lat: 27.6588, lng: 85.3247 },
            { district: 'Kaski', municipality: 'Pokhara Metropolitan City', ward: 15, lat: 28.2096, lng: 83.9856 }
        ];

        const sampleTitles = [
            'Broken street light on main road',
            'Water supply disruption in residential area',
            'Pothole causing traffic issues',
            'Electricity outage for 3 days',
            'Garbage collection not happening',
            'School building needs repair',
            'Air pollution from factory',
            'Corruption in local office',
            'Healthcare facility lacks equipment',
            'Road construction incomplete'
        ];

        const sampleDescriptions = [
            'The street light has been broken for over a week, making it dangerous for pedestrians at night.',
            'Water supply has been disrupted for the past 3 days affecting over 100 households.',
            'Large pothole on the main road is causing traffic jams and vehicle damage.',
            'Electricity has been out for 3 days with no communication from the utility company.',
            'Garbage has not been collected for 2 weeks, creating health hazards.',
            'The school building roof is leaking and needs immediate repair.',
            'Factory is releasing smoke causing air pollution in the neighborhood.',
            'Local officials are demanding bribes for basic services.',
            'The health post lacks basic medical equipment and medicines.',
            'Road construction started 6 months ago but remains incomplete.'
        ];

        return Array.from({ length: 20 }, (_, i) => {
            const location = locations[i % locations.length];
            return {
                id: this.generateId(),
                title: sampleTitles[i % sampleTitles.length],
                description: sampleDescriptions[i % sampleDescriptions.length],
                category: categories[i % categories.length],
                severity: severities[i % severities.length],
                status: statuses[i % statuses.length],
                district: location.district,
                municipality: location.municipality,
                ward: location.ward,
                lat: location.lat + (Math.random() - 0.5) * 0.1,
                lng: location.lng + (Math.random() - 0.5) * 0.1,
                upvotes: Math.floor(Math.random() * 50),
                anonymous: Math.random() > 0.7,
                timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
            };
        });
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Export for global access
window.app = app;