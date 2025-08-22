// Admin Panel JavaScript

let currentAdminUser;
let adminData = {
    users: [],
    issues: [],
    officials: [],
    activities: []
};

document.addEventListener('DOMContentLoaded', function() {
    initializeAdminPanel();
});

function initializeAdminPanel() {
    checkAdminAuthentication();
    setupAdminEventListeners();
    loadAdminData();
    setupAdminNavigation();
}

// Authentication Check
function checkAdminAuthentication() {
    const user = sessionStorage.getItem('standwithnepal_user');
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    currentAdminUser = JSON.parse(user);
    
    if (currentAdminUser.type !== 'admin') {
        showNotification('Access denied. Admin privileges required.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
    
    // Update admin info
    const adminName = document.getElementById('adminName');
    if (adminName) adminName.textContent = currentAdminUser.name || 'System Admin';
}

// Event Listeners
function setupAdminEventListeners() {
    // Navigation
    document.querySelectorAll('.admin-nav .nav-link').forEach(link => {
        link.addEventListener('click', handleAdminNavigation);
    });

    // Logout
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleAdminLogout);
    }

    // Add User Button
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', openUserModal);
    }

    // User Form
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', handleUserFormSubmit);
    }

    // Modal Close
    const closeBtn = document.querySelector('#userModal .close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeUserModal);
    }

    // Moderation Filter
    const moderationFilter = document.getElementById('moderationFilter');
    if (moderationFilter) {
        moderationFilter.addEventListener('change', handleModerationFilter);
    }
}

// Navigation
function setupAdminNavigation() {
    showAdminSection('dashboard');
}

function handleAdminNavigation(e) {
    e.preventDefault();
    
    const targetSection = e.target.getAttribute('href').substring(1);
    showAdminSection(targetSection);
    
    // Update active nav link
    document.querySelectorAll('.admin-nav .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Update page title
    const pageTitle = document.getElementById('adminPageTitle');
    if (pageTitle) {
        const sectionTitles = {
            'dashboard': 'System Dashboard',
            'users': 'User Management',
            'issues': 'Issue Moderation',
            'officials': 'Official Verification',
            'reports': 'System Reports',
            'settings': 'System Settings'
        };
        pageTitle.textContent = sectionTitles[targetSection] || 'Admin Panel';
    }
}

function showAdminSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Load section-specific data
    switch(sectionName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsersData();
            break;
        case 'issues':
            loadIssuesModerationData();
            break;
        case 'officials':
            loadOfficialVerificationData();
            break;
    }
}

// Load Admin Data
function loadAdminData() {
    // Load sample data (in real app, this would come from API)
    adminData.users = JSON.parse(localStorage.getItem('standwithnepal_users') || '[]');
    adminData.issues = JSON.parse(localStorage.getItem('standwithnepal_issues') || '[]');
    adminData.officials = generateSampleOfficials();
    adminData.activities = generateRecentActivities();
    
    updateAdminStats();
}

function updateAdminStats() {
    const totalUsers = document.getElementById('totalUsers');
    const totalIssues = document.getElementById('totalIssuesAdmin');
    const totalOfficials = document.getElementById('totalOfficials');
    const pendingApprovals = document.getElementById('pendingApprovals');

    if (totalUsers) totalUsers.textContent = adminData.users.length;
    if (totalIssues) totalIssues.textContent = adminData.issues.length;
    if (totalOfficials) totalOfficials.textContent = adminData.officials.filter(o => o.verified).length;
    if (pendingApprovals) pendingApprovals.textContent = adminData.officials.filter(o => !o.verified).length;
}

// Dashboard Data
function loadDashboardData() {
    loadRecentActivities();
}

