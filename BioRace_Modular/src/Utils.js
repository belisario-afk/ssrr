let logTimer = null;

export function logEvent(msg) {
    const el = document.getElementById('event-log');
    if (!el) return;
    
    el.innerText = msg;
    
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