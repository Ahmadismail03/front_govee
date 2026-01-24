export function formatMoney(amount: number, currency: string = 'JOD'): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

const ILS_PER_JOD = 4.43;

export function convertToJod(amount: number, fromCurrency?: string | null): number {
  const cur = String(fromCurrency ?? 'JOD').toUpperCase();
  if (!Number.isFinite(amount)) return 0;

  if (cur === 'JOD') return amount;
  if (cur === 'ILS') return amount / ILS_PER_JOD;

  // Unknown currency: treat as already in JOD (best-effort)
  return amount;
}

export function formatMoneyJod(amount: number, fromCurrency?: string | null): string {
  return formatMoney(convertToJod(amount, fromCurrency), 'JOD');
}

export function formatFees(amount: number): string {
  return formatMoney(amount, 'JOD');
}

export function formatTimeLabel(hm: string): string {
  const [h, m] = String(hm).split(':');
  if (!h || !m) return hm;
  const hour = String(Number(h));
  return m === '00' ? hour : `${hour}:${m}`;
}
