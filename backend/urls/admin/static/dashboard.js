// Admin Dashboard JavaScript

// Global auth extension for HTMX
htmx.defineExtension('authBearer', {
    onEvent: (name, evt) => {
        if (name === 'htmx:configRequest') {
            const apiKey = sessionStorage.getItem('apiKey') || document.body.dataset.apiKey;
            if (apiKey) {
                evt.detail.headers['Authorization'] = 'Bearer ' + apiKey;
            }
        }
    }
});

// Apply auth extension to all requests
document.body.setAttribute('hx-ext', 'authBearer');

// Store API key in session storage if available
document.addEventListener('DOMContentLoaded', function() {
    const apiKey = document.body.dataset.apiKey;
    if (apiKey) {
        sessionStorage.setItem('apiKey', apiKey);
    }
});

// Toast notification handling
document.body.addEventListener('htmx:afterRequest', function(evt) {
    if (evt.detail.target.id === 'toast') {
        const toast = document.getElementById('toast');
        toast.classList.remove('hidden');
        
        // Auto-hide toast after 3 seconds
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
        
        // Refresh grid after successful operations
        if (evt.detail.xhr.status === 200) {
            setTimeout(() => {
                htmx.trigger('#grid', 'refresh');
            }, 500);
        }
    }
});

// Move table functionality
let moveMode = false;
let moveSourceId = null;

window.pickTarget = function(evt) {
    evt.preventDefault();
    
    const sourceTile = evt.target.closest('.tile');
    const sourceId = sourceTile.dataset.tableId;
    
    // Enter move mode
    moveMode = true;
    moveSourceId = sourceId;
    
    // Add visual indicators
    document.body.classList.add('move-mode');
    sourceTile.classList.add('move-source');
    
    // Show instruction
    showToast('Select a green table to move the party to', 'info');
    
    // Add click handlers to open tables
    const openTiles = document.querySelectorAll('.tile.open:not(.move-source)');
    openTiles.forEach(tile => {
        tile.addEventListener('click', handleMoveTarget, { once: true });
    });
    
    // Add escape handler
    document.addEventListener('keydown', handleMoveEscape, { once: true });
};

function handleMoveTarget(evt) {
    if (!moveMode) return;
    
    const targetTile = evt.currentTarget;
    const targetId = targetTile.dataset.tableId;
    
    // Make the move request
    htmx.ajax('POST', `/admin/table/${moveSourceId}/move`, {
        target: '#toast',
        swap: 'innerHTML',
        values: { target: targetId }
    });
    
    // Exit move mode
    exitMoveMode();
}

function handleMoveEscape(evt) {
    if (evt.key === 'Escape') {
        exitMoveMode();
        showToast('Move cancelled', 'info');
    }
}

function exitMoveMode() {
    moveMode = false;
    moveSourceId = null;
    document.body.classList.remove('move-mode');
    
    // Remove visual indicators
    const sourceTile = document.querySelector('.move-source');
    if (sourceTile) {
        sourceTile.classList.remove('move-source');
    }
    
    // Remove click handlers from open tables
    const openTiles = document.querySelectorAll('.tile.open');
    openTiles.forEach(tile => {
        tile.removeEventListener('click', handleMoveTarget);
    });
}

// Manual toast function for info messages
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    let className = 'toast-info';
    
    if (type === 'success') {
        className = 'toast-success';
    } else if (type === 'error') {
        className = 'toast-error';
    }
    
    toast.innerHTML = `<div class="${className}">${message}</div>`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Logout functionality
window.logout = function() {
    sessionStorage.removeItem('apiKey');
    window.location.href = '/admin/login';
};

// Auto-refresh on visibility change (when tab becomes active)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        htmx.trigger('#grid', 'refresh');
    }
});

// Handle connection errors
document.body.addEventListener('htmx:responseError', function(evt) {
    if (evt.detail.xhr.status === 401 || evt.detail.xhr.status === 403) {
        showToast('Session expired. Please log in again.', 'error');
        setTimeout(() => {
            window.location.href = '/admin/login';
        }, 2000);
    } else {
        showToast('Connection error. Please try again.', 'error');
    }
});

// Add loading indicators
document.body.addEventListener('htmx:beforeRequest', function(evt) {
    if (evt.detail.target.id === 'grid') {
        // Add loading state to grid
        const grid = document.getElementById('grid');
        if (grid) {
            grid.style.opacity = '0.7';
        }
    }
});

document.body.addEventListener('htmx:afterRequest', function(evt) {
    if (evt.detail.target.id === 'grid') {
        // Remove loading state from grid
        const grid = document.getElementById('grid');
        if (grid) {
            grid.style.opacity = '1';
        }
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(evt) {
    // Ctrl/Cmd + R: Refresh grid
    if ((evt.ctrlKey || evt.metaKey) && evt.key === 'r') {
        evt.preventDefault();
        htmx.trigger('#grid', 'refresh');
        showToast('Refreshing...', 'info');
    }
    
    // Escape: Exit move mode
    if (evt.key === 'Escape' && moveMode) {
        exitMoveMode();
        showToast('Move cancelled', 'info');
    }
});

console.log('✅ Admin Dashboard loaded successfully'); 