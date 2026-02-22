const MAX_PARSED_CACHE_ENTRIES = 10;
const PARSED_CACHE_TTL_MS = 20 * 60 * 1000;
const parsedPartCache = new Map();

function normalizeBookId(bookId) {
    return String(bookId ?? '').trim();
}

function normalizePartIndex(partIndex) {
    return Number.isInteger(partIndex) && partIndex >= 0 ? partIndex : 0;
}

function buildCacheKey(bookId, partIndex) {
    return `${normalizeBookId(bookId)}::${normalizePartIndex(partIndex)}`;
}

function enforceCacheLimit() {
    while (parsedPartCache.size > MAX_PARSED_CACHE_ENTRIES) {
        const oldestKey = parsedPartCache.keys().next().value;
        parsedPartCache.delete(oldestKey);
    }
}

function isExpired(entry) {
    if (!entry || typeof entry !== 'object') return true;
    const createdAt = Number(entry.createdAt);
    if (!Number.isFinite(createdAt)) return true;
    return (Date.now() - createdAt) > PARSED_CACHE_TTL_MS;
}

export function getParsedPartCache(bookId, partIndex) {
    const key = buildCacheKey(bookId, partIndex);
    if (!parsedPartCache.has(key)) return null;

    const entry = parsedPartCache.get(key);
    if (isExpired(entry)) {
        parsedPartCache.delete(key);
        return null;
    }

    parsedPartCache.delete(key);
    parsedPartCache.set(key, entry);
    return entry.value;
}

export function setParsedPartCache(bookId, partIndex, parsedContent) {
    const key = buildCacheKey(bookId, partIndex);
    parsedPartCache.delete(key);
    parsedPartCache.set(key, {
        value: parsedContent,
        createdAt: Date.now()
    });
    enforceCacheLimit();
}

export function clearParsedBookCache(bookId) {
    const prefix = `${normalizeBookId(bookId)}::`;
    [...parsedPartCache.keys()].forEach((key) => {
        if (key.startsWith(prefix)) {
            parsedPartCache.delete(key);
        }
    });
}
