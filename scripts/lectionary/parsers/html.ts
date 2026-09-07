/**
 * Minimal, dependency-free HTML table extraction for the catholic-resources.org
 * lectionary pages (Latin-1, hand-written 1990s HTML). Pure functions: the
 * caller reads the file (as latin1) and passes the string.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  quot: '"',
  lt: "<",
  gt: ">",
  eacute: "é",
  egrave: "è",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  ccedil: "ç",
  ouml: "ö",
  uuml: "ü",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  dagger: "†",
  Dagger: "‡",
};

/** Decode the handful of entities the source pages use (named, decimal and hex). */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-zA-Z]+);/g, (whole, name: string) => NAMED_ENTITIES[name] ?? whole);
}

/**
 * Text of one table cell. `<sup>` ordinal suffixes (1<sup>st</sup>) are kept
 * so day labels stay readable; every OTHER superscript is a footnote marker
 * and is dropped — otherwise "Matt 17:9a, 10-13<sup>5</sup>" would read
 * "10-135" and silently corrupt a citation.
 */
export function cellText(html: string): string {
  const withoutSup = html.replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, (_, inner: string) =>
    /^\s*(st|nd|rd|th)\s*$/i.test(inner.replace(/<[^>]+>/g, "")) ? inner : " ",
  );
  return decodeEntities(withoutSup.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every `<table>` of the page as rows of cell texts (header rows included). */
export function extractTables(html: string): string[][][] {
  const tables: string[][][] = [];
  for (const table of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const rows: string[][] = [];
    for (const row of table[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const cells = [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
        cellText(m[1]),
      );
      if (cells.length > 0) rows.push(cells);
    }
    tables.push(rows);
  }
  return tables;
}
