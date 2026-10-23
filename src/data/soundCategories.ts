const CATEGORY_LABELS: Record<string, string> = {
  impact: 'Impact & FX',
  'impact & fx': 'Impact & FX',
  ui: 'UI & Tactile',
  'ui & tactile': 'UI & Tactile',
  transition: 'Transition',
  whoosh: 'Transition',
};

export function normalizeSoundCategory(category: string): string {
  const normalized = category.trim().toLowerCase();
  if (!normalized) return 'Uncategorized';
  return CATEGORY_LABELS[normalized] ??
    normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getSoundCategoryLabels(categories: readonly string[]): string[] {
  return ['All', ...new Set(
    categories.map(normalizeSoundCategory).filter((label) => label !== 'All')
  )];
}
