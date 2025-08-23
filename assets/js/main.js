// Main JavaScript functionality for Stand with Nepal
import { performance, dom, validation, api, storage, dateUtils, locationUtils, CONSTANTS } from './utils.js';
import { IssueCard } from './components/IssueCard.js';
import { NotificationManager } from './components/NotificationManager.js';
import { LoadingManager } from './components/LoadingManager.js';

// Performance monitoring
const performanceMonitor = {
    startTime: performance.now(),
    metrics: {},
    
    mark(name) {
        this.metrics[name] = performance.now() - this.startTime;
    },
    
    measure(name, startMark, endMark) {
        const start = this.metrics[startMark] || 0;
        const end = this.metrics[endMark] || performance.now() - this.startTime;
        this.metrics[name] = end - start;
    },
    
    report() {
        console.table(this.metrics);
    }
};

// Advanced caching system
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.maxSize = 100;
        this.ttl = 5 * 60 * 1000; // 5 minutes
    }
    
    set(key, value, customTTL = null) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl: customTTL || this.ttl
        });
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }
    
    clear() {
        this.cache.clear();
    }
}

// Lazy loading for images
class LazyLoader {
    constructor() {
        this.observer = null;
        this.init();
    }
    
    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                        this.observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px'
            });
        }
    }
    
    observe(img) {
        if (this.observer) {
            this.observer.observe(img);
        } else {
            this.loadImage(img);
        }
    }
    
    loadImage(img) {
        if (img.dataset.src) {
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            img.classList.add('loaded');
        }
    }
}

// Virtual scrolling for large lists
class VirtualScroller {
    constructor(container, itemHeight, renderItem) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.renderItem = renderItem;
        this.items = [];
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.scrollTop = 0;
        this.containerHeight = 0;
        
        this.init();
    }
    
    init() {
        this.container.style.position = 'relative';
        this.container.addEventListener('scroll', this.onScroll.bind(this));
        this.updateDimensions();
    }
    
    setItems(items) {
        this.items = items;
        this.render();
    }
    
    updateDimensions() {
        this.containerHeight = this.container.clientHeight;
        this.visibleCount = Math.ceil(this.containerHeight / this.itemHeight) + 2;
    }
    
    onScroll() {
        this.scrollTop = this.container.scrollTop;
        this.visibleStart = Math.floor(this.scrollTop / this.itemHeight);
        this.visibleEnd = Math.min(this.visibleStart + this.visibleCount, this.items.length);
        this.render();
    }
    
    render() {
        const totalHeight = this.items.length * this.itemHeight;
        const offsetY = this.visibleStart * this.itemHeight;
        
        this.container.innerHTML = `
            <div style="height: ${totalHeight}px; position: relative;">
                <div style="transform: translateY(${offsetY}px);">
                    ${this.items.slice(this.visibleStart, this.visibleEnd)
                        .map((item, index) => this.renderItem(item, this.visibleStart + index))
                        .join('')}
                </div>
            </div>
        `;
    }
}

// Service Worker registration for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Application class
class StandWithNepalApp {
    constructor() {
        this.map = null;
        this.issuesData = [];
        this.currentLocation = null;
        this.userPreferences = {};
        this.currentFilters = {
            category: '',
            location: '',
            status: '',
            severity: '',
            dateRange: ''
        };
        
        // Initialize managers
        this.notificationManager = new NotificationManager();
        this.loadingManager = new LoadingManager();
        this.cache = new CacheManager();
        this.lazyLoader = new LazyLoader();
        this.virtualScroller = null;
        
        // Debounced functions
        this.debouncedSearch = performance.debounce(this.handleSearch.bind(this), 300);
        this.debouncedFilter = performance.debounce(this.handleFilterChange.bind(this), 200);
    }

    async init() {
        try {
            performanceMonitor.mark('appInitStart');
            this.setupEventListeners();
            this.loadUserPreferences();
            await this.detectUserLocation();
            this.initializeMap();
            await this.loadIssues();
            this.setupCharts();
            this.setupMobileMenu();
            this.loadLocationData();
            this.setupAdvancedFilters();
            this.initializeNotifications();
            await this.loadTrendingIssues();
            this.setupQuickActions();
            this.enhanceAccessibility();
            performanceMonitor.mark('appInitEnd');
            performanceMonitor.measure('appInitTime', 'appInitStart', 'appInitEnd');
        } catch (error) {
            console.error('App initialization error:', error);
            this.showNotification('Failed to initialize application', 'error');
        }
    }

    setupEventListeners() {
        // Modal controls
        const modal = document.getElementById('issueModal');
        const postIssueBtn = document.getElementById('postIssueBtn');
        const reportIssueBtn = document.getElementById('reportIssueBtn');
        const viewIssuesBtn = document.getElementById('viewIssuesBtn');
        const closeBtn = document.querySelector('.close');

        if (postIssueBtn) postIssueBtn.addEventListener('click', () => this.openIssueModal());
        if (reportIssueBtn) reportIssueBtn.addEventListener('click', () => this.openIssueModal());
        if (viewIssuesBtn) viewIssuesBtn.addEventListener('click', () => this.scrollToIssues());
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());

