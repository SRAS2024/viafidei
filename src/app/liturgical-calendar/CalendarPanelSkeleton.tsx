import { LoadingStatus } from "@/components/ui/LoadingStatus";

/**
 * The calendar's placeholder: the same contained panel, with its controls and
 * facts reserved, so the result appears without moving the page. A client component
 * renders it too, and cannot read the reader's language, so it is handed its words.
 */
export function CalendarPanelSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <>
      <LoadingStatus>{loadingLabel}</LoadingStatus>
      <div className="vf-calendar-panel" aria-busy="true" data-testid="calendar-loading">
        <div aria-hidden="true">
          <div className="vf-calendar-controls">
            <div>
              <span className="vf-skeleton mb-1.5 h-5 w-24" />
              <span className="vf-skeleton h-11 w-full" />
            </div>
            <div>
              <span className="vf-skeleton mb-1.5 h-5 w-12" />
              <span className="vf-skeleton h-11 w-full" />
            </div>
          </div>
          <div className="vf-calendar-result">
            <span className="vf-skeleton h-[1.125rem] w-32" />
            <span className="vf-skeleton mt-1 h-8 w-4/5" />
            {/* On a phone most days' titles take a second line. */}
            <span className="vf-skeleton mt-0.5 h-[1.6875rem] w-3/5 sm:hidden" />
            <span className="vf-skeleton mt-1 h-6 w-1/2" />
            <dl className="vf-facts">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="contents">
                  <dt>
                    <span className="vf-skeleton h-5 w-24" />
                  </dt>
                  <dd>
                    <span className="vf-skeleton h-[1.625rem] w-28" />
                  </dd>
                </div>
              ))}
            </dl>
            {/* The day's readings follow: the name of the Mass, then its first reading. */}
            <div className="vf-calendar-readings vf-calendar-readings-loading">
              <span className="vf-skeleton h-6 w-3/5" />
              <span className="vf-skeleton h-7 w-40" />
              <span className="vf-skeleton h-5 w-32" />
              <span className="vf-skeleton h-24 w-full" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
