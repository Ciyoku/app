const ARABIC_DIACRITICS_GLOBAL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08FF]/g;
const ARABIC_DIACRITIC_SINGLE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08FF]/;

export function normalizeArabicForSearch(text) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(ARABIC_DIACRITICS_GLOBAL, '')
        .toLowerCase();
}

export function isArabicDiacritic(char) {
    return ARABIC_DIACRITIC_SINGLE.test(char);
}

export function buildNormalizedIndexMap(text) {
    const source = String(text ?? '').normalize('NFC');
    const normalizedChars = [];
    const indexMap = [];

    for (let index = 0; index < source.length; index++) {
        const char = source[index];
        if (isArabicDiacritic(char)) continue;
        normalizedChars.push(char.toLowerCase());
        indexMap.push(index);
    }

    return {
        source,
        normalized: normalizedChars.join(''),
        indexMap
    };
}