        // Form submission
        const issueForm = document.getElementById('issueForm');
        if (issueForm) issueForm.addEventListener('submit', (e) => this.handleIssueSubmission(e));

        // Filters with debouncing
        const categoryFilter = document.getElementById('categoryFilter');
        const locationFilter = document.getElementById('locationFilter');
        const statusFilter = document.getElementById('statusFilter');

        if (categoryFilter) categoryFilter.addEventListener('change', this.debouncedFilter);
        if (locationFilter) locationFilter.addEventListener('change', this.debouncedFilter);
        if (statusFilter) statusFilter.addEventListener('change', this.debouncedFilter);

        // Location cascading dropdowns
        const province = document.getElementById('province');
        if (province) province.addEventListener('change', (e) => this.handleProvinceChange(e));

        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeModal();
            }
        });

        // Advanced search with debouncing
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debouncedSearch);
        }

        // Custom events
        document.addEventListener('viewIssueDetails', (e) => {
            this.viewIssueDetails(e.detail.issueId);
        });

        // Smooth scrolling for navigation
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    async detectUserLocation() {
        try {
            this.currentLocation = await locationUtils.getCurrentPosition();
            this.updateMapCenter();
            await this.loadNearbyIssues();
        } catch (error) {
            console.log('Location detection failed:', error);
        }
    }

    handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (searchTerm.length < 2 && searchTerm.length > 0) {
            return; // Don't search for single characters
        }
        
        const cacheKey = `search_${searchTerm}`;
        const cachedResults = this.cache.get(cacheKey);
        
        if (cachedResults) {
            this.displayIssues(cachedResults);
            this.updateMapMarkers(cachedResults);
            return;
        }
        
        const filteredIssues = this.issuesData.filter(issue => 
            issue.title.toLowerCase().includes(searchTerm) ||
            issue.description.toLowerCase().includes(searchTerm) ||
            issue.municipality.toLowerCase().includes(searchTerm)
        );
        
        this.cache.set(cacheKey, filteredIssues, 2 * 60 * 1000); // 2 minutes cache
        this.displayIssues(filteredIssues);
        this.updateMapMarkers(filteredIssues);
    }

    async loadIssues() {
        const issuesGrid = document.getElementById('issuesGrid');
        if (issuesGrid) {
            this.loadingManager.showSkeleton(issuesGrid, 'list');
        }

        const cacheKey = 'issues_list';
        const cachedIssues = this.cache.get(cacheKey);
        
        if (cachedIssues) {
            this.issuesData = cachedIssues;
            this.displayIssues(this.filterIssues(cachedIssues));
            this.updateMapMarkers(cachedIssues);
            this.updateStats(cachedIssues);
            return;
        }

        try {
            // Try to load from API first, fallback to localStorage
            let issues;
            try {
                const response = await api.get('api/issues.php?action=list');
                issues = response.success ? response.issues : [];
            } catch (apiError) {
                console.log('API not available, using local storage');
                issues = storage.get('standwithnepal_issues', []);
            }
            
            // Add sample data if empty
            if (issues.length === 0) {
                issues = this.getSampleIssues();
                storage.set('standwithnepal_issues', issues);
            }
            
            this.issuesData = issues;
            this.cache.set(cacheKey, issues);
            this.displayIssues(this.filterIssues(issues));
            this.updateMapMarkers(issues);
            this.updateStats(issues);
        } catch (error) {
            console.error('Failed to load issues:', error);
            this.showNotification('Failed to load issues', 'error');
        }
    }

    displayIssues(issues) {
        const issuesGrid = document.getElementById('issuesGrid');
        if (!issuesGrid) return;

        if (issues.length === 0) {
            issuesGrid.innerHTML = `
                <div class="no-issues">
                    <i class="fas fa-search fa-3x"></i>
                    <h3>No issues found</h3>
                    <p>Try adjusting your filters or search terms</p>
                    <button class="btn btn-primary" onclick="app.clearAllFilters()">Clear Filters</button>
                </div>
            `;
            return;
        }

        // Use virtual scrolling for large lists
        if (issues.length > 50) {
            if (!this.virtualScroller) {
                this.virtualScroller = new VirtualScroller(issuesGrid, 200, this.renderIssueCard.bind(this));
            }
            this.virtualScroller.setItems(issues);
            return;
        }
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        issues.forEach(issue => {
            const issueCard = new IssueCard(issue, this.currentLocation);
            fragment.appendChild(issueCard.render());
        });
        
        issuesGrid.innerHTML = '';
        issuesGrid.appendChild(fragment);
        
        // Initialize lazy loading for images
        issuesGrid.querySelectorAll('img.lazy').forEach(img => {
            this.lazyLoader.observe(img);
        });
        
        this.updateFilterStats(issues);
    }

    renderIssueCard(issue, index = 0) {
        const distance = this.currentLocation && issue.lat && issue.lng ? 
            this.calculateDistance(this.currentLocation.lat, this.currentLocation.lng, issue.lat, issue.lng) : null;
        
        return `
            <div class="issue-card ${issue.severity}" data-issue-id="${issue.id}" onclick="app.viewIssueDetails('${issue.id}')">
                <div class="issue-header">
                    <div>
                        <h3 class="issue-title">${this.escapeHtml(issue.title)}</h3>
                        <span class="issue-category">${this.getCategoryLabel(issue.category)}</span>
                        <span class="severity-badge severity-${issue.severity}">${issue.severity.toUpperCase()}</span>
                    </div>
                    <span class="status-badge status-${issue.status}">${this.getStatusLabel(issue.status)}</span>
                </div>
                <p class="issue-description">${this.truncateText(this.escapeHtml(issue.description), 120)}</p>
                ${issue.image ? `<img class="lazy issue-image" data-src="${issue.image}" alt="Issue image">` : ''}
                <div class="issue-meta">
                    <div class="issue-location">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${this.escapeHtml(issue.municipality)}, Ward ${issue.ward}</span>
                        ${distance ? `<span class="distance">${distance.toFixed(1)}km away</span>` : ''}
                    </div>
                    <div class="issue-stats">
                        <div class="stat">
                            <i class="fas fa-thumbs-up"></i>
                            <span>${issue.upvotes || 0}</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-clock"></i>
                            <span>${this.formatDate(issue.timestamp)}</span>
                        </div>
                    </div>
                </div>
                <div class="issue-actions">
                    <button class="btn btn-sm btn-secondary upvote-btn" onclick="event.stopPropagation(); app.upvoteIssue('${issue.id}')" ${issue.userUpvoted ? 'disabled' : ''}>
                        <i class="fas fa-thumbs-up"></i> ${issue.userUpvoted ? 'Upvoted' : 'Upvote'}
                    </button>
                    <button class="btn btn-sm btn-secondary share-btn" onclick="event.stopPropagation(); app.shareIssue('${issue.id}')">
                        <i class="fas fa-share"></i> Share
                    </button>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    showNotification(message, type = 'info') {
        this.notificationManager.show(message, type);
    }

    // ... rest of the methods remain similar but optimized
}

// Initialize app when DOM is loaded
let app;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    performanceMonitor.mark('domContentLoaded');
    app = new StandWithNepalApp();
    app.init();
});

// Export for global access (for onclick handlers)
window.app = app;

let map;
let issuesData = [];
let filteredIssues = [];
let currentUser = null;
let currentLocation = null;
const cache = new CacheManager();
const lazyLoader = new LazyLoader();
let virtualScroller = null;

// Initialize Application
function initializeApp() {
    performanceMonitor.mark('appInitStart');
    setupEventListeners();
    loadUserPreferences();
    detectUserLocation();
    initializeMap();
    loadIssues();
    setupCharts();
    setupMobileMenu();
    loadLocationData();
    setupAdvancedFilters();
    initializeNotifications();
    loadTrendingIssues();
    setupQuickActions();
    performanceMonitor.mark('appInitEnd');
    performanceMonitor.measure('appInitTime', 'appInitStart', 'appInitEnd');
}

// Event Listeners
function setupEventListeners() {
    // Modal controls
    const modal = document.getElementById('issueModal');
    const postIssueBtn = document.getElementById('postIssueBtn');
    const reportIssueBtn = document.getElementById('reportIssueBtn');
    const viewIssuesBtn = document.getElementById('viewIssuesBtn');
    const closeBtn = document.querySelector('.close');

    if (postIssueBtn) postIssueBtn.addEventListener('click', openIssueModal);
    if (reportIssueBtn) reportIssueBtn.addEventListener('click', openIssueModal);
    if (viewIssuesBtn) viewIssuesBtn.addEventListener('click', scrollToIssues);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Form submission
    const issueForm = document.getElementById('issueForm');
    if (issueForm) issueForm.addEventListener('submit', handleIssueSubmission);

    // Filters
    const categoryFilter = document.getElementById('categoryFilter');
    const locationFilter = document.getElementById('locationFilter');
    const statusFilter = document.getElementById('statusFilter');

    if (categoryFilter) categoryFilter.addEventListener('change', handleFilterChange);
    if (locationFilter) locationFilter.addEventListener('change', handleFilterChange);
    if (statusFilter) statusFilter.addEventListener('change', handleFilterChange);

    // Location cascading dropdowns
    const province = document.getElementById('province');
    if (province) province.addEventListener('change', handleProvinceChange);

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Advanced search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debouncedSearch);
    }

    // Severity filter
    const severityFilter = document.getElementById('severityFilter');
    if (severityFilter) severityFilter.addEventListener('change', handleFilterChange);

    // Date range filter
    const dateRangeFilter = document.getElementById('dateRangeFilter');
    if (dateRangeFilter) dateRangeFilter.addEventListener('change', handleFilterChange);

    // Smooth scrolling for navigation
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
}

// User Location Detection
function detectUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                updateMapCenter();
                loadNearbyIssues();
            },
            function(error) {
                console.log('Location detection failed:', error);
            }
        );
    }
}

// Enhanced search with debouncing and caching
const debouncedSearch = debounce(function(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length < 2 && query.length > 0) {
        return; // Don't search for single characters
    }
    
    const cacheKey = `search_${query}`;
    const cachedResults = cache.get(cacheKey);
    
    if (cachedResults) {
        displayIssues(cachedResults);
        updateMapMarkers(cachedResults);
        return;
    }
    
    const results = issuesData.filter(issue => 
        issue.title.toLowerCase().includes(query) ||
        issue.description.toLowerCase().includes(query) ||
        issue.municipality.toLowerCase().includes(query)
    );
    
    cache.set(cacheKey, results, 2 * 60 * 1000); // 2 minutes cache
    displayIssues(results);
    updateMapMarkers(results);
}, 300);

// Advanced Filters Setup
function setupAdvancedFilters() {
    // Add severity filter to existing filters section
    const filtersContainer = document.querySelector('.filters');
    if (filtersContainer) {
        const advancedFilters = document.createElement('div');
        advancedFilters.className = 'advanced-filters';
        advancedFilters.innerHTML = `
            <input type="text" id="searchInput" placeholder="Search issues..." class="search-input">
            <select id="severityFilter" class="filter-select">
                <option value="">All Severity</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
            </select>
            <select id="dateRangeFilter" class="filter-select">
                <option value="">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
            </select>
        `;
        filtersContainer.appendChild(advancedFilters);
    }
}

// Enhanced Filter Function
function filterIssues(issues) {
    return issues.filter(issue => {
        const categoryMatch = !currentFilters.category || issue.category === currentFilters.category;
        const locationMatch = !currentFilters.location || issue.district.toLowerCase().includes(currentFilters.location.toLowerCase());
        const statusMatch = !currentFilters.status || issue.status === currentFilters.status;
        const severityMatch = !currentFilters.severity || issue.severity === currentFilters.severity;
        const dateMatch = checkDateRange(issue.timestamp, currentFilters.dateRange);
        
        return categoryMatch && locationMatch && statusMatch && severityMatch && dateMatch;
    });
}

// Date Range Filter
function checkDateRange(timestamp, range) {
    if (!range) return true;
    
    const issueDate = new Date(timestamp);
    const now = new Date();
    
    switch(range) {
        case 'today':
            return issueDate.toDateString() === now.toDateString();
        case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return issueDate >= weekAgo;
        case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return issueDate >= monthAgo;
        case 'year':
            const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            return issueDate >= yearAgo;
        default:
            return true;
    }
}

// Enhanced Filter Change Handler
function handleFilterChange() {
    currentFilters.category = document.getElementById('categoryFilter')?.value || '';
    currentFilters.location = document.getElementById('locationFilter')?.value || '';
    currentFilters.status = document.getElementById('statusFilter')?.value || '';
    currentFilters.severity = document.getElementById('severityFilter')?.value || '';
    currentFilters.dateRange = document.getElementById('dateRangeFilter')?.value || '';
    
    const filteredIssues = filterIssues(issuesData);
    displayIssues(filteredIssues);
    updateMapMarkers(filteredIssues);
    updateFilterStats(filteredIssues);
}

// Filter Statistics
function updateFilterStats(filteredIssues) {
    const statsContainer = document.querySelector('.filter-stats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <span class="filter-count">Showing ${filteredIssues.length} of ${issuesData.length} issues</span>
        `;
    }
}

