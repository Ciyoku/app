function resetActivePartState(session) {
    session.activePages = null;
    session.activeBook = null;
    session.activeBookId = '';
    session.activeBookPartIndex = 0;
    session.activePageIndex = 0;
}

export function createSearchSession(books, normalizedQuery) {
    return {
        books,
        normalizedQuery,
        matches: [],
        loading: false,
        completed: false,
        reachedMatchCap: false,
        partialFailures: 0,
        bookIndex: 0,
        partIndex: 0,
        activeBook: null,
        activeBookId: '',
        activeBookPartIndex: 0,
        activePages: null,
        activePageIndex: 0,
        error: null
    };
}

async function prepareNextPart(session, deps) {
    const {
        isTokenActive,
        fetchBookPart,
        getBookId,
        getBookPartCount,
        splitPartToPages
    } = deps;

    while (session.bookIndex < session.books.length) {
        const book = session.books[session.bookIndex];
        const bookId = getBookId(book);
        if (!bookId) {
            session.bookIndex += 1;
            session.partIndex = 0;
            continue;
        }

        const totalParts = getBookPartCount(book);
        if (session.partIndex >= totalParts) {
            session.bookIndex += 1;
            session.partIndex = 0;
            continue;
        }

        const currentPartIndex = session.partIndex;
        session.partIndex += 1;

        let partText = null;
        try {
            partText = await fetchBookPart(bookId, currentPartIndex);
        } catch (_) {
            session.partialFailures += 1;
            continue;
        }

        if (!isTokenActive()) return false;

        if (partText === null) {
            if (currentPartIndex === 0) {
                session.bookIndex += 1;
                session.partIndex = 0;
            }
            continue;
        }

        session.activeBook = book;
        session.activeBookId = bookId;
        session.activeBookPartIndex = currentPartIndex;
        session.activePages = splitPartToPages(partText);
        session.activePageIndex = 0;
        return true;
    }

    return false;
}

function forEachTextLine(text, onLine) {
    const source = String(text ?? '');
    let start = 0;

    while (start <= source.length) {
        const nextBreak = source.indexOf('\n', start);
        const end = nextBreak === -1 ? source.length : nextBreak;
        const line = source.slice(start, end);
        const shouldContinue = onLine(line);
        if (shouldContinue === false) return false;
        if (nextBreak === -1) break;
        start = nextBreak + 1;
    }

    return true;
}

function scanPageForMatches(session, pageText, targetCount, deps) {
    const {
        maxStoredMatches,
        normalizeLine,
        buildMatch
    } = deps;

    forEachTextLine(pageText, (line) => {
        if (session.matches.length >= targetCount || session.matches.length >= maxStoredMatches) {
            return false;
        }

        const trimmed = line.trim();
        if (!trimmed) return true;

        const normalizedLine = normalizeLine(trimmed);
        if (!normalizedLine.includes(session.normalizedQuery)) return true;

        const activeBook = session.activeBook;
        if (!activeBook || !session.activeBookId) return true;

        const match = buildMatch({
            book: activeBook,
            partIndex: session.activeBookPartIndex,
            pageIndex: session.activePageIndex,
            line: trimmed,
            normalizedQuery: session.normalizedQuery
        });

        if (!match || !match.excerpt) return true;
        session.matches.push(match);
        return true;
    });
}

async function scanSessionChunk(session, targetCount, deps) {
    const {
        isTokenActive,
        maxStoredMatches,
        pageScanChunkSize,
        frameBudgetMs = 12,
        yieldToBrowser
    } = deps;

    let pagesProcessed = 0;
    const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? () => performance.now()
        : () => Date.now();
    const chunkStartedAt = now();

    while (
        isTokenActive()
        && !session.completed
        && session.matches.length < targetCount
        && session.matches.length < maxStoredMatches
    ) {
        const reachedPageChunkLimit = pagesProcessed >= pageScanChunkSize;
        const reachedFrameBudget = (now() - chunkStartedAt) >= frameBudgetMs;
        if (reachedPageChunkLimit || reachedFrameBudget) {
            break;
        }

        if (!session.activePages) {
            const hasPart = await prepareNextPart(session, deps);
            if (!hasPart) {
                if (isTokenActive()) {
                    session.completed = true;
                }
                break;
            }
        }

        if (!session.activePages || session.activePageIndex >= session.activePages.length) {
            resetActivePartState(session);
            continue;
        }

        const pageText = session.activePages[session.activePageIndex];
        scanPageForMatches(session, pageText, targetCount, deps);
        session.activePageIndex += 1;
        pagesProcessed += 1;

        if (session.activePageIndex >= session.activePages.length) {
            resetActivePartState(session);
        }
    }

    if (session.matches.length >= maxStoredMatches) {
        session.completed = true;
        session.reachedMatchCap = true;
    }

    if (pagesProcessed > 0) {
        await yieldToBrowser();
    }
}

export async function fillMatchesUntil(session, targetCount, deps) {
    if (!session || session.loading || session.completed || session.matches.length >= targetCount) {
        return;
    }

    session.loading = true;

    try {
        while (
            deps.isTokenActive()
            && !session.completed
            && session.matches.length < targetCount
        ) {
            await scanSessionChunk(session, targetCount, deps);
        }
    } catch (error) {
        session.error = error;
        session.completed = true;
    } finally {
        session.loading = false;
    }
}
