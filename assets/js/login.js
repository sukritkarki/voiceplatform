// Login page functionality

document.addEventListener('DOMContentLoaded', function() {
    initializeLoginPage();
});

function initializeLoginPage() {
    setupTabSwitching();
    setupFormHandlers();
    setupRegistrationModal();
}

// Tab Switching
function setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            btn.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

// Form Handlers
function setupFormHandlers() {
    // Citizen Login
    const citizenForm = document.getElementById('citizenLoginForm');
    if (citizenForm) {
        citizenForm.addEventListener('submit', handleCitizenLogin);
    }

    // Official Login
    const officialForm = document.getElementById('officialLoginForm');
    if (officialForm) {
        officialForm.addEventListener('submit', handleOfficialLogin);
    }

    // Admin Login
    const adminForm = document.getElementById('adminLoginForm');
    if (adminForm) {
        adminForm.addEventListener('submit', handleAdminLogin);
    }

    // Registration Form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
    }
}

// Registration Modal
function setupRegistrationModal() {
    const registerLink = document.getElementById('registerLink');
    const registerModal = document.getElementById('registerModal');
    const closeBtn = registerModal?.querySelector('.close');

    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            openRegistrationModal();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeRegistrationModal);
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === registerModal) {
            closeRegistrationModal();
        }
    });
}

function openRegistrationModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeRegistrationModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Login Handlers
function handleCitizenLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const loginData = {
        email: formData.get('email'),
        password: formData.get('password'),
        userType: 'citizen'
    };

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;

    // Simulate API call
    setTimeout(() => {
        if (validateCitizenLogin(loginData)) {
            // Store user session
            sessionStorage.setItem('standwithnepal_user', JSON.stringify({
                type: 'citizen',
                email: loginData.email,
                name: 'John Doe', // Would come from API
                loginTime: new Date().toISOString()
            }));

            showNotification('Login successful! Redirecting...', 'success');
            
            // Redirect to main page
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } else {
            showNotification('Invalid email or password', 'error');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }, 1500);
}

function handleOfficialLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const loginData = {
        official_id: formData.get('official_id'),
        password: formData.get('password'),
        jurisdiction: formData.get('jurisdiction'),
        userType: 'official'
    };

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Verifying...';
    submitBtn.disabled = true;

    // Simulate API call
    setTimeout(() => {
        if (validateOfficialLogin(loginData)) {
            // Store user session
            sessionStorage.setItem('standwithnepal_user', JSON.stringify({
                type: 'official',
                officialId: loginData.official_id,
                name: 'Ram Bahadur Thapa', // Would come from API
                jurisdiction: loginData.jurisdiction,
                area: 'Kathmandu Ward-10', // Would come from API
                loginTime: new Date().toISOString()
            }));

            showNotification('Login successful! Redirecting to dashboard...', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showNotification('Invalid credentials or unauthorized access', 'error');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }, 2000);
}

function handleAdminLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const loginData = {
        username: formData.get('username'),
        password: formData.get('password'),
        admin_code: formData.get('admin_code'),
        userType: 'admin'
    };

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Authenticating...';
    submitBtn.disabled = true;

    // Simulate API call
    setTimeout(() => {
        if (validateAdminLogin(loginData)) {
            // Store user session
            sessionStorage.setItem('standwithnepal_user', JSON.stringify({
                type: 'admin',
                username: loginData.username,
                name: 'System Administrator',
                loginTime: new Date().toISOString()
            }));

            showNotification('Admin login successful! Redirecting...', 'success');
            
            // Redirect to admin dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showNotification('Invalid admin credentials', 'error');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }, 2000);
}

function handleRegistration(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    // Validate passwords match
    const password = formData.get('password');
    const confirmPassword = formData.get('confirm_password');
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    const registrationData = {
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        password: password,
        province: formData.get('province'),
        agree_terms: formData.get('agree_terms') === 'on'
    };

    if (!registrationData.agree_terms) {
        showNotification('Please agree to the terms and conditions', 'error');
        return;
    }

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating Account...';
    submitBtn.disabled = true;

    // Simulate API call
    setTimeout(() => {
        // Store user data (in real app, this would be sent to server)
        let users = JSON.parse(localStorage.getItem('standwithnepal_users') || '[]');
        
        // Check if email already exists
        if (users.some(user => user.email === registrationData.email)) {
            showNotification('Email already registered', 'error');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            return;
        }

        // Add new user
        users.push({
            id: generateId(),
            ...registrationData,
            created_at: new Date().toISOString(),
            verified: false
        });
        
        localStorage.setItem('standwithnepal_users', JSON.stringify(users));

        showNotification('Registration successful! Please login with your credentials.', 'success');
        
        // Close modal and reset form
        setTimeout(() => {
            closeRegistrationModal();
            document.getElementById('registerForm').reset();
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 2000);
    }, 2000);
}

// Validation Functions
function validateCitizenLogin(loginData) {
    // In a real app, this would validate against the server
    // For demo purposes, accept any email/password combination
    const users = JSON.parse(localStorage.getItem('standwithnepal_users') || '[]');
    return users.some(user => user.email === loginData.email) || loginData.email.includes('@');
}

function validateOfficialLogin(loginData) {
    // Demo validation - in real app, this would check against government database
    const validOfficials = [
        { id: 'KTM001', jurisdiction: 'ward', area: 'Kathmandu Ward-10' },
        { id: 'PKR002', jurisdiction: 'municipality', area: 'Pokhara Metropolitan' },
        { id: 'LTP003', jurisdiction: 'ward', area: 'Lalitpur Ward-5' }
    ];
    
    return validOfficials.some(official => 
        official.id === loginData.official_id && 
        loginData.password.length >= 6
    );
}

function validateAdminLogin(loginData) {
    // Demo validation - in real app, this would be more secure
    return loginData.username === 'admin' && 
           loginData.password === 'admin123' && 
           loginData.admin_code === 'SWN2025';
}

// Utility Functions
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