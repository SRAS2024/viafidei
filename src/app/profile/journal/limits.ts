/** The longest a journal entry's fields may be: one source for the API and the forms. */
export const JOURNAL_TITLE_MAX = 200;
export const JOURNAL_BODY_MAX = 20000;

/**
 * Room for any entry within those limits. JSON turns a control character into six bytes,
 * so this is more than the 64 KB the other routes allow: an entry that is within its
 * limits must never be turned away for its encoded size.
 */
export const JOURNAL_JSON_LIMIT_BYTES = 128 * 1024;

/**
 * A count as the page's language writes it. Left to the browser's language, a Spanish page
 * in an English browser says "20,000", and in Spanish a comma is a decimal mark. "en" is
 * for a language the browser has no numbers for, so that every browser and the server
 * agree.
 */
export function formatJournalCount(count: number, locale: string): string {
  return count.toLocaleString([locale, "en"]);
}

/**
 * Text as the journal keeps it. A form post sends CRLF, which would make an entry longer
 * at the server than the reader's count, and it stores marks the journal's formatting does
 * not read. And the database refuses a NUL character or half of an emoji outright: pasted
 * in with some text, where no reader can see the trouble, either would turn away every save
 * of that entry however often they tried again.
 */
export function storableJournalText(value: unknown): unknown {
  return typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").replaceAll("\0", "").toWellFormed()
    : value;
}
