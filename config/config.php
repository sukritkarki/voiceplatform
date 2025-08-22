<?php
// Configuration file for Stand with Nepal

// Environment detection
define('ENVIRONMENT', $_ENV['APP_ENV'] ?? 'development');
define('DEBUG', ENVIRONMENT === 'development');

// Database configuration
define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
define('DB_NAME', $_ENV['DB_NAME'] ?? 'standwithnepal');
define('DB_USER', $_ENV['DB_USER'] ?? 'root');
define('DB_PASS', $_ENV['DB_PASS'] ?? '');

// Application settings
define('APP_NAME', 'Stand with Nepal');
define('APP_VERSION', '1.0.0');
define('APP_URL', $_ENV['APP_URL'] ?? 'http://localhost');

// Security settings
define('SESSION_LIFETIME', 3600 * 24); // 24 hours
define('CSRF_TOKEN_LIFETIME', 3600); // 1 hour
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOGIN_LOCKOUT_TIME', 900); // 15 minutes

// File upload settings
define('UPLOAD_MAX_SIZE', 10 * 1024 * 1024); // 10MB
define('UPLOAD_ALLOWED_TYPES', ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'avi']);
define('UPLOAD_PATH', __DIR__ . '/../uploads/');

// API settings
define('API_RATE_LIMIT', 100); // requests per hour
define('API_RATE_WINDOW', 3600); // 1 hour

// Email settings (for notifications)
define('SMTP_HOST', $_ENV['SMTP_HOST'] ?? '');
define('SMTP_PORT', $_ENV['SMTP_PORT'] ?? 587);
define('SMTP_USER', $_ENV['SMTP_USER'] ?? '');
define('SMTP_PASS', $_ENV['SMTP_PASS'] ?? '');
define('FROM_EMAIL', $_ENV['FROM_EMAIL'] ?? 'noreply@standwithnepal.org');

// Logging
define('LOG_LEVEL', DEBUG ? 'DEBUG' : 'ERROR');
define('LOG_PATH', __DIR__ . '/../logs/');

// Cache settings
define('CACHE_ENABLED', !DEBUG);
define('CACHE_LIFETIME', 3600); // 1 hour

// Pagination
define('DEFAULT_PAGE_SIZE', 20);
define('MAX_PAGE_SIZE', 100);

// Map settings
define('DEFAULT_MAP_CENTER_LAT', 28.3949);
define('DEFAULT_MAP_CENTER_LNG', 84.1240);
define('DEFAULT_MAP_ZOOM', 7);

// Notification settings
define('NOTIFICATION_BATCH_SIZE', 100);
define('NOTIFICATION_RETRY_ATTEMPTS', 3);

// Error reporting
if (DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(E_ERROR | E_WARNING | E_PARSE);
    ini_set('display_errors', 0);
}

// Timezone
date_default_timezone_set('Asia/Kathmandu');

// Session configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', isset($_SERVER['HTTPS']));
ini_set('session.use_strict_mode', 1);
ini_set('session.gc_maxlifetime', SESSION_LIFETIME);

// Create necessary directories
$directories = [LOG_PATH, UPLOAD_PATH];
foreach ($directories as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
}

// Autoloader for classes
spl_autoload_register(function ($class) {
    $file = __DIR__ . '/classes/' . $class . '.php';
    if (file_exists($file)) {
        require_once $file;
    }
});

// Global functions
function sanitize_input($input) {
    if (is_array($input)) {
        return array_map('sanitize_input', $input);
    }
    return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}

function generate_csrf_token() {
    if (!isset($_SESSION['csrf_token']) || 
        !isset($_SESSION['csrf_token_time']) || 
        (time() - $_SESSION['csrf_token_time']) > CSRF_TOKEN_LIFETIME) {
        
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        $_SESSION['csrf_token_time'] = time();
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf_token($token) {
    return isset($_SESSION['csrf_token']) && 
           hash_equals($_SESSION['csrf_token'], $token) &&
           isset($_SESSION['csrf_token_time']) &&
           (time() - $_SESSION['csrf_token_time']) <= CSRF_TOKEN_LIFETIME;
}

function log_message($level, $message, $context = []) {
    if (!is_dir(LOG_PATH)) {
        mkdir(LOG_PATH, 0755, true);
    }
    
    $log_file = LOG_PATH . date('Y-m-d') . '.log';
    $timestamp = date('Y-m-d H:i:s');
    $context_str = !empty($context) ? ' ' . json_encode($context) : '';
    $log_entry = "[$timestamp] [$level] $message$context_str" . PHP_EOL;
    
    file_put_contents($log_file, $log_entry, FILE_APPEND | LOCK_EX);
}

function send_json_response($data, $status_code = 200) {
    http_response_code($status_code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function validate_email($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function validate_phone($phone) {
    return preg_match('/^[+]?[\d\s\-\(\)]{10,}$/', $phone);
}

function generate_unique_id() {
    return uniqid(bin2hex(random_bytes(8)), true);
}
?>