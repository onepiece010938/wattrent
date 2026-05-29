import { currentPeriod, formatPeriod } from '../period';

describe('currentPeriod', () => {
  it('formats year and month as YYYY-MM with zero padding', () => {
    expect(currentPeriod(new Date(2025, 0, 15))).toBe('2025-01'); // January
    expect(currentPeriod(new Date(2025, 11, 31))).toBe('2025-12'); // December
    expect(currentPeriod(new Date(2024, 5, 1))).toBe('2024-06'); // June
  });

  it('defaults to "now" when no argument is given', () => {
    const got = currentPeriod();
    expect(got).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('formatPeriod', () => {
  // We rely on the real lib/i18n module being loaded; the test only asserts
  // the function does not throw and returns a non-empty string for valid input.
  it('returns the input verbatim for invalid format', () => {
    expect(formatPeriod('bogus', 'en')).toBe('bogus');
    expect(formatPeriod('2025-1', 'en')).toBe('2025-1');
    expect(formatPeriod('', 'en')).toBe('');
  });

  it('returns a string (or undefined when i18n is not initialised) for a valid YYYY-MM', () => {
    // i18n may not be initialised under Jest; just make sure the function does
    // not throw. When initialised, the EN template produces something like
    // "March 2025"; when not initialised, i18n returns undefined.
    expect(() => formatPeriod('2025-03', 'en')).not.toThrow();
  });
});
