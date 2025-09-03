// Advanced Cache Management System
export class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.indexedDB = null;
        this.cacheStats = {
            hits: 0,
            misses: 0,
            sets: 0
        };
        
        this.init();
    }

    async init() {
        await this.initIndexedDB();
        this.setupCacheCleanup();
        this.setupCacheMetrics();
    }

    async initIndexedDB() {
        if (!('indexedDB' in window)) return;

        try {
            this.indexedDB = await new Promise((resolve, reject) => {
                const request = indexedDB.open('StandWithNepalCache', 2);
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    // Issues cache
                    if (!db.objectStoreNames.contains('issues')) {
                        const issuesStore = db.createObjectStore('issues', { keyPath: 'key' });
                        issuesStore.createIndex('timestamp', 'timestamp');
                        issuesStore.createIndex('category', 'category');
                    }
                    
                    // API responses cache
                    if (!db.objectStoreNames.contains('api_responses')) {
                        const apiStore = db.createObjectStore('api_responses', { keyPath: 'key' });
                        apiStore.createIndex('timestamp', 'timestamp');
                        apiStore.createIndex('endpoint', 'endpoint');
                    }
                    
                    // User preferences
                    if (!db.objectStoreNames.contains('preferences')) {
                        db.createObjectStore('preferences', { keyPath: 'key' });
                    }
                };
            });
        } catch (error) {
            console.warn('IndexedDB initialization failed:', error);
        }
    }

    // Multi-layer Cache Strategy
    async get(key, options = {}) {
        const { useMemory = true, useIndexedDB = true, defaultValue = null } = options;
        
        // Layer 1: Memory Cache (fastest)
        if (useMemory && this.memoryCache.has(key)) {
            const cached = this.memoryCache.get(key);
            if (this.isValidCache(cached)) {
                this.cacheStats.hits++;
                return cached.data;
            }
            this.memoryCache.delete(key);
        }

        // Layer 2: IndexedDB (persistent)
        if (useIndexedDB && this.indexedDB) {
            try {
                const cached = await this.getFromIndexedDB(key);
                if (cached && this.isValidCache(cached)) {
                    // Promote to memory cache
                    this.memoryCache.set(key, cached);
                    this.cacheStats.hits++;
                    return cached.data;
                }
            } catch (error) {
                console.warn('IndexedDB read error:', error);
            }
        }

        this.cacheStats.misses++;
        return defaultValue;
    }

    async set(key, data, options = {}) {
        const { 
            ttl = 300000, // 5 minutes default
            useMemory = true, 
            useIndexedDB = true,
            category = 'general'
        } = options;

        const cacheEntry = {
            data,
            timestamp: Date.now(),
            ttl,
            category,
            size: this.calculateSize(data)
        };

        // Store in memory cache
        if (useMemory) {
            this.memoryCache.set(key, cacheEntry);
            this.enforceMemoryLimit();
        }

        // Store in IndexedDB
        if (useIndexedDB && this.indexedDB) {
            try {
                await this.setInIndexedDB(key, cacheEntry);
            } catch (error) {
                console.warn('IndexedDB write error:', error);
            }
        }

        this.cacheStats.sets++;
    }

    async getFromIndexedDB(key) {
        const transaction = this.indexedDB.transaction(['api_responses'], 'readonly');
        const store = transaction.objectStore('api_responses');
        
        return new Promise((resolve) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    }

    async setInIndexedDB(key, cacheEntry) {
        const transaction = this.indexedDB.transaction(['api_responses'], 'readwrite');
        const store = transaction.objectStore('api_responses');
        
        return new Promise((resolve, reject) => {
            const request = store.put({ key, ...cacheEntry });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    isValidCache(cached) {
        return cached && (Date.now() - cached.timestamp) < cached.ttl;
    }

    calculateSize(data) {
        return new Blob([JSON.stringify(data)]).size;
    }

    enforceMemoryLimit(maxSize = 50 * 1024 * 1024) { // 50MB limit
        let totalSize = 0;
        const entries = Array.from(this.memoryCache.entries());
        
        // Calculate total size
        entries.forEach(([key, value]) => {
            totalSize += value.size || 0;
        });

        // Remove oldest entries if over limit
        if (totalSize > maxSize) {
            entries
                .sort((a, b) => a[1].timestamp - b[1].timestamp)
                .slice(0, Math.floor(entries.length / 2))
                .forEach(([key]) => this.memoryCache.delete(key));
        }
    }

    // Cache Cleanup
    setupCacheCleanup() {
        // Clean expired entries every 5 minutes
        setInterval(() => {
            this.cleanExpiredEntries();
        }, 300000);

        // Clean on page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.cleanExpiredEntries();
            }
        });
    }

    async cleanExpiredEntries() {
        // Clean memory cache
        const now = Date.now();
        for (const [key, value] of this.memoryCache.entries()) {
            if (!this.isValidCache(value)) {
                this.memoryCache.delete(key);
            }
        }

        // Clean IndexedDB
        if (this.indexedDB) {
            try {
                const transaction = this.indexedDB.transaction(['api_responses'], 'readwrite');
                const store = transaction.objectStore('api_responses');
                const index = store.index('timestamp');
                
                const range = IDBKeyRange.upperBound(now - 3600000); // 1 hour old
                const request = index.openCursor(range);
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    }
                };
            } catch (error) {
                console.warn('Cache cleanup error:', error);
            }
        }
    }

    setupCacheMetrics() {
        // Report cache performance
        setInterval(() => {
            const hitRate = this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100;
            console.log('Cache Performance:', {
                hitRate: `${hitRate.toFixed(2)}%`,
                memoryEntries: this.memoryCache.size,
                ...this.cacheStats
            });
        }, 60000); // Every minute
    }

    // Smart Prefetching
    async prefetchData(keys) {
        const prefetchPromises = keys.map(async (key) => {
            if (!this.memoryCache.has(key)) {
                try {
                    const data = await this.fetchFromAPI(key);
                    await this.set(key, data, { ttl: 600000 }); // 10 minutes
                } catch (error) {
                    console.warn(`Prefetch failed for ${key}:`, error);
                }
            }
        });

        await Promise.allSettled(prefetchPromises);
    }

    async fetchFromAPI(endpoint) {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    // Cache Statistics
    getStats() {
        return {
            ...this.cacheStats,
            memorySize: this.memoryCache.size,
            hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100
        };
    }

    clear() {
        this.memoryCache.clear();
        
        if (this.indexedDB) {
            const transaction = this.indexedDB.transaction(['api_responses'], 'readwrite');
            const store = transaction.objectStore('api_responses');
            store.clear();
        }
    }
}