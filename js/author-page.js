import { fetchBooksList } from './books-repo.js';
import {
    buildReaderUrl
} from './books-meta.js';
import { createBookListPageController } from './book-list-page-controller.js';
import { buildAuthorPageUrl, filterBooksByAuthor, groupBooksByAuthor } from './authors-data.js';
import {
    createFavoriteToggleControl
} from './catalog-page-core.js';
import { onDomReady } from './shared/bootstrap.js';
import { setSocialMetadata } from './shared/seo.js';
import { normalizeCatalogText } from './shared/text-normalization.js';

const FAVORITE_BUTTON_LABEL = 'إضافة أو إزالة من المفضلة';
const EMPTY_AUTHOR_MESSAGE = 'لا توجد كتب لهذا المؤلف حاليًا.';

onDomReady(initAuthorPage);

function getRequestedAuthorName() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('author') ?? '').trim();
}

function findKnownAuthor(authors, requestedAuthor) {
    const normalizedRequested = normalizeCatalogText(requestedAuthor);
    if (!normalizedRequested) return null;

    return authors.find((author) => (
        normalizeCatalogText(author.name) === normalizedRequested
    )) || null;
}

function createFavoriteButton(bookId) {
    return createFavoriteToggleControl(bookId, {
        title: FAVORITE_BUTTON_LABEL,
        ariaLabel: FAVORITE_BUTTON_LABEL
    });
}

function setAuthorSeo(authorName) {
    const safeName = String(authorName).trim();
    if (!safeName) return;

    setSocialMetadata({
        title: `${safeName} | المؤلفون | المكتبة الأخبارية`,
        description: `تصفح الكتب التابعة للمؤلف "${safeName}" في المكتبة الأخبارية.`,
        url: buildAuthorPageUrl(safeName)
    });
}

async function initAuthorPage() {
    const listElement = document.getElementById('authorBookList');
    if (!listElement) return;
    const listController = createBookListPageController({
        container: listElement,
        emptyMessage: EMPTY_AUTHOR_MESSAGE,
        createReadHref: (book) => buildReaderUrl(book, 0),
        createTrailingControl: (_book, bookId) => createFavoriteButton(bookId)
    });

    const requestedAuthor = getRequestedAuthorName();
    if (!requestedAuthor) {
        listController.renderError('يرجى العودة إلى صفحة المؤلفين ثم اختيار مؤلف.');
        return;
    }

    try {
        const books = await fetchBooksList();
        const authors = groupBooksByAuthor(books);
        const knownAuthor = findKnownAuthor(authors, requestedAuthor);

        if (!knownAuthor) {
            listController.renderError('المؤلف المطلوب غير متاح في بيانات الكتب الحالية.');
            return;
        }

        const selectedAuthor = knownAuthor.name;
        const authorBooks = filterBooksByAuthor(books, selectedAuthor);
        listController.render(authorBooks);
        setAuthorSeo(selectedAuthor);
    } catch (error) {
        listController.renderError(`تعذر تحميل كتب المؤلف: ${error.message}`);
    }
}
