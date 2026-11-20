/**
 * The passages a text quotes, in order: the words a guide or a novena day tells the
 * reader to say ("…ask for light: 'Come, Holy Spirit, …'", "pray: \"Eternal Father,
 * …\""). Double quotes, typographic quotes, guillemets and CJK brackets, and single
 * quotes — told apart from apostrophes ("person's", "the Apostles' Creed").
 *
 * Pure: no I/O, no React, no regex lookbehind (old Safari cannot parse one).
 */

/** Every quoted passage counts, short ones ("Amen") too: a plan names a passage by its place. */
const MIN_LENGTH = 1;

const PAIRS: ReadonlyArray<[string, string]> = [
  ['"', '"'],
  ["“", "”"],
  ["„", "“"],
  ["„", "”"],
  ["«", "»"],
  ["「", "」"],
  ["『", "』"],
];

const LETTER = /[\p{L}\p{N}]/u;
const SPACE_OR_OPEN = /[\s:(\[—–-]/;
const CLOSE_FOLLOW = /[\s.,;:!?)\]—–-]/;

/** Is the single quote at `i` an opening quote: at the start, or after a space or colon, before a word? */
function opensSingle(text: string, i: number): boolean {
  const before = i === 0 ? " " : text[i - 1]!;
  const after = text[i + 1] ?? "";
  // A passage may open on an ellipsis that abbreviates a repeated beginning.
  const opensOnEllipsis = text.startsWith("...", i + 1) || after === "\u2026";
  return SPACE_OR_OPEN.test(before) && (LETTER.test(after) || opensOnEllipsis);
}

/**
 * Is the single quote at `i` a closing quote: after a letter or a stop, before a space,
 * a stop or the end? A plural possessive before a capitalised noun ("the Apostles'
 * Creed") is an apostrophe, not the end of the passage.
 */
function closesSingle(text: string, i: number): boolean {
  const before = text[i - 1] ?? "";
  const after = text[i + 1] ?? "";
  if (!(LETTER.test(before) || /[.,!?;:]/.test(before))) return false;
  if (after && !CLOSE_FOLLOW.test(after)) return false;
  if (before === "s" && after === " " && /^ \p{Lu}/u.test(text.slice(i + 1, i + 3))) return false;
  return true;
}

export function quotedPassages(text: string): string[] {
  const found: Array<{ at: number; text: string }> = [];
  // Double quotes and their kin.
  for (const [open, close] of PAIRS) {
    let from = 0;
    for (;;) {
      const start = text.indexOf(open, from);
      if (start < 0) break;
      const end = text.indexOf(close, start + 1);
      if (end < 0) break;
      const inner = text.slice(start + 1, end).trim();
      if (inner.length >= MIN_LENGTH && !found.some((f) => f.at === start)) {
        found.push({ at: start, text: inner });
      }
      from = end + 1;
    }
  }
  // Single quotes (straight or typographic), outside any double-quoted passage.
  const inside = (i: number) => found.some((f) => i > f.at && i <= f.at + f.text.length + 2);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if ((ch !== "'" && ch !== "‘") || inside(i) || !opensSingle(text, i)) continue;
    for (let j = i + 2; j < text.length; j++) {
      const cj = text[j]!;
      if ((cj === "'" || cj === "’") && closesSingle(text, j)) {
        const inner = text.slice(i + 1, j).trim();
        if (inner.length >= MIN_LENGTH) found.push({ at: i, text: inner });
        i = j;
        break;
      }
    }
  }
  const passages = found.sort((a, b) => a.at - b.at).map((f) => f.text);
  return passages.map((p, i) => completeContinuation(p, passages.slice(0, i)));
}

const ELLIPSIS = /^(?:\.{3}|\u2026)\s*/;

/**
 * A passage the text abbreviates with an ellipsis ("...and the celestial choir of
 * Cherubim, may the Lord…") is said whole: its opening is taken from the earlier
 * passage it continues ("By the intercession of Saint Michael and the celestial choir
 * of Seraphim…" gives "By the intercession of Saint Michael "). Left as it is, without
 * the ellipsis, when no earlier passage shares its first words.
 */
function completeContinuation(passage: string, earlier: readonly string[]): string {
  if (!ELLIPSIS.test(passage)) return passage;
  const rest = passage.replace(ELLIPSIS, "");
  const lead = rest.split(/\s+/).slice(0, 4).join(" ").toLowerCase();
  for (let i = earlier.length - 1; i >= 0; i--) {
    const before = earlier[i]!.replace(ELLIPSIS, "");
    const at = before.toLowerCase().indexOf(lead);
    if (lead.length >= 8 && at > 0) return `${before.slice(0, at)}${rest}`;
  }
  return rest;
}
