/**
 * Placeholders for the spans a model must not translate.
 *
 * Before a sentence goes to a model, every protected span (a Latin or Greek
 * title, a saint's name — rules.ts) is replaced by a short placeholder such
 * as "X1". OPUS-MT models copy such tokens through unchanged ("X1 entered the
 * Carmel at fifteen." → "X1 entró en el Carmelo a los quince años."), so the
 * span comes back exactly as published instead of as the model's rendering
 * of it ("Teresa de Lisieux", "Salve Reina"). A translation in which any
 * placeholder is missing, repeated or altered is rejected (`unmaskSpans`
 * returns null) and the caller retries or keeps the English.
 */

export interface MaskedText {
  /** The text sent to the model. */
  text: string;
  /** slots[i] is the span placeholder i stands for. */
  slots: string[];
  /** The placeholder letter ("X", or another when the text already uses X1…). */
  prefix: string;
}

const PREFIXES = ["X", "Z", "Q", "K", "W"];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function placeholderRe(prefix: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${prefix}(\\d+)(?![\\p{L}\\p{N}])`, "gu");
}

/**
 * Replace every occurrence of each span (longest spans first, so "Ave Maria
 * Stella" wins over "Ave Maria") with a numbered placeholder. A span that
 * occurs twice gets the same placeholder both times.
 */
export function maskSpans(source: string, spans: readonly string[]): MaskedText {
  const text = String(source ?? "");
  const prefix =
    PREFIXES.find((p) => !placeholderRe(p).test(text)) ?? PREFIXES[PREFIXES.length - 1]!;
  const unique = [...new Set(spans.map((s) => s.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  const slots: string[] = [];
  let out = text;
  for (const span of unique) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(span)}(?![\\p{L}\\p{N}])`, "gu");
    if (!re.test(out)) continue;
    const token = `${prefix}${slots.length + 1}`;
    slots.push(span);
    out = out.replace(re, token);
  }
  return { text: out, slots, prefix };
}

/**
 * Put the spans back into a model's output. Null when a placeholder is
 * missing, occurs more often than it did in the source, or an unknown
 * placeholder appears — the translation then cannot be trusted.
 */
export function unmaskSpans(output: string, masked: MaskedText): string | null {
  const out = String(output ?? "");
  if (masked.slots.length === 0) return out;
  const expected = new Map<number, number>();
  for (const m of masked.text.matchAll(placeholderRe(masked.prefix))) {
    const n = Number(m[1]);
    expected.set(n, (expected.get(n) ?? 0) + 1);
  }
  const seen = new Map<number, number>();
  for (const m of out.matchAll(placeholderRe(masked.prefix))) {
    const n = Number(m[1]);
    if (!expected.has(n)) return null;
    seen.set(n, (seen.get(n) ?? 0) + 1);
  }
  for (const [n, count] of expected) {
    const got = seen.get(n) ?? 0;
    if (got === 0 || got > count) return null;
  }
  return out.replace(placeholderRe(masked.prefix), (_, n: string) => masked.slots[Number(n) - 1]!);
}
