// Share-message template with {{token}} placeholders.
//
// The user edits a plain-text template; tokens like {{房租}} / {{rent}} expand to
// the bill's values when shared. Each token has both a Chinese and an English
// form, so a template written in one language still renders in the other.
//
// Values are plain numbers (no currency symbol, no thousands separator) so they
// read naturally inside the user's own sentence, e.g. "737 +房租16000=16737".

export interface BillMessageData {
  landlordName?: string;
  period: string;
  meterReading: number;
  previousReading: number;
  electricityUsage: number;
  electricityRate: number;
  electricityCost: number;
  rent: number;
  totalAmount: number;
}

function num(n: number): string {
  return String(Math.round((n + Number.EPSILON) * 100) / 100);
}

interface TokenDef {
  key: string;
  zh: string;
  en: string;
  value: (b: BillMessageData) => string;
}

// Longest tokens are matched first at render time (see renderBillMessage).
const TOKENS: TokenDef[] = [
  { key: 'landlord', zh: '{{房東}}', en: '{{landlord}}', value: (b) => b.landlordName ?? '' },
  { key: 'current', zh: '{{這次電表}}', en: '{{current}}', value: (b) => num(b.meterReading) },
  { key: 'previous', zh: '{{上次電表}}', en: '{{previous}}', value: (b) => num(b.previousReading) },
  { key: 'usage', zh: '{{用電度數}}', en: '{{usage}}', value: (b) => num(b.electricityUsage) },
  { key: 'rate', zh: '{{電費單價}}', en: '{{rate}}', value: (b) => num(b.electricityRate) },
  { key: 'bill', zh: '{{電費}}', en: '{{bill}}', value: (b) => num(b.electricityCost) },
  { key: 'rent', zh: '{{房租}}', en: '{{rent}}', value: (b) => num(b.rent) },
  { key: 'total', zh: '{{合計}}', en: '{{total}}', value: (b) => num(b.totalAmount) },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace every #hashtag token (Chinese or English form) in the template with
 * the bill's value. Unknown tokens are left untouched.
 */
export function renderBillMessage(template: string, bill: BillMessageData): string {
  const src = migrateTemplate(template);
  const map: Record<string, string> = {};
  for (const t of TOKENS) {
    const v = t.value(bill);
    map[t.zh] = v;
    map[t.en] = v;
  }
  // Longest-first so e.g. "{{電費單價}}" matches before "{{電費}}".
  const hashes = Object.keys(map).sort((a, b) => b.length - a.length);
  const re = new RegExp(hashes.map(escapeRegExp).join('|'), 'g');
  return src.replace(re, (m) => map[m] ?? m);
}

/** The pre-filled, editable default template for the given UI language. */
export function getDefaultTemplate(language?: string): string {
  if (language && language.startsWith('zh')) {
    return [
      '嗨 {{房東}}',
      '這個月的房租連電費 我一起轉過去嘍',
      '這次電表{{這次電表}} -上次電表{{上次電表}}',
      '={{用電度數}} {{用電度數}}×{{電費單價}}={{電費}}',
      '{{電費}} +房租{{房租}}={{合計}}',
      '再麻煩確認一下嘍',
    ].join('\n');
  }
  return [
    'Hi {{landlord}}',
    "Here's this month's rent + electricity together.",
    'This reading {{current}} − last reading {{previous}}',
    '= {{usage}}, {{usage}} × {{rate}} = {{bill}}',
    '{{bill}} + rent {{rent}} = {{total}}',
    'Please help confirm, thanks!',
  ].join('\n');
}

/**
 * Tokens to render as insert buttons under the template editor, in the UI
 * language's form.
 */
export function getInsertTokens(language?: string): { key: string; token: string }[] {
  const zh = !!(language && language.startsWith('zh'));
  return TOKENS.map((t) => ({ key: t.key, token: zh ? t.zh : t.en }));
}

/** Every token string (both languages), for highlighting the template editor. */
export function getAllTokenStrings(): string[] {
  const out: string[] = [];
  for (const t of TOKENS) out.push(t.zh, t.en);
  return out;
}

/**
 * Upgrade legacy "#房租" placeholders (the pre-{{}} format) to the current
 * {{房租}} form. No-op for templates that already use {{}} or have no tokens.
 */
export function migrateTemplate(template: string): string {
  if (!template.includes('#')) return template;
  const pairs = TOKENS.flatMap((t) => [
    { old: '#' + t.zh.slice(2, -2), neu: t.zh },
    { old: '#' + t.en.slice(2, -2), neu: t.en },
  ]).sort((a, b) => b.old.length - a.old.length); // longest first (#電費單價 before #電費)
  let out = template;
  for (const p of pairs) out = out.split(p.old).join(p.neu);
  return out;
}
