const SERVICE_WORKER_URL = '/sw.js';
let serviceWorkerRegistrationPromise = null;
let hasBoundRefreshListeners = false;

/**
 * @param {ServiceWorker} worker
 */
function setupWorkerLifecycle(worker) {
    if (!worker) return;

    worker.addEventListener('statechange', () => {
        if (worker.state !== 'installed') return;
        if (!navigator.serviceWorker.controller) return;
        worker.postMessage({ type: 'SKIP_WAITING' });
    });
}

/**
 * @param {ServiceWorkerRegistration} registration
 */
function bindRegistrationLifecycle(registration) {
    registration.addEventListener('updatefound', () => {
        setupWorkerLifecycle(registration.installing);
    });

    if (registration.installing) {
        setupWorkerLifecycle(registration.installing);
    }

    if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
}

/**
 * @param {ServiceWorkerRegistration} registration
 */
function bindRefreshTriggers(registration) {
    if (hasBoundRefreshListeners) return;
    hasBoundRefreshListeners = true;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        registration.update().catch(() => {});
    });

    window.addEventListener('online', () => {
        registration.update().catch(() => {});
    }, { passive: true });
}

export function registerPwaServiceWorker() {
    if (serviceWorkerRegistrationPromise) {
        return serviceWorkerRegistrationPromise;
    }

    if (typeof window === 'undefined' || !window.isSecureContext || !('serviceWorker' in navigator)) {
        serviceWorkerRegistrationPromise = Promise.resolve(null);
        return serviceWorkerRegistrationPromise;
    }

    serviceWorkerRegistrationPromise = navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' })
        .then((registration) => {
            bindRegistrationLifecycle(registration);
            bindRefreshTriggers(registration);
            return registration;
        })
        .catch(() => null);

    return serviceWorkerRegistrationPromise;
}
