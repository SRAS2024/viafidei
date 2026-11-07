const SECTIONS = [
  { lines: 7, verse: false },
  { lines: 5, verse: true },
  { lines: 7, verse: false },
  { lines: 8, verse: false },
];

/**
 * The readings page's own placeholder: the same column, compact header and reading
 * sections as the finished page, so the text arrives without the page rearranging.
 */
export default function DailyReadingsLoading() {
  return (
    <div role="status" aria-busy="true" className="vf-detail" data-testid="readings-loading">
      <span className="sr-only">Loading the readings of the day…</span>
      <div aria-hidden="true">
        <div className="vf-detail-header">
          <p className="vf-eyebrow">Daily Readings</p>
          <span className="vf-skeleton mt-2 h-12 w-4/5" />
          <span className="vf-skeleton mt-3 h-6 w-3/5" />
          <span className="vf-skeleton mt-3 h-4 w-3/4" />
          <span className="vf-skeleton mt-1 h-4 w-1/2" />
          <span className="vf-skeleton mt-3.5 h-10 w-24" />
        </div>
        <div className="vf-readings">
          {SECTIONS.map((section, i) => (
            <div key={i} className="vf-detail-section vf-reading-section">
              <span className="vf-skeleton h-7 w-2/5" />
              <span className="vf-skeleton mb-3 mt-1.5 h-4 w-1/4" />
              <div className="space-y-2.5">
                {Array.from({ length: section.lines }).map((_, l) => (
                  <span
                    key={l}
                    className={`vf-skeleton h-5 ${
                      section.verse
                        ? l % 2 === 0
                          ? "w-11/12"
                          : "w-3/4"
                        : l === section.lines - 1
                          ? "w-2/3"
                          : "w-full"
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
