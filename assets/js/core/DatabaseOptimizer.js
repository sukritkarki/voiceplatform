// Database Optimization Class
export class DatabaseOptimizer {
    constructor(db) {
        this.db = db;
        this.queryCache = new Map();
        this.connectionPool = [];
        this.maxConnections = 10;
        this.queryStats = new Map();
    }

    // Query Performance Monitoring
    async executeQuery(sql, params = [], useCache = true) {
        const queryKey = this.generateQueryKey(sql, params);
        const startTime = performance.now();

        try {
            // Check cache first
            if (useCache && this.queryCache.has(queryKey)) {
                const cached = this.queryCache.get(queryKey);
                if (Date.now() - cached.timestamp < 300000) { // 5 minutes
                    this.updateQueryStats(queryKey, performance.now() - startTime, true);
                    return cached.result;
                }
            }

            // Execute query
            const stmt = this.db.prepare(sql);
            const result = await stmt.execute(params);
            
            // Cache result
            if (useCache) {
                this.queryCache.set(queryKey, {
                    result,
                    timestamp: Date.now()
                });
            }

            this.updateQueryStats(queryKey, performance.now() - startTime, false);
            return result;

        } catch (error) {
            this.logSlowQuery(sql, params, performance.now() - startTime, error);
            throw error;
        }
    }

    generateQueryKey(sql, params) {
        return btoa(sql + JSON.stringify(params));
    }

    updateQueryStats(queryKey, executionTime, fromCache) {
        if (!this.queryStats.has(queryKey)) {
            this.queryStats.set(queryKey, {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                cacheHits: 0
            });
        }

        const stats = this.queryStats.get(queryKey);
        stats.count++;
        
        if (fromCache) {
            stats.cacheHits++;
        } else {
            stats.totalTime += executionTime;
            stats.avgTime = stats.totalTime / (stats.count - stats.cacheHits);
        }

        // Log slow queries
        if (executionTime > 1000) { // 1 second
            this.logSlowQuery(queryKey, [], executionTime);
        }
    }

    logSlowQuery(sql, params, time, error = null) {
        console.warn('Slow query detected:', {
            sql: sql.substring(0, 100) + '...',
            params,
            executionTime: `${time.toFixed(2)}ms`,
            error: error?.message
        });
    }

    // Connection Pool Management
    async getConnection() {
        if (this.connectionPool.length > 0) {
            return this.connectionPool.pop();
        }

        if (this.connectionPool.length < this.maxConnections) {
            return await this.createNewConnection();
        }

        // Wait for available connection
        return new Promise((resolve) => {
            const checkForConnection = () => {
                if (this.connectionPool.length > 0) {
                    resolve(this.connectionPool.pop());
                } else {
                    setTimeout(checkForConnection, 10);
                }
            };
            checkForConnection();
        });
    }

    releaseConnection(connection) {
        if (this.connectionPool.length < this.maxConnections) {
            this.connectionPool.push(connection);
        } else {
            connection.close();
        }
    }

    // Query Optimization
    optimizeQuery(sql) {
        // Add LIMIT if not present for SELECT queries
        if (sql.trim().toUpperCase().startsWith('SELECT') && 
            !sql.toUpperCase().includes('LIMIT')) {
            sql += ' LIMIT 1000';
        }

        // Add indexes suggestions
        this.suggestIndexes(sql);

        return sql;
    }

    suggestIndexes(sql) {
        const whereMatches = sql.match(/WHERE\s+(\w+)/gi);
        const orderMatches = sql.match(/ORDER\s+BY\s+(\w+)/gi);
        
        if (whereMatches || orderMatches) {
            console.info('Consider adding indexes for better performance');
        }
    }

    // Cache Management
    clearQueryCache() {
        this.queryCache.clear();
    }

    getCacheStats() {
        return {
            size: this.queryCache.size,
            hitRate: this.calculateCacheHitRate()
        };
    }

    calculateCacheHitRate() {
        let totalQueries = 0;
        let cacheHits = 0;

        this.queryStats.forEach(stats => {
            totalQueries += stats.count;
            cacheHits += stats.cacheHits;
        });

        return totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;
    }
}