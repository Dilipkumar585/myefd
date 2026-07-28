// =============================================
// EFD Premium Toast Notification System v2.0
// Inspired by Uber's toast design
// With progress bar, icons, animations, queue
// =============================================

// Toast icon mapping
const TOAST_ICONS = {
    success: 'fa-solid fa-check-circle',
    error: 'fa-solid fa-circle-xmark',
    info: 'fa-solid fa-circle-info',
    warning: 'fa-solid fa-triangle-exclamation'
};

const TOAST_COLORS = {
    success: { bg: '#E8F5E9', text: '#2E7D32', icon: '#4CAF50', bar: '#4CAF50' },
    error: { bg: '#FFEBEE', text: '#C62828', icon: '#F44336', bar: '#F44336' },
    info: { bg: '#E3F2FD', text: '#1565C0', icon: '#2196F3', bar: '#2196F3' },
    warning: { bg: '#FFF8E1', text: '#F57F17', icon: '#FF9800', bar: '#FF9800' }
};

const TOAST_DURATION = 4000;

// Toast queue to handle multiple toasts
let toastQueue = [];
let isProcessing = false;

function processQueue() {
    if (isProcessing || toastQueue.length === 0) return;
    isProcessing = true;
    const toast = toastQueue.shift();
    showToastInternal(toast.message, toast.type, toast.duration);
}

function showToast(message, type = 'info', duration = TOAST_DURATION) {
    toastQueue.push({ message, type, duration });
    if (!isProcessing) processQueue();
}

// Make globally available
window.showToast = showToast;

function showToastInternal(message, type, duration) {
    const colors = TOAST_COLORS[type] || TOAST_COLORS.info;
    const icon = TOAST_ICONS[type] || TOAST_ICONS.info;

    // Create container if not exists
    let container = document.getElementById('efd-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'efd-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
            width: calc(100% - 40px);
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${colors.bg};
        color: ${colors.text};
        padding: 0;
        border-radius: 14px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.06);
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        display: flex;
        align-items: stretch;
        overflow: hidden;
        pointer-events: auto;
        opacity: 0;
        transform: translateX(120%);
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        border: 1px solid rgba(0,0,0,0.04);
        max-width: 100%;
        position: relative;
    `;

    // Icon bar
    const iconBar = document.createElement('div');
    iconBar.style.cssText = `
        width: 48px;
        min-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: ${colors.icon};
        background: rgba(255,255,255,0.5);
        flex-shrink: 0;
    `;
    iconBar.innerHTML = `<i class="${icon}"></i>`;

    // Content
    const content = document.createElement('div');
    content.style.cssText = `
        padding: 14px 16px;
        flex: 1;
        display: flex;
        align-items: center;
        font-weight: 500;
        line-height: 1.4;
        min-height: 52px;
        word-break: break-word;
    `;
    content.textContent = message;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: ${colors.text};
        opacity: 0.5;
        cursor: pointer;
        padding: 8px 12px;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s;
        flex-shrink: 0;
    `;
    closeBtn.innerHTML = '✕';
    closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
    closeBtn.onmouseout = () => closeBtn.style.opacity = '0.5';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        dismissToast(toast);
    };

    // Progress bar
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: ${colors.bar};
        border-radius: 0 2px 0 0;
        transition: width ${duration}ms linear;
        width: 100%;
    `;

    toast.appendChild(iconBar);
    toast.appendChild(content);
    toast.appendChild(closeBtn);
    toast.appendChild(progressBar);
    container.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });

    // Start progress bar
    requestAnimationFrame(() => {
        progressBar.style.width = '0%';
    });

    // Auto dismiss
    const dismissTimer = setTimeout(() => {
        dismissToast(toast);
    }, duration);

    // Store timer for cleanup
    toast._dismissTimer = dismissTimer;

    // Add tap to dismiss
    toast.addEventListener('click', () => {
        clearTimeout(toast._dismissTimer);
        dismissToast(toast);
    });
}

function dismissToast(toast) {
    if (toast._dismissing) return;
    toast._dismissing = true;

    clearTimeout(toast._dismissTimer);

    toast.style.opacity = '0';
    toast.style.transform = 'translateX(120%)';

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
        // Clean up container if empty
        const container = document.getElementById('efd-toast-container');
        if (container && container.children.length === 0) {
            document.body.removeChild(container);
        }
        isProcessing = false;
        processQueue();
    }, 400);
}

// Inject Font Awesome if not already loaded
if (!document.querySelector('link[href*="font-awesome"]')) {
    const fa = document.createElement('link');
    fa.rel = 'stylesheet';
    fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css';
    document.head.appendChild(fa);
}

// Inject styles for toast
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @media (max-width: 480px) {
        #efd-toast-container {
            top: 10px !important;
            right: 10px !important;
            left: 10px !important;
            max-width: 100% !important;
            width: auto !important;
        }
    }
`;
document.head.appendChild(toastStyles);

console.log('✅ EFD Premium Toast System v2.0 loaded');

