// Bill period formatting helpers.
//
// Backend always uses a "YYYY-MM" string (binding:"required,len=7").
// The frontend only converts it to a localised string at display time.
// Localised templates live in locales/{lang}.json under the "period.format" key.
import i18n from './i18n';
import type { SupportedLanguage } from './i18n';

/** Get the current month period string (YYYY-MM). */
export function currentPeriod(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Render a "YYYY-MM" string in the given language. */
export function formatPeriod(period: string, lang: SupportedLanguage | string): string {
  if (!/^\d{4}-\d{2}$/.test(period)) return period;
  const [y, mm] = period.split('-');
  const monthNum = parseInt(mm, 10);
  // For English, pass the spelled-out month name; for other languages pass the number.
  const month = lang === 'en' ? (ENGLISH_MONTHS[monthNum - 1] ?? mm) : String(monthNum);
  return i18n.t('period.format', { lng: lang, year: y, month });
}