// User Preferences
function loadUserPreferences() {
    userPreferences = JSON.parse(localStorage.getItem('user_preferences') || '{}');
    applyUserPreferences();
}

function applyUserPreferences() {
    // Apply theme preference
    if (userPreferences.theme === 'dark') {
        document.body.classList.add('dark-theme');
    }
    
    // Apply language preference
    if (userPreferences.language) {
        document.documentElement.lang = userPreferences.language;
    }
}

// Notifications System
function initializeNotifications() {
    // Check for notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Load unread notifications count
    updateNotificationBadge();
}

function updateNotificationBadge() {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        // In a real app, this would fetch from API
        const unreadCount = Math.floor(Math.random() * 10);
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
}

// Enhanced Map Functions
function updateMapCenter() {
    if (map && currentLocation) {
        map.setView([currentLocation.lat, currentLocation.lng], 12);
    }
}

function loadNearbyIssues() {
    if (!currentLocation) return;
    
    // Filter issues within 10km radius (simplified)
    const nearbyIssues = issuesData.filter(issue => {
        if (!issue.lat || !issue.lng) return false;
        const distance = calculateDistance(
            currentLocation.lat, currentLocation.lng,
            issue.lat, issue.lng
        );
        return distance <= 10; // 10km radius
    });
    
    displayIssues(nearbyIssues);
    updateMapMarkers(nearbyIssues);
}

