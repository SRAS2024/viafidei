export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="pt-8 pb-10 text-center">
      {eyebrow ? <p className="vf-eyebrow">{eyebrow}</p> : null}
      <div className="vf-rule mx-auto my-5" />
      <h1 className="mx-auto max-w-3xl font-display text-5xl leading-tight text-ink sm:text-6xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mx-auto mt-5 max-w-reading font-serif text-lg leading-relaxed text-ink-soft">
          {subtitle}
        </p>
      ) : null}
    </section>
  );
}
