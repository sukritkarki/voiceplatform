<?php
// Database configuration
class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    public $conn;
    private static $instance = null;

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
    
    // Prepared statement cache
    private $preparedStatements = [];
    
    public function prepare($sql) {
        $hash = md5($sql);
        
        if (!isset($this->preparedStatements[$hash])) {
            $this->preparedStatements[$hash] = $this->getConnection()->prepare($sql);
        }
        
        return $this->preparedStatements[$hash];
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