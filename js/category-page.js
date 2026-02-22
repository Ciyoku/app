import { fetchBooksList } from './books-repo.js';
import {
    buildReaderUrl
} from './books-meta.js';
import { createBookListPageController } from './book-list-page-controller.js';
import { filterBooksByCategoryName, groupBooksByCategory } from './categories-data.js';
import { onDomReady } from './shared/bootstrap.js';
import { setCanonicalUrl, setRobots, setSocialMetadata } from './shared/seo.js';
import { normalizeCatalogText } from './shared/text-normalization.js';

const EMPTY_CATEGORY_MESSAGE = 'لا توجد كتب ضمن هذا التصنيف حاليًا.';
const INDEXABLE_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';

onDomReady(initCategoryPage);

function getRequestedCategoryName() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('category') ?? '').trim();
}

function buildCategoryUrl(categoryName) {
    const params = new URLSearchParams();
    params.set('category', categoryName);
    return `category.html?${params.toString()}`;
}

function findKnownCategory(categories, requestedCategory) {
    const normalizedRequested = normalizeCatalogText(requestedCategory);
    if (!normalizedRequested) return null;

    return categories.find((category) => (
        normalizeCatalogText(category.name) === normalizedRequested
    )) || null;
}

function setCategorySeo(categoryName) {
    const safeName = String(categoryName).trim();
    if (!safeName) return;

    setRobots(INDEXABLE_ROBOTS);
    setSocialMetadata({
        title: `${safeName} | التصنيفات | المكتبة الأخبارية`,
        description: `تصفح الكتب المصنفة تحت "${safeName}" في المكتبة الأخبارية.`,
        url: buildCategoryUrl(safeName)
    });
}

async function initCategoryPage() {
    const listElement = document.getElementById('categoryBookList');
    if (!listElement) return;
    const listController = createBookListPageController({
        container: listElement,
        emptyMessage: EMPTY_CATEGORY_MESSAGE,
        createReadHref: (book) => buildReaderUrl(book, 0)
    });

    const requestedCategory = getRequestedCategoryName();
    if (!requestedCategory) {
        setRobots('noindex,follow');
        setCanonicalUrl('categories.html');
        listController.renderError('يرجى العودة إلى صفحة التصنيفات ثم اختيار تصنيف.');
        return;
    }

    try {
        const books = await fetchBooksList();
        const categories = groupBooksByCategory(books);
        const knownCategory = findKnownCategory(categories, requestedCategory);

        if (!knownCategory) {
            setRobots('noindex,follow');
            setCanonicalUrl('categories.html');
            listController.renderError('التصنيف المطلوب غير متاح في بيانات الكتب الحالية.');
            return;
        }

        const selectedCategory = knownCategory.name;
        const categoryBooks = filterBooksByCategoryName(books, selectedCategory);
        listController.render(categoryBooks);
        setCategorySeo(selectedCategory);
    } catch (error) {
        listController.renderError(`تعذر تحميل كتب التصنيف: ${error.message}`);
    }
}
