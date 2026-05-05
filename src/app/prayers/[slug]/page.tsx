import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedPrayerBySlug } from "@/lib/data/prayers";
import { isSaved } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";
import { SaveButton } from "@/components/profile/SaveButton";
import { logger } from "@/lib/observability/logger";
import { logPageError, logPageMissingContent } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

async function safeGetPrayer(slug: string, locale: string) {
  try {
    return await getPublishedPrayerBySlug(slug, locale as never);
  } catch (err) {
    logPageError({ route: "/prayers/[slug]", entityType: "Prayer", slug, error: err });
    return null;
  }
}

async function safeRequireUser() {
  try {
    return await requireUser();
  } catch (err) {
    logger.warn("prayer.requireUser_failed", { error: (err as Error).message });
    return null;
  }
}

async function safeIsSaved(userId: string, prayerId: string): Promise<boolean> {
  try {
    return await isSaved("prayer", userId, prayerId);
  } catch (err) {
    logger.warn("prayer.isSaved_failed", { error: (err as Error).message });
    return false;
  }
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await getTranslator();
  const prayer = await safeGetPrayer(params.slug, locale);
  if (!prayer) return { title: "Not Found" };
  const tr = prayer.translations[0];
  return { title: tr?.title ?? prayer.defaultTitle };
}

export default async function PrayerDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  const prayer = await safeGetPrayer(params.slug, locale);
  if (!prayer) {
    logPageMissingContent({
      route: "/prayers/[slug]",
      entityType: "Prayer",
      slug: params.slug,
      reason: "missing_record",
    });
    notFound();
  }

  const user = await safeRequireUser();
  const alreadySaved = user ? await safeIsSaved(user.id, prayer.id) : false;

  const tr = prayer.translations[0];
  const title = tr?.title ?? prayer.defaultTitle;
  const body = tr?.body ?? prayer.body;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/prayers" className="vf-nav-link">
          ← {t("nav.prayers")}
        </Link>
      </div>

      <section className="mb-10 text-center">
        <p className="vf-eyebrow">{prayer.category}</p>
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">{title}</h1>
      </section>

      <div className="mb-10 flex justify-center">
        <SaveButton
          kind="prayers"
          entityId={prayer.id}
          initiallySaved={alreadySaved}
          isAuthed={!!user}
          labels={{
            save: t("prayers.save"),
            saved: t("prayers.saved"),
            remove: t("common.remove"),
          }}
        />
      </div>

      <article className="vf-card rounded-sm p-8">
        <p className="whitespace-pre-wrap font-serif text-lg leading-loose text-ink-soft">{body}</p>
      </article>

      {prayer.officialPrayer ? (
        <div className="mt-8">
          <h2 className="mb-4 font-display text-xl">{t("saints.officialPrayer")}</h2>
          <p className="font-serif leading-relaxed text-ink-soft">{prayer.officialPrayer}</p>
        </div>
      ) : null}
    </div>
  );
}
