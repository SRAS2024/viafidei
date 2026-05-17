import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedSpiritualLifeGuideBySlug } from "@/lib/data/spiritual-life";
import { resolveGuidePrayers, type GuidePrayerEntry } from "@/lib/data/guide-prayers";
import { requireUser } from "@/lib/auth";
import { ExpandablePrayer, OfficialSourceLink } from "@/components/ui";
import { AddGoalButton } from "../_components";
import { logger } from "@/lib/observability/logger";
import { logPageError, logPageMissingContent } from "@/lib/observability/page-errors";
import { buildDetailMetadata, notFoundMetadataFor } from "@/lib/metadata";
import { checkSpiritualGuidanceRender, notifyRenderGateFailure } from "@/lib/content-qa";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

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

type MysterySet = {
  setName?: string;
  mysteries?: Array<{ order?: number; title?: string; scripture?: string; meditation?: string }>;
};

function RosarySection({ metadata }: { metadata: Record<string, unknown> }) {
  const mysterySets = Array.isArray(metadata.mysterySets)
    ? (metadata.mysterySets as MysterySet[])
    : [];
  const openingPrayers = Array.isArray(metadata.openingPrayers)
    ? (metadata.openingPrayers as string[])
    : [];
  const closingPrayers = Array.isArray(metadata.closingPrayers)
    ? (metadata.closingPrayers as string[])
    : [];
  if (mysterySets.length === 0 && openingPrayers.length === 0 && closingPrayers.length === 0) {
    return null;
  }
  return (
    <section className="mt-10 vf-card rounded-sm p-6 sm:p-8">
      <h2 className="mb-6 font-display text-2xl">The Rosary</h2>
      {openingPrayers.length > 0 ? (
        <div className="mb-6">
          <h3 className="font-display text-lg">Opening prayers</h3>
          <div className="mt-2 space-y-2">
            {openingPrayers.map((p, i) => (
              <details key={i} className="rounded-sm border border-stone-200 p-2">
                <summary className="cursor-pointer font-medium">Prayer {i + 1}</summary>
                <p className="mt-2 whitespace-pre-wrap font-serif text-sm">{p}</p>
              </details>
            ))}
          </div>
        </div>
      ) : null}
      {mysterySets.map((set, i) => (
        <div key={i} className="mb-6">
          <h3 className="font-display text-lg">{set.setName ?? `Mystery set ${i + 1}`}</h3>
          <ol className="mt-2 space-y-2">
            {(set.mysteries ?? []).map((m, j) => (
              <li key={j} className="rounded-sm border border-stone-200 p-2">
                <p className="font-medium">
                  {j + 1}. {m.title ?? `Mystery ${j + 1}`}
                </p>
                {m.scripture ? (
                  <p className="mt-1 font-serif text-xs italic text-stone-700">{m.scripture}</p>
                ) : null}
                {m.meditation ? (
                  <p className="mt-1 font-serif text-sm text-ink-soft">{m.meditation}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ))}
      {closingPrayers.length > 0 ? (
        <div>
          <h3 className="font-display text-lg">Closing prayers</h3>
          <div className="mt-2 space-y-2">
            {closingPrayers.map((p, i) => (
              <details key={i} className="rounded-sm border border-stone-200 p-2">
                <summary className="cursor-pointer font-medium">Prayer {i + 1}</summary>
                <p className="mt-2 whitespace-pre-wrap font-serif text-sm">{p}</p>
              </details>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

async function safeGetGuide(slug: string, locale: string) {
  try {
    return await getPublishedSpiritualLifeGuideBySlug(slug, locale as never);
  } catch (err) {
    logPageError({
      route: "/spiritual-life/[slug]",
      entityType: "SpiritualLifeGuide",
      slug,
      error: err,
    });
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
  const { slug } = await params;
  const guide = await safeGetGuide(slug, locale);
  if (!guide) return notFoundMetadataFor("/spiritual-life");
  const tr = guide.translations[0];
  return buildDetailMetadata({
    path: `/spiritual-life/${slug}`,
    title: tr?.title ?? guide.title,
  });
}

export default async function SpiritualLifeDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  const { slug } = await params;
  const guide = await safeGetGuide(slug, locale);
  if (!guide) {
    logPageMissingContent({
      route: "/spiritual-life/[slug]",
      entityType: "SpiritualLifeGuide",
      slug,
      reason: "missing_record",
    });
    notFound();
  }

  // Strict render gate — refuse to render an empty-section guide page.
  const render = checkSpiritualGuidanceRender({
    kind: guide.kind,
    subtype: guide.subtype,
    title: guide.title,
    summary: guide.summary,
    bodyText: guide.bodyText,
    steps: guide.steps,
  });
  if (!render.ready) {
    logger.warn("guide.package_unready", { slug, missing: render.missing });
    logPageMissingContent({
      route: "/spiritual-life/[slug]",
      entityType: "SpiritualLifeGuide",
      slug,
      reason: "validation_error",
    });
    void notifyRenderGateFailure({
      contentType: "SpiritualLifeGuide",
      slug,
      missingFields: render.missing,
    });
    notFound();
  }

  const tr = guide.translations[0];
  const title = tr?.title ?? guide.title ?? slug;
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

      {guide.kind === "ROSARY" && guide.packageMetadata ? (
        <RosarySection metadata={guide.packageMetadata as Record<string, unknown>} />
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
          <AddGoalButton
            isAuthed={!!user}
            title={title}
            summary={summary}
            templateSlug={guide.goalTemplateSlug}
            steps={steps}
            className="vf-btn vf-btn-primary"
          >
            {t("spiritualLife.addGoal")}
          </AddGoalButton>
        </div>
      ) : null}

      <OfficialSourceLink url={guide.externalSourceKey} />
    </div>
  );
}
