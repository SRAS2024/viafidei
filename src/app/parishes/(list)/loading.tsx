import { gridClass } from "@/components/ui/PaginatedGrid";
import { LoadingStatus } from "@/components/ui/TabLoadingSkeleton";
import { getTranslator } from "@/lib/i18n/server";

import { LoadingLine } from "../LoadingLine";
import { ParishesHero } from "../ParishesHero";

/** A card whose address runs to a third line: the directory's first rows tend to hold one. */
const THREE_LINE_ADDRESSES: ReadonlySet<number> = new Set([1, 3]);

/**
 * The directory while its page of parishes is on the way: the same opening, the
 * same control row and the same three columns of the same cards, so nothing moves
 * when they arrive. Only the status line is for a screen reader; the shapes are
 * hidden from it.
 */
export default async function ParishesLoading() {
  const { t } = await getTranslator();
  return (
    <>
      <LoadingStatus>{t("common.loadingContent")}</LoadingStatus>
      <div aria-busy="true" data-testid="tab-loading">
        <ParishesHero />
        <div aria-hidden="true">
          <div className="vf-locator">
            <div className="vf-list-controls">
              <div className="flex min-w-0 max-w-xl flex-1 basis-[22rem] gap-1.5">
                <span className="vf-skeleton h-11 min-w-0 flex-1" />
                <span className="vf-skeleton h-11 w-[2.875rem] sm:w-[7.7375rem]" />
              </div>
              <div className="vf-locator-actions">
                <span className="vf-skeleton h-11 w-[5.125rem]" />
                <span className="vf-skeleton h-11 w-[12.28125rem]" />
              </div>
            </div>
            {/* The sentence's own words hold its room: it takes two lines at enlarged text. */}
            <p className="vf-fineprint vf-locator-line relative">
              <span className="invisible">1,030 parishes in the directory.</span>
              <LoadingLine className="absolute left-1/2 top-[0.5em] w-44 max-w-full -translate-x-1/2" />
            </p>
          </div>
          <ul className={gridClass(3)} data-testid="tab-loading-cards">
            {Array.from({ length: 9 }).map((_, i) => (
              <li key={i}>
                <div className="vf-entry" data-testid="tab-loading-card">
                  <div className="vf-entry-title">
                    <LoadingLine className="w-4/5" />
                  </div>
                  <p className="vf-entry-meta">
                    <LoadingLine className="w-16" />
                  </p>
                  <div className="vf-address">
                    <span>
                      <LoadingLine className="w-3/5" />
                    </span>
                    <span>
                      <LoadingLine className="w-2/5" />
                    </span>
                    {THREE_LINE_ADDRESSES.has(i) ? (
                      <span>
                        <LoadingLine className="w-1/4" />
                      </span>
                    ) : null}
                  </div>
                  <div className="vf-entry-action">
                    <span className="vf-skeleton h-10 w-[9.375rem]" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
