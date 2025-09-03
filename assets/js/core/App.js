// Core Application Class with Advanced Optimizations
import { performance, dom, validation, api, storage, dateUtils, locationUtils, CONSTANTS } from '../utils.js';
import { IssueCard } from '../components/IssueCard.js';
import { NotificationManager } from '../components/NotificationManager.js';
import { LoadingManager } from '../components/LoadingManager.js';

export class StandWithNepalApp {
    constructor() {
        this.state = {
            issues: [],
            filters: {},
            currentLocation: null,
            user: null,
            cache: new Map(),
            observers: new Map()
        };
        
        this.components = {
            notifications: new NotificationManager(),
            loading: new LoadingManager()
        };
        
        this.init();
    }

    async init() {
        await this.setupPerformanceMonitoring();
        this.setupEventListeners();
        this.setupIntersectionObservers();
        this.setupServiceWorker();
        await this.loadInitialData();
        this.setupVirtualScrolling();
        this.setupAdvancedCaching();
    }

    // Performance Monitoring
    async setupPerformanceMonitoring() {
        if ('performance' in window) {
            // Monitor Core Web Vitals
            this.monitorCoreWebVitals();
            
            // Track custom metrics
            performance.mark('app-init-start');
            
            // Monitor memory usage
            if ('memory' in performance) {
                setInterval(() => {
                    this.trackMemoryUsage();
                }, 30000);
            }
        }
    }

    monitorCoreWebVitals() {
        // Largest Contentful Paint
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            console.log('LCP:', lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach(entry => {
                console.log('FID:', entry.processingStart - entry.startTime);
            });
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift
        new PerformanceObserver((list) => {
            let clsValue = 0;
            const entries = list.getEntries();
            entries.forEach(entry => {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                }
            });
            console.log('CLS:', clsValue);
        }).observe({ entryTypes: ['layout-shift'] });
    }

    trackMemoryUsage() {
        if ('memory' in performance) {
            const memory = performance.memory;
            const usage = {
                used: Math.round(memory.usedJSHeapSize / 1048576),
                total: Math.round(memory.totalJSHeapSize / 1048576),
                limit: Math.round(memory.jsHeapSizeLimit / 1048576)
            };
            
            if (usage.used > usage.limit * 0.8) {
                console.warn('High memory usage detected:', usage);
                this.optimizeMemory();
            }
        }
    }

    optimizeMemory() {
        // Clear old cache entries
        this.state.cache.clear();
        
        // Remove unused DOM elements
        this.cleanupDOM();
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }

    // Advanced Virtual Scrolling
    setupVirtualScrolling() {
        const container = document.getElementById('issuesGrid');
        if (!container) return;

        const itemHeight = 400; // Estimated issue card height
        const containerHeight = container.clientHeight;
        const visibleItems = Math.ceil(containerHeight / itemHeight) + 2; // Buffer

        let startIndex = 0;
        let endIndex = visibleItems;

        const virtualScroll = performance.throttle(() => {
            const scrollTop = container.scrollTop;
            const newStartIndex = Math.floor(scrollTop / itemHeight);
            const newEndIndex = Math.min(newStartIndex + visibleItems, this.state.issues.length);

            if (newStartIndex !== startIndex || newEndIndex !== endIndex) {
                startIndex = newStartIndex;
                endIndex = newEndIndex;
                this.renderVisibleIssues(startIndex, endIndex);
            }
        }, 16); // 60fps

        container.addEventListener('scroll', virtualScroll, { passive: true });
    }

    renderVisibleIssues(start, end) {
        const container = document.getElementById('issuesGrid');
        if (!container) return;

        const fragment = document.createDocumentFragment();
        const visibleIssues = this.state.issues.slice(start, end);

        // Create spacer for items above viewport
        if (start > 0) {
            const topSpacer = dom.createElement('div');
            topSpacer.style.height = `${start * 400}px`;
            fragment.appendChild(topSpacer);
        }

        // Render visible items
        visibleIssues.forEach(issue => {
            const issueCard = new IssueCard(issue, this.state.currentLocation);
            fragment.appendChild(issueCard.render());
        });

        // Create spacer for items below viewport
        const remaining = this.state.issues.length - end;
        if (remaining > 0) {
            const bottomSpacer = dom.createElement('div');
            bottomSpacer.style.height = `${remaining * 400}px`;
            fragment.appendChild(bottomSpacer);
        }

        container.innerHTML = '';
        container.appendChild(fragment);
    }

