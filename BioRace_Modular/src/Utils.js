let logTimer = null;

export function logEvent(msg) {
    const el = document.getElementById('event-log');
    if (!el) return;
    
    el.innerText = msg;
    
    // Add animation class
    el.classList.remove('gift-notification');
    void el.offsetWidth; // Trigger reflow
    if (msg.includes('GIFT') || msg.includes('ENERGY')) {
        el.classList.add('gift-notification');
    }
    
    if(logTimer) clearTimeout(logTimer);
    logTimer = setTimeout(() => {
        el.innerText = "WAITING FOR INPUT...";
    }, 3000);
}

export function updateUI(playerZ, courseLength) {
    const currentZ = Math.abs(playerZ);
    const remaining = Math.max(0, courseLength - currentZ);
    
    const distEl = document.getElementById('distance');
    if(distEl) distEl.innerText = remaining.toFixed(0) + "m";
    
    const barEl = document.getElementById('progress-bar');
    if(barEl) barEl.style.width = ((currentZ / courseLength) * 100) + "%";
    
    return remaining;
}

export function updateBoostDisplay(charges) {
    const boostEl = document.getElementById('boost-charges');
    if (boostEl) {
        const icons = '⚡'.repeat(Math.min(charges, 10));
        boostEl.innerText = icons || '⚡ 0';
        boostEl.style.color = charges > 0 ? '#00ffff' : '#666';
    }
}

export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}