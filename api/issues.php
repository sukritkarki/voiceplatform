<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
session_start();

$database = new Database();
$db = $database->getConnection();

$action = $_GET['action'] ?? '';

switch($action) {
    case 'create':
        createIssue($db);
        break;
    case 'list':
        listIssues($db);
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
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}

function createIssue($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode(['success' => false, 'message' => 'Invalid input']);
        return;
    }
    
    try {
        $user_id = $input['anonymous'] ? null : ($_SESSION['user_id'] ?? null);
        
        $stmt = $db->prepare("INSERT INTO issues (title, description, category, severity, province_id, district, municipality, ward_no, latitude, longitude, anonymous, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        $stmt->execute([
            $input['title'],
            $input['description'],
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
        
        echo json_encode([
            'success' => true, 
            'message' => 'Issue created successfully',
            'issue_id' => $issue_id
        ]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to create issue: ' . $e->getMessage()]);
    }
}

function listIssues($db) {
    try {
        $filters = [];
        $params = [];
        
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
        
        $stmt = $db->prepare("SELECT i.*, u.full_name as reporter_name, 
                             (SELECT COUNT(*) FROM issue_upvotes WHERE issue_id = i.id) as upvotes
                             FROM issues i 
                             LEFT JOIN users u ON i.user_id = u.id 
                             $where_clause 
                             ORDER BY i.created_at DESC");
        
        $stmt->execute($params);
        $issues = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Hide reporter name for anonymous posts
        foreach ($issues as &$issue) {
            if ($issue['anonymous']) {
                $issue['reporter_name'] = 'Anonymous';
            }
        }
        
        echo json_encode(['success' => true, 'issues' => $issues]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch issues: ' . $e->getMessage()]);
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