// Distance calculation (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// Enhanced issue loading with caching
async function loadIssues() {
    const cacheKey = 'issues_list';
    const cachedIssues = cache.get(cacheKey);
    
    if (cachedIssues) {
        issuesData = cachedIssues;
        displayIssues(issuesData);
        return;
    }
    
    try {
        showLoading();
        
        // Simulate API call - replace with actual API
        const response = await fetch('api/issues.php?action=list');
        const data = await response.json();
        
        if (data.success) {
            issuesData = data.issues || generateSampleIssues();
            cache.set(cacheKey, issuesData);
        } else {
            issuesData = generateSampleIssues();
        }
        
        displayIssues(issuesData);
        updateIssueStats();
        
    } catch (error) {
        console.error('Error loading issues:', error);
        issuesData = generateSampleIssues();
        displayIssues(issuesData);
    } finally {
        hideLoading();
    }
}

// Optimized issue display with virtual scrolling
function displayIssues(issues) {
    const issuesGrid = document.getElementById('issuesGrid');
    if (!issuesGrid) return;

    if (issues.length === 0) {
        issuesGrid.innerHTML = `
            <div class="no-issues">
                <i class="fas fa-search fa-3x"></i>
                <h3>No Issues Found</h3>
                <p>Try adjusting your filters or be the first to report an issue in this area.</p>
                <button class="btn btn-primary" onclick="openIssueModal()">Report First Issue</button>
            </div>
        `;
        return;
    }

    // Use virtual scrolling for large lists
    if (issues.length > 50) {
        if (!virtualScroller) {
            virtualScroller = new VirtualScroller(issuesGrid, 200, renderIssueCard);
        }
        virtualScroller.setItems(issues);
        return;
    }
    
    // Regular rendering for smaller lists
    const fragment = document.createDocumentFragment();
    
    issues.forEach(issue => {
        const cardElement = document.createElement('div');
        cardElement.innerHTML = renderIssueCard(issue);
        fragment.appendChild(cardElement.firstElementChild);
    });
    
    issuesGrid.innerHTML = '';
    issuesGrid.appendChild(fragment);
    
    // Initialize lazy loading for images
    issuesGrid.querySelectorAll('img.lazy').forEach(img => {
        lazyLoader.observe(img);
    });
}

