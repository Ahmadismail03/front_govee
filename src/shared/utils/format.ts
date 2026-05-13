export function formatMoney(amount: number): string {
  try {
    const formatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }).format(amount);

    return `${formatted} ₪`;
  } catch {
    return `${amount} ₪`;
  }
}

export function formatFees(amount: number): string {
  return formatMoney(amount);
}

export function formatTimeLabel(hm: string): string {
  const parts = String(hm).split(':');
  const h = parts[0];
  const m = parts[1];
  if (!h || !m) return hm;
  const h24 = Number(h);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return m === '00' ? `${h12} ${period}` : `${h12}:${m} ${period}`;
}
