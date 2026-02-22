export function createReaderState() {
    return {
        pageBlocks: [],
        chapters: [],
        searchIndex: [],
        searchEngine: null,
        currentPageIndex: 0,
        bookParts: [],
        currentPartIndex: 0,
        currentBookId: '',
        currentChapterId: '',
        currentBookPartCount: 1
    };
}
