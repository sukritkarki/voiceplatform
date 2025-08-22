// Dashboard functionality for government officials and admins

let dashboardMap;
let currentUser;
let dashboardIssues = [];
let dashboardFilters = {
    status: '',
    category: '',
    priority: '',
    dateRange: ''
};
let selectedIssueId = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

function initializeDashboard() {
    checkAuthentication();
    setupDashboardEventListeners();
    loadUserInfo();
    initializeDashboardMap();
    loadDashboardIssues();
    setupDashboardCharts();
    setupSidebar();
}

// Authentication Check
function checkAuthentication() {
    const user = sessionStorage.getItem('standwithnepal_user');
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = JSON.parse(user);
    
    // Check if user has dashboard access
    if (currentUser.type !== 'official' && currentUser.type !== 'admin') {
        showNotification('Access denied. Redirecting...', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
}

// Load User Information
function loadUserInfo() {
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const jurisdictionInfo = document.getElementById('jurisdictionInfo');

    if (userName) userName.textContent = currentUser.name || 'User';
    
    if (userRole) {
        if (currentUser.type === 'admin') {
            userRole.textContent = 'System Administrator';
        } else {
            userRole.textContent = currentUser.jurisdiction === 'ward' ? 'Ward Representative' : 
                                  currentUser.jurisdiction === 'municipality' ? 'Municipal Representative' :
                                  'District Representative';
        }
    }
    
    if (jurisdictionInfo && currentUser.area) {
        jurisdictionInfo.textContent = currentUser.area;
    }
}

// Event Listeners
function setupDashboardEventListeners() {
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Sidebar navigation
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });

    // Filters
    const statusFilter = document.getElementById('statusFilterDash');
    const categoryFilter = document.getElementById('categoryFilterDash');
    
    if (statusFilter) statusFilter.addEventListener('change', handleDashboardFilter);
    if (categoryFilter) categoryFilter.addEventListener('change', handleDashboardFilter);

    // Priority filter
    const priorityFilter = document.getElementById('priorityFilterDash');
    if (priorityFilter) priorityFilter.addEventListener('change', handleDashboardFilter);

    // Issue detail modal
    const issueDetailModal = document.getElementById('issueDetailModal');
    const closeBtn = issueDetailModal?.querySelector('.close');
    if (closeBtn) closeBtn.addEventListener('click', closeIssueDetailModal);

    // Issue action buttons
    const acknowledgeBtn = document.getElementById('acknowledgeBtn');
    const inProgressBtn = document.getElementById('inProgressBtn');
    const resolveBtn = document.getElementById('resolveBtn');

    if (acknowledgeBtn) acknowledgeBtn.addEventListener('click', () => updateIssueStatus('acknowledged'));
    if (inProgressBtn) inProgressBtn.addEventListener('click', () => updateIssueStatus('in-progress'));
    if (resolveBtn) resolveBtn.addEventListener('click', () => updateIssueStatus('resolved'));

    // Update form
    const updateForm = document.getElementById('updateForm');
    if (updateForm) updateForm.addEventListener('submit', handleIssueUpdate);

    // Sidebar toggle for mobile
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Bulk actions
    const bulkActionBtn = document.getElementById('bulkActionBtn');
    if (bulkActionBtn) bulkActionBtn.addEventListener('click', handleBulkActions);

    // Export data
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportDashboardData);
}

// Sidebar Setup
function setupSidebar() {
    // Set initial active section
    showSection('overview');
    
    // Handle responsive sidebar
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

// Navigation
function handleNavigation(e) {
    e.preventDefault();
    
    const targetSection = e.target.getAttribute('href').substring(1);
    showSection(targetSection);
    
    // Update active nav link
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        const sectionTitles = {
            'overview': 'Dashboard Overview',
            'issues': 'Manage Issues',
            'map': 'Issues Map',
            'analytics': 'Analytics & Reports',
            'reports': 'Reports',
            'settings': 'Settings'
        };
        pageTitle.textContent = sectionTitles[targetSection] || 'Dashboard';
    }

    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
}

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
}

