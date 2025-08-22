// Notification Manager Component
import { dom } from '../utils.js';

export class NotificationManager {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.init();
    }

    init() {
        this.createContainer();
        this.addStyles();
        
        // Listen for notification events
        document.addEventListener('showNotification', (e) => {
            this.show(e.detail.message, e.detail.type);
        });
    }

    createContainer() {
        this.container = dom.createElement('div', 'notification-container');
        document.body.appendChild(this.container);
    }

    addStyles() {
        if (document.querySelector('#notification-styles')) return;

        const styles = dom.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 400px;
            }

            .notification {
                padding: 1rem 1.5rem;
                border-radius: 8px;
                color: white;
                animation: slideInRight 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 1rem;
                min-width: 300px;
            }

            .notification-success { background: linear-gradient(135deg, #10b981, #059669); }
            .notification-error { background: linear-gradient(135deg, #ef4444, #dc2626); }
            .notification-info { background: linear-gradient(135deg, #3b82f6, #2563eb); }
            .notification-warning { background: linear-gradient(135deg, #f59e0b, #d97706); }

            .notification-content {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .notification-icon {
                font-size: 1.2rem;
            }

            .notification-close {
                background: none;
                border: none;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
                opacity: 0.8;
                transition: opacity 0.2s;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .notification-close:hover {
                opacity: 1;
            }

            @keyframes slideInRight {
                from { 
                    transform: translateX(100%); 
                    opacity: 0; 
                }
                to { 
                    transform: translateX(0); 
                    opacity: 1; 
                }
            }

            @keyframes slideOutRight {
                from { 
                    transform: translateX(0); 
                    opacity: 1; 
                }
                to { 
                    transform: translateX(100%); 
                    opacity: 0; 
                }
            }

            .notification.removing {
                animation: slideOutRight 0.3s ease forwards;
            }

            @media (max-width: 480px) {
                .notification-container {
                    left: 10px;
                    right: 10px;
                    top: 10px;
                    max-width: none;
                }
                
                .notification {
                    min-width: auto;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    show(message, type = 'info', duration = 5000) {
        const notification = this.createNotification(message, type);
        this.container.appendChild(notification);
        this.notifications.push(notification);

        // Auto remove
        setTimeout(() => {
            this.remove(notification);
        }, duration);

        // Limit number of notifications
        if (this.notifications.length > 5) {
            this.remove(this.notifications[0]);
        }
    }

    createNotification(message, type) {
        const notification = dom.createElement('div', `notification notification-${type}`);
        
        const icon = this.getIcon(type);
        
        notification.innerHTML = `
            <div class="notification-content">
                <i class="notification-icon ${icon}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" aria-label="Close notification">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.remove(notification);
        });

        return notification;
    }

    getIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    remove(notification) {
        if (!notification || !notification.parentNode) return;

        notification.classList.add('removing');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 300);
    }

    clear() {
        this.notifications.forEach(notification => {
            this.remove(notification);
        });
    }
}