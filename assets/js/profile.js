// Profile page functionality

let currentUser;
let userIssues = [];
let userActivity = [];
let userNotifications = [];

document.addEventListener('DOMContentLoaded', function() {
    initializeProfile();
});

function initializeProfile() {
    checkUserAuthentication();
    setupProfileEventListeners();
    loadUserData();
    setupProfileNavigation();
}

// Authentication Check
function checkUserAuthentication() {
    const user = sessionStorage.getItem('standwithnepal_user');
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = JSON.parse(user);
    updateProfileDisplay();
}

// Update Profile Display
function updateProfileDisplay() {
    // Update profile info
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileType = document.getElementById('profileType');
    
    if (profileName) profileName.textContent = currentUser.name || 'User';
    if (profileEmail) profileEmail.textContent = currentUser.email || '';
    if (profileType) {
        const typeLabels = {
            'citizen': 'Citizen',
            'official': 'Government Official',
            'admin': 'Administrator'
        };
        profileType.textContent = typeLabels[currentUser.type] || 'Citizen';
    }
    
    // Update form fields
    const fullName = document.getElementById('fullName');
    const email = document.getElementById('email');
    
    if (fullName) fullName.value = currentUser.name || '';
    if (email) email.value = currentUser.email || '';
}

// Event Listeners
function setupProfileEventListeners() {
    // Profile navigation
    document.querySelectorAll('.profile-nav-link').forEach(link => {
        link.addEventListener('click', handleProfileNavigation);
    });

    // Edit profile button
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', toggleEditMode);
    }

    // Cancel edit button
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', cancelEditMode);
    }

    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }

    // Issue status filter
    const issueStatusFilter = document.getElementById('issueStatusFilter');
    if (issueStatusFilter) {
        issueStatusFilter.addEventListener('change', filterUserIssues);
    }

    // Settings buttons
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', openPasswordModal);
    }

    // Password modal
    const passwordModal = document.getElementById('passwordModal');
    const closeBtn = passwordModal?.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closePasswordModal);
    }

    // Password form
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordChange);
    }

    // Mark all notifications read
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsRead);
    }

    // Logout
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', handleLogout);
    }

    // Settings checkboxes
    const settingsCheckboxes = document.querySelectorAll('#settings-section input[type="checkbox"]');
    settingsCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleSettingChange);
    });
}

// Profile Navigation
function setupProfileNavigation() {
    showProfileSection('personal');
}

function handleProfileNavigation(e) {
    e.preventDefault();
    
    const targetSection = e.target.getAttribute('href').substring(1);
    showProfileSection(targetSection);
    
    // Update active nav link
    document.querySelectorAll('.profile-nav-link').forEach(link => {
        link.classList.remove('active');
    });
    e.target.classList.add('active');
}

function showProfileSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.profile-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Load section-specific data
    switch(sectionName) {
        case 'issues':
            loadUserIssues();
            break;
        case 'activity':
            loadUserActivity();
            break;
        case 'notifications':
            loadUserNotifications();
            break;
        case 'settings':
            loadUserSettings();
            break;
    }
}

// Load User Data
function loadUserData() {
    // Load user's issues
    const allIssues = JSON.parse(localStorage.getItem('standwithnepal_issues') || '[]');
    userIssues = allIssues.filter(issue => 
        !issue.anonymous && issue.user_id === currentUser.id
    );
    
    // Generate user activity
    userActivity = generateUserActivity();
    
    // Generate notifications
    userNotifications = generateUserNotifications();
    
    // Update stats
    updateUserStats();
}

function updateUserStats() {
    const issuesPosted = document.getElementById('issuesPosted');
    const upvotesReceived = document.getElementById('upvotesReceived');
    const commentsPosted = document.getElementById('commentsPosted');

    if (issuesPosted) issuesPosted.textContent = userIssues.length;
    if (upvotesReceived) {
        const totalUpvotes = userIssues.reduce((sum, issue) => sum + (issue.upvotes || 0), 0);
        upvotesReceived.textContent = totalUpvotes;
    }
    if (commentsPosted) commentsPosted.textContent = Math.floor(Math.random() * 50) + 10; // Demo data
}

// Edit Profile
function toggleEditMode() {
    const form = document.getElementById('profileForm');
    const inputs = form.querySelectorAll('input, select, textarea');
    const formActions = document.getElementById('formActions');
    const editBtn = document.getElementById('editProfileBtn');

    inputs.forEach(input => {
        input.removeAttribute('readonly');
        input.removeAttribute('disabled');
    });

    formActions.style.display = 'flex';
    editBtn.style.display = 'none';
}

function cancelEditMode() {
    const form = document.getElementById('profileForm');
    const inputs = form.querySelectorAll('input, select, textarea');
    const formActions = document.getElementById('formActions');
    const editBtn = document.getElementById('editProfileBtn');

    inputs.forEach(input => {
        input.setAttribute('readonly', 'readonly');
        if (input.tagName === 'SELECT') {
            input.setAttribute('disabled', 'disabled');
        }
    });

    formActions.style.display = 'none';
    editBtn.style.display = 'inline-flex';
    
    // Reset form values
    updateProfileDisplay();
}

function handleProfileUpdate(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const updatedData = {
        ...currentUser,
        name: formData.get('full_name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        date_of_birth: formData.get('date_of_birth'),
        province: formData.get('province'),
        district: formData.get('district'),
        address: formData.get('address')
    };
    
    // Update session storage
    sessionStorage.setItem('standwithnepal_user', JSON.stringify(updatedData));
    currentUser = updatedData;
    
    // Update local storage users array
    let users = JSON.parse(localStorage.getItem('standwithnepal_users') || '[]');
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...updatedData };
        localStorage.setItem('standwithnepal_users', JSON.stringify(users));
    }
    
    cancelEditMode();
    showNotification('Profile updated successfully', 'success');
}

