import type { GuideStep } from "@/lib/content-shared/structured-content";

import { PrayerLinkedText } from "./PrayerLinkedText";

/**
 * The steps of a how-to guide, as a numbered ordered list that is OPEN.
 *
 * Guides used to render each step as a closed accordion row with no numeral,
 * so "How to Go to Confession" was six chevrons and a reader had to tap each
 * one in order to find out what to do. A how-to has to be readable straight
 * through — on a phone, kneeling, mid-prayer — so every step's text is on the
 * page from the first paint, in order, with its number.
 *
 * Prayer names inside a step body stay inline-expandable through
 * PrayerLinkedText (with its Latin / Greek toggle) whenever the guide's
 * prayers are supplied; without them the body is plain text.
 */
export function GuideSteps({
  steps,
  prayers,
  headingId,
}: {
  steps: GuideStep[];
  prayers?: React.ComponentProps<typeof PrayerLinkedText>["prayers"];
  /** Id of the "Steps" heading, so the list is labelled by it. */
  headingId?: string;
}) {
  if (steps.length === 0) return null;
  const linked = prayers && prayers.length > 0 ? prayers : null;

  return (
    <ol aria-labelledby={headingId} className="mt-4 space-y-6">
      {steps.map((step) => (
        <li key={step.order} className="flex flex-col gap-2 sm:flex-row sm:gap-5">
          <span
            aria-hidden="true"
            className="font-display text-3xl leading-none text-ink-faint sm:w-10 sm:shrink-0 sm:text-right"
          >
            {step.order}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg text-ink">
              <span className="sr-only">{`Step ${step.order}: `}</span>
              {step.title}
            </h3>
            <div className="mt-1 font-serif leading-relaxed text-ink">
              {linked ? (
                <PrayerLinkedText text={step.body} prayers={linked} />
              ) : (
                <p className="whitespace-pre-line">{step.body}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
