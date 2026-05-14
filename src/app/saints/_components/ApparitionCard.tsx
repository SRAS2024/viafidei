import Link from "next/link";

type Translation = { title?: string | null; summary?: string | null } | undefined;

type Apparition = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  location?: string | null;
  translations: NonNullable<Translation>[];
};

export function ApparitionCard({ apparition }: { apparition: Apparition }) {
  const tr = apparition.translations[0];
  return (
    <Link href={`/saints/${apparition.slug}`}>
      <article className="vf-card flex h-full flex-col rounded-sm p-5 transition hover:border-ink/30 hover:-translate-y-0.5 sm:p-6">
        <p className="vf-eyebrow vf-icon-marian truncate">{apparition.location ?? "—"}</p>
        <h3 className="mt-3 break-words font-display text-xl sm:text-2xl">
          {tr?.title ?? apparition.title}
        </h3>
        <p className="mt-3 line-clamp-4 font-serif leading-relaxed text-ink-soft">
          {tr?.summary ?? apparition.summary}
        </p>
      </article>
    </Link>
  );
}
