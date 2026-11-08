import type { Metadata } from "next";

import { PageHero } from "@/components/ui/PageHero";
import { HISTORY_ERAS } from "@/lib/content-shared/church-history/types";
import { getTranslator } from "@/lib/i18n/server";
import { loadHistoryTimeline } from "@/lib/data/history-timeline";

import { HistoryControls } from "./HistoryControls";
import { HistoryResults, HistoryShell } from "./HistoryShell";
import { HistoryEmpty, HistoryEraSteps, HistoryEventList, HistoryPager } from "./HistoryTimeline";
import {
  HISTORY_EVENT_ID_PREFIX,
  HISTORY_STATUS_ID,
  historyHref,
  type HistoryLinkState,
} from "./historyUrl";
import {
  buildHistoryView,
  formatCount,
  historyStatusSpeech,
  historyStatusText,
  parseHistoryParams,
} from "./historyView";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const TITLE = "Church History";
const DESCRIPTION =
  "A timeline of the Catholic Church from Pentecost to today — councils, saints and martyrs, schisms and reform, the Magisterium, and Our Lady.";

/**
 * Each era and each page of it is a page in its own right, so search engines
 * can reach every event. A filter, a search or a year is another view of those
 * same pages and points back to them.
 *
 * The title is one for them all. A move between views happens on the page, and
 * the live status above the list announces each one. Next's route announcer speaks
 * whenever the title changes, and it is assertive, so an era in the title would
 * speak over that sentence, and over the slider's as soon as it crosses into
 * another era. The era's name goes in the description instead.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = parseHistoryParams((await searchParams) ?? {});
  const era = HISTORY_ERAS.find((e) => e.key === params.era);
  const isPlainPage =
    params.theme === "all" &&
    !params.q &&
    params.order === "oldest" &&
    params.year === null &&
    params.event === null;
  return {
    title: TITLE,
    description: era ? `${era.label}: ${DESCRIPTION}` : DESCRIPTION,
    alternates: {
      canonical: historyHref({ era: params.era, page: isPlainPage ? params.page : null }),
    },
    robots: params.q ? { index: false, follow: true } : undefined,
  };
}

export default async function HistoryPage({ searchParams }: Props) {
  const { t, locale } = await getTranslator();
  // Rendered on the server from the cached, body-free timeline (static dataset
  // merged with published documents). Only the page of events the URL asks for
  // reaches the browser, as plain HTML with its details inside.
  const timeline = await loadHistoryTimeline();
  const { events } = timeline;
  const view = buildHistoryView(timeline, parseHistoryParams((await searchParams) ?? {}));
  // The opening label comes from the first event itself ("c. 33"), so the
  // subtitle never asserts a precision the dataset does not claim.
  const firstLabel = events[0]?.dateLabel;
  const subtitle = `${formatCount(events.length)} events from ${firstLabel ?? "the early Church"} to today: councils, saints and martyrs, schisms and reform, and the Magisterium.`;

  const { theme, q } = view;
  const order = view.params.order;
  const base: HistoryLinkState = { era: view.era?.key, theme, q, order };
  // "Show all events" is for when something is actually narrowed; a search alone
  // has "Clear search" for that. The order is not a narrowing, and it stays.
  const narrowed = view.era !== null || theme !== "all";

  return (
    <div className="vf-history">
      <PageHero title={TITLE} subtitle={subtitle} />
      <HistoryShell>
        <HistoryControls view={view} firstLabel={firstLabel ?? "33"} t={t} locale={locale} />
        <div className="vf-timeline-status-row">
          {/* A live region: the sentence is announced whenever the view changes.
              It takes focus after a search, so it needs a tab stop of -1. The ear
              gets its own sentence; see historyStatusSpeech. */}
          <p
            id={HISTORY_STATUS_ID}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            tabIndex={-1}
            className="vf-timeline-status"
          >
            <span className="sr-only">{historyStatusSpeech(view, t, locale)}</span>
            <span aria-hidden="true">{historyStatusText(view)}</span>
          </p>
          {/* From the slider or the year field to the row it found, without
              stepping through every row above it. */}
          {view.target && view.year !== null ? (
            <a
              href={`#${HISTORY_EVENT_ID_PREFIX}${view.target.slug}`}
              aria-label={`${t("history.goToEvent")}: ${view.target.title}`}
              className="vf-link-action"
            >
              {t("history.goToEvent")}
            </a>
          ) : null}
          {/* An empty list offers these ways back itself. Each is gone once
              followed, so the focus goes to the sentence above: see data-landing
              in HistoryShell. */}
          {q && view.total > 0 ? (
            <a
              href={historyHref({ ...base, q: null })}
              data-landing="status"
              className="vf-link-action"
            >
              {t("listSearch.clear")}
            </a>
          ) : null}
          {narrowed && view.total > 0 ? (
            <a href={historyHref({ order })} data-landing="status" className="vf-link-action">
              {t("history.showAll")}
            </a>
          ) : null}
        </div>
        <HistoryResults>
          {view.total === 0 ? (
            <HistoryEmpty
              view={view}
              base={base}
              noneText={t("listSearch.none", { query: q })}
              hintText={t("listSearch.noneHint")}
              clearText={t("listSearch.clear")}
              emptyText={t("history.noEvents")}
              searchAllText={t("history.searchAll")}
              showAllText={t("history.showAll")}
            />
          ) : (
            <>
              <HistoryEventList view={view} t={t} locale={locale} />
              <HistoryPager view={view} base={base} t={t} />
              <HistoryEraSteps view={view} base={base} t={t} />
            </>
          )}
        </HistoryResults>
      </HistoryShell>
    </div>
  );
}
