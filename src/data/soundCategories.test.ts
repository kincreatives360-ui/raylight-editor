import { describe, expect, it } from 'vitest';
import { getSoundCategoryLabels, normalizeSoundCategory } from './soundCategories';

describe('sound category normalization', () => {
  it('unifies equivalent curated and procedural labels without losing other categories', () => {
    expect(getSoundCategoryLabels([
      'ambience', 'click', 'impact', 'ui', 'whoosh',
      'Transition', 'UI & Tactile', 'Impact & FX', 'Notification',
    ])).toEqual([
      'All', 'Ambience', 'Click', 'Impact & FX', 'UI & Tactile',
      'Transition', 'Notification',
    ]);
  });

  it('keeps unknown categories searchable and labels empty values explicitly', () => {
    expect(normalizeSoundCategory('  field recording ')).toBe('Field Recording');
    expect(normalizeSoundCategory(' ')).toBe('Uncategorized');
  });
});
