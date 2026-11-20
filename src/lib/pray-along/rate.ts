/**
 * The speeds the pray-along player steps through with its speed button (beside Stop):
 * 1x, 1.25x, 1.5x, then 1x again. Browser-safe: the player, the profile API and the
 * playlist route share it.
 */

export const RATES = [1, 1.25, 1.5] as const;

export type Rate = (typeof RATES)[number];

/** The normal speed: what a reader hears until they choose another. */
export const DEFAULT_RATE: Rate = 1;

export function isRate(value: unknown): value is Rate {
  return typeof value === "number" && (RATES as readonly number[]).includes(value);
}

export function rateOrDefault(value: unknown): Rate {
  return isRate(value) ? value : DEFAULT_RATE;
}

/** The speed after `rate`: 1x → 1.25x → 1.5x → 1x. */
export function nextRate(rate: Rate): Rate {
  return RATES[(RATES.indexOf(rate) + 1) % RATES.length]!;
}

/** "1x", "1.25x", "1.5x", written with the reader's decimal mark ("1,25x" in French). */
export function formatRate(rate: number, locale: string): string {
  let n = String(rate);
  try {
    // Latin has no number format of its own; it writes the decimal point.
    n = new Intl.NumberFormat(locale === "la" ? "en" : locale, {
      maximumFractionDigits: 2,
    }).format(rate);
  } catch {
    // An unknown locale keeps the plain number.
  }
  return `${n}x`;
}
