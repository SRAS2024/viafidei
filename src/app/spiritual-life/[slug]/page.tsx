import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedSpiritualLifeGuideBySlug } from "@/lib/data/spiritual-life";
import { resolveGuidePrayers, type GuidePrayerEntry } from "@/lib/data/guide-prayers";
import { requireUser } from "@/lib/auth";
import { ExpandablePrayer, AccountRequiredButton } from "@/components/ui";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

type Step = { order: number; title: string; body: string };

function isStep(value: unknown): value is Step {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.title === "string" && typeof candidate.body === "string";
}

function parseSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isStep).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

async function safeGetGuide(slug: string, locale: string) {
  try {
    return await getPublishedSpiritualLifeGuideBySlug(slug, locale as never);
  } catch (err) {
    logger.error("guide.lookup_failed", { slug, error: (err as Error).message });
    return null;
  }
}

async function safeResolvePrayers(slug: string, locale: string): Promise<GuidePrayerEntry[]> {
  try {
    return await resolveGuidePrayers(slug, locale as never);
  } catch (err) {
    logger.error("guide.prayer_resolve_failed", { slug, error: (err as Error).message });
    return [];
  }
}

async function safeRequireUser() {
  try {
    return await requireUser();
  } catch (err) {
    logger.warn("guide.requireUser_failed", { error: (err as Error).message });
    return null;
  }
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await getTranslator();
  const guide = await safeGetGuide(params.slug, locale);
  if (!guide) return { title: "Not Found" };
  const tr = guide.translations[0];
  return { title: tr?.title ?? guide.title };
}

export default async function SpiritualLifeDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  const guide = await safeGetGuide(params.slug, locale);
  if (!guide) notFound();

  const tr = guide.translations[0];
  const title = tr?.title ?? guide.title ?? params.slug;
  const summary = tr?.summary ?? guide.summary ?? "";
  const bodyText = tr?.bodyText ?? guide.bodyText ?? null;
  const steps = parseSteps(tr?.steps ?? guide.steps);
  const guidePrayers = await safeResolvePrayers(guide.slug, locale);
  const user = await safeRequireUser();

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
        <section className="mb-10">
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

      {guidePrayers.length > 0 ? (
        <section className="vf-card rounded-sm p-6 sm:p-8">
          <h2 className="mb-2 font-display text-2xl">Prayers in this guide</h2>
          <p className="mb-4 font-serif text-sm text-ink-faint">
            Tap any prayer to read its full text.
          </p>
          <div>
            {guidePrayers.map((p) => (
              <ExpandablePrayer key={p.slug} title={p.title} body={p.body} />
            ))}
          </div>
        </section>
      ) : null}

      {guide.goalTemplateSlug ? (
        <div className="mt-10 text-center">
          <AccountRequiredButton
            isAuthed={!!user}
            href="/profile/goals"
            className="vf-btn vf-btn-primary"
          >
            {t("spiritualLife.addGoal")}
          </AccountRequiredButton>
        </div>
      ) : null}
    </div>
  );
}