// Optimized issue card rendering
function renderIssueCard(issue, index = 0) {
    const distance = currentLocation && issue.lat && issue.lng ? 
        calculateDistance(currentLocation.lat, currentLocation.lng, issue.lat, issue.lng) : null;
    
    return `
        <div class="issue-card ${issue.severity}" data-issue-id="${issue.id}" onclick="openIssueDetail('${issue.id}')">
            <div class="issue-header">
                <div>
                    <h3 class="issue-title">${escapeHtml(issue.title)}</h3>
                    <span class="issue-category">${getCategoryLabel(issue.category)}</span>
                    <span class="severity-badge severity-${issue.severity}">${issue.severity.toUpperCase()}</span>
                </div>
                <span class="status-badge status-${issue.status}">${getStatusLabel(issue.status)}</span>
            </div>
            <p class="issue-description">${truncateText(escapeHtml(issue.description), 120)}</p>
            ${issue.image ? `<img class="lazy issue-image" data-src="${issue.image}" alt="Issue image">` : ''}
            <div class="issue-meta">
                <div class="issue-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${escapeHtml(issue.municipality)}, Ward ${issue.ward}</span>
                    ${distance ? `<span class="distance">${distance.toFixed(1)}km away</span>` : ''}
                </div>
                <div class="issue-stats">
                    <div class="stat">
                        <i class="fas fa-thumbs-up"></i>
                        <span>${issue.upvotes || 0}</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-clock"></i>
                        <span>${formatDate(issue.timestamp)}</span>
                    </div>
                </div>
            </div>
            <div class="issue-actions">
                <button class="btn btn-sm btn-secondary upvote-btn" onclick="event.stopPropagation(); upvoteIssue('${issue.id}')" ${issue.userUpvoted ? 'disabled' : ''}>
                    <i class="fas fa-thumbs-up"></i> ${issue.userUpvoted ? 'Upvoted' : 'Upvote'}
                </button>
                <button class="btn btn-sm btn-secondary share-btn" onclick="event.stopPropagation(); shareIssue('${issue.id}')">
                    <i class="fas fa-share"></i> Share
                </button>
            </div>
        </div>
    `;
}

// Mobile Menu Setup
function setupMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking on a link
        document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        }));
    }
}

