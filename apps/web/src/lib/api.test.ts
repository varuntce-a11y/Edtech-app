import { describe, expect, it } from 'vitest';
import { formatRupees, languageNames, modeNames } from './api';

describe('catalog display helpers', () => {
  it('formats integer paise as Indian rupees', () => {
    expect(formatRupees(199_900)).toContain('1,999');
  });

  it('keeps course delivery and language labels explicit', () => {
    expect(modeNames.VIRTUAL).toBe('Live online');
    expect(languageNames.ta).toBe('தமிழ்');
  });
});
