import {
    downloadBookForOffline,
    getBookDownloadStatus,
    isOfflineBookStorageSupported
} from './book-offline-storage.js';

const DOWNLOAD_LABEL = 'Download';
const DOWNLOADING_LABEL = 'Downloading';
const OPEN_OFFLINE_LABEL = 'Open Offline';
const RETRY_LABEL = 'Retry Download';

/**
 * @param {string|number} bookId
 * @returns {string}
 */
function normalizeBookId(bookId) {
    return String(bookId ?? '').trim();
}

/**
 * @param {number|string} partCount
 * @returns {number}
 */
function normalizePartCount(partCount) {
    const parsed = Number.parseInt(String(partCount ?? ''), 10);
    if (Number.isInteger(parsed) && parsed > 1) return parsed;
    return 1;
}

/**
 * @param {HTMLButtonElement} button
 */
function resetButtonStateClasses(button) {
    button.classList.remove('is-loading', 'is-downloaded', 'is-error');
}

/**
 * @param {HTMLButtonElement} button
 * @param {'idle'|'loading'|'downloaded'|'error'} state
 * @param {string} label
 * @param {string} title
 */
function applyButtonState(button, state, label, title = '') {
    resetButtonStateClasses(button);
    button.classList.add(`is-${state}`);
    button.textContent = label;
    if (title) {
        button.title = title;
    } else {
        button.removeAttribute('title');
    }
}

/**
 * @param {HTMLButtonElement} button
 * @param {{
 *   bookId: string,
 *   title: string,
 *   partCount: number,
 *   readHref: string
 * }} context
 */
async function syncDownloadButtonState(button, context) {
    const status = await getBookDownloadStatus(context.bookId, context.partCount);

    button.disabled = false;
    if (status.downloading) {
        applyButtonState(
            button,
            'loading',
            `${DOWNLOADING_LABEL} ${status.cachedParts}/${status.partCount}`,
            'Book download is in progress.'
        );
        return;
    }

    if (status.downloaded) {
        applyButtonState(
            button,
            'downloaded',
            OPEN_OFFLINE_LABEL,
            'This book is saved locally and can open without internet.'
        );
        return;
    }

    applyButtonState(
        button,
        'idle',
        DOWNLOAD_LABEL,
        'Save this book for offline reading.'
    );
}

/**
 * @param {HTMLButtonElement} button
 * @param {{
 *   bookId: string,
 *   title: string,
 *   partCount: number,
 *   readHref: string
 * }} context
 */
async function handleDownloadButtonClick(button, context) {
    const status = await getBookDownloadStatus(context.bookId, context.partCount);

    if (status.downloading) {
        return;
    }

    if (status.downloaded) {
        if (context.readHref) {
            window.location.href = context.readHref;
        }
        return;
    }

    button.disabled = true;
    applyButtonState(
        button,
        'loading',
        `${DOWNLOADING_LABEL} 0/${context.partCount}`,
        'Book download is in progress.'
    );

    try {
        await downloadBookForOffline({
            id: context.bookId,
            title: context.title,
            parts: context.partCount
        }, {
            onProgress: (progress) => {
                if (!button.isConnected) return;
                const completedParts = Math.max(0, Number(progress.completedParts) || 0);
                const totalParts = Math.max(1, Number(progress.totalParts) || context.partCount);
                applyButtonState(
                    button,
                    'loading',
                    `${DOWNLOADING_LABEL} ${Math.min(completedParts, totalParts)}/${totalParts}`,
                    'Book download is in progress.'
                );
            }
        });

        button.disabled = false;
        applyButtonState(
            button,
            'downloaded',
            OPEN_OFFLINE_LABEL,
            'This book is saved locally and can open without internet.'
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Book download failed.';
        button.disabled = false;
        applyButtonState(button, 'error', RETRY_LABEL, message);

        window.setTimeout(() => {
            if (!button.isConnected) return;
            void syncDownloadButtonState(button, context);
        }, 2000);
    }
}

/**
 * @param {HTMLButtonElement} button
 * @param {{
 *   bookId: string|number,
 *   title?: string,
 *   partCount?: number,
 *   readHref?: string
 * }} options
 */
export function attachBookDownloadButton(button, options = {}) {
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.dataset.offlineDownloadBound === '1') return;

    const bookId = normalizeBookId(options.bookId);
    if (!bookId) {
        button.hidden = true;
        return;
    }

    if (!isOfflineBookStorageSupported()) {
        button.hidden = true;
        button.setAttribute('aria-hidden', 'true');
        return;
    }

    const context = {
        bookId,
        title: String(options.title ?? '').trim(),
        partCount: normalizePartCount(options.partCount),
        readHref: String(options.readHref ?? '').trim()
    };

    button.dataset.offlineDownloadBound = '1';
    button.dataset.bookId = context.bookId;
    button.dataset.partCount = String(context.partCount);
    button.type = 'button';

    void syncDownloadButtonState(button, context);

    button.addEventListener('click', (event) => {
        event.preventDefault();
        void handleDownloadButtonClick(button, context);
    });

    button.addEventListener('focus', () => {
        void syncDownloadButtonState(button, context);
    });
}