// Load Dashboard Issues
function loadDashboardIssues() {
    // Load issues from localStorage (in real app, this would filter by jurisdiction)
    let allIssues = JSON.parse(localStorage.getItem('standwithnepal_issues') || '[]');
    
    // Filter issues based on user's jurisdiction
    if (currentUser.type === 'official') {
        dashboardIssues = filterIssuesByJurisdiction(allIssues);
    } else {
        dashboardIssues = allIssues; // Admin sees all issues
    }
    
    updateDashboardStats();
    loadRecentIssues();
    loadIssuesTable();
    updateDashboardMap();
}

function filterIssuesByJurisdiction(issues) {
    // For demo purposes, filter based on area
    if (currentUser.area && currentUser.area.includes('Kathmandu')) {
        return issues.filter(issue => issue.district === 'Kathmandu');
    } else if (currentUser.area && currentUser.area.includes('Pokhara')) {
        return issues.filter(issue => issue.district === 'Kaski');
    } else if (currentUser.area && currentUser.area.includes('Lalitpur')) {
        return issues.filter(issue => issue.district === 'Lalitpur');
    }
    return issues;
}

// Update Dashboard Stats
function updateDashboardStats() {
    const totalCount = document.getElementById('totalIssuesCount');
    const pendingCount = document.getElementById('pendingIssuesCount');
    const inProgressCount = document.getElementById('inProgressCount');
    const resolvedCount = document.getElementById('resolvedCount');

    if (totalCount) totalCount.textContent = dashboardIssues.length;
    
    if (pendingCount) {
        const pending = dashboardIssues.filter(issue => issue.status === 'new').length;
        pendingCount.textContent = pending;
    }
    
    if (inProgressCount) {
        const inProgress = dashboardIssues.filter(issue => issue.status === 'in-progress').length;
        inProgressCount.textContent = inProgress;
    }
    
    if (resolvedCount) {
        const resolved = dashboardIssues.filter(issue => issue.status === 'resolved').length;
        resolvedCount.textContent = resolved;
    }
}

// Load Recent Issues
function loadRecentIssues() {
    const recentIssuesContainer = document.getElementById('recentIssues');
    if (!recentIssuesContainer) return;

    const recentIssues = dashboardIssues
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5);

    recentIssuesContainer.innerHTML = recentIssues.map(issue => `
        <div class="recent-issue-item" onclick="openIssueDetail('${issue.id}')">
            <div class="recent-issue-title">${issue.title}</div>
            <div class="recent-issue-meta">
                <span class="status-badge status-${issue.status}">${getStatusLabel(issue.status)}</span>
                <span>${formatDate(issue.timestamp)}</span>
            </div>
        </div>
    `).join('');
}