// User Issues
function loadUserIssues() {
    const container = document.getElementById('myIssuesGrid');
    if (!container) return;

    const filteredIssues = getFilteredUserIssues();
    
    if (filteredIssues.length === 0) {
        container.innerHTML = '<div class="no-issues"><p>No issues found.</p></div>';
        return;
    }

    container.innerHTML = filteredIssues.map(issue => `
        <div class="my-issue-card">
            <div class="issue-card-header">
                <div>
                    <div class="issue-card-title">${issue.title}</div>
                    <span class="issue-card-category">${getCategoryLabel(issue.category)}</span>
                </div>
                <span class="status-badge status-${issue.status}">${getStatusLabel(issue.status)}</span>
            </div>
            <div class="issue-card-description">${truncateText(issue.description, 100)}</div>
            <div class="issue-card-meta">
                <span><i class="fas fa-map-marker-alt"></i> ${issue.municipality}, Ward ${issue.ward}</span>
                <span><i class="fas fa-thumbs-up"></i> ${issue.upvotes || 0}</span>
                <span><i class="fas fa-clock"></i> ${formatDate(issue.timestamp)}</span>
            </div>
        </div>
    `).join('');
}

function filterUserIssues() {
    loadUserIssues();
}

function getFilteredUserIssues() {
    const statusFilter = document.getElementById('issueStatusFilter')?.value || '';
    
    return userIssues.filter(issue => {
        return !statusFilter || issue.status === statusFilter;
    });
}

// User Activity
function loadUserActivity() {
    const container = document.getElementById('activityTimeline');
    if (!container) return;

    container.innerHTML = userActivity.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-description">${activity.description}</div>
                <div class="activity-time">${formatDate(activity.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

// User Notifications
function loadUserNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;

    container.innerHTML = userNotifications.map(notification => `
        <div class="notification-item ${notification.read ? 'read' : 'unread'}">
            <div class="notification-icon">
                <i class="${notification.icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${formatDate(notification.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

function markAllNotificationsRead() {
    userNotifications.forEach(notification => {
        notification.read = true;
    });
    
    loadUserNotifications();
    showNotification('All notifications marked as read', 'success');
}

// Settings
function loadUserSettings() {
    // Load user preferences from localStorage or set defaults
    const settings = JSON.parse(localStorage.getItem(`user_settings_${currentUser.id}`) || '{}');
    
    const publicProfile = document.getElementById('publicProfile');
    const emailNotifications = document.getElementById('emailNotifications');
    const smsNotifications = document.getElementById('smsNotifications');

    if (publicProfile) publicProfile.checked = settings.publicProfile || false;
    if (emailNotifications) emailNotifications.checked = settings.emailNotifications !== false;
    if (smsNotifications) smsNotifications.checked = settings.smsNotifications || false;
}

function handleSettingChange(e) {
    const settingKey = e.target.id;
    const settingValue = e.target.checked;
    
    // Load current settings
    const settings = JSON.parse(localStorage.getItem(`user_settings_${currentUser.id}`) || '{}');
    settings[settingKey] = settingValue;
    
    // Save updated settings
    localStorage.setItem(`user_settings_${currentUser.id}`, JSON.stringify(settings));
    
    showNotification('Setting updated', 'success');
}

// Password Change
function openPasswordModal() {
    const modal = document.getElementById('passwordModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('passwordForm').reset();
}

function handlePasswordChange(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const currentPassword = formData.get('current_password');
    const newPassword = formData.get('new_password');
    const confirmPassword = formData.get('confirm_password');
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        return;
    }
    
    // In a real app, you would verify the current password with the server
    // For demo purposes, we'll just simulate success
    setTimeout(() => {
        closePasswordModal();
        showNotification('Password updated successfully', 'success');
    }, 1000);
}

// Logout
function handleLogout(e) {
    e.preventDefault();
    
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('standwithnepal_user');
        showNotification('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    }
}

// Utility Functions
function generateUserActivity() {
    return [
        {
            id: '1',
            title: 'Issue Posted',
            description: 'You posted "Broken Street Light in Thamel"',
            icon: 'fas fa-plus-circle',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
        },
        {
            id: '2',
            title: 'Issue Updated',
            description: 'Your issue "Water Supply Problem" was acknowledged by officials',
            icon: 'fas fa-check-circle',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
        },
        {
            id: '3',
            title: 'Comment Added',
            description: 'You commented on "Road Repair in Lalitpur"',
            icon: 'fas fa-comment',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
        },
        {
            id: '4',
            title: 'Issue Resolved',
            description: 'Your issue "Electricity Problem" was marked as resolved',
            icon: 'fas fa-check-double',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString()
        }
    ];
}

function generateUserNotifications() {
    return [
        {
            id: '1',
            title: 'Issue Acknowledged',
            message: 'Your issue "Broken Street Light" has been acknowledged by local officials.',
            icon: 'fas fa-check-circle',
            read: false,
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
        },
        {
            id: '2',
            title: 'New Comment',
            message: 'Someone commented on your issue "Water Supply Problem".',
            icon: 'fas fa-comment',
            read: false,
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
        },
        {
            id: '3',
            title: 'Issue Resolved',
            message: 'Your issue "Road Damage" has been marked as resolved.',
            icon: 'fas fa-check-double',
            read: true,
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
        },
        {
            id: '4',
            title: 'System Update',
            message: 'New features have been added to the platform.',
            icon: 'fas fa-info-circle',
            read: true,
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
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

function getStatusLabel(status) {
    const labels = {
        'new': 'New',
        'acknowledged': 'Acknowledged',
        'in-progress': 'In Progress',
        'resolved': 'Resolved'
    };
    return labels[status] || status;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
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