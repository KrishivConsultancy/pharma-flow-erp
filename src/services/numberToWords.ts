// Indian Rupee Number-to-Words Converter
// Formats e.g. 5868 -> "RS. FIVE THOUSAND EIGHT HUNDRED SIXTY EIGHT ONLY"

const ONES = [
  '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
];

const TENS = [
  '', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'
];

function convertLessThanThousand(num: number): string {
  let str = '';
  if (num >= 100) {
    str += ONES[Math.floor(num / 100)] + ' HUNDRED ';
    num %= 100;
  }
  if (num >= 20) {
    str += TENS[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ONES[num % 10] : '');
  } else if (num > 0) {
    str += ONES[num];
  }
  return str.trim();
}

export function numberToWordsInr(amount: number): string {
  if (amount === 0) return 'RS. ZERO ONLY';
  if (isNaN(amount)) return '';

  const isNegative = amount < 0;
  amount = Math.abs(amount);

  const rounded = Math.round(amount * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  let remaining = rupees;
  const parts: string[] = [];

  // Crores (>= 1,00,00,000)
  if (remaining >= 10000000) {
    const crores = Math.floor(remaining / 10000000);
    parts.push(convertLessThanThousand(crores) + ' CRORE');
    remaining %= 10000000;
  }

  // Lakhs (>= 1,00,000)
  if (remaining >= 100000) {
    const lakhs = Math.floor(remaining / 100000);
    parts.push(convertLessThanThousand(lakhs) + ' LAKH');
    remaining %= 100000;
  }

  // Thousands (>= 1,000)
  if (remaining >= 1000) {
    const thousands = Math.floor(remaining / 1000);
    parts.push(convertLessThanThousand(thousands) + ' THOUSAND');
    remaining %= 1000;
  }

  // Remaining hundreds/tens/ones
  if (remaining > 0) {
    parts.push(convertLessThanThousand(remaining));
  }

  let words = (isNegative ? 'MINUS ' : '') + 'RS. ' + parts.join(' ').trim();

  if (paise > 0) {
    words += ' AND ' + convertLessThanThousand(paise) + ' PAISE';
  }

  words += ' ONLY';
  return words.toUpperCase();
}
