type Translation = { title?: string | null; summary?: string | null } | undefined;

type Apparition = {
  id: string;
  title: string;
  summary: string;
  location?: string | null;
  translations: NonNullable<Translation>[];
};

export function ApparitionCard({ apparition }: { apparition: Apparition }) {
  const tr = apparition.translations[0];
  return (
    <article className="vf-card flex flex-col rounded-sm p-6">
      <p className="vf-eyebrow vf-icon-marian">{apparition.location ?? "—"}</p>
      <h3 className="mt-3 font-display text-2xl">{tr?.title ?? apparition.title}</h3>
      <p className="mt-3 line-clamp-4 font-serif leading-relaxed text-ink-soft">
        {tr?.summary ?? apparition.summary}
      </p>
    </article>
  );
}
