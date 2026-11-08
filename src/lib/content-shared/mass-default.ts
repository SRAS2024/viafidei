/**
 * Which of a date's Masses a page opens on when nobody has chosen one.
 *
 * Kept apart from the calendar engine so the pages that only need this rule (the
 * readings page's client side) do not carry the engine to the browser.
 */

/** The hour of the visitor's own day from which the evening Mass is the one meant. */
export const EVENING_MASS_FROM_HOUR = 12;

/**
 * True when the readings of a date's evening Mass, rather than its own Mass, are the
 * ones to show first: only for the visitor's current day, and only from noon on their
 * device. Someone who opens Saturday's readings in the afternoon is most likely going
 * to Sunday's Mass that evening; a Saturday visited from another day is shown its own
 * Mass, and whichever is shown, the other is a press away.
 */
export function prefersEveningMass(
  shownDate: string,
  visit: { day: string; hour: number } | null,
): boolean {
  return visit !== null && visit.day === shownDate && visit.hour >= EVENING_MASS_FROM_HOUR;
}
