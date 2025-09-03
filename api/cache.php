<?php
// Advanced Caching API
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

// Redis connection
$redis = null;
if (class_exists('Redis')) {
    try {
        $redis = new Redis();
        $redis->connect('127.0.0.1', 6379);
        $redis->select(1); // Use database 1 for application cache
    } catch (Exception $e) {
        $redis = null;
    }
}

$action = $_GET['action'] ?? '';

switch($action) {
    case 'get':
        getCacheData($redis);
        break;
    case 'set':
        setCacheData($redis);
        break;
    case 'delete':
        deleteCacheData($redis);
        break;
    case 'clear':
        clearCache($redis);
        break;
    case 'stats':
        getCacheStats($redis);
        break;
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}

function getCacheData($redis) {
    $key = $_GET['key'] ?? '';
    
    if (empty($key)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Key required']);
        return;
    }
    
    try {
        if ($redis) {
            $data = $redis->get($key);
            if ($data !== false) {
                echo json_encode([
                    'success' => true,
                    'data' => json_decode($data, true),
                    'source' => 'redis'
                ]);
                return;
            }
        }
        
        // Fallback to file cache
        $cacheFile = sys_get_temp_dir() . '/cache_' . md5($key);
        if (file_exists($cacheFile)) {
            $cached = json_decode(file_get_contents($cacheFile), true);
            if (time() - $cached['timestamp'] < $cached['ttl']) {
                echo json_encode([
                    'success' => true,
                    'data' => $cached['data'],
                    'source' => 'file'
                ]);
                return;
            } else {
                unlink($cacheFile);
            }
        }
        
        echo json_encode(['success' => false, 'message' => 'Cache miss']);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Cache error: ' . $e->getMessage()]);
    }
}

function setCacheData($redis) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['key']) || !isset($input['data'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Key and data required']);
        return;
    }
    
    $key = $input['key'];
    $data = $input['data'];
    $ttl = $input['ttl'] ?? 300; // 5 minutes default
    
    try {
        if ($redis) {
            $redis->setex($key, $ttl, json_encode($data));
            echo json_encode(['success' => true, 'message' => 'Cached in Redis']);
        } else {
            // Fallback to file cache
            $cacheFile = sys_get_temp_dir() . '/cache_' . md5($key);
            $cacheData = [
                'data' => $data,
                'timestamp' => time(),
                'ttl' => $ttl
            ];
            file_put_contents($cacheFile, json_encode($cacheData));
            echo json_encode(['success' => true, 'message' => 'Cached in file']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Cache error: ' . $e->getMessage()]);
    }
}

function deleteCacheData($redis) {
    $key = $_GET['key'] ?? '';
    
    try {
        if ($redis) {
            $redis->del($key);
        }
        
        // Also remove from file cache
        $cacheFile = sys_get_temp_dir() . '/cache_' . md5($key);
        if (file_exists($cacheFile)) {
            unlink($cacheFile);
        }
        
        echo json_encode(['success' => true, 'message' => 'Cache deleted']);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Delete error: ' . $e->getMessage()]);
    }
}

function clearCache($redis) {
    try {
        if ($redis) {
            $redis->flushDB();
        }
        
        // Clear file cache
        $files = glob(sys_get_temp_dir() . '/cache_*');
        foreach ($files as $file) {
            unlink($file);
        }
        
        echo json_encode(['success' => true, 'message' => 'Cache cleared']);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Clear error: ' . $e->getMessage()]);
    }
}

function getCacheStats($redis) {
    try {
        $stats = ['type' => 'file', 'entries' => 0];
        
        if ($redis) {
            $info = $redis->info();
            $stats = [
                'type' => 'redis',
                'entries' => $redis->dbSize(),
                'memory_usage' => $info['used_memory_human'] ?? 'N/A',
                'hit_rate' => $info['keyspace_hit_rate'] ?? 'N/A'
            ];
        } else {
            $files = glob(sys_get_temp_dir() . '/cache_*');
            $stats['entries'] = count($files);
        }
        
        echo json_encode(['success' => true, 'stats' => $stats]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Stats error: ' . $e->getMessage()]);
    }
}
?>