import Link from "next/link";

type Translation = { name?: string | null; biography?: string | null } | undefined;

type Saint = {
  id: string;
  slug: string;
  canonicalName: string;
  biography: string;
  feastDay?: string | null;
  translations: NonNullable<Translation>[];
};

type Props = {
  saint: Saint;
  feastDayLabel: string;
};

export function SaintCard({ saint, feastDayLabel }: Props) {
  const tr = saint.translations[0];
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
      </article>
    </Link>
  );
}
