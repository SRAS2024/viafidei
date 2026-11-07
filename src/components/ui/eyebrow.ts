/** Longer than this, a label keeps its ordinary case. */
const LONGEST_IN_CAPITALS = 24;

/**
 * The class for a label over a title. Spaced capitals suit a word or two ("Prayers",
 * "The Magisterium"). At the length of a phrase ("Sacrament at the Service of
 * Communion") they turn into a line nobody reads, so it stays in sentence type.
 */
export function eyebrowClass(label: string): string {
  return label.length > LONGEST_IN_CAPITALS ? "vf-eyebrow vf-eyebrow-long" : "vf-eyebrow";
}
