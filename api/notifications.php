<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
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
    case 'get_notifications':
        getNotifications($db);
        break;
    case 'mark_read':
        markNotificationRead($db);
        break;
    case 'create_notification':
        createNotification($db);
        break;
    case 'get_unread_count':
        getUnreadCount($db);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}

function getNotifications($db) {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not authenticated']);
        return;
    }
    
    try {
        $user_id = $_SESSION['user_id'];
        $user_type = $_SESSION['user_type'];
        
        // Get notifications for the user
        $stmt = $db->prepare("SELECT * FROM notifications 
                             WHERE (user_id = ? OR user_type = ? OR user_type = 'all') 
                             ORDER BY created_at DESC 
                             LIMIT 50");
        $stmt->execute([$user_id, $user_type]);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'notifications' => $notifications]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch notifications: ' . $e->getMessage()]);
    }
}

function markNotificationRead($db) {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not authenticated']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $notification_id = $input['notification_id'] ?? 0;
    
    try {
        $stmt = $db->prepare("UPDATE notifications SET read_status = TRUE WHERE id = ? AND user_id = ?");
        $stmt->execute([$notification_id, $_SESSION['user_id']]);
        
        echo json_encode(['success' => true, 'message' => 'Notification marked as read']);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to update notification: ' . $e->getMessage()]);
    }
}

function createNotification($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    try {
        $stmt = $db->prepare("INSERT INTO notifications (user_id, user_type, title, message, notification_type, related_id) 
                             VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['user_id'] ?? null,
            $input['user_type'] ?? 'all',
            $input['title'],
            $input['message'],
            $input['type'] ?? 'info',
            $input['related_id'] ?? null
        ]);
        
        echo json_encode(['success' => true, 'message' => 'Notification created successfully']);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to create notification: ' . $e->getMessage()]);
    }
}

function getUnreadCount($db) {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not authenticated']);
        return;
    }
    
    try {
        $user_id = $_SESSION['user_id'];
        $user_type = $_SESSION['user_type'];
        
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM notifications 
                             WHERE (user_id = ? OR user_type = ? OR user_type = 'all') 
                             AND read_status = FALSE");
        $stmt->execute([$user_id, $user_type]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'count' => $result['count']]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to get unread count: ' . $e->getMessage()]);
    }
}
?>