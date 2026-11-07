/**
 * The calendar's placeholder: the same contained panel, with its controls and
 * facts reserved, so the result appears without moving the page.
 */
export function CalendarPanelSkeleton() {
  return (
    <div className="vf-calendar-panel" role="status" aria-busy="true">
      <span className="sr-only">Loading the calendar…</span>
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
          <div className="vf-calendar-links">
            <span className="vf-skeleton mb-2 h-5 w-24" />
            <span className="vf-skeleton h-10 w-48" />
          </div>
        </div>
      </div>
    </div>
  );
}
