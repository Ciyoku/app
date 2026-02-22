export function persistReadingProgress(state, saveBookProgress) {
    if (!state.currentBookId) return;

    saveBookProgress(state.currentBookId, {
        partIndex: state.currentPartIndex,
        pageIndex: state.currentPageIndex,
        chapterId: state.currentChapterId
    });
}
