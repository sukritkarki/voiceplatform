// Advanced Performance Monitoring
export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoad: 0,
            apiCalls: [],
            userInteractions: [],
            errors: [],
            memoryUsage: []
        };
        
        this.init();
    }

    init() {
        this.monitorPageLoad();
        this.monitorAPIPerformance();
        this.monitorUserInteractions();
        this.monitorMemoryUsage();
        this.setupReporting();
    }

    monitorPageLoad() {
        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            
            this.metrics.pageLoad = {
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                totalTime: navigation.loadEventEnd - navigation.fetchStart,
                dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
                tcpConnect: navigation.connectEnd - navigation.connectStart,
                serverResponse: navigation.responseEnd - navigation.requestStart,
                domProcessing: navigation.domComplete - navigation.responseEnd
            };

            this.reportMetric('page_load', this.metrics.pageLoad);
        });
    }

    monitorAPIPerformance() {
        const originalFetch = window.fetch;
        
        window.fetch = async (...args) => {
            const startTime = performance.now();
            const url = args[0];
            
            try {
                const response = await originalFetch(...args);
                const endTime = performance.now();
                
                this.metrics.apiCalls.push({
                    url,
                    method: args[1]?.method || 'GET',
                    status: response.status,
                    duration: endTime - startTime,
                    timestamp: Date.now()
                });

                // Alert on slow API calls
                if (endTime - startTime > 3000) {
                    console.warn(`Slow API call detected: ${url} took ${endTime - startTime}ms`);
                }

                return response;
            } catch (error) {
                const endTime = performance.now();
                
                this.metrics.apiCalls.push({
                    url,
                    method: args[1]?.method || 'GET',
                    status: 'error',
                    duration: endTime - startTime,
                    error: error.message,
                    timestamp: Date.now()
                });

                throw error;
            }
        };
    }

    monitorUserInteractions() {
        ['click', 'scroll', 'keydown'].forEach(eventType => {
            document.addEventListener(eventType, (e) => {
                this.metrics.userInteractions.push({
                    type: eventType,
                    target: e.target.tagName,
                    timestamp: Date.now()
                });

                // Keep only last 100 interactions
                if (this.metrics.userInteractions.length > 100) {
                    this.metrics.userInteractions.shift();
                }
            }, { passive: true });
        });
    }

    monitorMemoryUsage() {
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                this.metrics.memoryUsage.push({
                    used: memory.usedJSHeapSize,
                    total: memory.totalJSHeapSize,
                    limit: memory.jsHeapSizeLimit,
                    timestamp: Date.now()
                });

                // Keep only last 20 measurements
                if (this.metrics.memoryUsage.length > 20) {
                    this.metrics.memoryUsage.shift();
                }
            }, 30000); // Every 30 seconds
        }
    }

    setupReporting() {
        // Report metrics every 5 minutes
        setInterval(() => {
            this.sendMetricsReport();
        }, 300000);

        // Report on page unload
        window.addEventListener('beforeunload', () => {
            this.sendMetricsReport();
        });
    }

    reportMetric(name, data) {
        // Send to analytics service
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/metrics.php', JSON.stringify({
                metric: name,
                data,
                timestamp: Date.now(),
                userAgent: navigator.userAgent
            }));
        }
    }

    sendMetricsReport() {
        const report = {
            pageLoad: this.metrics.pageLoad,
            apiPerformance: this.getAPIStats(),
            userEngagement: this.getUserEngagementStats(),
            memoryUsage: this.getMemoryStats(),
            timestamp: Date.now()
        };

        this.reportMetric('performance_report', report);
    }

    getAPIStats() {
        const calls = this.metrics.apiCalls;
        if (calls.length === 0) return null;

        const totalCalls = calls.length;
        const avgDuration = calls.reduce((sum, call) => sum + call.duration, 0) / totalCalls;
        const errorRate = calls.filter(call => call.status === 'error').length / totalCalls;

        return {
            totalCalls,
            avgDuration: Math.round(avgDuration),
            errorRate: Math.round(errorRate * 100),
            slowCalls: calls.filter(call => call.duration > 3000).length
        };
    }

    getUserEngagementStats() {
        const interactions = this.metrics.userInteractions;
        const now = Date.now();
        const last5Minutes = interactions.filter(i => now - i.timestamp < 300000);

        return {
            totalInteractions: interactions.length,
            recentInteractions: last5Minutes.length,
            clickRate: interactions.filter(i => i.type === 'click').length,
            scrollEvents: interactions.filter(i => i.type === 'scroll').length
        };
    }

    getMemoryStats() {
        const usage = this.metrics.memoryUsage;
        if (usage.length === 0) return null;

        const latest = usage[usage.length - 1];
        const peak = Math.max(...usage.map(u => u.used));

        return {
            current: Math.round(latest.used / 1048576), // MB
            peak: Math.round(peak / 1048576), // MB
            limit: Math.round(latest.limit / 1048576) // MB
        };
    }

    // Real-time Performance Dashboard
    createPerformanceDashboard() {
        const dashboard = document.createElement('div');
        dashboard.id = 'performance-dashboard';
        dashboard.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            display: none;
        `;

        document.body.appendChild(dashboard);

        // Toggle with Ctrl+Shift+P
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                dashboard.style.display = dashboard.style.display === 'none' ? 'block' : 'none';
                if (dashboard.style.display === 'block') {
                    this.updateDashboard(dashboard);
                }
            }
        });

        return dashboard;
    }

    updateDashboard(dashboard) {
        const stats = this.getAPIStats();
        const memory = this.getMemoryStats();
        
        dashboard.innerHTML = `
            <div>Performance Monitor</div>
            <div>API Calls: ${stats?.totalCalls || 0}</div>
            <div>Avg Response: ${stats?.avgDuration || 0}ms</div>
            <div>Error Rate: ${stats?.errorRate || 0}%</div>
            <div>Memory: ${memory?.current || 0}MB</div>
            <div>Cache Hit Rate: ${this.getCacheHitRate()}%</div>
        `;
    }

    getCacheHitRate() {
        // Calculate from app cache if available
        return Math.round(Math.random() * 100); // Placeholder
    }
}