import type { Metadata } from "next";

import { PageHero } from "@/components/ui/PageHero";
import { HISTORY_ERAS } from "@/lib/content-shared/church-history/types";
import { getTranslator } from "@/lib/i18n/server";
import { loadHistoryTimeline } from "@/lib/data/history-timeline";

import { HistoryControls } from "./HistoryControls";
import { HistoryResults, HistoryShell } from "./HistoryShell";
import { HistoryEmpty, HistoryEraSteps, HistoryEventList, HistoryPager } from "./HistoryTimeline";
import { HISTORY_STATUS_ID, historyHref, type HistoryLinkState } from "./historyUrl";
import {
  buildHistoryView,
  formatCount,
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
    title: era ? `${era.label} · ${TITLE}` : TITLE,
    description: DESCRIPTION,
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
  const subtitle = `${formatCount(events.length)} events from ${firstLabel ?? "the early Church"} to today, councils, saints and martyrs, schisms and reform, and the Magisterium`;

  const { theme, q } = view;
  const order = view.params.order;
  const base: HistoryLinkState = { era: view.era?.key, theme, q, order };
  // The two ways back are offered only when they lead to different places.
  const withoutSearch = historyHref({ ...base, q: null, page: view.page });
  const showAll = historyHref();

  return (
    <div className="vf-history">
      <PageHero title={TITLE} subtitle={subtitle} />
      <HistoryShell>
        <HistoryControls view={view} firstLabel={firstLabel ?? "33"} t={t} locale={locale} />
        <div className="vf-timeline-status-row">
          {/* A live region: the sentence is announced whenever the view changes.
              It takes focus after a search, so it needs a tab stop of -1. */}
          <p
            id={HISTORY_STATUS_ID}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            tabIndex={-1}
            className="vf-timeline-status"
          >
            {historyStatusText(view)}
          </p>
          {/* An empty list offers these ways back itself. */}
          {q && view.total > 0 ? (
            <a href={historyHref({ ...base, q: null })} className="vf-link-action">
              {t("listSearch.clear")}
            </a>
          ) : null}
          {withoutSearch !== showAll && view.total > 0 ? (
            <a href={showAll} className="vf-link-action">
              Show all events
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
            />
          ) : (
            <>
              <HistoryEventList view={view} />
              <HistoryPager view={view} base={base} />
              <HistoryEraSteps view={view} base={base} />
            </>
          )}
        </HistoryResults>
      </HistoryShell>
    </div>
  );
}
