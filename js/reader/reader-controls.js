export function clampValue(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function applyStoredReaderPreferences({
    state,
    loadReaderPreferences,
    getReaderContent,
    minFontSize,
    maxFontSize
}) {
    const stored = loadReaderPreferences();
    if (!Number.isFinite(stored.fontSize)) return;

    state.fontSize = clampValue(Math.round(stored.fontSize), minFontSize, maxFontSize);
    getReaderContent().style.fontSize = `${state.fontSize}px`;
}

function changeFontSize({
    delta,
    state,
    getReaderContent,
    saveReaderPreferences,
    minFontSize,
    maxFontSize
}) {
    state.fontSize = clampValue(state.fontSize + delta, minFontSize, maxFontSize);
    getReaderContent().style.fontSize = `${state.fontSize}px`;
    saveReaderPreferences({ fontSize: state.fontSize });
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        return;
    }

    if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function handleReaderControlAction(action, deps) {
    switch (action) {
        case 'font-up':
            changeFontSize({
                ...deps,
                delta: 1
            });
            return true;
        case 'font-down':
            changeFontSize({
                ...deps,
                delta: -1
            });
            return true;
        case 'fullscreen':
            toggleFullscreen();
            return true;
        case 'top':
            scrollToTop();
            return true;
        default:
            return false;
    }
}
