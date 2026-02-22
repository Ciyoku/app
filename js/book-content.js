function getBookPartFileName(partIndex) {
    return partIndex === 0 ? 'book.txt' : `book${partIndex + 1}.txt`;
}

const BOOK_LOAD_ERROR_MESSAGE = 'تعذر تحميل نص الكتاب';
const MAX_PART_CACHE_ENTRIES = 24;
const PART_CACHE_TTL_MS = 30 * 60 * 1000;
const partFetchCache = new Map();

function normalizeBookPathId(bookId) {
    return encodeURIComponent(String(bookId ?? '').trim());
}

async function fetchTextIfOk(url) {
    const response = await fetch(url, {
        headers: {
            Accept: 'text/plain, text/*;q=0.9, */*;q=0.1'
        }
    });
    if (!response.ok) return null;
    return response.text();
}

function getPartCacheKey(bookId, partIndex) {
    return `${normalizeBookPathId(bookId)}::${partIndex}`;
}

function normalizePartIndex(partIndex) {
    if (!Number.isInteger(partIndex) || partIndex < 0) return 0;
    return partIndex;
}

function setCacheEntry(key, value) {
    pruneExpiredEntries();
    partFetchCache.delete(key);
    partFetchCache.set(key, value);

    while (partFetchCache.size > MAX_PART_CACHE_ENTRIES) {
        const oldestKey = partFetchCache.keys().next().value;
        partFetchCache.delete(oldestKey);
    }
}

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

    const request = fetchTextIfOk(`books/${normalizedBookId}/${getBookPartFileName(safePartIndex)}`);
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

export function clearBookPartCache(bookId) {
    const prefix = `${normalizeBookPathId(bookId)}::`;
    [...partFetchCache.keys()].forEach((key) => {
        if (key.startsWith(prefix)) {
            partFetchCache.delete(key);
        }
    });
}
