import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedPrayerBySlug } from "@/lib/data/prayers";
import { isSaved } from "@/lib/data/saved";
import { requireUser } from "@/lib/auth";
import { SaveButton } from "@/components/profile/SaveButton";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  const { locale } = await getTranslator();
  const prayer = await getPublishedPrayerBySlug(params.slug, locale);
  if (!prayer) return { title: "Not Found" };
  const tr = prayer.translations[0];
  return { title: tr?.title ?? prayer.defaultTitle };
}

export default async function PrayerDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  const prayer = await getPublishedPrayerBySlug(params.slug, locale);
  if (!prayer) notFound();

  const user = await requireUser();
  const alreadySaved = user ? await isSaved("prayer", user.id, prayer.id) : false;

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

      {user ? (
        <div className="mb-10 flex justify-center">
          <SaveButton
            kind="prayers"
            entityId={prayer.id}
            initiallySaved={alreadySaved}
            labels={{
              save: t("prayers.save"),
              saved: t("prayers.saved"),
              remove: t("common.remove"),
            }}
          />
        </div>
      ) : null}

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
