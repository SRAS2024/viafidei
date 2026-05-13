import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listSacramentGuides } from "@/lib/data/spiritual-life";
import {
  BaptismBadge,
  ConfirmationBadge,
  EucharistBadge,
  ConfessionBadge,
  AnointingBadge,
  HolyOrdersBadge,
  MatrimonyBadge,
  MarianConsecrationBadge,
  StJosephBadge,
  HolyFamilyBadge,
  SacredHeartBadge,
} from "@/components/icons/SacramentBadges";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sacraments" };

// Match each sacrament/consecration slug to its badge component so the
// catalog cards carry the same imagery the user will earn on their
// profile when the corresponding goal is completed.
const BADGE_FOR_SLUG: Record<string, React.FC<{ size?: number; className?: string }>> = {
  "sacrament-baptism": BaptismBadge,
  "sacrament-confirmation": ConfirmationBadge,
  "sacrament-eucharist": EucharistBadge,
  "sacrament-reconciliation": ConfessionBadge,
  "sacrament-anointing-of-the-sick": AnointingBadge,
  "sacrament-holy-orders": HolyOrdersBadge,
  "sacrament-matrimony": MatrimonyBadge,
  "consecration-marian-de-montfort": MarianConsecrationBadge,
  "consecration-st-joseph": StJosephBadge,
  "consecration-holy-family": HolyFamilyBadge,
  "consecration-sacred-heart": SacredHeartBadge,
};

const SACRAMENT_ORDER = [
  "sacrament-baptism",
  "sacrament-confirmation",
  "sacrament-eucharist",
  "sacrament-reconciliation",
  "sacrament-anointing-of-the-sick",
  "sacrament-holy-orders",
  "sacrament-matrimony",
];

const CONSECRATION_ORDER = [
  "consecration-marian-de-montfort",
  "consecration-st-joseph",
  "consecration-holy-family",
  "consecration-sacred-heart",
];

function orderBySlug<T extends { slug: string }>(items: T[], order: string[]): T[] {
  const idx = new Map(order.map((slug, i) => [slug, i]));
  return [...items].sort(
    (a, b) => (idx.get(a.slug) ?? 999) - (idx.get(b.slug) ?? 999),
  );
}

export default async function SacramentsPage() {
  const { t, locale } = await getTranslator();
  let groups: Awaited<ReturnType<typeof listSacramentGuides>> = {
    sacraments: [],
    consecrations: [],
  };
  try {
    groups = await listSacramentGuides(locale);
  } catch (err) {
    logger.error("sacraments.list_failed", { error: (err as Error).message });
  }

  const sacraments = orderBySlug(groups.sacraments, SACRAMENT_ORDER);
  const consecrations = orderBySlug(groups.consecrations, CONSECRATION_ORDER);

  return (
    <div>
      <PageHero
        eyebrow={t("nav.sacraments")}
        title="The Seven Sacraments"
        subtitle="Christ instituted seven sacraments — visible signs of invisible grace — to give the divine life of the Trinity to his people through the Church. Personal consecrations join the soul more closely to Jesus through Mary, Joseph, the Holy Family, and the Sacred Heart."
      />

      <section className="mx-auto max-w-reading pb-10 font-serif leading-relaxed text-ink-soft">
        <h2 className="font-display text-3xl text-ink mb-4">What are the Seven Sacraments?</h2>
        <p className="mb-3">
          A sacrament is an outward sign instituted by Christ to give grace (Roman Catechism). The
          Catholic Church teaches that Christ instituted seven, grouped under three headings.
        </p>
        <ul className="ml-6 list-disc space-y-1">
          <li>
            <strong>Sacraments of Christian Initiation</strong> — Baptism, Confirmation, and the
            Most Holy Eucharist.
          </li>
          <li>
            <strong>Sacraments of Healing</strong> — Penance and Reconciliation, and the Anointing
            of the Sick.
          </li>
          <li>
            <strong>Sacraments at the Service of Communion</strong> — Holy Orders and Matrimony.
          </li>
        </ul>
        <p className="mt-3 text-sm text-ink-faint">
          See Catechism of the Catholic Church §1210–1666 and the Code of Canon Law canons 840–1165.
        </p>
      </section>

      <section className="mb-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sacraments.map((g) => {
            const Badge = BADGE_FOR_SLUG[g.slug];
            const title = g.translations[0]?.title ?? g.title;
            const summary = g.translations[0]?.summary ?? g.summary;
            return (
              <Link key={g.id} href={`/sacraments/${g.slug}`}>
                <article className="vf-card flex h-full flex-col rounded-sm p-7 transition hover:border-ink/30 hover:-translate-y-0.5">
                  {Badge ? (
                    <div className="mb-3 text-ink">
                      <Badge size={48} />
                    </div>
                  ) : null}
                  <h3 className="font-display text-2xl">{title}</h3>
                  <p className="mt-3 flex-1 font-serif text-sm leading-relaxed text-ink-soft">
                    {summary}
                  </p>
                </article>
              </Link>
            );
          })}
        </div>
      </section>

      {consecrations.length > 0 ? (
        <section>
          <div className="mb-6 text-center">
            <p className="vf-eyebrow">Personal entrustment</p>
            <h2 className="mt-2 font-display text-4xl">Consecrations</h2>
            <p className="mx-auto mt-3 max-w-reading font-serif text-ink-soft">
              A personal consecration is a free, total entrustment of oneself to Jesus, Mary, Saint
              Joseph, the Holy Family, or the Sacred Heart. Each completed consecration is added as
              a badge under your profile.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2">
            {consecrations.map((g) => {
              const Badge = BADGE_FOR_SLUG[g.slug];
              const title = g.translations[0]?.title ?? g.title;
              const summary = g.translations[0]?.summary ?? g.summary;
              return (
                <Link key={g.id} href={`/sacraments/${g.slug}`}>
                  <article className="vf-card flex h-full flex-col rounded-sm p-7 transition hover:border-ink/30 hover:-translate-y-0.5">
                    {Badge ? (
                      <div className="mb-3 text-ink">
                        <Badge size={48} />
                      </div>
                    ) : null}
                    <h3 className="font-display text-2xl">{title}</h3>
                    <p className="mt-3 flex-1 font-serif text-sm leading-relaxed text-ink-soft">
                      {summary}
                    </p>
                  </article>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
