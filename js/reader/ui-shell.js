import { hasMinimumQueryWords } from '../shared/query-words.js';

const MIN_READER_SEARCH_WORDS = 2;
const READER_MIN_SEARCH_WORDS_MESSAGE = 'اكتب كلمتين أو أكثر لبدء البحث.';

function getReaderShellElements() {
    return {
        toggle: document.getElementById('sidebarToggle'),
        sidebar: document.getElementById('sidebar'),
        content: document.getElementById('readerContent'),
        searchOverlay: document.getElementById('searchOverlay'),
        searchBtn: document.getElementById('searchBtn'),
        closeSearch: document.getElementById('closeSearch'),
        searchInput: document.getElementById('searchInput'),
        searchHint: document.getElementById('searchHint'),
        searchResults: document.getElementById('searchResults')
    };
}

function isCompactViewport() {
    return window.matchMedia('(max-width: 900px)').matches;
}

function collectFocusableElements(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    const selector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    return [...root.querySelectorAll(selector)].filter((element) => (
        !element.hasAttribute('disabled')
        && element.getAttribute('aria-hidden') !== 'true'
    ));
}

export function closeSidebarOnCompactView() {
    if (!isCompactViewport()) return;
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('readerContent');
    const toggle = document.getElementById('sidebarToggle');

    sidebar.classList.add('hidden');
    sidebar.setAttribute('aria-hidden', 'true');
    content.classList.add('full-width');
    toggle.setAttribute('aria-expanded', 'false');
}

export function setupReaderUi({
    onSearchQuery
}) {
    const {
        toggle,
        sidebar,
        content,
        searchOverlay,
        searchBtn,
        closeSearch,
        searchInput,
        searchHint,
        searchResults
    } = getReaderShellElements();

    let compactMode = isCompactViewport();
    let resizeTimer = null;
    let searchDebounceTimer = null;
    let sidebarHiddenBeforeSearch = false;
    let previousFocusBeforeSearch = null;

    const setSidebarVisibility = (hidden) => {
        sidebar.classList.toggle('hidden', hidden);
        sidebar.setAttribute('aria-hidden', hidden ? 'true' : 'false');
        content.classList.toggle('full-width', hidden);
        toggle.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    };

    const setSearchVisibility = (open) => {
        searchOverlay.classList.toggle('active', open);
        searchOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');
        searchBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    const applyViewportLayout = (force = false) => {
        const nextCompactMode = isCompactViewport();
        if (!force && nextCompactMode === compactMode) return;
        compactMode = nextCompactMode;

        if (compactMode) {
            setSidebarVisibility(true);
        }
    };

    const closeSearchOverlay = () => {
        if (!searchOverlay.classList.contains('active')) return;
        setSearchVisibility(false);
        clearTimeout(searchDebounceTimer);

        if (searchHint) {
            searchHint.textContent = '';
        }

        searchResults.replaceChildren();

        if (!isCompactViewport() && !sidebarHiddenBeforeSearch) {
            setSidebarVisibility(false);
        }

        const focusTarget = previousFocusBeforeSearch instanceof HTMLElement
            ? previousFocusBeforeSearch
            : searchBtn;
        previousFocusBeforeSearch = null;
        focusTarget.focus({ preventScroll: true });
    };

    applyViewportLayout(true);
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => applyViewportLayout(), 120);
    });

    toggle.addEventListener('click', () => {
        const hidden = sidebar.classList.contains('hidden');
        setSidebarVisibility(!hidden);
        setSearchVisibility(false);
    });

    searchBtn.addEventListener('click', () => {
        const willOpen = !searchOverlay.classList.contains('active');

        if (!willOpen) {
            closeSearchOverlay();
            return;
        }

        sidebarHiddenBeforeSearch = !isCompactViewport() && sidebar.classList.contains('hidden');
        previousFocusBeforeSearch = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setSearchVisibility(true);
        setSidebarVisibility(true);
        searchInput.focus({ preventScroll: true });
    });

    closeSearch.addEventListener('click', closeSearchOverlay);

    searchInput.addEventListener('input', (event) => {
        const query = event.target.value.trim();
        searchResults.replaceChildren();
        clearTimeout(searchDebounceTimer);

        if (!query) {
            if (searchHint) {
                searchHint.textContent = '';
            }
            return;
        }

        if (!hasMinimumQueryWords(query, MIN_READER_SEARCH_WORDS)) {
            if (searchHint) {
                searchHint.textContent = READER_MIN_SEARCH_WORDS_MESSAGE;
            }
            return;
        }

        if (searchHint) {
            searchHint.textContent = '';
        }

        searchDebounceTimer = setTimeout(() => {
            onSearchQuery(query, searchResults, closeSearchOverlay);
        }, 180);
    });

    document.addEventListener('keydown', (event) => {
        if (!searchOverlay.classList.contains('active')) return;

        if (event.key === 'Escape') {
            closeSearchOverlay();
            return;
        }

        if (event.key !== 'Tab') return;

        const focusables = collectFocusableElements(searchOverlay);
        if (!focusables.length) {
            event.preventDefault();
            searchInput.focus({ preventScroll: true });
            return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (!(active instanceof Element) || !searchOverlay.contains(active)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus({ preventScroll: true });
            return;
        }

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus({ preventScroll: true });
            return;
        }

        if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus({ preventScroll: true });
        }
    });

    document.addEventListener('pointerdown', (event) => {
        if (!searchOverlay.classList.contains('active')) return;
        const target = event.target;
        if (searchOverlay.contains(target)) return;
        if (searchBtn.contains(target)) return;
        closeSearchOverlay();
    });

}
