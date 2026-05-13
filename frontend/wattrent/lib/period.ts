// 帳單期間（period）格式工具。
//
// Backend 永遠用 "YYYY-MM" 字串（binding:"required,len=7"）。
// 前端只在「顯示」時翻譯成本地化字串。
import type { SupportedLanguage } from './i18n';

/** 取得當月的 period 字串（YYYY-MM） */
export function currentPeriod(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** 把 "YYYY-MM" 顯示成「2026年5月」/「May 2026」 */
export function formatPeriod(period: string, lang: SupportedLanguage | string): string {
  if (!/^\d{4}-\d{2}$/.test(period)) return period;
  const [y, m] = period.split('-');
  const month = parseInt(m, 10);
  if (lang === 'zh-TW') return `${y}年${month}月`;
  // English
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${monthNames[month - 1] ?? m} ${y}`;
}
