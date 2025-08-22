<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
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
    case 'dashboard_stats':
        getDashboardStats($db);
        break;
    case 'category_distribution':
        getCategoryDistribution($db);
        break;
    case 'resolution_trends':
        getResolutionTrends($db);
        break;
    case 'regional_stats':
        getRegionalStats($db);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}

function getDashboardStats($db) {
    try {
        $filters = [];
        $params = [];
        
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
        
        // Total issues
        $stmt = $db->prepare("SELECT COUNT(*) as total FROM issues $where_clause");
        $stmt->execute($params);
        $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Issues by status
        $stmt = $db->prepare("SELECT status, COUNT(*) as count FROM issues $where_clause GROUP BY status");
        $stmt->execute($params);
        $status_counts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $stats = [
            'total' => $total,
            'new' => 0,
            'acknowledged' => 0,
            'in_progress' => 0,
            'resolved' => 0
        ];
        
        foreach ($status_counts as $status) {
            $stats[$status['status']] = $status['count'];
        }
        
        echo json_encode(['success' => true, 'stats' => $stats]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch stats: ' . $e->getMessage()]);
    }
}

function getCategoryDistribution($db) {
    try {
        $stmt = $db->prepare("SELECT category, COUNT(*) as count FROM issues GROUP BY category ORDER BY count DESC");
        $stmt->execute();
        $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'categories' => $categories]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch category distribution: ' . $e->getMessage()]);
    }
}

function getResolutionTrends($db) {
    try {
        $stmt = $db->prepare("SELECT 
                                DATE_FORMAT(created_at, '%Y-%m') as month,
                                COUNT(*) as reported,
                                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
                             FROM issues 
                             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                             GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                             ORDER BY month");
        
        $stmt->execute();
        $trends = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'trends' => $trends]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch trends: ' . $e->getMessage()]);
    }
}

function getRegionalStats($db) {
    try {
        $stmt = $db->prepare("SELECT 
                                district,
                                COUNT(*) as total_issues,
                                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_issues,
                                ROUND(AVG(CASE WHEN status = 'resolved' THEN DATEDIFF(updated_at, created_at) END), 1) as avg_resolution_days
                             FROM issues 
                             GROUP BY district 
                             ORDER BY total_issues DESC 
                             LIMIT 10");
        
        $stmt->execute();
        $regional_stats = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'regional_stats' => $regional_stats]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch regional stats: ' . $e->getMessage()]);
    }
}
?>