export function createBookListItem({
    bookId,
    title,
    readHref
}) {
    const item = document.createElement('li');
    item.className = 'book-list-item fade-in';
    if (bookId) {
        item.dataset.bookId = String(bookId);
    }

    const card = document.createElement('article');
    card.className = 'book-card';

    const link = document.createElement('a');
    link.href = readHref;
    link.className = 'book-link';
    link.textContent = title;

    card.appendChild(link);
    item.appendChild(card);
    return item;
}

export function renderListMessage(container, message, tone = 'error') {
    const cssClass = tone === 'loading'
        ? 'book-list-loading'
        : tone === 'empty'
            ? 'book-list-empty'
            : 'book-list-error';

    container.replaceChildren();
    const item = document.createElement('li');
    item.className = cssClass;
    item.textContent = message;
    container.appendChild(item);
}
