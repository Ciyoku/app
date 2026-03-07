/**
 * @typedef {Object} Book
 * @property {string|number} id - Unique identifier for the book.
 * @property {string} title - The title of the book.
 * @property {string|number} [parts] - Number of parts/volumes.
 * @property {string|string[]} [categories] - Categories or tags.
 * @property {string|string[]} [category] - Alternative category field.
 */

/**
 * @typedef {Object} ReaderState
 * @property {string} [bookId]
 * @property {number} [partIndex]
 * @property {number} [pageIndex]
 * @property {string} [chapterId]
 */

/**
 * @param {string|number} id
 * @returns {string}
 */
function normalizeId(id) {
    return String(id ?? '').trim();
}

/**
 * @param {Book} book
 * @returns {string}
 */
function getBookId(book) {
    return normalizeId(book?.id);
}

/**
 * @param {Book} book
 * @param {number} [fallbackIndex=0]
 * @returns {string}
 */
function getBookTitle(book, fallbackIndex = 0) {
    const title = String(book?.title ?? '').trim();
    if (title) return title;
    return `كتاب ${fallbackIndex + 1}`;
}

/**
 * @param {Book} book
 * @returns {number}
 */
function getBookPartCount(book) {
    const value = Number.parseInt(String(book?.parts ?? ''), 10);
    if (Number.isInteger(value) && value > 1) return value;
    return 1;
}

/**
 * @param {any} value
 * @param {string[]} output
 */
function collectCategories(value, output) {
    if (Array.isArray(value)) {
        value.forEach((item) => collectCategories(item, output));
        return;
    }

    if (value === null || value === undefined) return;
    if (typeof value !== 'string' && typeof value !== 'number') return;

    const normalized = String(value).trim();
    if (normalized) {
        output.push(normalized);
    }
}

/**
 * @param {Book} book
 * @returns {string[]}
 */
function getBookCategories(book) {
    const categories = [];
    collectCategories(book?.categories, categories);
    collectCategories(book?.category, categories);
    collectCategories(book?.['التصنيفات'], categories);
    collectCategories(book?.['التصنيف'], categories);
    return [...new Set(categories)];
}

/**
 * @param {Book} book
 * @returns {boolean}
 */
function hasMultipleParts(book) {
    return getBookPartCount(book) > 1;
}

/**
 * @param {number} partIndex
 * @returns {string}
 */
function toPartParam(partIndex) {
    const safeIndex = Number.isInteger(partIndex) && partIndex >= 0 ? partIndex : 0;
    return `part${safeIndex + 1}`;
}

/**
 * @param {any} partIndex
 * @returns {number}
 */
function normalizePartIndex(partIndex) {
    return Number.isInteger(partIndex) && partIndex >= 0 ? partIndex : 0;
}

/**
 * @param {Book} book
 * @param {number} [partIndex=0]
 * @returns {boolean}
 */
function shouldIncludePartInUrl(book, partIndex = 0) {
    return hasMultipleParts(book) && normalizePartIndex(partIndex) > 0;
}

/**
 * @param {string|null} partValue
 * @returns {number|null}
 */
function parsePartParam(partValue) {
    if (partValue === null || partValue === undefined || partValue === '') {
        return null;
    }

    const value = String(partValue).trim();
    const partMatch = /^part(\d+)$/i.exec(value);
    if (partMatch) {
        const parsed = Number.parseInt(partMatch[1], 10);
        if (Number.isInteger(parsed) && parsed > 0) return parsed - 1;
        return null;
    }

    const asNumber = Number(value);
    if (Number.isInteger(asNumber) && asNumber > 0) {
        return asNumber - 1;
    }

    return null;
}

/**
 * @param {Book} book
 * @param {number} [partIndex=0]
 * @returns {string}
 */
function buildReaderUrl(book, partIndex = 0) {
    return buildReaderUrlWithState(book, { partIndex });
}

/**
 * @param {Book} book
 * @param {ReaderState} [state={}]
 * @returns {string}
 */
function buildReaderUrlWithState(book, state = {}) {
    const id = getBookId(book) || normalizeId(state.bookId);
    if (!id) return 'reader.html';

    const params = new URLSearchParams();
    params.set('book', id);

    const safePartIndex = normalizePartIndex(state.partIndex);
    if (shouldIncludePartInUrl(book, safePartIndex)) {
        params.set('part', toPartParam(safePartIndex));
    }

    const pageIndex = Number.isInteger(state.pageIndex) && state.pageIndex >= 0
        ? state.pageIndex
        : null;
    if (pageIndex !== null && pageIndex > 0) {
        params.set('page', String(pageIndex + 1));
    }

    const chapterId = String(state.chapterId ?? '').trim();
    if (chapterId) {
        params.set('chapter', chapterId);
    }

    return `reader.html?${params.toString()}`;
}

export {
    getBookId,
    getBookPartCount,
    getBookCategories,
    getBookTitle,
    parsePartParam,
    toPartParam,
    buildReaderUrl,
    buildReaderUrlWithState
};