    // Advanced Caching System
    setupAdvancedCaching() {
        this.cache = {
            memory: new Map(),
            indexedDB: null,
            
            async init() {
                if ('indexedDB' in window) {
                    this.indexedDB = await this.openIndexedDB();
                }
            },

            async openIndexedDB() {
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open('StandWithNepalCache', 1);
                    
                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => resolve(request.result);
                    
                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;
                        if (!db.objectStoreNames.contains('issues')) {
                            const store = db.createObjectStore('issues', { keyPath: 'id' });
                            store.createIndex('timestamp', 'timestamp');
                            store.createIndex('category', 'category');
                        }
                    };
                });
            },

            async get(key) {
                // Try memory cache first
                if (this.memory.has(key)) {
                    const cached = this.memory.get(key);
                    if (Date.now() - cached.timestamp < cached.ttl) {
                        return cached.data;
                    }
                    this.memory.delete(key);
                }

                // Try IndexedDB
                if (this.indexedDB) {
                    try {
                        const transaction = this.indexedDB.transaction(['issues'], 'readonly');
                        const store = transaction.objectStore('issues');
                        const request = store.get(key);
                        
                        return new Promise((resolve) => {
                            request.onsuccess = () => {
                                const result = request.result;
                                if (result && Date.now() - result.timestamp < result.ttl) {
                                    resolve(result.data);
                                } else {
                                    resolve(null);
                                }
                            };
                            request.onerror = () => resolve(null);
                        });
                    } catch (error) {
                        console.warn('IndexedDB error:', error);
                    }
                }

                return null;
            },

            async set(key, data, ttl = 300000) { // 5 minutes default
                const cacheEntry = {
                    data,
                    timestamp: Date.now(),
                    ttl
                };

                // Store in memory cache
                this.memory.set(key, cacheEntry);

                // Store in IndexedDB
                if (this.indexedDB) {
                    try {
                        const transaction = this.indexedDB.transaction(['issues'], 'readwrite');
                        const store = transaction.objectStore('issues');
                        store.put({ id: key, ...cacheEntry });
                    } catch (error) {
                        console.warn('IndexedDB write error:', error);
                    }
                }

                // Limit memory cache size
                if (this.memory.size > 100) {
                    const oldestKey = this.memory.keys().next().value;
                    this.memory.delete(oldestKey);
                }
            }
        };

        this.cache.init();
    }

    // Intersection Observer for Lazy Loading
    setupIntersectionObservers() {
        // Lazy load images
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    imageObserver.unobserve(img);
                }
            });
        }, { rootMargin: '50px' });

        this.state.observers.set('images', imageObserver);

        // Infinite scroll
        const scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadMoreIssues();
                }
            });
        }, { rootMargin: '100px' });

        this.state.observers.set('scroll', scrollObserver);
    }

    // Advanced Issue Loading with Caching
    async loadIssues(useCache = true) {
        const cacheKey = `issues_${JSON.stringify(this.state.filters)}`;
        
        if (useCache) {
            const cached = await this.cache.get(cacheKey);
            if (cached) {
                this.state.issues = cached;
                this.renderIssues();
                return;
            }
        }

        try {
            this.components.loading.show(document.getElementById('issuesGrid'), 'Loading issues...');
            
            const params = new URLSearchParams({
                action: 'list',
                limit: 50,
                offset: this.state.issues.length,
                ...this.state.filters
            });

            const response = await api.get(`${CONSTANTS.API_ENDPOINTS.ISSUES}?${params}`);
            
            if (response.success) {
                this.state.issues = [...this.state.issues, ...response.issues];
                await this.cache.set(cacheKey, this.state.issues);
                this.renderIssues();
            }
        } catch (error) {
            console.error('Failed to load issues:', error);
            this.components.notifications.show('Failed to load issues', 'error');
        } finally {
            this.components.loading.hide(document.getElementById('issuesGrid'));
        }
    }

    // Optimized Rendering with DocumentFragment
    renderIssues() {
        const container = document.getElementById('issuesGrid');
        if (!container) return;

        // Use virtual scrolling for large lists
        if (this.state.issues.length > 50) {
            this.renderVisibleIssues(0, 50);
            return;
        }

        const fragment = document.createDocumentFragment();
        
        this.state.issues.forEach(issue => {
            const issueCard = new IssueCard(issue, this.state.currentLocation);
            fragment.appendChild(issueCard.render());
        });

        // Batch DOM update
        requestAnimationFrame(() => {
            container.innerHTML = '';
            container.appendChild(fragment);
            this.setupLazyLoading();
        });
    }

    setupLazyLoading() {
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = this.state.observers.get('images');
        
        images.forEach(img => {
            imageObserver.observe(img);
        });
    }

    // Service Worker Registration
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration);
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.components.notifications.show(
                                'New version available! Refresh to update.',
                                'info'
                            );
                        }
                    });
                });
            } catch (error) {
                console.warn('Service Worker registration failed:', error);
            }
        }
    }

    // Advanced Search with Fuzzy Matching
    setupAdvancedSearch() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;

        const debouncedSearch = performance.debounce(async (query) => {
            if (query.length < 2) {
                this.state.filters.search = '';
                await this.loadIssues();
                return;
            }

            this.state.filters.search = query;
            
            // Client-side fuzzy search for cached results
            const fuzzyResults = this.fuzzySearch(query, this.state.issues);
            
            if (fuzzyResults.length > 0) {
                this.renderFilteredIssues(fuzzyResults);
            } else {
                // Server-side search
                await this.loadIssues(false);
            }
        }, 300);

        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });
    }

    fuzzySearch(query, items) {
        const threshold = 0.6;
        return items.filter(item => {
            const titleScore = this.calculateSimilarity(query.toLowerCase(), item.title.toLowerCase());
            const descScore = this.calculateSimilarity(query.toLowerCase(), item.description.toLowerCase());
            return Math.max(titleScore, descScore) >= threshold;
        });
    }

    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
        
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + cost
                );
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Advanced Geolocation with Caching
    async getCurrentLocation() {
        const cached = storage.get('user_location');
        if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
            return cached.location;
        }

        try {
            const position = await locationUtils.getCurrentPosition();
            const location = { lat: position.lat, lng: position.lng };
            
            storage.set('user_location', {
                location,
                timestamp: Date.now()
            });
            
            return location;
        } catch (error) {
            console.warn('Geolocation failed:', error);
            return null;
        }
    }

    // Optimized Event Delegation
    setupEventListeners() {
        // Use event delegation for better performance
        document.addEventListener('click', this.handleGlobalClick.bind(this));
        document.addEventListener('submit', this.handleGlobalSubmit.bind(this));
        
        // Optimized resize handler
        window.addEventListener('resize', performance.throttle(() => {
            this.handleResize();
        }, 250), { passive: true });

        // Optimized scroll handler
        window.addEventListener('scroll', performance.throttle(() => {
            this.handleScroll();
        }, 16), { passive: true });

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    }

    handleGlobalClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;

        switch (action) {
            case 'upvote':
                this.handleUpvote(id);
                break;
            case 'share':
                this.handleShare(id);
                break;
            case 'view-details':
                this.viewIssueDetails(id);
                break;
            case 'report-issue':
                this.openIssueModal();
                break;
        }
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            this.closeAllModals();
        }
        
        // Ctrl/Cmd + Enter to submit forms
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const activeForm = document.querySelector('form:focus-within');
            if (activeForm) {
                activeForm.requestSubmit();
            }
        }
    }

    // Advanced Error Handling
    setupErrorHandling() {
        window.addEventListener('error', (e) => {
            this.logError('JavaScript Error', e.error);
        });

        window.addEventListener('unhandledrejection', (e) => {
            this.logError('Unhandled Promise Rejection', e.reason);
        });
    }

    logError(type, error) {
        const errorData = {
            type,
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Send to logging service
        api.post('/api/log-error.php', errorData).catch(() => {
            // Fallback to console
            console.error('Error logging failed:', errorData);
        });
    }

    // Memory Management
    cleanupDOM() {
        // Remove unused elements
        const unusedElements = document.querySelectorAll('.removed, .hidden');
        unusedElements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });

        // Clear event listeners on removed elements
        this.state.observers.forEach(observer => {
            observer.disconnect();
        });
    }

    // Performance Optimization
    optimizePerformance() {
        // Preload critical resources
        this.preloadCriticalResources();
        
        // Optimize images
        this.optimizeImages();
        
        // Minimize reflows
        this.batchDOMUpdates();
    }

    preloadCriticalResources() {
        const criticalResources = [
            '/assets/css/style.css',
            '/assets/js/main.js',
            '/api/issues.php?action=list&limit=10'
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource;
            link.as = resource.endsWith('.css') ? 'style' : 
                     resource.endsWith('.js') ? 'script' : 'fetch';
            document.head.appendChild(link);
        });
    }

    optimizeImages() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            // Add loading="lazy" for better performance
            if (!img.hasAttribute('loading')) {
                img.loading = 'lazy';
            }
            
            // Add proper alt text if missing
            if (!img.alt) {
                img.alt = 'Image';
            }
        });
    }

    batchDOMUpdates() {
        let pendingUpdates = [];
        
        this.scheduleDOMUpdate = (updateFn) => {
            pendingUpdates.push(updateFn);
            
            if (pendingUpdates.length === 1) {
                requestAnimationFrame(() => {
                    pendingUpdates.forEach(fn => fn());
                    pendingUpdates = [];
                });
            }
        };
    }

    // Cleanup on page unload
    cleanup() {
        // Clear intervals and timeouts
        this.state.observers.forEach(observer => observer.disconnect());
        
        // Clear cache
        this.state.cache.clear();
        
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('scroll', this.handleScroll);
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.standWithNepalApp = new StandWithNepalApp();
    });
} else {
    window.standWithNepalApp = new StandWithNepalApp();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.standWithNepalApp) {
        window.standWithNepalApp.cleanup();
    }
});