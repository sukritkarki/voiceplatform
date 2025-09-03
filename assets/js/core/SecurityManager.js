// Advanced Security Manager
export class SecurityManager {
    constructor() {
        this.csrfToken = null;
        this.rateLimits = new Map();
        this.securityHeaders = new Map();
        this.init();
    }

    init() {
        this.setupCSRFProtection();
        this.setupXSSProtection();
        this.setupRateLimiting();
        this.setupSecurityHeaders();
        this.monitorSecurityEvents();
    }

    // CSRF Protection
    setupCSRFProtection() {
        this.csrfToken = this.generateCSRFToken();
        
        // Add CSRF token to all forms
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.tagName === 'FORM' && form.method.toLowerCase() === 'post') {
                this.addCSRFToken(form);
            }
        });

        // Add to AJAX requests
        const originalFetch = window.fetch;
        window.fetch = (url, options = {}) => {
            if (options.method && options.method.toUpperCase() !== 'GET') {
                options.headers = {
                    ...options.headers,
                    'X-CSRF-Token': this.csrfToken
                };
            }
            return originalFetch(url, options);
        };
    }

    generateCSRFToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    addCSRFToken(form) {
        let tokenInput = form.querySelector('input[name="csrf_token"]');
        if (!tokenInput) {
            tokenInput = document.createElement('input');
            tokenInput.type = 'hidden';
            tokenInput.name = 'csrf_token';
            form.appendChild(tokenInput);
        }
        tokenInput.value = this.csrfToken;
    }

    // XSS Protection
    setupXSSProtection() {
        // Sanitize all user inputs
        document.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                e.target.value = this.sanitizeInput(e.target.value);
            }
        });
    }

    sanitizeInput(input) {
        // Remove script tags and dangerous content
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }

    // Rate Limiting
    setupRateLimiting() {
        const limits = {
            api: { requests: 100, window: 3600000 }, // 100 requests per hour
            login: { requests: 5, window: 900000 },   // 5 attempts per 15 minutes
            upload: { requests: 10, window: 3600000 } // 10 uploads per hour
        };

        this.rateLimits = limits;
    }

    checkRateLimit(action, identifier = 'global') {
        const key = `${action}_${identifier}`;
        const limit = this.rateLimits[action];
        
        if (!limit) return true;

        const now = Date.now();
        const requests = JSON.parse(localStorage.getItem(key) || '[]');
        
        // Remove old requests outside the window
        const validRequests = requests.filter(time => now - time < limit.window);
        
        if (validRequests.length >= limit.requests) {
            return false;
        }

        // Add current request
        validRequests.push(now);
        localStorage.setItem(key, JSON.stringify(validRequests));
        
        return true;
    }

    // Security Headers
    setupSecurityHeaders() {
        this.securityHeaders.set('X-Content-Type-Options', 'nosniff');
        this.securityHeaders.set('X-Frame-Options', 'DENY');
        this.securityHeaders.set('X-XSS-Protection', '1; mode=block');
        this.securityHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    // Security Event Monitoring
    monitorSecurityEvents() {
        // Monitor for suspicious activity
        let suspiciousActivity = 0;
        
        document.addEventListener('click', (e) => {
            // Detect rapid clicking (potential bot)
            const now = Date.now();
            const lastClick = this.lastClickTime || 0;
            
            if (now - lastClick < 100) {
                suspiciousActivity++;
                if (suspiciousActivity > 10) {
                    this.reportSecurityEvent('rapid_clicking', {
                        count: suspiciousActivity,
                        userAgent: navigator.userAgent
                    });
                }
            } else {
                suspiciousActivity = 0;
            }
            
            this.lastClickTime = now;
        });

        // Monitor for console access
        let devtools = false;
        setInterval(() => {
            if (window.outerHeight - window.innerHeight > 200 || 
                window.outerWidth - window.innerWidth > 200) {
                if (!devtools) {
                    devtools = true;
                    this.reportSecurityEvent('devtools_opened');
                }
            } else {
                devtools = false;
            }
        }, 1000);
    }

    reportSecurityEvent(type, data = {}) {
        const event = {
            type,
            data,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Send to security monitoring service
        fetch('/api/security-events.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        }).catch(console.error);
    }

    // Content Security Policy
    enforceCSP() {
        const csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net",
            "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
            "img-src 'self' data: https:",
            "font-src 'self' https://cdnjs.cloudflare.com",
            "connect-src 'self'",
            "frame-ancestors 'none'"
        ].join('; ');

        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = csp;
        document.head.appendChild(meta);
    }

    // Input Validation
    validateInput(input, type) {
        switch (type) {
            case 'email':
                return validation.isEmail(input);
            case 'phone':
                return validation.isPhone(input);
            case 'text':
                return input.length > 0 && input.length < 1000;
            case 'number':
                return !isNaN(input) && isFinite(input);
            default:
                return true;
        }
    }

    // Secure Data Transmission
    encryptSensitiveData(data) {
        // Simple encryption for client-side (in production, use proper encryption)
        return btoa(JSON.stringify(data));
    }

    decryptSensitiveData(encryptedData) {
        try {
            return JSON.parse(atob(encryptedData));
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }
}