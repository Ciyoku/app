export function splitBookPages(text) {
    if (!String(text).includes('PAGE_SEPARATOR')) {
        return [String(text ?? '')];
    }

    return String(text ?? '').split(/PAGE_SEPARATOR/g);
}
