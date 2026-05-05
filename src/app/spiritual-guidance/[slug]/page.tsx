import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedParishBySlug } from "@/lib/data/parishes";
import { isSaved } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";
import { SaveButton } from "@/components/profile/SaveButton";
import { logger } from "@/lib/observability/logger";
import { logPageError, logPageMissingContent } from "@/lib/observability/page-errors";
import { fetchOsmParishById, type ExternalParish } from "@/lib/data/external-parishes";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

async function safeGetParish(slug: string) {
  try {
    return await getPublishedParishBySlug(slug);
  } catch (err) {
    logPageError({
      route: "/spiritual-guidance/[slug]",
      entityType: "Parish",
      slug,
      error: err,
    });
    return null;
  }
}

async function safeRequireUser() {
  try {
    return await requireUser();
  } catch (err) {
    logger.warn("parish.requireUser_failed", { error: (err as Error).message });
    return null;
  }
}

async function safeIsSaved(userId: string, parishId: string): Promise<boolean> {
  try {
    return await isSaved("parish", userId, parishId);
  } catch (err) {
    logger.warn("parish.isSaved_failed", { error: (err as Error).message });
    return false;
  }
}

async function safeGetExternalParish(slug: string): Promise<ExternalParish | null> {
  try {
    return await fetchOsmParishById(slug);
  } catch (err) {
    logger.warn("parish.osm_lookup_failed", { slug, error: (err as Error).message });
    return null;
  }
}

export async function generateMetadata({ params }: Props) {
  const parish = await safeGetParish(params.slug);
  if (parish) return { title: parish.name };
  if (params.slug.startsWith("osm-")) {
    const ext = await safeGetExternalParish(params.slug);
    if (ext) return { title: ext.name };
  }
  return { title: "Not Found" };
}

export default async function ParishDetailPage({ params }: Props) {
  const { t } = await getTranslator();
  const parish = await safeGetParish(params.slug);

  if (!parish) {
    if (params.slug.startsWith("osm-")) {
      const external = await safeGetExternalParish(params.slug);
      if (external) return renderExternalParish(external, t);
    }
    logPageMissingContent({
      route: "/spiritual-guidance/[slug]",
      entityType: "Parish",
      slug: params.slug,
      reason: "missing_record",
    });
    notFound();
  }

  const user = await safeRequireUser();
  const alreadySaved = user ? await safeIsSaved(user.id, parish.id) : false;

  const location = [parish.address, parish.city, parish.region, parish.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/spiritual-guidance" className="vf-nav-link">
          ← {t("nav.spiritualGuidance")}
        </Link>
      </div>

      <section className="mb-10 text-center">
        {parish.diocese ? <p className="vf-eyebrow">{parish.diocese}</p> : null}
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">{parish.name}</h1>
        {location ? <p className="mt-5 font-serif text-lg text-ink-soft">{location}</p> : null}
      </section>

      <div className="mb-10 flex justify-center">
        <SaveButton
          kind="parishes"
          entityId={parish.id}
          initiallySaved={alreadySaved}
          isAuthed={!!user}
        />
      </div>

      <div className="vf-card rounded-sm p-8">
        <dl className="divide-y divide-ink/10">
          {parish.phone ? (
            <div className="flex gap-4 py-4">
              <dt className="w-28 font-serif text-sm font-semibold text-ink">Phone</dt>
              <dd className="font-serif text-ink-soft">
                <a href={`tel:${parish.phone}`} className="underline underline-offset-4">
                  {parish.phone}
                </a>
              </dd>
            </div>
          ) : null}
          {parish.email ? (
            <div className="flex gap-4 py-4">
              <dt className="w-28 font-serif text-sm font-semibold text-ink">Email</dt>
              <dd className="font-serif text-ink-soft">
                <a href={`mailto:${parish.email}`} className="underline underline-offset-4">
                  {parish.email}
                </a>
              </dd>
            </div>
          ) : null}
          {parish.websiteUrl ? (
            <div className="flex gap-4 py-4">
              <dt className="w-28 font-serif text-sm font-semibold text-ink">Website</dt>
              <dd className="font-serif text-ink-soft">
                <a
                  href={parish.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  {parish.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          ) : null}
          {parish.ociaUrl ? (
            <div className="flex gap-4 py-4">
              <dt className="w-28 font-serif text-sm font-semibold text-ink">OCIA</dt>
              <dd className="font-serif text-ink-soft">
                <a
                  href={parish.ociaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  OCIA information
                </a>
              </dd>
            </div>
          ) : null}
          {parish.latitude && parish.longitude ? (
            <div className="flex gap-4 py-4">
              <dt className="w-28 font-serif text-sm font-semibold text-ink">Map</dt>
              <dd className="font-serif text-ink-soft">
                <a
                  href={`https://www.openstreetmap.org/?mlat=${parish.latitude}&mlon=${parish.longitude}&zoom=16`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  View on map
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

function renderExternalParish(parish: ExternalParish, t: (key: string) => string) {
  const location = [parish.address, parish.city, parish.region, parish.country]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/spiritual-guidance" className="vf-nav-link">
          ← {t("nav.spiritualGuidance")}
        </Link>
      </div>

      <section className="mb-10 text-center">
        <p className="vf-eyebrow">External directory</p>
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">{parish.name}</h1>
        {location ? <p className="mt-5 font-serif text-lg text-ink-soft">{location}</p> : null}
      </section>

      <div className="vf-card rounded-sm p-8">
        <dl className="divide-y divide-ink/10">
          {parish.phone ? (
            <div className="flex gap-4 py-4">
              <dt className="w-28 font-serif text-sm font-semibold text-ink">Phone</dt>
              <dd className="font-serif text-ink-soft">
                <a href={`tel:${parish.phone}`} className="underline underline-offset-4">
                  {parish.phone}
                </a>
              </dd>
            </div>
          ) : null}
          {parish.websiteUrl ? (
            <div className="flex gap-4 py-4">
              <dt className="w-28 font-serif text-sm font-semibold text-ink">Website</dt>
              <dd className="font-serif text-ink-soft">
                <a
                  href={parish.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  {parish.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          ) : null}
          <div className="flex gap-4 py-4">
            <dt className="w-28 font-serif text-sm font-semibold text-ink">Map</dt>
            <dd className="font-serif text-ink-soft">
              <a
                href={`https://www.openstreetmap.org/?mlat=${parish.latitude}&mlon=${parish.longitude}&zoom=17`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                View on map
              </a>
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-8 text-center font-serif text-xs text-ink-faint">
        Listing sourced from OpenStreetMap (© OSM contributors). Confirm Mass times and contact
        details with the parish directly.
      </p>
    </div>
  );
}
