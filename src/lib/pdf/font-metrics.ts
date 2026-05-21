/**
 * Glyph-width tables for the three standard PDF Type-1 fonts the
 * Developer Audit report uses: Helvetica, Helvetica-Bold, and Courier.
 *
 * The standard 14 PDF fonts need no font embedding — every conformant
 * PDF reader ships them — but the report layout engine still needs
 * their metrics to wrap paragraphs, lay out table columns, right-align
 * numbers, and draw table-of-contents dot leaders. Widths are the
 * canonical Adobe AFM values in 1/1000 em units, indexed by character.
 *
 * Characters outside these tables fall back to the average width so an
 * unexpected glyph never throws — it just measures slightly off.
 */

export type PdfFont = "Helvetica" | "Helvetica-Bold" | "Courier";

// Helvetica AFM advance widths, 1/1000 em, ASCII printable range.
const HELVETICA: Record<string, number> = {
  " ": 278,
  "!": 278,
  '"': 355,
  "#": 556,
  $: 556,
  "%": 889,
  "&": 667,
  "'": 191,
  "(": 333,
  ")": 333,
  "*": 389,
  "+": 584,
  ",": 278,
  "-": 333,
  ".": 278,
  "/": 278,
  "0": 556,
  "1": 556,
  "2": 556,
  "3": 556,
  "4": 556,
  "5": 556,
  "6": 556,
  "7": 556,
  "8": 556,
  "9": 556,
  ":": 278,
  ";": 278,
  "<": 584,
  "=": 584,
  ">": 584,
  "?": 556,
  "@": 1015,
  A: 667,
  B: 667,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 500,
  K: 667,
  L: 556,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,
  "[": 278,
  "\\": 278,
  "]": 278,
  "^": 469,
  _: 556,
  "`": 333,
  a: 556,
  b: 556,
  c: 500,
  d: 556,
  e: 556,
  f: 278,
  g: 556,
  h: 556,
  i: 222,
  j: 222,
  k: 500,
  l: 222,
  m: 833,
  n: 556,
  o: 556,
  p: 556,
  q: 556,
  r: 333,
  s: 500,
  t: 278,
  u: 556,
  v: 500,
  w: 722,
  x: 500,
  y: 500,
  z: 500,
  "{": 334,
  "|": 260,
  "}": 334,
  "~": 584,
};

// Helvetica-Bold AFM advance widths, 1/1000 em.
const HELVETICA_BOLD: Record<string, number> = {
  " ": 278,
  "!": 333,
  '"': 474,
  "#": 556,
  $: 556,
  "%": 889,
  "&": 722,
  "'": 238,
  "(": 333,
  ")": 333,
  "*": 389,
  "+": 584,
  ",": 278,
  "-": 333,
  ".": 278,
  "/": 278,
  "0": 556,
  "1": 556,
  "2": 556,
  "3": 556,
  "4": 556,
  "5": 556,
  "6": 556,
  "7": 556,
  "8": 556,
  "9": 556,
  ":": 333,
  ";": 333,
  "<": 584,
  "=": 584,
  ">": 584,
  "?": 611,
  "@": 975,
  A: 722,
  B: 722,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 556,
  K: 722,
  L: 611,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,
  "[": 333,
  "\\": 278,
  "]": 333,
  "^": 584,
  _: 556,
  "`": 333,
  a: 556,
  b: 611,
  c: 556,
  d: 611,
  e: 556,
  f: 333,
  g: 611,
  h: 611,
  i: 278,
  j: 278,
  k: 556,
  l: 278,
  m: 889,
  n: 611,
  o: 611,
  p: 611,
  q: 611,
  r: 389,
  s: 556,
  t: 333,
  u: 611,
  v: 556,
  w: 778,
  x: 556,
  y: 556,
  z: 500,
  "{": 389,
  "|": 280,
  "}": 389,
  "~": 584,
};

const AVG_WIDTH: Record<PdfFont, number> = {
  Helvetica: 556,
  "Helvetica-Bold": 556,
  Courier: 600,
};

/**
 * Width of a single rendered string, in points, for the given font and
 * size. Courier is fixed-pitch (600/1000 em); the proportional fonts
 * sum their per-glyph advances.
 */
export function measureText(text: string, font: PdfFont, fontSize: number): number {
  if (font === "Courier") {
    return (text.length * 600 * fontSize) / 1000;
  }
  const table = font === "Helvetica-Bold" ? HELVETICA_BOLD : HELVETICA;
  let units = 0;
  for (const ch of text) {
    units += table[ch] ?? AVG_WIDTH[font];
  }
  return (units * fontSize) / 1000;
}

/**
 * Break `text` into lines that each fit within `maxWidth` points. Words
 * are kept whole where possible; a single word longer than the line is
 * hard-split so it cannot overflow the margin.
 */
export function wrapText(
  text: string,
  font: PdfFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const rawParagraph of text.split(/\r?\n/)) {
    const words = rawParagraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (measureText(candidate, font, fontSize) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current.length > 0) {
        lines.push(current);
        current = "";
      }
      // The word itself is wider than the line — hard-split it.
      if (measureText(word, font, fontSize) <= maxWidth) {
        current = word;
        continue;
      }
      let chunk = "";
      for (const ch of word) {
        if (measureText(chunk + ch, font, fontSize) <= maxWidth) {
          chunk += ch;
        } else {
          if (chunk.length > 0) lines.push(chunk);
          chunk = ch;
        }
      }
      current = chunk;
    }
    if (current.length > 0) lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

/**
 * Truncate `text` to fit `maxWidth` points, appending an ellipsis when
 * the string had to be shortened. Used for single-line table cells.
 */
export function truncateToWidth(
  text: string,
  font: PdfFont,
  fontSize: number,
  maxWidth: number,
): string {
  if (measureText(text, font, fontSize) <= maxWidth) return text;
  const ellipsis = "…";
  let out = "";
  for (const ch of text) {
    if (measureText(out + ch + ellipsis, font, fontSize) > maxWidth) break;
    out += ch;
  }
  return out.length > 0 ? out + ellipsis : ellipsis;
}
