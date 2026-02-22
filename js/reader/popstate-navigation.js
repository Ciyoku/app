let popstateBound = false;

export function bindReaderPopstateNavigation({
    state,
    getRequestedReaderState,
    renderMissingBookMessage,
    loadBook,
    loadBookPart
}) {
    if (popstateBound) return;
    popstateBound = true;

    window.addEventListener('popstate', async () => {
        const bookIdFromUrl = new URLSearchParams(window.location.search).get('book');
        if (!bookIdFromUrl) {
            renderMissingBookMessage();
            return;
        }

        if (String(bookIdFromUrl) !== state.currentBookId) {
            await loadBook(bookIdFromUrl);
            return;
        }

        const requested = getRequestedReaderState();
        const partIndex = Number.isInteger(requested.partIndex) ? requested.partIndex : state.currentPartIndex;
        await loadBookPart(partIndex, {
            pageIndex: requested.pageIndex,
            chapterId: requested.chapterId,
            historyMode: 'none'
        });
    });
}
