// Loading Manager Component
import { dom } from '../utils.js';

export class LoadingManager {
    constructor() {
        this.loadingElements = new Map();
        this.init();
    }

    init() {
        this.addStyles();
    }

    addStyles() {
        if (document.querySelector('#loading-styles')) return;

        const styles = dom.createElement('style');
        styles.id = 'loading-styles';
        styles.textContent = `
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                border-radius: inherit;
            }

            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #e5e7eb;
                border-top: 4px solid #2c5aa0;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            .loading-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1rem;
            }

            .loading-text {
                color: #6b7280;
                font-weight: 500;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .skeleton {
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: loading 1.5s infinite;
            }

            @keyframes loading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            .skeleton-text {
                height: 1rem;
                border-radius: 4px;
                margin-bottom: 0.5rem;
            }

            .skeleton-title {
                height: 1.5rem;
                border-radius: 4px;
                margin-bottom: 1rem;
                width: 60%;
            }

            .skeleton-card {
                padding: 1.5rem;
                border-radius: 12px;
                background: white;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
        `;
        document.head.appendChild(styles);
    }

    show(container, text = 'Loading...') {
        if (!container) return;

        // Make container relative if not already positioned
        const computedStyle = window.getComputedStyle(container);
        if (computedStyle.position === 'static') {
            container.style.position = 'relative';
        }

        const overlay = dom.createElement('div', 'loading-overlay');
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${text}</div>
            </div>
        `;

        container.appendChild(overlay);
        this.loadingElements.set(container, overlay);
    }

    hide(container) {
        if (!container) return;

        const overlay = this.loadingElements.get(container);
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
            this.loadingElements.delete(container);
        }
    }

    showSkeleton(container, type = 'card') {
        if (!container) return;

        const skeleton = this.createSkeleton(type);
        container.innerHTML = skeleton;
    }

    createSkeleton(type) {
        switch (type) {
            case 'card':
                return `
                    <div class="skeleton-card">
                        <div class="skeleton skeleton-title"></div>
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text" style="width: 80%;"></div>
                        <div class="skeleton skeleton-text" style="width: 60%;"></div>
                    </div>
                `;
            case 'list':
                return Array(5).fill().map(() => `
                    <div class="skeleton-card" style="margin-bottom: 1rem;">
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text" style="width: 70%;"></div>
                    </div>
                `).join('');
            default:
                return '<div class="skeleton skeleton-text"></div>';
        }
    }

    hideAll() {
        this.loadingElements.forEach((overlay, container) => {
            this.hide(container);
        });
    }
}