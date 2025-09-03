<?php
// Database configuration
class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    public $conn;
    private static $instance = null;
    private $queryCache = [];
    private $connectionPool = [];
    private $maxConnections = 10;
    private $queryStats = [];

    public function __construct() {
        // Load from environment variables or use defaults
        $this->host = $_ENV['DB_HOST'] ?? 'localhost';
        $this->db_name = $_ENV['DB_NAME'] ?? 'standwithnepal';
        $this->username = $_ENV['DB_USER'] ?? 'root';
        $this->password = $_ENV['DB_PASS'] ?? '';
    }

    // Singleton pattern for connection pooling
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    // Advanced Connection Pooling
    public function getPooledConnection() {
        if (!empty($this->connectionPool)) {
            return array_pop($this->connectionPool);
        }
        
        if (count($this->connectionPool) < $this->maxConnections) {
            return $this->createNewConnection();
        }
        
        // Wait for available connection
        usleep(10000); // 10ms
        return $this->getPooledConnection();
    }
    
    public function releaseConnection($connection) {
        if (count($this->connectionPool) < $this->maxConnections) {
            $this->connectionPool[] = $connection;
        } else {
            $connection = null;
        }
    }
    
    private function createNewConnection() {
        $dsn = "mysql:host={$this->host};dbname={$this->db_name};charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_PERSISTENT => false, // Disable for pooling
            PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, sql_mode='STRICT_TRANS_TABLES'",
            PDO::ATTR_TIMEOUT => 30
        ];
        
        return new PDO($dsn, $this->username, $this->password, $options);
    }

    // Query Performance Monitoring
    public function executeOptimizedQuery($sql, $params = [], $useCache = true) {
        $queryKey = md5($sql . serialize($params));
        $startTime = microtime(true);
        
        try {
            // Check query cache
            if ($useCache && isset($this->queryCache[$queryKey])) {
                $cached = $this->queryCache[$queryKey];
                if (time() - $cached['timestamp'] < 300) { // 5 minutes
                    $this->logQueryPerformance($queryKey, microtime(true) - $startTime, true);
                    return $cached['result'];
                }
            }
            
            // Execute query
            $stmt = $this->getConnection()->prepare($sql);
            $stmt->execute($params);
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Cache result
            if ($useCache) {
                $this->queryCache[$queryKey] = [
                    'result' => $result,
                    'timestamp' => time()
                ];
            }
            
            $this->logQueryPerformance($queryKey, microtime(true) - $startTime, false);
            return $result;
            
        } catch (PDOException $e) {
            $this->logSlowQuery($sql, $params, microtime(true) - $startTime, $e->getMessage());
            throw $e;
        }
    }
    
    private function logQueryPerformance($queryKey, $executionTime, $fromCache) {
        if (!isset($this->queryStats[$queryKey])) {
            $this->queryStats[$queryKey] = [
                'count' => 0,
                'total_time' => 0,
                'cache_hits' => 0
            ];
        }
        
        $this->queryStats[$queryKey]['count']++;
        
        if ($fromCache) {
            $this->queryStats[$queryKey]['cache_hits']++;
        } else {
            $this->queryStats[$queryKey]['total_time'] += $executionTime;
        }
        
        // Log slow queries
        if ($executionTime > 1.0) { // 1 second
            error_log("Slow query detected: {$queryKey} took {$executionTime}s");
        }
    }
    
    private function logSlowQuery($sql, $params, $time, $error = null) {
        $logData = [
            'sql' => substr($sql, 0, 200),
            'params' => $params,
            'execution_time' => $time,
            'error' => $error,
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        error_log("Slow query: " . json_encode($logData));
    }

    // Database Health Monitoring
    public function getHealthStatus() {
        try {
            $stmt = $this->getConnection()->query("SELECT 1");
            $processlist = $this->getConnection()->query("SHOW PROCESSLIST")->fetchAll();
            $status = $this->getConnection()->query("SHOW STATUS LIKE 'Threads_connected'")->fetch();
            
            return [
                'status' => 'healthy',
                'connections' => $status['Value'],
                'processes' => count($processlist),
                'cache_hit_rate' => $this->getCacheHitRate()
            ];
        } catch (Exception $e) {
            return [
                'status' => 'unhealthy',
                'error' => $e->getMessage()
            ];
        }
    }
    
    private function getCacheHitRate() {
        $totalQueries = 0;
        $cacheHits = 0;
        
        foreach ($this->queryStats as $stats) {
            $totalQueries += $stats['count'];
            $cacheHits += $stats['cache_hits'];
        }
        
        return $totalQueries > 0 ? ($cacheHits / $totalQueries) * 100 : 0;
    }

    public function getConnection() {
        if ($this->conn !== null) {
            return $this->conn; // Return existing connection
        }
        
        try {
            $dsn = "mysql:host={$this->host};dbname={$this->db_name};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_PERSISTENT => true,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, sql_mode='STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'",
                PDO::ATTR_TIMEOUT => 30
            ];
            
            // Enable SSL if available
            if (isset($_ENV['DB_SSL']) && $_ENV['DB_SSL'] === 'true') {
                $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
            }
            
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
            
            // Set additional MySQL settings for performance
            $this->conn->exec("SET SESSION query_cache_type = ON");
            $this->conn->exec("SET SESSION query_cache_size = 1048576"); // 1MB
            
        } catch(PDOException $exception) {
            error_log("Database connection error: " . $exception->getMessage());
            throw new Exception("Database connection failed");
        }
        
        return $this->conn;
    }
    
    // Query Optimization
    public function optimizeQuery($sql) {
        // Add EXPLAIN for SELECT queries in development
        if (defined('DEBUG') && DEBUG && stripos($sql, 'SELECT') === 0) {
            $explainStmt = $this->getConnection()->prepare("EXPLAIN " . $sql);
            $explainStmt->execute();
            $explain = $explainStmt->fetchAll();
            
            // Check for full table scans
            foreach ($explain as $row) {
                if ($row['type'] === 'ALL' && $row['rows'] > 1000) {
                    error_log("Potential slow query detected: " . substr($sql, 0, 100));
                }
            }
        }
        
        return $sql;
    }
    
    // Prepared statement cache
    private $preparedStatements = [];
    
    public function prepare($sql) {
        $hash = md5($sql);
        
        if (!isset($this->preparedStatements[$hash])) {
            $this->preparedStatements[$hash] = $this->getConnection()->prepare($sql);
        }
        
        return $this->preparedStatements[$hash];
    }
    
    // Batch Operations for Better Performance
    public function batchInsert($table, $data, $batchSize = 1000) {
        if (empty($data)) return;
        
        $chunks = array_chunk($data, $batchSize);
        $this->beginTransaction();
        
        try {
            foreach ($chunks as $chunk) {
                $this->insertBatch($table, $chunk);
            }
            $this->commit();
        } catch (Exception $e) {
            $this->rollback();
            throw $e;
        }
    }
    
    private function insertBatch($table, $data) {
        if (empty($data)) return;
        
        $columns = array_keys($data[0]);
        $placeholders = '(' . str_repeat('?,', count($columns) - 1) . '?)';
        $values = str_repeat($placeholders . ',', count($data) - 1) . $placeholders;
        
        $sql = "INSERT INTO {$table} (" . implode(',', $columns) . ") VALUES {$values}";
        
        $params = [];
        foreach ($data as $row) {
            foreach ($columns as $column) {
                $params[] = $row[$column];
            }
        }
        
        $stmt = $this->getConnection()->prepare($sql);
        $stmt->execute($params);
    }

    // Transaction management with savepoints
    private $transactionLevel = 0;
    
    public function beginTransaction() {
        if ($this->transactionLevel === 0) {
            $result = $this->conn->beginTransaction();
        } else {
            $result = $this->conn->exec("SAVEPOINT LEVEL{$this->transactionLevel}");
        }
        
        $this->transactionLevel++;
        return $result;
    }
    
    public function commit() {
        $this->transactionLevel--;
        
        if ($this->transactionLevel === 0) {
            return $this->conn->commit();
        } else {
            return $this->conn->exec("RELEASE SAVEPOINT LEVEL{$this->transactionLevel}");
        }
    }
    
    public function rollback() {
        $this->transactionLevel--;
        
        if ($this->transactionLevel === 0) {
            return $this->conn->rollback();
        } else {
            return $this->conn->exec("ROLLBACK TO SAVEPOINT LEVEL{$this->transactionLevel}");
        }
    }
    
    // Advanced Query Builder
    public function buildOptimizedQuery($table, $conditions = [], $options = []) {
        $sql = "SELECT ";
        
        // Select specific columns if provided
        if (isset($options['columns'])) {
            $sql .= implode(', ', $options['columns']);
        } else {
            $sql .= "*";
        }
        
        $sql .= " FROM {$table}";
        
        // Add JOINs
        if (isset($options['joins'])) {
            foreach ($options['joins'] as $join) {
                $sql .= " {$join['type']} JOIN {$join['table']} ON {$join['condition']}";
            }
        }
        
        // Add WHERE conditions
        if (!empty($conditions)) {
            $sql .= " WHERE " . implode(' AND ', array_keys($conditions));
        }
        
        // Add GROUP BY
        if (isset($options['group_by'])) {
            $sql .= " GROUP BY " . implode(', ', $options['group_by']);
        }
        
        // Add ORDER BY
        if (isset($options['order_by'])) {
            $sql .= " ORDER BY " . $options['order_by'];
        }
        
        // Add LIMIT
        if (isset($options['limit'])) {
            $sql .= " LIMIT " . intval($options['limit']);
            if (isset($options['offset'])) {
                $sql .= " OFFSET " . intval($options['offset']);
            }
        }
        
        return $sql;
    }

    // Connection health check
    public function ping() {
        try {
            $this->conn->query('SELECT 1');
            return true;
        } catch (PDOException $e) {
            return false;
        }
    }
    
    // Reconnect if connection is lost
    public function reconnect() {
        $this->conn = null;
        return $this->getConnection();
    }
    
    public function closeConnection() {
        $this->preparedStatements = [];
        $this->conn = null;
    }
    
    // Query optimization
    public function analyze($table) {
        return $this->conn->exec("ANALYZE TABLE {$table}");
    }
    
    public function optimize($table) {
        return $this->conn->exec("OPTIMIZE TABLE {$table}");
    }
    
    // Index Management
    public function createIndex($table, $columns, $indexName = null) {
        $indexName = $indexName ?: 'idx_' . implode('_', $columns);
        $columnList = implode(', ', $columns);
        
        $sql = "CREATE INDEX {$indexName} ON {$table} ({$columnList})";
        return $this->conn->exec($sql);
    }
    
    public function analyzeTablePerformance($table) {
        $stats = $this->conn->query("SHOW TABLE STATUS LIKE '{$table}'")->fetch();
        $indexes = $this->conn->query("SHOW INDEX FROM {$table}")->fetchAll();
        
        return [
            'table_stats' => $stats,
            'indexes' => $indexes,
            'recommendations' => $this->generateOptimizationRecommendations($stats, $indexes)
        ];
    }
    
    private function generateOptimizationRecommendations($stats, $indexes) {
        $recommendations = [];
        
        // Check for missing primary key
        $hasPrimaryKey = false;
        foreach ($indexes as $index) {
            if ($index['Key_name'] === 'PRIMARY') {
                $hasPrimaryKey = true;
                break;
            }
        }
        
        if (!$hasPrimaryKey) {
            $recommendations[] = 'Add a primary key for better performance';
        }
        
        // Check table size
        if ($stats['Data_length'] > 100 * 1024 * 1024) { // 100MB
            $recommendations[] = 'Consider partitioning this large table';
        }
        
        return $recommendations;
    }

    // Get database statistics
    public function getStats() {
        $stmt = $this->conn->query("SHOW STATUS LIKE 'Queries'");
        return $stmt->fetchAll();
    }
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
            ];
            
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
            $this->conn->exec("set names utf8");
        } catch(PDOException $exception) {
            error_log("Database connection error: " . $exception->getMessage());
            throw new Exception("Database connection failed");
        }
        
        return $this->conn;
    }
    
    public function closeConnection() {
        $this->conn = null;
    }
    
    public function beginTransaction() {
        return $this->conn->beginTransaction();
    }
    
    public function commit() {
        return $this->conn->commit();
    }
    
    public function rollback() {
        return $this->conn->rollback();
    }
}
?>