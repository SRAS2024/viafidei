type PageHeroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export function PageHero({ eyebrow, title, subtitle }: PageHeroProps) {
  // A label that only repeats the title ("Saints & Our Lady" twice) says nothing.
  const label =
    eyebrow && eyebrow.trim().toLowerCase() !== title.trim().toLowerCase() ? eyebrow : null;
  return (
    <section className="vf-page-hero">
      {label ? <p className="vf-eyebrow">{label}</p> : null}
      <h1 className="vf-page-hero-title text-ink">{title}</h1>
      {subtitle ? <p className="vf-page-hero-lede">{subtitle}</p> : null}
    </section>
  );
}
