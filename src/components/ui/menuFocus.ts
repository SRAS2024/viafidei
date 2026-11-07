/**
 * Whether a move of focus has really left a menu, so it should close.
 *
 * `next` is the element gaining focus, as a blur event's relatedTarget or a focusin
 * event's target gives it. Two moves look like leaving and are not. A press on a link
 * in Safari focuses no link, so focus falls to nothing, or to the nearest focusable
 * ancestor of the menu; closing then would take the link away before its click lands.
 * Nothing at all is also what a blur names when the window itself loses focus.
 */
export function focusLeftMenu(next: EventTarget | null, menu: Element): boolean {
  if (!(next instanceof Node)) return false;
  return !menu.contains(next) && !next.contains(menu);
}
