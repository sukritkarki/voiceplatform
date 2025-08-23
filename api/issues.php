<?php
// Enable error reporting for development
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors to users
ini_set('log_errors', 1);

// Enable output compression
if (!ob_get_level()) {
    ob_start('ob_gzhandler');
}

// Set cache headers for static content
if (isset($_GET['action']) && $_GET['action'] === 'list') {
    header('Cache-Control: public, max-age=300'); // 5 minutes
    header('ETag: ' . md5(serialize($_GET)));
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
session_start();

// Redis cache connection (if available)
$redis = null;
if (class_exists('Redis')) {
    try {
        $redis = new Redis();
        $redis->connect('127.0.0.1', 6379);
    } catch (Exception $e) {
        $redis = null;
    }
}

try {
    $database = new Database();
    $db = $database->getConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

$action = $_GET['action'] ?? '';

// Rate limiting
$client_ip = $_SERVER['REMOTE_ADDR'];
$rate_limit_key = "rate_limit_{$client_ip}";

if (!checkRateLimit($rate_limit_key)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Too many requests']);
    exit;
}

// Enhanced caching for list requests
if ($action === 'list') {
    $cache_key = 'issues_list_' . md5(serialize($_GET));
    
    if ($redis) {
        $cached_result = $redis->get($cache_key);
        if ($cached_result) {
            header('X-Cache: HIT');
            echo $cached_result;
            exit;
        }
    }
}

switch($action) {
    case 'create':
        createIssue($db);
        break;
    case 'list':
        listIssues($db, $redis);
        break;
    case 'get':
        getIssue($db);
        break;
    case 'update_status':
        updateIssueStatus($db);
        break;
    case 'upvote':
        upvoteIssue($db);
        break;
    case 'add_comment':
        addComment($db);
        break;
    case 'get_comments':
        getComments($db);
        break;
    case 'get_nearby':
        getNearbyIssues($db);
        break;
    case 'get_trending':
        getTrendingIssues($db);
        break;
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}

function checkRateLimit($key, $redis = null, $limit = 100, $window = 3600) {
    if ($redis) {
        $current = $redis->incr($key);
        if ($current === 1) {
            $redis->expire($key, $window);
        }
        return $current <= $limit;
    }
    
    // Simple file-based rate limiting
    $rate_file = sys_get_temp_dir() . "/rate_limit_" . md5($key);
    $current_time = time();
    
    if (file_exists($rate_file)) {
        $data = json_decode(file_get_contents($rate_file), true);
        if ($current_time - $data['start_time'] < $window) {
            if ($data['count'] >= $limit) {
                return false;
            }
            $data['count']++;
        } else {
            $data = ['start_time' => $current_time, 'count' => 1];
        }
    } else {
        $data = ['start_time' => $current_time, 'count' => 1];
    }
    
    file_put_contents($rate_file, json_encode($data));
    return true;
}

// Enhanced list function with caching
function listIssues($db, $redis = null) {
    try {
        $filters = [];
        $params = [];
        $limit = min(intval($_GET['limit'] ?? 50), 100);
        $offset = max(intval($_GET['offset'] ?? 0), 0);
        
        // Build cache key
        $cache_key = 'issues_list_' . md5(serialize($_GET));
        
        // Apply filters
        if (isset($_GET['category']) && $_GET['category'] !== '') {
            $filters[] = "category = ?";
            $params[] = $_GET['category'];
        }
        
        if (isset($_GET['status']) && $_GET['status'] !== '') {
            $filters[] = "status = ?";
            $params[] = $_GET['status'];
        }
        
        if (isset($_GET['district']) && $_GET['district'] !== '') {
            $filters[] = "district LIKE ?";
            $params[] = '%' . $_GET['district'] . '%';
        }
        
        // For government officials, filter by jurisdiction
        if (isset($_SESSION['user_type']) && $_SESSION['user_type'] === 'official') {
            if (isset($_SESSION['district'])) {
                $filters[] = "district = ?";
                $params[] = $_SESSION['district'];
            }
            if (isset($_SESSION['ward_no']) && $_SESSION['jurisdiction'] === 'ward') {
                $filters[] = "ward_no = ?";
                $params[] = $_SESSION['ward_no'];
            }
        }
        
        $where_clause = !empty($filters) ? 'WHERE ' . implode(' AND ', $filters) : '';
        
        // Optimized query with proper indexing
        $stmt = $db->prepare("SELECT i.*, u.full_name as reporter_name, 
                             (SELECT COUNT(*) FROM issue_upvotes WHERE issue_id = i.id) as upvotes,
                             (SELECT COUNT(*) FROM issue_comments WHERE issue_id = i.id) as comments
                             FROM issues i 
                             LEFT JOIN users u ON i.user_id = u.id 
                             $where_clause 
                             ORDER BY i.created_at DESC 
                             LIMIT ? OFFSET ?");
        
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $issues = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get total count for pagination
        $count_params = array_slice($params, 0, -2); // Remove limit and offset
        $count_stmt = $db->prepare("SELECT COUNT(*) as total FROM issues i LEFT JOIN users u ON i.user_id = u.id $where_clause");
        $count_stmt->execute($count_params);
        $total = $count_stmt->fetch()['total'];
        
        // Hide reporter name for anonymous posts
        foreach ($issues as &$issue) {
            if ($issue['anonymous']) {
                $issue['reporter_name'] = 'Anonymous';
            }
        }
        
        $result = [
            'success' => true, 
            'issues' => $issues,
            'pagination' => [
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
                'has_more' => ($offset + $limit) < $total
            ]
        ];
        
        // Cache the result
        if ($redis) {
            $redis->setex($cache_key, 300, json_encode($result)); // 5 minutes cache
            header('X-Cache: MISS');
        }
        
        echo json_encode($result);
        
    } catch(PDOException $e) {
        error_log("List issues error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch issues']);
    }
}

function createIssue($db) {
    // Validate input
    $input = validateInput(file_get_contents('php://input'));
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid input']);
        return;
    }
    
    // Validate required fields
    $required_fields = ['title', 'description', 'category', 'province', 'district', 'municipality', 'ward'];
    foreach ($required_fields as $field) {
        if (empty($input[$field])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
            return;
        }
    }
    
    // Sanitize inputs
    $input['title'] = sanitizeInput($input['title']);
    $input['description'] = sanitizeInput($input['description']);
    
    try {
        $db->beginTransaction();
        
        $user_id = $input['anonymous'] ? null : ($_SESSION['user_id'] ?? null);
        
        $stmt = $db->prepare("INSERT INTO issues (title, description, category, severity, province_id, district, municipality, ward_no, latitude, longitude, anonymous, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
        
        $stmt->execute([
            trim($input['title']),
            trim($input['description']),
            $input['category'],
            $input['severity'] ?? 'medium',
            $input['province'],
            $input['district'],
            $input['municipality'],
            $input['ward'],
            $input['latitude'] ?? null,
            $input['longitude'] ?? null,
            $input['anonymous'] ? 1 : 0,
            $user_id
        ]);
        
        $issue_id = $db->lastInsertId();
        
        // Log the action
        logAction($db, 'issue_created', $issue_id, $user_id);
        
        $db->commit();
        
        http_response_code(201);
        echo json_encode([
            'success' => true, 
            'message' => 'Issue created successfully',
            'issue_id' => $issue_id
        ]);
        
    } catch(PDOException $e) {
        $db->rollback();
        error_log("Create issue error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create issue: ' . $e->getMessage()]);
    }
}

function validateInput($json_string) {
    $input = json_decode($json_string, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        return false;
    }
    
    return $input;
}

function sanitizeInput($input) {
    return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}

function logAction($db, $action, $related_id = null, $user_id = null) {
    try {
        $stmt = $db->prepare("INSERT INTO activity_log (action, related_id, user_id, ip_address, created_at) VALUES (?, ?, ?, ?, NOW())");
        $stmt->execute([$action, $related_id, $user_id, $_SERVER['REMOTE_ADDR']]);
    } catch (Exception $e) {
        error_log("Failed to log action: " . $e->getMessage());
    }
}

function listIssues($db) {
    try {
        $filters = [];
        $params = [];
        $limit = min(intval($_GET['limit'] ?? 50), 100); // Max 100 items
        $offset = max(intval($_GET['offset'] ?? 0), 0);
        
        // Apply filters
        if (isset($_GET['category']) && $_GET['category'] !== '') {
            $filters[] = "category = ?";
            $params[] = $_GET['category'];
        }
        
        if (isset($_GET['status']) && $_GET['status'] !== '') {
            $filters[] = "status = ?";
            $params[] = $_GET['status'];
        }
        
        if (isset($_GET['district']) && $_GET['district'] !== '') {
            $filters[] = "district LIKE ?";
            $params[] = '%' . $_GET['district'] . '%';
        }
        
        // For government officials, filter by jurisdiction
        if (isset($_SESSION['user_type']) && $_SESSION['user_type'] === 'official') {
            if (isset($_SESSION['district'])) {
                $filters[] = "district = ?";
                $params[] = $_SESSION['district'];
            }
            if (isset($_SESSION['ward_no']) && $_SESSION['jurisdiction'] === 'ward') {
                $filters[] = "ward_no = ?";
                $params[] = $_SESSION['ward_no'];
            }
        }
        
        $where_clause = !empty($filters) ? 'WHERE ' . implode(' AND ', $filters) : '';
        
        // Get total count for pagination
        $count_stmt = $db->prepare("SELECT COUNT(*) as total FROM issues i LEFT JOIN users u ON i.user_id = u.id $where_clause");
        $count_stmt->execute($params);
        $total = $count_stmt->fetch()['total'];
        
        $stmt = $db->prepare("SELECT i.*, u.full_name as reporter_name, 
                             (SELECT COUNT(*) FROM issue_upvotes WHERE issue_id = i.id) as upvotes
                             FROM issues i 
                             LEFT JOIN users u ON i.user_id = u.id 
                             $where_clause 
                             ORDER BY i.created_at DESC 
                             LIMIT ? OFFSET ?");
        
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $issues = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Hide reporter name for anonymous posts
        foreach ($issues as &$issue) {
            if ($issue['anonymous']) {
                $issue['reporter_name'] = 'Anonymous';
            }
        }
        
        echo json_encode([
            'success' => true, 
            'issues' => $issues,
            'pagination' => [
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
                'has_more' => ($offset + $limit) < $total
            ]
        ]);
        
    } catch(PDOException $e) {
        error_log("List issues error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch issues: ' . $e->getMessage()]);
    }
}

function getNearbyIssues($db) {
    $lat = floatval($_GET['lat'] ?? 0);
    $lng = floatval($_GET['lng'] ?? 0);
    $radius = min(floatval($_GET['radius'] ?? 10), 50); // Max 50km radius
    
    if ($lat == 0 || $lng == 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid coordinates']);
        return;
    }
    
    try {
        // Using Haversine formula to find nearby issues
        $stmt = $db->prepare("SELECT i.*, u.full_name as reporter_name,
                             (SELECT COUNT(*) FROM issue_upvotes WHERE issue_id = i.id) as upvotes,
                             (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * 
                              cos(radians(longitude) - radians(?)) + 
                              sin(radians(?)) * sin(radians(latitude)))) AS distance
                             FROM issues i 
                             LEFT JOIN users u ON i.user_id = u.id 
                             WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                             HAVING distance < ?
                             ORDER BY distance ASC
                             LIMIT 50");
        
        $stmt->execute([$lat, $lng, $lat, $radius]);
        $issues = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Hide reporter name for anonymous posts
        foreach ($issues as &$issue) {
            if ($issue['anonymous']) {
                $issue['reporter_name'] = 'Anonymous';
            }
        }
        
        echo json_encode(['success' => true, 'issues' => $issues]);
        
    } catch(PDOException $e) {
        error_log("Nearby issues error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch nearby issues']);
    }
}

function getTrendingIssues($db) {
    try {
        // Get trending issues based on upvotes and recency
        $stmt = $db->prepare("SELECT i.*, u.full_name as reporter_name,
                             (SELECT COUNT(*) FROM issue_upvotes WHERE issue_id = i.id) as upvotes,
                             (SELECT COUNT(*) FROM issue_comments WHERE issue_id = i.id) as comments,
                             TIMESTAMPDIFF(HOUR, i.created_at, NOW()) as hours_old
                             FROM issues i 
                             LEFT JOIN users u ON i.user_id = u.id 
                             WHERE i.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                             ORDER BY (upvotes * 2 + comments) / (hours_old + 1) DESC
                             LIMIT 10");
        
        $stmt->execute();
        $issues = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Hide reporter name for anonymous posts
        foreach ($issues as &$issue) {
            if ($issue['anonymous']) {
                $issue['reporter_name'] = 'Anonymous';
            }
        }
        
        echo json_encode(['success' => true, 'issues' => $issues]);
        
    } catch(PDOException $e) {
        error_log("Trending issues error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch trending issues']);
    }
}

function getIssue($db) {
    $issue_id = $_GET['id'] ?? 0;
    
    try {
        $stmt = $db->prepare("SELECT i.*, u.full_name as reporter_name,
                             (SELECT COUNT(*) FROM issue_upvotes WHERE issue_id = i.id) as upvotes
                             FROM issues i 
                             LEFT JOIN users u ON i.user_id = u.id 
                             WHERE i.id = ?");
        
        $stmt->execute([$issue_id]);
        $issue = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($issue) {
            if ($issue['anonymous']) {
                $issue['reporter_name'] = 'Anonymous';
            }
            
            // Get updates/comments
            $stmt = $db->prepare("SELECT iu.*, u.full_name as author_name 
                                 FROM issue_updates iu 
                                 LEFT JOIN users u ON iu.user_id = u.id 
                                 WHERE iu.issue_id = ? 
                                 ORDER BY iu.created_at ASC");
            $stmt->execute([$issue_id]);
            $issue['updates'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode(['success' => true, 'issue' => $issue]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Issue not found']);
        }
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch issue: ' . $e->getMessage()]);
    }
}

function updateIssueStatus($db) {
    if (!isset($_SESSION['user_id']) || $_SESSION['user_type'] !== 'official') {
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    try {
        $issue_id = $input['issue_id'];
        $new_status = $input['status'];
        $update_text = $input['update_text'] ?? '';
        
        // Get current status
        $stmt = $db->prepare("SELECT status FROM issues WHERE id = ?");
        $stmt->execute([$issue_id]);
        $current_issue = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$current_issue) {
            echo json_encode(['success' => false, 'message' => 'Issue not found']);
            return;
        }
        
        // Update issue status
        $stmt = $db->prepare("UPDATE issues SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$new_status, $issue_id]);
        
        // Add update record
        $stmt = $db->prepare("INSERT INTO issue_updates (issue_id, user_id, update_text, update_type, old_status, new_status) VALUES (?, ?, ?, 'status_change', ?, ?)");
        $stmt->execute([
            $issue_id,
            $_SESSION['user_id'],
            $update_text ?: "Status changed to " . ucfirst(str_replace('-', ' ', $new_status)),
            $current_issue['status'],
            $new_status
        ]);
        
        echo json_encode(['success' => true, 'message' => 'Status updated successfully']);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to update status: ' . $e->getMessage()]);
    }
}

function upvoteIssue($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    $issue_id = $input['issue_id'];
    $user_id = $_SESSION['user_id'] ?? null;
    $ip_address = $_SERVER['REMOTE_ADDR'];
    
    try {
        // Check if already upvoted
        if ($user_id) {
            $stmt = $db->prepare("SELECT id FROM issue_upvotes WHERE issue_id = ? AND user_id = ?");
            $stmt->execute([$issue_id, $user_id]);
        } else {
            $stmt = $db->prepare("SELECT id FROM issue_upvotes WHERE issue_id = ? AND ip_address = ?");
            $stmt->execute([$issue_id, $ip_address]);
        }
        
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'message' => 'Already upvoted']);
            return;
        }
        
        // Add upvote
        $stmt = $db->prepare("INSERT INTO issue_upvotes (issue_id, user_id, ip_address) VALUES (?, ?, ?)");
        $stmt->execute([$issue_id, $user_id, $ip_address]);
        
        // Get new upvote count
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM issue_upvotes WHERE issue_id = ?");
        $stmt->execute([$issue_id]);
        $count = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        
        echo json_encode(['success' => true, 'upvotes' => $count]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to upvote: ' . $e->getMessage()]);
    }
}

function addComment($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    try {
        $stmt = $db->prepare("INSERT INTO issue_comments (issue_id, user_id, comment_text, anonymous) VALUES (?, ?, ?, ?)");
        $stmt->execute([
            $input['issue_id'],
            $input['anonymous'] ? null : ($_SESSION['user_id'] ?? null),
            $input['comment'],
            $input['anonymous'] ? 1 : 0
        ]);
        
        echo json_encode(['success' => true, 'message' => 'Comment added successfully']);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to add comment: ' . $e->getMessage()]);
    }
}

function getComments($db) {
    $issue_id = $_GET['issue_id'] ?? 0;
    
    try {
        $stmt = $db->prepare("SELECT c.*, u.full_name as author_name 
                             FROM issue_comments c 
                             LEFT JOIN users u ON c.user_id = u.id 
                             WHERE c.issue_id = ? AND c.moderated = FALSE 
                             ORDER BY c.created_at ASC");
        
        $stmt->execute([$issue_id]);
        $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Hide author name for anonymous comments
        foreach ($comments as &$comment) {
            if ($comment['anonymous']) {
                $comment['author_name'] = 'Anonymous';
            }
        }
        
        echo json_encode(['success' => true, 'comments' => $comments]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch comments: ' . $e->getMessage()]);
    }
}

// Additional API endpoints for enhanced functionality
function getIssuesByLocation($db) {
    $lat = $_GET['lat'] ?? 0;
    $lng = $_GET['lng'] ?? 0;
    $radius = $_GET['radius'] ?? 10; // km
    
    try {
        // Using Haversine formula to find nearby issues
        $stmt = $db->prepare("SELECT i.*, u.full_name as reporter_name,
                             (SELECT COUNT(*) FROM issue_upvotes WHERE issue_id = i.id) as upvotes,
                             (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * 
                              cos(radians(longitude) - radians(?)) + 
                              sin(radians(?)) * sin(radians(latitude)))) AS distance
                             FROM issues i 
                             LEFT JOIN users u ON i.user_id = u.id 
                             WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                             HAVING distance < ?
                             ORDER BY distance ASC");
        
        $stmt->execute([$lat, $lng, $lat, $radius]);
        $issues = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Hide reporter name for anonymous posts
        foreach ($issues as &$issue) {
            if ($issue['anonymous']) {
                $issue['reporter_name'] = 'Anonymous';
            }
        }
        
        echo json_encode(['success' => true, 'issues' => $issues]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch nearby issues: ' . $e->getMessage()]);
    }
}

function getTrendingIssues($db) {
    try {
        // Get trending issues based on upvotes and recency
        $stmt = $db->prepare("SELECT i.*, u.full_name as reporter_name,
                             (SELECT COUNT(*) FROM issue_upvotes WHERE issue_id = i.id) as upvotes,
                             (SELECT COUNT(*) FROM issue_comments WHERE issue_id = i.id) as comments,
                             TIMESTAMPDIFF(HOUR, i.created_at, NOW()) as hours_old
                             FROM issues i 
                             LEFT JOIN users u ON i.user_id = u.id 
                             WHERE i.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                             ORDER BY (upvotes * 2 + comments) / (hours_old + 1) DESC
                             LIMIT 10");
        
        $stmt->execute();
        $issues = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Hide reporter name for anonymous posts
        foreach ($issues as &$issue) {
            if ($issue['anonymous']) {
                $issue['reporter_name'] = 'Anonymous';
            }
        }
        
        echo json_encode(['success' => true, 'issues' => $issues]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch trending issues: ' . $e->getMessage()]);
    }
}
?>