// Modal Functions
function openIssueModal() {
    const modal = document.getElementById('issueModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    const modal = document.getElementById('issueModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function scrollToIssues() {
    const issuesSection = document.getElementById('issues');
    if (issuesSection) {
        issuesSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Issue Submission
function handleIssueSubmission(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const issueData = {
        title: formData.get('title'),
        category: formData.get('category'),
        description: formData.get('description'),
        province: formData.get('province'),
        district: formData.get('district'),
        municipality: formData.get('municipality'),
        ward: formData.get('ward'),
        severity: formData.get('severity'),
        anonymous: formData.get('anonymous') === 'on',
        media: formData.get('media'),
        timestamp: new Date().toISOString(),
        status: 'new',
        upvotes: 0,
        id: generateId()
    };

    // Simulate API call
    submitIssue(issueData);
}

function submitIssue(issueData) {
    // Show loading state
    const submitBtn = document.querySelector('#issueForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    // Simulate API delay
    setTimeout(() => {
        // Add to local storage for demo
        let issues = JSON.parse(localStorage.getItem('standwithnepal_issues') || '[]');
        issues.unshift(issueData);
        localStorage.setItem('standwithnepal_issues', JSON.stringify(issues));

        // Reset form and close modal
        document.getElementById('issueForm').reset();
        closeModal();
        
        // Show success message
        showNotification('Issue submitted successfully!', 'success');
        
        // Reload issues
        loadIssues();
        
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }, 1500);
}

function getSampleIssues() {
    return [
        {
            id: '1',
            title: 'Broken Street Light in Thamel',
            category: 'electricity',
            description: 'The street light near Kathmandu Guest House has been broken for 2 weeks, making the area unsafe at night.',
            province: '3',
            district: 'Kathmandu',
            municipality: 'Kathmandu Metropolitan',
            ward: '26',
            severity: 'high',
            status: 'new',
            upvotes: 15,
            timestamp: '2025-01-15T10:30:00Z',
            anonymous: false,
            lat: 27.7172,
            lng: 85.3240
        },
        {
            id: '2',
            title: 'Water Supply Issues in Lalitpur',
            category: 'water',
            description: 'No water supply for the past 3 days in Ward 5. Residents are facing severe difficulties.',
            province: '3',
            district: 'Lalitpur',
            municipality: 'Lalitpur Metropolitan',
            ward: '5',
            severity: 'urgent',
            status: 'acknowledged',
            upvotes: 28,
            timestamp: '2025-01-14T08:15:00Z',
            anonymous: true,
            lat: 27.6588,
            lng: 85.3247
        },
        {
            id: '3',
            title: 'Road Damage in Pokhara',
            category: 'road',
            description: 'Large potholes on the main road causing traffic issues and vehicle damage.',
            province: '4',
            district: 'Kaski',
            municipality: 'Pokhara Metropolitan',
            ward: '10',
            severity: 'medium',
            status: 'in-progress',
            upvotes: 12,
            timestamp: '2025-01-13T14:20:00Z',
            anonymous: false,
            lat: 28.2096,
            lng: 83.9856
        }
    ];
}

// Clear All Filters
function clearAllFilters() {
    document.getElementById('categoryFilter').value = '';
    document.getElementById('locationFilter').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('severityFilter').value = '';
    document.getElementById('dateRangeFilter').value = '';
    document.getElementById('searchInput').value = '';
    
    currentFilters = {
        category: '',
        location: '',
        status: '',
        severity: '',
        dateRange: ''
    };
    
    displayIssues(issuesData);
    updateMapMarkers(issuesData);
}

// Issue Actions
function upvoteIssue(issueId) {
    const issue = issuesData.find(i => i.id === issueId);
    if (issue) {
        issue.upvotes = (issue.upvotes || 0) + 1;
        localStorage.setItem('standwithnepal_issues', JSON.stringify(issuesData));
        showNotification('Issue upvoted successfully!', 'success');
        loadIssues(); // Refresh display
    }
}

function shareIssue(issueId) {
    const issue = issuesData.find(i => i.id === issueId);
    if (issue && navigator.share) {
        navigator.share({
            title: issue.title,
            text: issue.description,
            url: window.location.href + '#issue-' + issueId
        });
    } else {
        // Fallback: copy to clipboard
        const shareUrl = window.location.href + '#issue-' + issueId;
        navigator.clipboard.writeText(shareUrl).then(() => {
            showNotification('Issue link copied to clipboard!', 'success');
        });
    }
}
// Filter Functions
function handleFilterChange() {
    currentFilters.category = document.getElementById('categoryFilter')?.value || '';
    currentFilters.location = document.getElementById('locationFilter')?.value || '';
    currentFilters.status = document.getElementById('statusFilter')?.value || '';
    
    const filteredIssues = filterIssues(issuesData);
    displayIssues(filteredIssues);
    updateMapMarkers(filteredIssues);
}

function filterIssues(issues) {
    return issues.filter(issue => {
        const categoryMatch = !currentFilters.category || issue.category === currentFilters.category;
        const locationMatch = !currentFilters.location || issue.district.toLowerCase().includes(currentFilters.location.toLowerCase());
        const statusMatch = !currentFilters.status || issue.status === currentFilters.status;
        
        return categoryMatch && locationMatch && statusMatch;
    });
}

// Map Functions
function initializeMap() {
    const mapElement = document.getElementById('issuesMap');
    if (!mapElement) return;

    // Initialize Leaflet map centered on Nepal
    map = L.map('issuesMap').setView([28.3949, 84.1240], 7);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function updateMapMarkers(issues) {
    if (!map) return;

    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    // Add markers for each issue
    issues.forEach(issue => {
        if (issue.lat && issue.lng) {
            const marker = L.marker([issue.lat, issue.lng]).addTo(map);
            
            const popupContent = `
                <div class="map-popup">
                    <h4>${issue.title}</h4>
                    <p><strong>Category:</strong> ${getCategoryLabel(issue.category)}</p>
                    <p><strong>Status:</strong> ${getStatusLabel(issue.status)}</p>
                    <p><strong>Location:</strong> ${issue.municipality}, Ward ${issue.ward}</p>
                    <p><strong>Upvotes:</strong> ${issue.upvotes}</p>
                    <button onclick="viewIssueDetails('${issue.id}')" class="btn btn-primary btn-sm">View Details</button>
                </div>
            `;
            
            marker.bindPopup(popupContent);
        }
    });
}

// Location Data Functions
function loadLocationData() {
    // This would typically load from an API
    const locationData = {
        '3': { // Bagmati Province
            name: 'Bagmati Province',
            districts: {
                'Kathmandu': {
                    municipalities: ['Kathmandu Metropolitan', 'Kirtipur Municipality'],
                    wards: Array.from({length: 32}, (_, i) => i + 1)
                },
                'Lalitpur': {
                    municipalities: ['Lalitpur Metropolitan', 'Godawari Municipality'],
                    wards: Array.from({length: 29}, (_, i) => i + 1)
                }
            }
        },
        '4': { // Gandaki Province
            name: 'Gandaki Province',
            districts: {
                'Kaski': {
                    municipalities: ['Pokhara Metropolitan', 'Annapurna Rural Municipality'],
                    wards: Array.from({length: 33}, (_, i) => i + 1)
                }
            }
        }
    };

    window.locationData = locationData;
}

function handleProvinceChange() {
    const provinceSelect = document.getElementById('province');
    const districtSelect = document.getElementById('district');
    const municipalitySelect = document.getElementById('municipality');
    const wardSelect = document.getElementById('ward');

    if (!provinceSelect || !districtSelect) return;

    const selectedProvince = provinceSelect.value;
    
    // Clear dependent dropdowns
    districtSelect.innerHTML = '<option value="">Select District</option>';
    municipalitySelect.innerHTML = '<option value="">Select Municipality</option>';
    wardSelect.innerHTML = '<option value="">Select Ward</option>';

    if (selectedProvince && window.locationData[selectedProvince]) {
        const districts = window.locationData[selectedProvince].districts;
        Object.keys(districts).forEach(district => {
            const option = document.createElement('option');
            option.value = district;
            option.textContent = district;
            districtSelect.appendChild(option);
        });
    }

    districtSelect.addEventListener('change', handleDistrictChange);
}

function handleDistrictChange() {
    const provinceSelect = document.getElementById('province');
    const districtSelect = document.getElementById('district');
    const municipalitySelect = document.getElementById('municipality');
    const wardSelect = document.getElementById('ward');

    const selectedProvince = provinceSelect.value;
    const selectedDistrict = districtSelect.value;

    municipalitySelect.innerHTML = '<option value="">Select Municipality</option>';
    wardSelect.innerHTML = '<option value="">Select Ward</option>';

    if (selectedProvince && selectedDistrict && window.locationData[selectedProvince]) {
        const district = window.locationData[selectedProvince].districts[selectedDistrict];
        if (district) {
            district.municipalities.forEach(municipality => {
                const option = document.createElement('option');
                option.value = municipality;
                option.textContent = municipality;
                municipalitySelect.appendChild(option);
            });

            // Populate wards
            district.wards.forEach(ward => {
                const option = document.createElement('option');
                option.value = ward;
                option.textContent = ward;
                wardSelect.appendChild(option);
            });
        }
    }
}

// Chart Functions
function setupCharts() {
    setupCategoryChart();
    setupTrendChart();
    setupRegionChart();
    setupResponseChart();
}

function setupCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Road & Infrastructure', 'Electricity', 'Water Supply', 'Healthcare', 'Corruption', 'Education'],
            datasets: [{
                data: [35, 20, 25, 8, 7, 5],
                backgroundColor: [
                    '#2c5aa0',
                    '#f59e0b',
                    '#10b981',
                    '#ef4444',
                    '#8b5cf6',
                    '#06b6d4'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function setupTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Issues Reported',
                data: [65, 78, 90, 81, 95, 102],
                borderColor: '#2c5aa0',
                backgroundColor: 'rgba(44, 90, 160, 0.1)',
                tension: 0.4
            }, {
                label: 'Issues Resolved',
                data: [45, 52, 68, 73, 82, 89],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function setupRegionChart() {
    const ctx = document.getElementById('regionChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Kathmandu', 'Pokhara', 'Chitwan', 'Lalitpur', 'Bhaktapur'],
            datasets: [{
                label: 'Issues Count',
                data: [120, 85, 65, 78, 45],
                backgroundColor: '#2c5aa0'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function setupResponseChart() {
    const ctx = document.getElementById('responseChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Response Time', 'Resolution Rate', 'Citizen Satisfaction', 'Transparency', 'Communication'],
            datasets: [{
                label: 'Performance',
                data: [75, 82, 68, 90, 78],
                borderColor: '#2c5aa0',
                backgroundColor: 'rgba(44, 90, 160, 0.2)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Utility Functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getCategoryLabel(category) {
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
}

function getStatusLabel(status) {
    const labels = {
        'new': 'New',
        'acknowledged': 'Acknowledged',
        'in-progress': 'In Progress',
        'resolved': 'Resolved'
    };
    return labels[status] || status;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
}

function updateStats(issues) {
    const totalIssues = document.getElementById('totalIssues');
    const resolvedIssues = document.getElementById('resolvedIssues');
    const activeUsers = document.getElementById('activeUsers');

    if (totalIssues) totalIssues.textContent = issues.length;
    if (resolvedIssues) {
        const resolved = issues.filter(issue => issue.status === 'resolved').length;
        resolvedIssues.textContent = resolved;
    }
    if (activeUsers) activeUsers.textContent = '3,456'; // Static for demo
}

function viewIssueDetails(issueId) {
    // This would typically navigate to a detailed view or open a modal
    console.log('Viewing issue details for:', issueId);
    showNotification('Issue details would open here', 'info');
}

function showNotification(message, type = 'info') {
    // Create notification element
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
            }
            .notification-success { background: #10b981; }
            .notification-error { background: #ef4444; }
            .notification-info { background: #2c5aa0; }
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
            }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    // Add to page
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
}

// Trending Issues
function loadTrendingIssues() {
    // Generate trending issues based on upvotes and recency
    const trendingIssues = issuesData
        .sort((a, b) => {
            const scoreA = (a.upvotes || 0) * 2 + Math.max(0, 7 - Math.floor((Date.now() - new Date(a.timestamp)) / (1000 * 60 * 60 * 24)));
            const scoreB = (b.upvotes || 0) * 2 + Math.max(0, 7 - Math.floor((Date.now() - new Date(b.timestamp)) / (1000 * 60 * 60 * 24)));
            return scoreB - scoreA;
        })
        .slice(0, 6);
    
    displayTrendingIssues(trendingIssues);
}

function displayTrendingIssues(issues) {
    const container = document.getElementById('trendingIssues');
    if (!container) return;

    container.innerHTML = issues.map(issue => `
        <div class="trending-issue-card" onclick="viewIssueDetails('${issue.id}')">
            <div class="trending-issue-title">${issue.title}</div>
            <div class="trending-issue-meta">
                <span>${issue.municipality}</span>
                <div class="trending-stats">
                    <div class="trending-stat">
                        <i class="fas fa-thumbs-up"></i>
                        <span>${issue.upvotes || 0}</span>
                    </div>
                    <div class="trending-stat">
                        <i class="fas fa-clock"></i>
                        <span>${formatDate(issue.timestamp)}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Quick Actions
function setupQuickActions() {
    const quickReportBtn = document.getElementById('quickReportBtn');
    if (quickReportBtn) {
        quickReportBtn.addEventListener('click', openIssueModal);
    }
}

// Enhanced Issue Details Modal
function viewIssueDetails(issueId) {
    const issue = issuesData.find(i => i.id === issueId);
    if (!issue) return;

    // Create detailed modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content large">
            <span class="close">&times;</span>
            <div class="issue-detail-header">
                <h2>${issue.title}</h2>
                <span class="status-badge status-${issue.status}">${getStatusLabel(issue.status)}</span>
            </div>
            <div class="issue-detail-content">
                <div class="issue-info">
                    <div><strong>Category:</strong> ${getCategoryLabel(issue.category)}</div>
                    <div><strong>Location:</strong> ${issue.municipality}, Ward ${issue.ward}</div>
                    <div><strong>Severity:</strong> ${issue.severity}</div>
                    <div><strong>Reported:</strong> ${formatDate(issue.timestamp)}</div>
                    <div><strong>Upvotes:</strong> ${issue.upvotes || 0}</div>
                </div>
                <div class="issue-description">
                    <h4>Description</h4>
                    <p>${issue.description}</p>
                </div>
                <div class="issue-actions">
                    <button class="btn btn-primary" onclick="upvoteIssue('${issue.id}'); this.closest('.modal').remove();">
                        <i class="fas fa-thumbs-up"></i> Upvote
                    </button>
                    <button class="btn btn-secondary" onclick="shareIssue('${issue.id}')">
                        <i class="fas fa-share"></i> Share
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Close modal functionality
    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', () => {
        modal.remove();
        document.body.style.overflow = 'auto';
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            document.body.style.overflow = 'auto';
        }
    });
}

// Enhanced Loading States
function showLoading(container) {
    if (container) {
        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading...</p>
            </div>
        `;
    }
}

function hideLoading(container) {
    const loading = container?.querySelector('.loading');
    if (loading) {
        loading.remove();
    }
}

// Enhanced Error Handling
function showError(container, message) {
    if (container) {
        container.innerHTML = `
            <div class="message error">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
            </div>
        `;
    }
}

// Performance Monitoring
function trackPerformance(action, startTime) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`${action} took ${duration.toFixed(2)} milliseconds`);
}

// Accessibility Enhancements
function enhanceAccessibility() {
    // Add keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.querySelector('.modal[style*="block"]');
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        }
    });

    // Add focus management
    const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
        const firstFocusable = modal.querySelector(focusableElements);
        const focusableContent = modal.querySelectorAll(focusableElements);
        const lastFocusable = focusableContent[focusableContent.length - 1];

        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        e.preventDefault();
                    }
                }
            }
        });
    });
}