// Load Issues Table
function loadIssuesTable() {
    const tableBody = document.getElementById('issuesTableBody');
    if (!tableBody) return;

    const filteredIssues = getFilteredDashboardIssues();

    tableBody.innerHTML = filteredIssues.map(issue => `
        <tr onclick="openIssueDetail('${issue.id}')" style="cursor: pointer;">
            <td>
                <div>
                    <strong>${issue.title}</strong>
                    <div style="font-size: 0.8rem; color: #6b7280;">${truncateText(issue.description, 60)}</div>
                </div>
            </td>
            <td><span class="issue-category">${getCategoryLabel(issue.category)}</span></td>
            <td>${issue.municipality}, Ward ${issue.ward}</td>
            <td><span class="status-badge status-${issue.status}">${getStatusLabel(issue.status)}</span></td>
            <td>
                <span class="priority-badge priority-${issue.severity}">${issue.severity}</span>
            </td>
            <td>${formatDate(issue.timestamp)}</td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); openIssueDetail('${issue.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Dashboard Filters
function handleDashboardFilter() {
    loadIssuesTable();
}

function getFilteredDashboardIssues() {
    const statusFilter = document.getElementById('statusFilterDash')?.value || '';
    const categoryFilter = document.getElementById('categoryFilterDash')?.value || '';

    return dashboardIssues.filter(issue => {
        const statusMatch = !statusFilter || issue.status === statusFilter;
        const categoryMatch = !categoryFilter || issue.category === categoryFilter;
        return statusMatch && categoryMatch;
    });
}

// Issue Detail Modal
function openIssueDetail(issueId) {
    const issue = dashboardIssues.find(i => i.id === issueId);
    if (!issue) return;

    const modal = document.getElementById('issueDetailModal');
    if (!modal) return;

    // Populate modal with issue details
    document.getElementById('issueDetailTitle').textContent = issue.title;
    document.getElementById('issueDetailStatus').textContent = getStatusLabel(issue.status);
    document.getElementById('issueDetailStatus').className = `issue-status status-badge status-${issue.status}`;
    document.getElementById('issueDetailCategory').textContent = getCategoryLabel(issue.category);
    document.getElementById('issueDetailLocation').textContent = `${issue.municipality}, Ward ${issue.ward}, ${issue.district}`;
    document.getElementById('issueDetailPriority').textContent = issue.severity;
    document.getElementById('issueDetailDate').textContent = formatDate(issue.timestamp);
    document.getElementById('issueDetailUpvotes').textContent = issue.upvotes;
    document.getElementById('issueDetailDescription').textContent = issue.description;

    // Store current issue ID for actions
    modal.setAttribute('data-issue-id', issueId);

    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeIssueDetailModal() {
    const modal = document.getElementById('issueDetailModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Issue Status Updates
function updateIssueStatus(newStatus) {
    const modal = document.getElementById('issueDetailModal');
    const issueId = modal.getAttribute('data-issue-id');
    
    if (!issueId) return;

    // Find and update issue
    const issueIndex = dashboardIssues.findIndex(i => i.id === issueId);
    if (issueIndex === -1) return;

    dashboardIssues[issueIndex].status = newStatus;
    dashboardIssues[issueIndex].lastUpdated = new Date().toISOString();
    dashboardIssues[issueIndex].updatedBy = currentUser.name;

    // Update in localStorage
    let allIssues = JSON.parse(localStorage.getItem('standwithnepal_issues') || '[]');
    const globalIndex = allIssues.findIndex(i => i.id === issueId);
    if (globalIndex !== -1) {
        allIssues[globalIndex] = dashboardIssues[issueIndex];
        localStorage.setItem('standwithnepal_issues', JSON.stringify(allIssues));
    }

    // Update UI
    updateDashboardStats();
    loadRecentIssues();
    loadIssuesTable();
    
    // Update modal
    document.getElementById('issueDetailStatus').textContent = getStatusLabel(newStatus);
    document.getElementById('issueDetailStatus').className = `issue-status status-badge status-${newStatus}`;

    showNotification(`Issue marked as ${getStatusLabel(newStatus)}`, 'success');
}

// Issue Updates/Comments
function handleIssueUpdate(e) {
    e.preventDefault();
    
    const updateText = document.getElementById('updateText').value.trim();
    if (!updateText) return;

    const modal = document.getElementById('issueDetailModal');
    const issueId = modal.getAttribute('data-issue-id');
    
    if (!issueId) return;

    // Add update to issue
    const update = {
        id: generateId(),
        text: updateText,
        author: currentUser.name,
        timestamp: new Date().toISOString(),
        type: 'comment'
    };

    // Find and update issue
    const issueIndex = dashboardIssues.findIndex(i => i.id === issueId);
    if (issueIndex !== -1) {
        if (!dashboardIssues[issueIndex].updates) {
            dashboardIssues[issueIndex].updates = [];
        }
        dashboardIssues[issueIndex].updates.push(update);

        // Update in localStorage
        let allIssues = JSON.parse(localStorage.getItem('standwithnepal_issues') || '[]');
        const globalIndex = allIssues.findIndex(i => i.id === issueId);
        if (globalIndex !== -1) {
            allIssues[globalIndex] = dashboardIssues[issueIndex];
            localStorage.setItem('standwithnepal_issues', JSON.stringify(allIssues));
        }
    }

    // Clear form
    document.getElementById('updateText').value = '';
    
    showNotification('Update added successfully', 'success');
}

// Dashboard Map
function initializeDashboardMap() {
    const mapElement = document.getElementById('dashboardMap');
    if (!mapElement) return;

    // Initialize map
    dashboardMap = L.map('dashboardMap').setView([28.3949, 84.1240], 7);

    // Add tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(dashboardMap);
}

function updateDashboardMap() {
    if (!dashboardMap) return;

    // Clear existing markers
    dashboardMap.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            dashboardMap.removeLayer(layer);
        }
    });

    // Add markers for dashboard issues
    dashboardIssues.forEach(issue => {
        if (issue.lat && issue.lng) {
            const marker = L.marker([issue.lat, issue.lng]).addTo(dashboardMap);
            
            const popupContent = `
                <div class="map-popup">
                    <h4>${issue.title}</h4>
                    <p><strong>Status:</strong> ${getStatusLabel(issue.status)}</p>
                    <p><strong>Priority:</strong> ${issue.severity}</p>
                    <p><strong>Upvotes:</strong> ${issue.upvotes}</p>
                    <button onclick="openIssueDetail('${issue.id}')" class="btn btn-primary btn-sm">Manage</button>
                </div>
            `;
            
            marker.bindPopup(popupContent);
        }
    });
}

// Dashboard Charts
function setupDashboardCharts() {
    setupDashboardCategoryChart();
    setupDashboardTimelineChart();
    setupDashboardTrendChart();
    setupDashboardPerformanceChart();
}

function setupDashboardCategoryChart() {
    const ctx = document.getElementById('dashCategoryChart');
    if (!ctx) return;

    const categoryData = getCategoryDistribution(dashboardIssues);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: [
                    '#2c5aa0', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function setupDashboardTimelineChart() {
    const ctx = document.getElementById('dashTimelineChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['New', 'Acknowledged', 'In Progress', 'Resolved'],
            datasets: [{
                label: 'Issues Count',
                data: [
                    dashboardIssues.filter(i => i.status === 'new').length,
                    dashboardIssues.filter(i => i.status === 'acknowledged').length,
                    dashboardIssues.filter(i => i.status === 'in-progress').length,
                    dashboardIssues.filter(i => i.status === 'resolved').length
                ],
                backgroundColor: ['#f59e0b', '#2c5aa0', '#8b5cf6', '#10b981']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function setupDashboardTrendChart() {
    const ctx = document.getElementById('dashTrendChart');
    if (!ctx) return;

    // Generate monthly data
    const monthlyData = generateMonthlyTrends(dashboardIssues);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Issues Reported',
                data: monthlyData.reported,
                borderColor: '#2c5aa0',
                backgroundColor: 'rgba(44, 90, 160, 0.1)',
                tension: 0.4
            }, {
                label: 'Issues Resolved',
                data: monthlyData.resolved,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function setupDashboardPerformanceChart() {
    const ctx = document.getElementById('dashPerformanceChart');
    if (!ctx) return;

    const performance = calculatePerformanceMetrics(dashboardIssues);

    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Response Time', 'Resolution Rate', 'Citizen Satisfaction', 'Transparency', 'Communication'],
            datasets: [{
                label: 'Performance',
                data: [
                    performance.responseTime,
                    performance.resolutionRate,
                    performance.satisfaction,
                    performance.transparency,
                    performance.communication
                ],
                borderColor: '#2c5aa0',
                backgroundColor: 'rgba(44, 90, 160, 0.2)'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Logout
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('standwithnepal_user');
        showNotification('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    }
}

// Utility Functions
function getCategoryDistribution(issues) {
    const distribution = {};
    issues.forEach(issue => {
        const category = getCategoryLabel(issue.category);
        distribution[category] = (distribution[category] || 0) + 1;
    });
    return distribution;
}

function generateMonthlyTrends(issues) {
    // Simplified monthly data generation
    return {
        reported: [12, 15, 18, 14, 20, 16],
        resolved: [8, 11, 14, 12, 16, 15]
    };
}

function calculatePerformanceMetrics(issues) {
    const totalIssues = issues.length;
    const resolvedIssues = issues.filter(i => i.status === 'resolved').length;
    
    return {
        responseTime: 75, // Simplified calculation
        resolutionRate: totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 0,
        satisfaction: 68, // Would come from user feedback
        transparency: 90, // Based on public updates
        communication: 78  // Based on response frequency
    };
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
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
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
            .notification-info { background: #2c5aa0; }
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
            .priority-badge {
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 0.7rem;
                font-weight: 500;
                text-transform: uppercase;
            }
            .priority-low { background: #d1fae5; color: #065f46; }
            .priority-medium { background: #fef3c7; color: #92400e; }
            .priority-high { background: #fed7aa; color: #ea580c; }
            .priority-urgent { background: #fecaca; color: #dc2626; }
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