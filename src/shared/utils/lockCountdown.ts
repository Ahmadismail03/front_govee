import { useEffect, useState } from 'react';

/**
 * Formats a remaining lock time in Arabic.
 * - < 60 s  → seconds
 * - >= 60 s → minutes (ceiling)
 * - <= 0    → empty string (caller should treat as "expired")
 *
 * Reusable for any rate-limit / cooldown error in the app.
 */
export function formatLockTimeArabic(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return '';
  if (remainingSeconds < 60) {
    return `تم تجاوز عدد المحاولات المسموح بها. حاول مرة أخرى بعد ${remainingSeconds} ثانية.`;
  }
  const minutes = Math.ceil(remainingSeconds / 60);
  return `تم تجاوز عدد المحاولات المسموح بها. حاول مرة أخرى بعد ${minutes} دقيقة.`;
}

/**
 * Countdown hook driven by a server-issued `lockedUntil` ISO timestamp.
 *
 * - Ticks every second.
 * - Returns `isLocked: false` and `message: null` once the time has passed,
 *   allowing the caller to automatically re-enable the retry UI.
 * - Safe against negative values and clock skew.
 *
 * @param lockedUntil - ISO 8601 string from the backend's `details.lockedUntil`,
 *                      or `null` when there is no active lock.
 */
export function useLockCountdown(lockedUntil: string | null): {
  message: string | null;
  isLocked: boolean;
} {
  const computeRemaining = (): number => {
    if (!lockedUntil) return 0;
    return Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
  };

  const [remainingSeconds, setRemainingSeconds] = useState<number>(computeRemaining);

  useEffect(() => {
    if (!lockedUntil) {
      setRemainingSeconds(0);
      return;
    }

    // Sync immediately when lockedUntil changes.
    const initial = computeRemaining();
    setRemainingSeconds(initial);
    if (initial <= 0) return;

    const interval = setInterval(() => {
      const secs = computeRemaining();
      setRemainingSeconds(secs);
      if (secs <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedUntil]);

  // On the first render after lockedUntil is set, remainingSeconds state may
  // still be 0 (the effect hasn't fired yet). Fall back to a live calculation
  // so isLocked is correct immediately, preventing the auto-clear effect in the
  // screen from mistakenly wiping the lock on that first render.
  const effective = remainingSeconds > 0 ? remainingSeconds : computeRemaining();

  if (!lockedUntil || effective <= 0) {
    return { message: null, isLocked: false };
  }

  return {
    message: formatLockTimeArabic(effective),
    isLocked: true,
  };
}
