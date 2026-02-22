import { fetchBooksList } from '../books-repo.js';
import { getBookPartCount } from '../books-meta.js';
import { isFavorite, toggleFavorite } from '../favorites-store.js';
import { clearBookPartCache, fetchBookPart } from '../book-content.js';
import { createHighlightedTextFragment, parseBookContentAsync } from '../reader-parser.js';
import { toArabicIndicNumber, parsePageNumberInput } from './number-format.js';
import { getRequestedReaderState, updateReaderStateInUrl } from './url-state.js';
import { createSearchEngine, searchInBookIndex } from './search.js';
import {
    MAX_FONT_SIZE,
    MIN_FONT_SIZE,
    applyBookmarkIcon,
    createReaderState
} from './constants.js';
import { renderPartSelector, updatePartSelector } from './part-selector.js';
import { createPaginationController } from './pagination.js';
import { renderSearchResults } from './search-results.js';
import { closeSidebarOnCompactView, setupReaderUi } from './ui-shell.js';
import {
    loadBookProgress,
    loadReaderPreferences,
    resolveRequestedState,
    saveBookProgress,
    saveReaderPreferences
} from './persistence.js';
import { clearParsedBookCache, getParsedPartCache, setParsedPartCache } from './parsed-content-cache.js';
import { setCanonicalUrl } from '../shared/seo.js';
import { SITE_NAME } from '../site-config.js';
import { buildBookPartState, canPreloadNextPart } from './part-state.js';
import { createReaderPartLoader } from './part-loader.js';
import { updateReaderSeo as applyReaderSeoMetadata } from './reader-seo.js';
import { applyStoredReaderPreferences, clampValue, handleReaderControlAction } from './reader-controls.js';
import { persistReadingProgress } from './reading-progress.js';
import { bindReaderPopstateNavigation } from './popstate-navigation.js';
import {
    UNKNOWN_BOOK_TITLE,
    READER_TITLE_SUFFIX,
    getBookTitleDisplay,
    getReaderContent,
    renderReaderError,
    renderReaderLoading,
    renderMissingBookMessage,
    setDocumentTitle
} from './view.js';

const BOOK_TEXT_LOAD_ERROR = 'تعذر تحميل نص الكتاب';
const BOOK_LOAD_ERROR_PREFIX = 'تعذر تحميل الكتاب';
const PART_LOAD_ERROR_PREFIX = 'تعذر تحميل هذا الجزء';

const state = createReaderState();
let activeBookInfo = null;
let loadBookPart = async () => {};

const pagination = createPaginationController({
    state,
    toArabicIndicNumber,
    parsePageNumberInput,
    updateReaderStateInUrl,
    onPageRender: () => {
        persistReadingProgress(state, saveBookProgress);
    }
});

function updateReaderSeo() {
    applyReaderSeoMetadata(state, activeBookInfo, {
        siteName: SITE_NAME,
        unknownBookTitle: UNKNOWN_BOOK_TITLE,
        readerTitleSuffix: READER_TITLE_SUFFIX
    });
}

function renderBookPartSelector() {
    renderPartSelector({
        state,
        onSelectPart: async (partIndex) => {
            await loadBookPart(partIndex, { historyMode: 'push' });
        },
        onAfterSelectPart: closeSidebarOnCompactView
    });
}

const partLoader = createReaderPartLoader({
    state,
    clamp: clampValue,
    createSearchEngine,
    fetchBookPart,
    parseBookContentAsync,
    getParsedPartCache,
    setParsedPartCache,
    updatePartSelector,
    pagination,
    updateReaderSeo,
    renderReaderLoading,
    renderReaderError,
    onPartStatusChange: () => {
        renderBookPartSelector();
    },
    canPreloadNextPart,
    partLoadErrorPrefix: PART_LOAD_ERROR_PREFIX
});

