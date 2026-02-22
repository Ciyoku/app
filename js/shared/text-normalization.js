export function normalizeCatalogText(value) {
    return String(value ?? '').normalize('NFC').toLowerCase().trim();
}
