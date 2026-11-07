import Link from "next/link";

import type { ReadingsMassOption } from "./readings-view";

/**
 * One choice of Mass: the same control whether it offers the day's own formularies,
 * the evening Mass beside them, the readings inside the Vigil, or, on the calendar,
 * the Masses of the date it shows, where none is chosen yet. Links rather than
 * buttons, so each Mass has its own URL, and the chosen one says so with
 * aria-current instead of by colour alone.
 */
export function MassChoice({
  label,
  navLabel,
  options,
}: {
  label: string;
  navLabel: string;
  options: ReadonlyArray<Pick<ReadingsMassOption, "label" | "href" | "isActive">>;
}) {
  return (
    <nav aria-label={navLabel} className="vf-choice">
      <p className="vf-choice-label" aria-hidden="true">
        {label}
      </p>
      {/* Without markers Safari drops a list's role, so it is said out loud. */}
      <ul className="vf-choice-options" role="list">
        {options.map((option) => (
          <li key={option.href}>
            <Link
              href={option.href}
              aria-current={option.isActive ? "true" : undefined}
              className={`vf-chip ${option.isActive ? "vf-filter-active" : ""}`.trim()}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
