import { eyebrowClass } from "./eyebrow";

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

/** A label that only repeats the title ("Saints & Our Lady" twice) says nothing. */
export function heroLabel(eyebrow: string | undefined, title: string): string | null {
  return eyebrow && eyebrow.trim().toLowerCase() !== title.trim().toLowerCase() ? eyebrow : null;
}

export function PageHero({ eyebrow, title, subtitle }: PageHeroProps) {
  const label = heroLabel(eyebrow, title);
  return (
    <section className="vf-page-hero">
      {label ? <p className={eyebrowClass(label)}>{label}</p> : null}
      <h1 className="vf-page-hero-title text-ink">{title}</h1>
      {subtitle ? <p className="vf-page-hero-lede">{subtitle}</p> : null}
    </section>
  );
}
