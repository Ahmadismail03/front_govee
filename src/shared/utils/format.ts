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
  const [h, m] = String(hm).split(':');
  if (!h || !m) return hm;
  const hour = String(Number(h));
  return m === '00' ? hour : `${hour}:${m}`;
}
