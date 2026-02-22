import {
    buildNormalizedIndexMap,
    isArabicDiacritic,
    normalizeArabicForSearch
} from './shared/arabic-search.js';
import { splitBookPages } from './shared/book-pages.js';

const DEFAULT_PARSE_CHUNK_SIZE = 700;

export { normalizeArabicForSearch, splitBookPages };

function findDiacriticsInsensitiveRanges(text, normalizedQuery) {
    const query = normalizeArabicForSearch(normalizedQuery);
    if (!query) return { source: String(text ?? '').normalize('NFC'), ranges: [] };

    const mapped = buildNormalizedIndexMap(text);
    const ranges = [];
    let offset = 0;

    while (offset <= mapped.normalized.length - query.length) {
        const normalizedIndex = mapped.normalized.indexOf(query, offset);
        if (normalizedIndex === -1) break;

        const startOriginalIndex = mapped.indexMap[normalizedIndex];
        let endOriginalIndex = mapped.indexMap[normalizedIndex + query.length - 1] + 1;

        while (endOriginalIndex < mapped.source.length && isArabicDiacritic(mapped.source[endOriginalIndex])) {
            endOriginalIndex++;
        }

        ranges.push([startOriginalIndex, endOriginalIndex]);
        offset = normalizedIndex + 1;
    }

    return { source: mapped.source, ranges };
}

export function createHighlightedTextFragment(line, normalizedQuery) {
    const { source, ranges } = findDiacriticsInsensitiveRanges(line, normalizedQuery);
    const fragment = document.createDocumentFragment();

    if (!ranges.length) {
        fragment.appendChild(document.createTextNode(source));
        return fragment;
    }

    let cursor = 0;
    ranges.forEach(([start, end]) => {
        if (start < cursor) return;

        const before = source.slice(cursor, start);
        if (before) {
            fragment.appendChild(document.createTextNode(before));
        }

        const highlighted = document.createElement('span');
        highlighted.className = 'highlight';
        highlighted.textContent = source.slice(start, end);
        fragment.appendChild(highlighted);
        cursor = end;
    });

    const remaining = source.slice(cursor);
    if (remaining) {
        fragment.appendChild(document.createTextNode(remaining));
    }

    return fragment;
}

function normalizeChunkSize(value) {
    if (Number.isInteger(value) && value > 0) return value;
    return DEFAULT_PARSE_CHUNK_SIZE;
}

function createParserContext(text) {
    return {
        pages: splitBookPages(text),
        pageBlocks: [],
        chapters: [],
        searchIndex: [],
        chapterIndex: 0,
        processedLines: 0
    };
}

function parseLine(context, line, pageIndex, currentChapter) {
    const trimmed = line.trim();
    if (!trimmed) return currentChapter;

    if (trimmed.startsWith('##')) {
        const title = trimmed.replace('##', '').trim();
        const id = `chap-${context.chapterIndex}`;
        context.pageBlocks[pageIndex].push({
            type: 'heading',
            id,
            text: title
        });
        context.chapters.push({ title, id, pageIndex });
        context.chapterIndex += 1;
        return {
            title: title || currentChapter.title,
            id
        };
    }

    context.pageBlocks[pageIndex].push({
        type: 'paragraph',
        text: trimmed
    });

    context.searchIndex.push({
        line: trimmed,
        normalizedLine: normalizeArabicForSearch(trimmed),
        pageIndex,
        chapterTitle: currentChapter.title,
        chapterId: currentChapter.id
    });

    return currentChapter;
}

async function yieldToBrowser() {
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

export async function parseBookContentAsync(text, options = {}) {
    const chunkSize = normalizeChunkSize(options.chunkSize);
    const context = createParserContext(text);
    let currentChapter = {
        title: 'بداية الكتاب',
        id: ''
    };

    for (let pageIndex = 0; pageIndex < context.pages.length; pageIndex++) {
        const pageText = context.pages[pageIndex];
        const lines = String(pageText).split('\n');
        context.pageBlocks.push([]);

        for (const line of lines) {
            currentChapter = parseLine(context, line, pageIndex, currentChapter);
            context.processedLines += 1;

            if (context.processedLines % chunkSize === 0) {
                await yieldToBrowser();
            }
        }
    }

    return {
        pages: context.pages,
        pageBlocks: context.pageBlocks,
        chapters: context.chapters,
        searchIndex: context.searchIndex
    };
}
