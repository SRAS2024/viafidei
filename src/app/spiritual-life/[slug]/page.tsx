import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedSpiritualLifeGuideBySlug } from "@/lib/data/spiritual-life";

type Props = { params: { slug: string } };

type Step = { order: number; title: string; body: string };

function parseSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter((s): s is Step => typeof s === "object" && s !== null && "title" in s && "body" in s)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await getTranslator();
  const guide = await getPublishedSpiritualLifeGuideBySlug(params.slug, locale);
  if (!guide) return { title: "Not Found" };
  const tr = guide.translations[0];
  return { title: tr?.title ?? guide.title };
}

export default async function SpiritualLifeDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  const guide = await getPublishedSpiritualLifeGuideBySlug(params.slug, locale);
  if (!guide) notFound();

  const tr = guide.translations[0];
  const title = tr?.title ?? guide.title;
  const summary = tr?.summary ?? guide.summary;
  const bodyText = tr?.bodyText ?? guide.bodyText;
  const steps = parseSteps(tr?.steps ?? guide.steps);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/spiritual-life" className="vf-nav-link">
          ← {t("nav.spiritualLife")}
        </Link>
      </div>

      <section className="mb-10 text-center">
        {guide.durationDays ? <p className="vf-eyebrow">{guide.durationDays}-day journey</p> : null}
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">{title}</h1>
        <p className="mx-auto mt-5 max-w-reading font-serif text-lg leading-relaxed text-ink-soft">
          {summary}
        </p>
      </section>

      {bodyText ? (
        <div className="mb-8 vf-card rounded-sm p-8">
          <p className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">{bodyText}</p>
        </div>
      ) : null}

      {steps.length > 0 ? (
        <section>
          <h2 className="mb-6 font-display text-3xl">Steps</h2>
          <ol className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={i} className="vf-card rounded-sm p-6">
                <div className="flex items-start gap-4">
                  <span className="vf-eyebrow w-8 shrink-0 pt-1">{i + 1}</span>
                  <div className="min-w-0">
                    <h3 className="font-display text-xl">{step.title}</h3>
                    <p className="mt-2 font-serif leading-relaxed text-ink-soft">{step.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {guide.goalTemplateSlug ? (
        <div className="mt-10 text-center">
          <button type="button" className="vf-btn vf-btn-primary">
            {t("spiritualLife.addGoal")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
