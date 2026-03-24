/**
 * Builds a 2-letter placeholder from a display name (e.g. "Ahmad Hassan" → "AH").
 * Arabic / single-word names: first two graphemes when only one token.
 */
export function getDisplayInitials(name: string, fallback = '?'): string {
  const s = name.trim();
  if (!s) return fallback;

  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;

  const firstChar = (segment: string): string => {
    const g = Array.from(segment.normalize('NFC'));
    return g[0] ?? '';
  };

  if (parts.length === 1) {
    const g = Array.from(parts[0].normalize('NFC'));
    if (g.length === 0) return fallback;
    if (g.length === 1) return (g[0] + g[0]).toLocaleUpperCase();
    return (g[0] + g[1]).toLocaleUpperCase();
  }

  const a = firstChar(parts[0]);
  const b = firstChar(parts[parts.length - 1]);
  const out = (a + b).trim();
  return out ? out.toLocaleUpperCase() : fallback;
}
