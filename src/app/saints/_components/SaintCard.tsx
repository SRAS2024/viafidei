import Link from "next/link";

type Translation = { name?: string | null; biography?: string | null } | undefined;

type Saint = {
  id: string;
  slug: string;
  canonicalName: string;
  biography: string;
  feastDay?: string | null;
  patronages?: string[];
  translations: NonNullable<Translation>[];
};

type Props = {
  saint: Saint;
  feastDayLabel: string;
  /** Localised "Patron of" label rendered in front of the patronage list. */
  patronagesLabel?: string;
};

/**
 * Catalog card for one saint.
 *
 * Patronages are surfaced on the card as a short ", "-joined list so a
 * user scanning the grid can immediately see who each saint is the
 * patron of. The label is localised via `patronagesLabel`; the card
 * silently hides the patronages line when the array is empty.
 */
export function SaintCard({
  saint,
  feastDayLabel,
  patronagesLabel = "Patron of",
}: Props) {
  const tr = saint.translations[0];
  const patronages = saint.patronages ?? [];
  return (
    <Link href={`/saints/${saint.slug}`}>
      <article className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:border-ink/30 hover:-translate-y-0.5">
        <p className="vf-eyebrow">
          {feastDayLabel}: {saint.feastDay ?? "—"}
        </p>
        <h2 className="mt-3 font-display text-2xl">{tr?.name ?? saint.canonicalName}</h2>
        <p className="mt-3 line-clamp-4 font-serif leading-relaxed text-ink-soft">
          {tr?.biography ?? saint.biography}
        </p>
        {patronages.length > 0 ? (
          <p className="mt-4 font-serif text-xs leading-relaxed text-ink-faint">
            <span className="font-medium text-ink-soft">{patronagesLabel}:</span>{" "}
            {patronages.join(", ")}
          </p>
        ) : null}
      </article>
    </Link>
  );
}
