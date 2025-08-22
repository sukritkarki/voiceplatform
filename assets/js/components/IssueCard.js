// Issue Card Component
import { dom, dateUtils, locationUtils, CONSTANTS } from '../utils.js';

export class IssueCard {
    constructor(issue, currentLocation = null) {
        this.issue = issue;
        this.currentLocation = currentLocation;
        this.element = null;
    }

    render() {
        const distance = this.calculateDistance();
        
        this.element = dom.createElement('div', `issue-card ${this.issue.severity}`);
        this.element.innerHTML = this.getTemplate(distance);
        this.attachEventListeners();
        
        return this.element;
    }

    getTemplate(distance) {
        return `
            <div class="issue-header">
                <div>
                    <h3 class="issue-title">${this.escapeHtml(this.issue.title)}</h3>
                    <span class="issue-category">${CONSTANTS.CATEGORIES[this.issue.category] || this.issue.category}</span>
                    <span class="severity-badge severity-${this.issue.severity}">${this.issue.severity.toUpperCase()}</span>
                </div>
                <span class="status-badge status-${this.issue.status}">${CONSTANTS.STATUSES[this.issue.status] || this.issue.status}</span>
            </div>
            <p class="issue-description">${this.truncateText(this.escapeHtml(this.issue.description), 120)}</p>
            <div class="issue-meta">
                <div class="issue-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${this.escapeHtml(this.issue.municipality)}, Ward ${this.issue.ward}</span>
                    ${distance ? `<span class="distance">${distance}km away</span>` : ''}
                </div>
                <div class="issue-stats">
                    <div class="stat">
                        <i class="fas fa-thumbs-up"></i>
                        <span>${this.issue.upvotes || 0}</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-clock"></i>
                        <span>${dateUtils.formatRelative(this.issue.timestamp)}</span>
                    </div>
                </div>
            </div>
            <div class="issue-actions">
                <button class="btn btn-sm btn-secondary upvote-btn" data-issue-id="${this.issue.id}">
                    <i class="fas fa-thumbs-up"></i> Upvote
                </button>
                <button class="btn btn-sm btn-secondary share-btn" data-issue-id="${this.issue.id}">
                    <i class="fas fa-share"></i> Share
                </button>
            </div>
        `;
    }

    attachEventListeners() {
        // Main card click
        this.element.addEventListener('click', (e) => {
            if (!e.target.closest('.issue-actions')) {
                this.viewDetails();
            }
        });

        // Upvote button
        const upvoteBtn = this.element.querySelector('.upvote-btn');
        if (upvoteBtn) {
            upvoteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleUpvote();
            });
        }

        // Share button
        const shareBtn = this.element.querySelector('.share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleShare();
            });
        }
    }

    calculateDistance() {
        if (!this.currentLocation || !this.issue.lat || !this.issue.lng) {
            return null;
        }
        
        const distance = locationUtils.calculateDistance(
            this.currentLocation.lat,
            this.currentLocation.lng,
            this.issue.lat,
            this.issue.lng
        );
        
        return distance.toFixed(1);
    }

    viewDetails() {
        // Dispatch custom event for issue details
        const event = new CustomEvent('viewIssueDetails', {
            detail: { issueId: this.issue.id }
        });
        document.dispatchEvent(event);
    }

    async handleUpvote() {
        try {
            const response = await fetch('api/issues.php?action=upvote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issue_id: this.issue.id })
            });

            const result = await response.json();
            
            if (result.success) {
                this.issue.upvotes = result.upvotes;
                this.updateUpvoteCount();
                this.showNotification('Issue upvoted successfully!', 'success');
            } else {
                this.showNotification(result.message || 'Failed to upvote', 'error');
            }
        } catch (error) {
            console.error('Upvote error:', error);
            this.showNotification('Failed to upvote issue', 'error');
        }
    }

    handleShare() {
        const shareData = {
            title: this.issue.title,
            text: this.issue.description,
            url: `${window.location.origin}#issue-${this.issue.id}`
        };

        if (navigator.share) {
            navigator.share(shareData);
        } else {
            // Fallback to clipboard
            navigator.clipboard.writeText(shareData.url).then(() => {
                this.showNotification('Issue link copied to clipboard!', 'success');
            });
        }
    }

    updateUpvoteCount() {
        const upvoteSpan = this.element.querySelector('.stat span');
        if (upvoteSpan) {
            upvoteSpan.textContent = this.issue.upvotes || 0;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    }

    showNotification(message, type) {
        const event = new CustomEvent('showNotification', {
            detail: { message, type }
        });
        document.dispatchEvent(event);
    }
}