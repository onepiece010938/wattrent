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

/** Bill fields a share-message template can reference. */
export interface BillTemplateData {
  period: string;
  meterReading: number;
  electricityUsage: number;
  electricityRate: number;
  electricityCost: number;
  rent: number;
  totalAmount: number;
}

/**
 * Substitute {placeholder} tokens in a user-defined share template with the
 * bill's values. Unknown tokens are left untouched. Supported placeholders:
 * {period} {meterReading} {usage} {rate} {electricityCost} {rent} {totalAmount}.
 */
export function applyBillTemplate(
  template: string,
  bill: BillTemplateData,
  language?: string,
): string {
  const map: Record<string, string> = {
    period: bill.period,
    meterReading: formatAmount(bill.meterReading),
    usage: formatAmount(bill.electricityUsage),
    rate: formatMoney(bill.electricityRate, language),
    electricityCost: formatMoney(bill.electricityCost, language),
    rent: formatMoney(bill.rent, language),
    totalAmount: formatMoney(bill.totalAmount, language),
  };
  return template.replace(/\{(\w+)\}/g, (m, key) => (key in map ? map[key] : m));
}
