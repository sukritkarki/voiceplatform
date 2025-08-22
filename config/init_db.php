<?php
// Database initialization script
require_once 'database.php';

$database = new Database();
$db = $database->getConnection();

// Create database if not exists
try {
    $db->exec("CREATE DATABASE IF NOT EXISTS standwithnepal");
    $db->exec("USE standwithnepal");
    
    // Users table
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        user_type ENUM('citizen', 'official', 'admin') DEFAULT 'citizen',
        province_id INT,
        district VARCHAR(100),
        municipality VARCHAR(100),
        ward_no INT,
        official_id VARCHAR(50),
        jurisdiction ENUM('ward', 'municipality', 'district', 'province'),
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
    
    // Issues table
    $db->exec("CREATE TABLE IF NOT EXISTS issues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category ENUM('road', 'electricity', 'water', 'healthcare', 'corruption', 'education', 'environment') NOT NULL,
        severity ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        status ENUM('new', 'acknowledged', 'in-progress', 'resolved') DEFAULT 'new',
        province_id INT NOT NULL,
        district VARCHAR(100) NOT NULL,
        municipality VARCHAR(100) NOT NULL,
        ward_no INT NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        image_path VARCHAR(255),
        video_path VARCHAR(255),
        anonymous BOOLEAN DEFAULT FALSE,
        user_id INT,
        upvotes INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )");
    
    // Issue updates table
    $db->exec("CREATE TABLE IF NOT EXISTS issue_updates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_id INT NOT NULL,
        user_id INT NOT NULL,
        update_text TEXT NOT NULL,
        update_type ENUM('comment', 'status_change', 'official_response') DEFAULT 'comment',
        old_status ENUM('new', 'acknowledged', 'in-progress', 'resolved'),
        new_status ENUM('new', 'acknowledged', 'in-progress', 'resolved'),
        attachment_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");
    
    // Upvotes table
    $db->exec("CREATE TABLE IF NOT EXISTS issue_upvotes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_id INT NOT NULL,
        user_id INT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_user_vote (issue_id, user_id),
        UNIQUE KEY unique_ip_vote (issue_id, ip_address)
    )");
    
    // Comments table
    $db->exec("CREATE TABLE IF NOT EXISTS issue_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_id INT NOT NULL,
        user_id INT,
        comment_text TEXT NOT NULL,
        anonymous BOOLEAN DEFAULT FALSE,
        moderated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )");
    
    // Notifications table
    $db->exec("CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        user_type ENUM('citizen', 'official', 'admin', 'all') DEFAULT 'all',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        notification_type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
        related_id INT,
        read_status BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");
    
    // System settings table
    $db->exec("CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
    
    // Location data tables
    $db->exec("CREATE TABLE IF NOT EXISTS provinces (
        id INT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        name_nepali VARCHAR(100)
    )");
    
    $db->exec("CREATE TABLE IF NOT EXISTS districts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        name_nepali VARCHAR(100),
        province_id INT NOT NULL,
        FOREIGN KEY (province_id) REFERENCES provinces(id)
    )");
    
    $db->exec("CREATE TABLE IF NOT EXISTS municipalities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        name_nepali VARCHAR(100),
        district_id INT NOT NULL,
        type ENUM('metropolitan', 'sub_metropolitan', 'municipality', 'rural_municipality') NOT NULL,
        total_wards INT DEFAULT 1,
        FOREIGN KEY (district_id) REFERENCES districts(id)
    )");
    
    // Insert sample location data
    $db->exec("INSERT IGNORE INTO provinces (id, name, name_nepali) VALUES 
        (1, 'Province 1', 'प्रदेश १'),
        (2, 'Madhesh Province', 'मधेश प्रदेश'),
        (3, 'Bagmati Province', 'बागमती प्रदेश'),
        (4, 'Gandaki Province', 'गण्डकी प्रदेश'),
        (5, 'Lumbini Province', 'लुम्बिनी प्रदेश'),
        (6, 'Karnali Province', 'कर्णाली प्रदेश'),
        (7, 'Sudurpashchim Province', 'सुदूरपश्चिम प्रदेश')");
    
    $db->exec("INSERT IGNORE INTO districts (name, name_nepali, province_id) VALUES 
        ('Kathmandu', 'काठमाडौं', 3),
        ('Lalitpur', 'ललितपुर', 3),
        ('Bhaktapur', 'भक्तपुर', 3),
        ('Kaski', 'कास्की', 4),
        ('Chitwan', 'चितवन', 3)");
    
    $db->exec("INSERT IGNORE INTO municipalities (name, name_nepali, district_id, type, total_wards) VALUES 
        ('Kathmandu Metropolitan City', 'काठमाडौं महानगरपालिका', 1, 'metropolitan', 32),
        ('Lalitpur Metropolitan City', 'ललितपुर महानगरपालिका', 2, 'metropolitan', 29),
        ('Bhaktapur Municipality', 'भक्तपुर नगरपालिका', 3, 'municipality', 10),
        ('Pokhara Metropolitan City', 'पोखरा महानगरपालिका', 4, 'metropolitan', 33),
        ('Bharatpur Metropolitan City', 'भरतपुर महानगरपालिका', 5, 'metropolitan', 29)");
    
    // Insert sample admin user
    $admin_password = password_hash('admin123', PASSWORD_DEFAULT);
    $db->exec("INSERT IGNORE INTO users (full_name, email, password, user_type) VALUES 
        ('System Administrator', 'admin@standwithnepal.org', '$admin_password', 'admin')");
    
    // Insert sample government official
    $official_password = password_hash('official123', PASSWORD_DEFAULT);
    $db->exec("INSERT IGNORE INTO users (full_name, email, password, user_type, official_id, jurisdiction, district, municipality, ward_no, verified) VALUES 
        ('Ram Bahadur Thapa', 'ram.thapa@ktm.gov.np', '$official_password', 'official', 'KTM001', 'ward', 'Kathmandu', 'Kathmandu Metropolitan City', 10, TRUE)");
    
    echo "Database initialized successfully!";
    
} catch(PDOException $exception) {
    echo "Database initialization error: " . $exception->getMessage();
}
?>