import { getBookCategories } from './books-meta.js';
import { normalizeCatalogText } from './shared/text-normalization.js';

export const UNCATEGORIZED_FILTER = '__uncategorized';

function collectBookCategories(book) {
    return [...new Set(getBookCategories(book).map((value) => String(value).trim()).filter(Boolean))];
}

export function collectCategoryStats(books, locale = 'ar') {
    const sourceBooks = Array.isArray(books) ? books : [];
    const categoriesSet = new Set();
    let hasUncategorizedBooks = false;

    sourceBooks.forEach((book) => {
        const categories = collectBookCategories(book);
        if (!categories.length) {
            hasUncategorizedBooks = true;
            return;
        }

        categories.forEach((category) => categoriesSet.add(category));
    });

    const sortedCategories = [...categoriesSet].sort((a, b) => a.localeCompare(b, locale));
    return {
        sortedCategories,
        hasUncategorizedBooks
    };
}

export function filterBooksByCategoryMode(books, categoryMode = 'all') {
    const sourceBooks = Array.isArray(books) ? books : [];
    return sourceBooks.filter((book) => {
        const categories = getBookCategories(book);
        if (categoryMode === UNCATEGORIZED_FILTER) {
            return categories.length === 0;
        }

        if (categoryMode !== 'all') {
            return categories.includes(categoryMode);
        }

        return true;
    });
}

export function filterBooksByCategoryName(books, categoryName) {
    const normalizedTarget = normalizeCatalogText(categoryName);
    if (!normalizedTarget) return [];

    const sourceBooks = Array.isArray(books) ? books : [];
    return sourceBooks.filter((book) => {
        const categories = collectBookCategories(book);
        return categories.some((category) => normalizeCatalogText(category) === normalizedTarget);
    });
}
