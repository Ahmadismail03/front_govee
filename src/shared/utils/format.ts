export function formatFees(amount: number): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'JOD' }).format(amount);
  } catch {
    return `${amount.toFixed(2)} JOD`;
  }
}

export function formatTimeLabel(hm: string): string {
  const [h, m] = String(hm).split(':');
  if (!h || !m) return hm;
  const hour = String(Number(h));
  return m === '00' ? hour : `${hour}:${m}`;
}
