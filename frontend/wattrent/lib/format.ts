// Money / number formatting shared across bill displays.
//
// Hermes (React Native) ships limited Intl support, so we group thousands
// manually instead of relying on Number.prototype.toLocaleString.

/** Round to at most 2 decimals and group thousands: 1234567.5 -> "1,234,567.5". */
export function formatAmount(n: number): string {
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  const [intPart, decPart] = Math.abs(rounded).toString().split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = rounded < 0 ? '-' : '';
  return decPart ? `${sign}${grouped}.${decPart}` : `${sign}${grouped}`;
}

/**
 * Format a money amount with the currency symbol placed correctly for the UI
 * language: Chinese uses a "元" suffix ("1,234 元"); everything else uses a
 * "$" prefix ("$1,234"). This avoids the reversed-looking "元1234".
 */
export function formatMoney(amount: number, language?: string): string {
  const num = formatAmount(amount);
  if (language && language.startsWith('zh')) return `${num} 元`;
  return `$${num}`;
}
