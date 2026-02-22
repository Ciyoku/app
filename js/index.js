import { fetchBooksList } from './books-repo.js';
import {
    buildReaderUrl
} from './books-meta.js';
import { createBookListPageController } from './book-list-page-controller.js';
import { onDomReady } from './shared/bootstrap.js';
import {
    createFavoriteToggleControl
} from './catalog-page-core.js';
import { normalizeCatalogText } from './shared/text-normalization.js';

const EMPTY_MESSAGE = 'لا توجد كتب مطابقة للبحث الحالي.';
const FAVORITE_BUTTON_LABEL = 'إضافة أو إزالة من المفضلة';

onDomReady(initCatalogPage);

async function initCatalogPage() {
    const container = document.getElementById('bookList');
    const searchInput = document.getElementById('catalogSearchInput');
    if (!container || !searchInput) return;

    let books = [];
    let query = '';
    const listController = createBookListPageController({
        container,
        emptyMessage: EMPTY_MESSAGE,
        createReadHref: (book) => buildReaderUrl(book, 0),
        createTrailingControl: (_book, bookId) => createFavoriteButton(bookId)
    });

    function createFavoriteButton(bookId) {
        return createFavoriteToggleControl(bookId, {
            title: FAVORITE_BUTTON_LABEL,
            ariaLabel: FAVORITE_BUTTON_LABEL
        });
    }

    function applyFilters(source) {
        const normalizedQuery = normalizeCatalogText(query);
        return source.filter((book) => {
            const title = normalizeCatalogText(book.title);
            return !normalizedQuery || title.includes(normalizedQuery);
        });
    }

    function refresh() {
        listController.render(applyFilters(books));
    }

    searchInput.addEventListener('input', (event) => {
        query = event.target.value;
        refresh();
    });

    try {
        books = await fetchBooksList();
        refresh();
    } catch (error) {
        listController.renderError(`خطأ في تحميل قائمة الكتب: ${error.message}`);
    }
}
