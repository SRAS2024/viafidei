/**
 * A card's description that ends on a whole word.
 *
 * The import keeps the opening of a long text as a record's summary, and where no sentence
 * ended in reach it cut at the character limit, in the middle of a word: the First
 * Saturdays card read "…on 13 May 1917, a", and a screen reader read the stray "a" aloud.
 * A summary that is the opening of a longer field of the same record is such a cut. It is
 * ended on its last whole word and marked "…", since the text goes on; a cut that already
 * ends a sentence is left as it is. Any other summary is the record's own and is shown as
 * written.
 *
 * Pure: no I/O, no React.
 */

/** The fields a summary may have been cut from. */
const SOURCE_FIELDS = [
  "background",
  "practiceInstructions",
  "biography",
  "origin",
  "description",
  "history",
] as const;

const fold = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Ends a sentence: a full stop, question or exclamation mark (Western or full-width),
 * maybe inside a quotation or bracket.
 */
const SENTENCE_END = /[.!?。！？]["”’)\]」』）]?$/;

/** Scripts written without spaces: any character after the cut starts a new word. */
const NO_SPACES = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/**
 * `summary` ended on a whole word with "…" when it is a cut opening of one of the record's
 * longer fields; otherwise `summary` unchanged.
 */
export function wholeWordExcerpt<T>(
  summary: T,
  payload: Record<string, unknown> | null | undefined,
): T {
  // A summary that is not text (a stray number or list) is shown as it was, never thrown on.
  if (typeof summary !== "string") return summary;
  const text = fold(summary);
  if (!text || !payload || text.endsWith("…")) return summary;
  const source = SOURCE_FIELDS.map((key) => payload[key])
    .filter((value): value is string => typeof value === "string")
    .map(fold)
    .find((value) => value.length > text.length && value.startsWith(text));
  if (!source) return summary;
  // A letter or digit right after the cut means the last word was cut short, except in
  // scripts written without spaces, where every character is a word's edge.
  const next = source.charAt(text.length);
  const midWord = /[\p{L}\p{N}]/u.test(next) && !NO_SPACES.test(next);
  const kept = midWord ? text.replace(/[\p{L}\p{N}'’-]+$/u, "") : text;
  if (!midWord && SENTENCE_END.test(kept)) return kept as T;
  const ended = kept.replace(/[\s,;:–—\-，、；：]+$/u, "");
  return (ended ? `${ended}…` : summary) as T;
}
