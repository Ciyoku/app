import { collectCategoryStats, UNCATEGORIZED_FILTER } from './books-filtering.js';

export { UNCATEGORIZED_FILTER };

export function populateCategoryFilter(selectElement, sourceBooks, options = {}) {
    const {
        currentValue = 'all',
        allLabel = 'كل التصنيفات',
        uncategorizedLabel = 'بدون تصنيف',
        uncategorizedValue = UNCATEGORIZED_FILTER,
        locale = 'ar'
    } = options;

    if (!selectElement || typeof selectElement.replaceChildren !== 'function') {
        return currentValue;
    }

    const { sortedCategories, hasUncategorizedBooks } = collectCategoryStats(sourceBooks, locale);
    const fragment = document.createDocumentFragment();

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = allLabel;
    fragment.appendChild(allOption);

    sortedCategories.forEach((category) => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        fragment.appendChild(option);
    });

    if (hasUncategorizedBooks) {
        const uncategorizedOption = document.createElement('option');
        uncategorizedOption.value = uncategorizedValue;
        uncategorizedOption.textContent = uncategorizedLabel;
        fragment.appendChild(uncategorizedOption);
    }

    selectElement.replaceChildren(fragment);

    const allowedValues = new Set([
        'all',
        ...sortedCategories,
        ...(hasUncategorizedBooks ? [uncategorizedValue] : [])
    ]);

    const nextValue = allowedValues.has(currentValue) ? currentValue : 'all';
    selectElement.value = nextValue;
    return nextValue;
}
