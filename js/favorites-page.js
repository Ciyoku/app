import { fetchBooksList } from './books-repo.js';
import {
    buildReaderUrl,
    getBookId,
    getBookTitle
} from './books-meta.js';
import { createBookListPageController } from './book-list-page-controller.js';
import { getFavorites } from './favorites-store.js';
import { onDomReady } from './shared/bootstrap.js';
import { hasMinimumQueryWords } from './shared/query-words.js';
import { renderListMessage } from './book-list-ui.js';
import {
    createFavoriteRemoveControl
} from './catalog-page-core.js';
import { normalizeCatalogText } from './shared/text-normalization.js';

const EMPTY_FAVORITES_MESSAGE = 'لا توجد كتب مفضلة حتى الآن.';
const REMOVE_FAVORITE_LABEL = 'إزالة من المفضلة';
const MIN_SEARCH_WORDS = 2;
const MIN_SEARCH_WORDS_MESSAGE = 'اكتب كلمتين أو أكثر لبدء البحث.';

onDomReady(initFavoritesPage);

async function initFavoritesPage() {
    const container = document.getElementById('favoritesList');
    const searchInput = document.getElementById('favoritesSearchInput');
    if (!container || !searchInput) return;

    let books = [];
    let favoriteIds = new Set(getFavorites());
    let query = '';
    const listController = createBookListPageController({
        container,
        emptyMessage: EMPTY_FAVORITES_MESSAGE,
        createReadHref: (book) => buildReaderUrl(book, 0),
        createTrailingControl: (_book, bookId) => createRemoveButton(bookId)
    });

    function createRemoveButton(bookId) {
        return createFavoriteRemoveControl(bookId, {
            title: REMOVE_FAVORITE_LABEL,
            ariaLabel: REMOVE_FAVORITE_LABEL,
            onRemove: () => {
                favoriteIds.delete(bookId);
                render();
            }
        });
    }

    function getVisibleFavorites(normalizedQuery) {
        return books.filter((book) => {
            const id = getBookId(book);
            if (!favoriteIds.has(id)) return false;

            if (!normalizedQuery) return true;
            return normalizeCatalogText(getBookTitle(book)).includes(normalizedQuery);
        });
    }

    function render() {
        const normalizedQuery = normalizeCatalogText(query);
        const belowMinWordCount = normalizedQuery && !hasMinimumQueryWords(query, MIN_SEARCH_WORDS);
        const visibleBooks = belowMinWordCount ? [] : getVisibleFavorites(normalizedQuery);

        if (belowMinWordCount) {
            renderListMessage(container, MIN_SEARCH_WORDS_MESSAGE, 'empty');
            return;
        }

        listController.render(visibleBooks);
    }

    searchInput.addEventListener('input', (event) => {
        query = event.target.value;
        render();
    });

    if (!favoriteIds.size) {
        listController.render([]);
        return;
    }

    try {
        books = await fetchBooksList();
        render();
    } catch (error) {
        listController.renderError(`خطأ في تحميل المفضلة: ${error.message}`);
    }
}
