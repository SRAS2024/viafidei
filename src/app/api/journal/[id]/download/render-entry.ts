/**
 * A journal entry's plain text as HTML, for the print page.
 *
 * The journal stores what the reader typed, with the few marks the form's toolbar and
 * placeholder offer: **bold**, _italic_, ## heading, > quote, - or 1. list items. The
 * toolbar puts a mark on its own line with a single newline before it, so a mark can
 * start any line, not only one after a blank line; and entries saved before line endings
 * were normalized still hold CRLF. Every piece of text is escaped before any mark becomes
 * a tag, so nothing a reader typed can reach the page as markup, and nothing they typed is
 * replaced: a number at the start of a line is theirs.
 */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Bold and italic within one line of text. An underscore counts only at a word's edge,
 * so "snake_case_name" stays as typed; a pair with nothing between them, which the
 * toolbar leaves when pressed with no selection, stays as typed too.
 */
function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\p{L}\p{N}_])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}_])/gu, "$1<em>$2</em>");
}

const HEADING = /^##\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
/**
 * A number a list item can carry and show as typed. "007." cannot, nor can a number too
 * long to be a list's: those stay as the text they are.
 */
const NUMBERED = /^(0|[1-9]\d{0,8})\.\s+(.*)$/;

/**
 * A numbered line is a list item beside another one, or as the toolbar's "1.". Alone, with
 * any other number, it is a sentence that starts with one, such as "1917. The year of
 * Fatima", and it stays a sentence, its number in it.
 */
function startsListItem(lines: string[], at: number): boolean {
  const line = NUMBERED.exec(lines[at]!);
  if (!line) return false;
  return (
    line[1] === "1" || NUMBERED.test(lines[at - 1] ?? "") || NUMBERED.test(lines[at + 1] ?? "")
  );
}

/**
 * The reader's own numbers, in `value`, so "23." and "51." print as 23 and 51. The toolbar
 * can only ever write "1.", so a run of nothing but 1s is its list, and counts up. The
 * room for the numbers follows the longest, or a long one would hang off the page's edge.
 */
function renderNumberedList(numbers: string[], items: string[]): string {
  const counted = numbers.length > 1 && numbers.every((number) => number === "1");
  const widest = counted
    ? String(numbers.length).length
    : Math.max(...numbers.map((number) => number.length));
  const rows = items.map((item, index) =>
    counted
      ? `<li>${renderInline(item)}</li>`
      : `<li value="${numbers[index]}">${renderInline(item)}</li>`,
  );
  return `<ol style="padding-left:${widest + 2}ch">${rows.join("")}</ol>`;
}

type Block = { kind: "p" | "blockquote" | "ul" | "ol"; lines: string[]; numbers: string[] };

export function renderJournalBody(body: string): string {
  const out: string[] = [];
  let open: Block | null = null;

  const close = () => {
    if (!open) return;
    const { kind, lines, numbers } = open;
    if (kind === "ol") {
      out.push(renderNumberedList(numbers, lines));
    } else if (kind === "ul") {
      out.push(`<ul>${lines.map((line) => `<li>${renderInline(line)}</li>`).join("")}</ul>`);
    } else {
      out.push(`<${kind}>${lines.map(renderInline).join("<br/>")}</${kind}>`);
    }
    open = null;
  };

  const add = (kind: Block["kind"], line: string, number?: string) => {
    if (open?.kind !== kind) {
      close();
      open = { kind, lines: [], numbers: [] };
    }
    open!.lines.push(line);
    if (number) open!.numbers.push(number);
  };

  const lines = body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  for (const [at, line] of lines.entries()) {
    if (!line) {
      close();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      close();
      out.push(`<h2>${renderInline(heading[1]!)}</h2>`);
      continue;
    }
    const quote = QUOTE.exec(line);
    if (quote) {
      add("blockquote", quote[1]!);
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      add("ul", bullet[1]!);
      continue;
    }
    if (startsListItem(lines, at)) {
      const [, number, item] = NUMBERED.exec(line)!;
      add("ol", item!, number);
      continue;
    }
    add("p", line);
  }
  close();
  return out.join("\n");
}