loadBookPart = async (partIndex, options = {}) => {
    await partLoader.loadBookPart(partIndex, {
        ...options,
        onAfterChapterNavigate: closeSidebarOnCompactView
    });
};

function resetBookCachesForSwitch(normalizedId) {
    if (!state.currentBookId || state.currentBookId === normalizedId) return;

    partLoader.cancelPendingPartLoads();
    clearBookPartCache(state.currentBookId);
    clearParsedBookCache(state.currentBookId);
}

async function loadBook(bookId) {
    const normalizedId = String(bookId ?? '').trim();
    if (!normalizedId) {
        renderMissingBookMessage();
        return;
    }

    resetBookCachesForSwitch(normalizedId);

    state.currentBookId = normalizedId;
    renderReaderLoading();

    try {
        const books = await fetchBooksList();
        const info = books.find((book) => String(book.id) === normalizedId);

        if (!info) {
            activeBookInfo = null;
            getBookTitleDisplay().textContent = UNKNOWN_BOOK_TITLE;
            renderReaderError('الكتاب المطلوب غير موجود في الفهرس.');
            setCanonicalUrl('reader.html');
            return;
        }

        activeBookInfo = info;
        state.currentBookPartCount = getBookPartCount(info);
        state.bookParts = buildBookPartState(state.currentBookPartCount, toArabicIndicNumber);

        const titleDisplay = getBookTitleDisplay();
        titleDisplay.textContent = info.title || UNKNOWN_BOOK_TITLE;
        setDocumentTitle(info);

        const requestedState = getRequestedReaderState();
        const persistedState = loadBookProgress(normalizedId);
        const initialState = resolveRequestedState(requestedState, persistedState);
        const safePartIndex = clampValue(initialState.partIndex, 0, Math.max(state.bookParts.length - 1, 0));

        state.currentPartIndex = safePartIndex;
        updateReaderSeo();

        renderBookPartSelector();
        await loadBookPart(safePartIndex, {
            pageIndex: initialState.pageIndex,
            chapterId: initialState.chapterId,
            historyMode: 'replace'
        });
    } catch (error) {
        renderReaderError(`${BOOK_LOAD_ERROR_PREFIX}: ${error.message || BOOK_TEXT_LOAD_ERROR}`);
    }
}

function setupUI() {
    setupReaderUi({
        onControlAction: (action) => {
            handleReaderControlAction(action, {
                state,
                getReaderContent,
                saveReaderPreferences,
                minFontSize: MIN_FONT_SIZE,
                maxFontSize: MAX_FONT_SIZE
            });
        },
        onSearchQuery: (query, resultsContainer, closeSearchOverlay) => {
            renderSearchResults({
                query,
                resultsContainer,
                closeSearchOverlay,
                searchEngine: state.searchEngine,
                searchInBookIndex,
                createHighlightedTextFragment,
                onOpenPage: (pageIndex) => pagination.renderPage(pageIndex, { chapterId: '', historyMode: 'push' }),
                onOpenChapter: (pageIndex, chapterId) => pagination.goToPage(pageIndex, chapterId, { historyMode: 'push' })
            });
        },
        isFavoriteBook: (bookId) => isFavorite(bookId),
        onToggleFavorite: (bookId) => toggleFavorite(bookId),
        applyFavoriteIcon: (button, isActive) => applyBookmarkIcon(button, isActive)
    });
}

export async function initReaderPage() {
    applyStoredReaderPreferences({
        state,
        loadReaderPreferences,
        getReaderContent,
        minFontSize: MIN_FONT_SIZE,
        maxFontSize: MAX_FONT_SIZE
    });
    setupUI();
    bindReaderPopstateNavigation({
        state,
        getRequestedReaderState,
        renderMissingBookMessage,
        loadBook: (bookId) => loadBook(bookId),
        loadBookPart: (partIndex, options) => loadBookPart(partIndex, options)
    });

    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('book');
    if (!bookId) {
        renderMissingBookMessage();
        return;
    }

    await loadBook(bookId);
}
