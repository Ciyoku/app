import { fetchBookPartWithOfflinePriority } from '../features/offline/book-offline-storage.js';

const BOOK_LOAD_ERROR_MESSAGE = 'تعذر تحميل نص الكتاب';
const MAX_PART_CACHE_ENTRIES = 24;
const PART_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * @typedef {Object} CacheEntry
 * @property {Promise<string|null>} request
 * @property {number} createdAt
 */

/** @type {Map<string, CacheEntry>} */
const partFetchCache = new Map();

/**
 * @param {string|number} bookId
 * @returns {string}
 */
function normalizeBookPathId(bookId) {
    return String(bookId ?? '').trim();
}

/**
 * @param {string} bookId
 * @param {number} partIndex
 * @param {Object} [options={}]
 * @param {boolean} [options.force=false]
 * @returns {Promise<string|null>}
 */
async function fetchTextIfOk(bookId, partIndex, options = {}) {
    return fetchBookPartWithOfflinePriority(bookId, partIndex, options);
}

/**
 * @param {string|number} bookId
 * @param {number} partIndex
 * @returns {string}
 */
function getPartCacheKey(bookId, partIndex) {
    return `${normalizeBookPathId(bookId)}::${partIndex}`;
}

/**
 * @param {number} partIndex
 * @returns {number}
 */
function normalizePartIndex(partIndex) {
    if (!Number.isInteger(partIndex) || partIndex < 0) return 0;
    return partIndex;
}

/**
 * @param {string} key
 * @param {CacheEntry} value
 */
function setCacheEntry(key, value) {
    pruneExpiredEntries();
    partFetchCache.delete(key);
    partFetchCache.set(key, value);

    while (partFetchCache.size > MAX_PART_CACHE_ENTRIES) {
        const oldestKey = partFetchCache.keys().next().value;
        if (oldestKey) partFetchCache.delete(oldestKey);
    }
}

/**
 * @param {CacheEntry} entry
 * @returns {boolean}
 */
function isExpired(entry) {
    if (!entry || typeof entry !== 'object') return true;
    const createdAt = Number(entry.createdAt);
    if (!Number.isFinite(createdAt)) return true;
    return (Date.now() - createdAt) > PART_CACHE_TTL_MS;
}

function pruneExpiredEntries() {
    [...partFetchCache.entries()].forEach(([key, entry]) => {
        if (isExpired(entry)) {
            partFetchCache.delete(key);
        }
    });
}

/**
 * @param {string} key
 * @returns {CacheEntry|null}
 */
function getFreshCacheEntry(key) {
    const entry = partFetchCache.get(key);
    if (!entry) return null;
    if (isExpired(entry)) {
        partFetchCache.delete(key);
        return null;
    }

    partFetchCache.delete(key);
    partFetchCache.set(key, entry);
    return entry;
}

/**
 * @param {string|number} bookId
 * @param {number} [partIndex=0]
 * @param {Object} [options={}]
 * @param {boolean} [options.force=false]
 * @returns {Promise<string|null>}
 */
export async function fetchBookPart(bookId, partIndex = 0, options = {}) {
    const normalizedBookId = normalizeBookPathId(bookId);
    if (!normalizedBookId) {
        throw new Error(BOOK_LOAD_ERROR_MESSAGE);
    }

    const safePartIndex = normalizePartIndex(partIndex);
    const force = options.force === true;
    const cacheKey = getPartCacheKey(bookId, safePartIndex);

    if (!force) {
        const cached = getFreshCacheEntry(cacheKey);
        if (cached) {
            return cached.request;
        }
    }

    const request = fetchTextIfOk(normalizedBookId, safePartIndex, { force });
    setCacheEntry(cacheKey, {
        request,
        createdAt: Date.now()
    });

    try {
        return await request;
    } catch (error) {
        partFetchCache.delete(cacheKey);
        throw error;
    }
}

/**
 * @param {string|number} bookId
 */
export function clearBookPartCache(bookId) {
    const prefix = `${normalizeBookPathId(bookId)}::`;
    [...partFetchCache.keys()].forEach((key) => {
        if (key.startsWith(prefix)) {
            partFetchCache.delete(key);
        }
    });
}