function loadRecentActivities() {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    const activities = adminData.activities.slice(0, 5);
    
    container.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-time">${formatDate(activity.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

// User Management
function loadUsersData() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = adminData.users.map(user => `
        <tr>
            <td>${user.full_name || user.name || 'N/A'}</td>
            <td>${user.email}</td>
            <td><span class="status-badge">${user.user_type || 'citizen'}</span></td>
            <td><span class="status-badge status-${user.verified !== false ? 'active' : 'pending'}">${user.verified !== false ? 'Active' : 'Pending'}</span></td>
            <td>${formatDate(user.created_at || new Date().toISOString())}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openUserModal(userId = null) {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    
    if (userId) {
        title.textContent = 'Edit User';
        // Load user data for editing
        const user = adminData.users.find(u => u.id === userId);
        if (user) {
            document.getElementById('userFullName').value = user.full_name || '';
            document.getElementById('userEmail').value = user.email || '';
            document.getElementById('userType').value = user.user_type || 'citizen';
        }
    } else {
        title.textContent = 'Add New User';
        form.reset();
    }
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeUserModal() {
    const modal = document.getElementById('userModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function handleUserFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        id: generateId(),
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        user_type: formData.get('user_type'),
        password: formData.get('password'),
        created_at: new Date().toISOString(),
        verified: true
    };
    
    // Add to users array
    adminData.users.push(userData);
    localStorage.setItem('standwithnepal_users', JSON.stringify(adminData.users));
    
    // Update display
    loadUsersData();
    updateAdminStats();
    closeUserModal();
    
    showNotification('User added successfully', 'success');
}

function editUser(userId) {
    openUserModal(userId);
}

function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        adminData.users = adminData.users.filter(u => u.id !== userId);
        localStorage.setItem('standwithnepal_users', JSON.stringify(adminData.users));
        loadUsersData();
        updateAdminStats();
        showNotification('User deleted successfully', 'success');
    }
}

// Issue Moderation
function loadIssuesModerationData() {
    const container = document.getElementById('issuesModeration');
    if (!container) return;

    const filter = document.getElementById('moderationFilter')?.value || '';
    let filteredIssues = adminData.issues;
    
    if (filter === 'flagged') {
        filteredIssues = adminData.issues.filter(issue => issue.flagged);
    } else if (filter === 'pending') {
        filteredIssues = adminData.issues.filter(issue => !issue.moderated);
    }

    container.innerHTML = filteredIssues.map(issue => `
        <div class="moderation-item">
            <div class="moderation-header">
                <div class="moderation-title">${issue.title}</div>
                <div class="moderation-actions">
                    <button class="btn btn-sm btn-success" onclick="approveIssue('${issue.id}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="rejectIssue('${issue.id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            </div>
            <div class="moderation-content">
                ${issue.description}
            </div>
            <div class="moderation-meta">
                <span>Category: ${getCategoryLabel(issue.category)}</span>
                <span>Location: ${issue.municipality}, Ward ${issue.ward}</span>
                <span>Posted: ${formatDate(issue.timestamp)}</span>
            </div>
        </div>
    `).join('');
}

function handleModerationFilter() {
    loadIssuesModerationData();
}

function approveIssue(issueId) {
    const issueIndex = adminData.issues.findIndex(i => i.id === issueId);
    if (issueIndex !== -1) {
        adminData.issues[issueIndex].moderated = true;
        adminData.issues[issueIndex].approved = true;
        localStorage.setItem('standwithnepal_issues', JSON.stringify(adminData.issues));
        loadIssuesModerationData();
        showNotification('Issue approved successfully', 'success');
    }
}

function rejectIssue(issueId) {
    if (confirm('Are you sure you want to reject this issue?')) {
        const issueIndex = adminData.issues.findIndex(i => i.id === issueId);
        if (issueIndex !== -1) {
            adminData.issues[issueIndex].moderated = true;
            adminData.issues[issueIndex].approved = false;
            localStorage.setItem('standwithnepal_issues', JSON.stringify(adminData.issues));
            loadIssuesModerationData();
            showNotification('Issue rejected', 'warning');
        }
    }
}

// Official Verification
function loadOfficialVerificationData() {
    const container = document.getElementById('verificationQueue');
    if (!container) return;

    const pendingOfficials = adminData.officials.filter(official => !official.verified);

    container.innerHTML = pendingOfficials.map(official => `
        <div class="verification-item">
            <div class="verification-header">
                <h4>${official.name}</h4>
                <span class="status-badge status-pending">Pending Verification</span>
            </div>
            <div class="verification-info">
                <div class="info-item">
                    <span class="info-label">Official ID</span>
                    <span class="info-value">${official.official_id}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Position</span>
                    <span class="info-value">${official.position}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Jurisdiction</span>
                    <span class="info-value">${official.jurisdiction}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Area</span>
                    <span class="info-value">${official.area}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Applied</span>
                    <span class="info-value">${formatDate(official.applied_date)}</span>
                </div>
            </div>
            <div class="verification-actions">
                <button class="btn btn-success" onclick="verifyOfficial('${official.id}')">
                    <i class="fas fa-check"></i> Verify
                </button>
                <button class="btn btn-danger" onclick="rejectOfficial('${official.id}')">
                    <i class="fas fa-times"></i> Reject
                </button>
            </div>
        </div>
    `).join('');
}

function verifyOfficial(officialId) {
    const officialIndex = adminData.officials.findIndex(o => o.id === officialId);
    if (officialIndex !== -1) {
        adminData.officials[officialIndex].verified = true;
        adminData.officials[officialIndex].verified_date = new Date().toISOString();
        loadOfficialVerificationData();
        updateAdminStats();
        showNotification('Official verified successfully', 'success');
    }
}

function rejectOfficial(officialId) {
    if (confirm('Are you sure you want to reject this official verification?')) {
        adminData.officials = adminData.officials.filter(o => o.id !== officialId);
        loadOfficialVerificationData();
        updateAdminStats();
        showNotification('Official verification rejected', 'warning');
    }
}

// Logout
function handleAdminLogout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('standwithnepal_user');
        showNotification('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    }
}

// Utility Functions
function generateSampleOfficials() {
    return [
        {
            id: '1',
            name: 'Ram Bahadur Thapa',
            official_id: 'KTM001',
            position: 'Ward Chairperson',
            jurisdiction: 'ward',
            area: 'Kathmandu Ward-10',
            verified: true,
            applied_date: '2025-01-10T10:00:00Z'
        },
        {
            id: '2',
            name: 'Sita Kumari Sharma',
            official_id: 'PKR002',
            position: 'Municipal Representative',
            jurisdiction: 'municipality',
            area: 'Pokhara Metropolitan',
            verified: false,
            applied_date: '2025-01-12T14:30:00Z'
        },
        {
            id: '3',
            name: 'Hari Prasad Gautam',
            official_id: 'LTP003',
            position: 'Ward Secretary',
            jurisdiction: 'ward',
            area: 'Lalitpur Ward-5',
            verified: false,
            applied_date: '2025-01-14T09:15:00Z'
        }
    ];
}

function generateRecentActivities() {
    return [
        {
            id: '1',
            title: 'New user registration: John Doe',
            icon: 'fas fa-user-plus',
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago
        },
        {
            id: '2',
            title: 'Issue reported: Road damage in Kathmandu',
            icon: 'fas fa-exclamation-triangle',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
        },
        {
            id: '3',
            title: 'Official verification approved',
            icon: 'fas fa-check-circle',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() // 4 hours ago
        },
        {
            id: '4',
            title: 'Issue resolved: Water supply fixed',
            icon: 'fas fa-wrench',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() // 6 hours ago
        },
        {
            id: '5',
            title: 'System backup completed',
            icon: 'fas fa-database',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() // 12 hours ago
        }
    ];
}

function getCategoryLabel(category) {
    const labels = {
        'road': 'Road & Infrastructure',
        'electricity': 'Electricity',
        'water': 'Water Supply',
        'healthcare': 'Healthcare',
        'corruption': 'Corruption',
        'education': 'Education',
        'environment': 'Environment'
    };
    return labels[category] || category;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;

    // Add styles if not already present
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                color: white;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
                max-width: 400px;
            }
            .notification-success { background: #10b981; }
            .notification-error { background: #ef4444; }
            .notification-info { background: #3b82f6; }
            .notification-warning { background: #f59e0b; }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            .notification-close {
                background: none;
                border: none;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
                flex-shrink: 0;
            }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);

    // Close button functionality
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
}