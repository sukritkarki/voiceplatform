<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$action = $_GET['action'] ?? '';

switch($action) {
    case 'provinces':
        getProvinces($db);
        break;
    case 'districts':
        getDistricts($db);
        break;
    case 'municipalities':
        getMunicipalities($db);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}

function getProvinces($db) {
    try {
        $stmt = $db->prepare("SELECT * FROM provinces ORDER BY id");
        $stmt->execute();
        $provinces = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'provinces' => $provinces]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch provinces: ' . $e->getMessage()]);
    }
}

function getDistricts($db) {
    $province_id = $_GET['province_id'] ?? 0;
    
    try {
        $stmt = $db->prepare("SELECT * FROM districts WHERE province_id = ? ORDER BY name");
        $stmt->execute([$province_id]);
        $districts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'districts' => $districts]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch districts: ' . $e->getMessage()]);
    }
}

function getMunicipalities($db) {
    $district_id = $_GET['district_id'] ?? 0;
    
    try {
        $stmt = $db->prepare("SELECT * FROM municipalities WHERE district_id = ? ORDER BY name");
        $stmt->execute([$district_id]);
        $municipalities = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'municipalities' => $municipalities]);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to fetch municipalities: ' . $e->getMessage()]);
    }
}
?>