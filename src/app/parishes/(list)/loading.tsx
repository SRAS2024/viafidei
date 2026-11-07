import { gridClass } from "@/components/ui/PaginatedGrid";

import { LoadingLine } from "../LoadingLine";
import { ParishesHero } from "../ParishesHero";

/** A card whose name runs to two lines, which is most rows of the directory. */
const TWO_LINE_NAMES: ReadonlySet<number> = new Set([1, 3, 4, 8]);

/**
 * The directory while its page of parishes is on the way: the same opening, the
 * same control row and the same three columns of the same cards, so nothing moves
 * when they arrive. Only the status line is for a screen reader; the shapes are
 * hidden from it.
 */
export default function ParishesLoading() {
  return (
    <div aria-busy="true" data-testid="tab-loading">
      <ParishesHero />
      <p role="status" className="sr-only">
        Loading the latest published content…
      </p>
      <div aria-hidden="true">
        <div className="vf-locator">
          <div className="vf-list-controls">
            <div className="flex min-w-0 max-w-xl flex-1 basis-[22rem] gap-1.5">
              <span className="vf-skeleton h-11 min-w-0 flex-1" />
              <span className="vf-skeleton h-11 w-11 sm:w-28" />
            </div>
            <div className="vf-locator-actions">
              <span className="vf-skeleton h-11 w-[5.25rem]" />
              <span className="vf-skeleton h-11 w-52" />
            </div>
          </div>
          <p className="vf-fineprint vf-locator-line">
            <LoadingLine className="w-44" />
          </p>
        </div>
        <ul className={gridClass(3)} data-testid="tab-loading-cards">
          {Array.from({ length: 9 }).map((_, i) => (
            <li key={i}>
              <div className="vf-entry" data-testid="tab-loading-card">
                <div className="vf-entry-title">
                  <LoadingLine className="w-4/5" />
                  {TWO_LINE_NAMES.has(i) ? <LoadingLine className="block w-1/2" /> : null}
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
                  <span>
                    <LoadingLine className="w-1/4" />
                  </span>
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
  );
}
