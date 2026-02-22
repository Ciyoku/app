import { getBookId, getBookTitle } from './books-meta.js';
import { createBookListItem, renderListMessage } from './book-list-ui.js';

export function createBookListPageController({
    container,
    emptyMessage = 'لا توجد كتب متاحة حاليًا.',
    createReadHref,
    createTrailingControl = null
}) {
    if (!container || typeof container.replaceChildren !== 'function') {
        throw new Error('A valid list container is required');
    }

    function render(books = []) {
        const sourceBooks = Array.isArray(books) ? books : [];
        container.replaceChildren();

        if (!sourceBooks.length) {
            renderListMessage(container, emptyMessage, 'empty');
            return 0;
        }

        sourceBooks.forEach((book, index) => {
            const id = getBookId(book);
            if (!id) return;

            const item = createBookListItem({
                bookId: id,
                title: getBookTitle(book, index),
                readHref: typeof createReadHref === 'function' ? createReadHref(book) : 'reader.html',
                favoriteButton: typeof createTrailingControl === 'function'
                    ? createTrailingControl(book, id)
                    : null
            });

            container.appendChild(item);
        });

        if (!container.children.length) {
            renderListMessage(container, emptyMessage, 'empty');
            return 0;
        }

        return container.children.length;
    }

    function renderError(message) {
        renderListMessage(container, message, 'error');
    }

    function renderLoading(message) {
        renderListMessage(container, message, 'loading');
    }

    return {
        render,
        renderError,
        renderLoading
    };
}
