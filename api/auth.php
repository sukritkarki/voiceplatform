<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
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
    case 'login':
        handleLogin($db);
        break;
    case 'register':
        handleRegister($db);
        break;
    case 'logout':
        handleLogout();
        break;
    case 'check_session':
        checkSession();
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}

function handleLogin($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode(['success' => false, 'message' => 'Invalid input']);
        return;
    }
    
    $user_type = $input['user_type'] ?? 'citizen';
    
    try {
        if ($user_type === 'citizen') {
            $stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND user_type = 'citizen'");
            $stmt->execute([$input['email']]);
        } elseif ($user_type === 'official') {
            $stmt = $db->prepare("SELECT * FROM users WHERE official_id = ? AND user_type = 'official' AND verified = TRUE");
            $stmt->execute([$input['official_id']]);
        } elseif ($user_type === 'admin') {
            $stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND user_type = 'admin'");
            $stmt->execute([$input['username'] . '@standwithnepal.org']);
        }
        
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user && password_verify($input['password'], $user['password'])) {
            // Additional validation for admin
            if ($user_type === 'admin' && $input['admin_code'] !== 'SWN2025') {
                echo json_encode(['success' => false, 'message' => 'Invalid admin code']);
                return;
            }
            
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_type'] = $user['user_type'];
            $_SESSION['user_name'] = $user['full_name'];
            
            if ($user_type === 'official') {
                $_SESSION['jurisdiction'] = $user['jurisdiction'];
                $_SESSION['district'] = $user['district'];
                $_SESSION['municipality'] = $user['municipality'];
                $_SESSION['ward_no'] = $user['ward_no'];
            }
            
            echo json_encode([
                'success' => true, 
                'message' => 'Login successful',
                'user' => [
                    'id' => $user['id'],
                    'name' => $user['full_name'],
                    'type' => $user['user_type'],
                    'jurisdiction' => $user['jurisdiction'] ?? null,
                    'area' => $user['district'] . ($user['ward_no'] ? ' Ward-' . $user['ward_no'] : '')
                ]
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
        }
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
}

function handleRegister($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode(['success' => false, 'message' => 'Invalid input']);
        return;
    }
    
    try {
        // Check if email already exists
        $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$input['email']]);
        
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'message' => 'Email already registered']);
            return;
        }
        
        // Hash password
        $hashed_password = password_hash($input['password'], PASSWORD_DEFAULT);
        
        // Insert new user
        $stmt = $db->prepare("INSERT INTO users (full_name, email, phone, password, province_id, user_type) VALUES (?, ?, ?, ?, ?, 'citizen')");
        $stmt->execute([
            $input['full_name'],
            $input['email'],
            $input['phone'] ?? null,
            $hashed_password,
            $input['province'] ?? null
        ]);
        
        echo json_encode(['success' => true, 'message' => 'Registration successful']);
        
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Registration failed: ' . $e->getMessage()]);
    }
}

function handleLogout() {
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
}

function checkSession() {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'name' => $_SESSION['user_name'],
                'type' => $_SESSION['user_type']
            ]
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
    }
}
?>