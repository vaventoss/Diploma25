let cvReady = false;

function onOpenCvReady() {
    cvReady = true;
    if (window.app && window.app.addLog) window.app.addLog('OpenCV.js is ready');
    else console.log('OpenCV.js is ready');
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.disabled = false;
    const loading = document.getElementById('loading');
    if (loading && loading.style.display !== 'none') loading.style.display = 'none';
    try {
        if (window.runGalleryDetail && typeof window.runGalleryDetail === 'function') {
            window.runGalleryDetail();
            window.runGalleryDetail = null;
        }
    } catch (e) { console.warn('Error running gallery detail initializer', e); }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!cvReady) {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'block';
        const startBtn = document.getElementById('startBtn');
        if (startBtn) startBtn.disabled = true;
    }

    if (document.getElementById('video') && window.CamRuler) {
        try {
            window.app = new window.CamRuler();
            const startBtn = document.getElementById('startBtn');
            if (startBtn) startBtn.disabled = !cvReady;
        } catch (e) {
            console.warn('Failed to instantiate CamRuler:', e);
        }
    }
});
