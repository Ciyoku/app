import { getBookCategories } from './books-meta.js';
import { filterBooksByCategoryName } from './books-filtering.js';

function toSafeCategoryName(value) {
    return String(value ?? '').trim();
}

function collectBookCategories(book) {
    return [...new Set(getBookCategories(book).map(toSafeCategoryName).filter(Boolean))];
}

export function groupBooksByCategory(books) {
    const grouped = new Map();

    books.forEach((book) => {
        const categories = collectBookCategories(book);
        categories.forEach((categoryName) => {
            if (!grouped.has(categoryName)) {
                grouped.set(categoryName, []);
            }
            grouped.get(categoryName).push(book);
        });
    });

    return [...grouped.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'ar'))
        .map(([name, groupedBooks]) => ({
            name,
            books: groupedBooks,
            count: groupedBooks.length
        }));
}

export function buildCategoryPageUrl(categoryName) {
    const name = toSafeCategoryName(categoryName);
    if (!name) return 'categories.html';

    const params = new URLSearchParams();
    params.set('category', name);
    return `category.html?${params.toString()}`;
}

export { filterBooksByCategoryName };
