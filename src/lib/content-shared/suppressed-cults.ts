/**
 * Cults the Church suppressed or never allowed, which data sources still list among the
 * saints. Nearly all are the child "martyrs" of the blood libel, a slander invented
 * against Jews: the cult of Simon of Trent was suppressed in 1965, that of Andreas of Rinn
 * in 1994, and Werner of Oberwesel was taken out of the Trier calendar in 1963. None is a
 * saint of the Church. Matched by name, so a record of the same cult that arrives from
 * another source, under another identifier, is refused as well.
 */
const SUPPRESSED_CULTS: readonly RegExp[] = [
  /\bsimon(?:ino)? (?:of|von|da|di) trent(?:o)?\b/i,
  /\bsimon unverdorben\b/i,
  /\bwerner (?:of|von) (?:oberwesel|bacharach|wesel)\b/i,
  /\bdominguito del val\b/i,
  /\b(?:andreas|anderl|andrew)(?: oxner)? (?:of|von) rinn\b/i,
  /\bwilliam of norwich\b/i,
  /\blittle (?:saint |st\.? )?hugh\b/i,
  /\brichard of pontoise\b/i,
  /\brudol(?:f|ph) (?:of|von) bern(?:e)?\b/i,
  /\blorenzino (?:sossio|of marostica|da marostica)\b/i,
  /\bholy child of la guardia\b/i,
  /\bni[ñn]o (?:santo )?de la guardia\b/i,
  /\bharold of gloucester\b/i,
  /\brobert of bury\b/i,
];

/** The name is that of a cult the Church suppressed or never allowed. */
export function isSuppressedCult(name: string): boolean {
  return SUPPRESSED_CULTS.some((pattern) => pattern.test(name));
}
