import type { DailySeriesChartData } from "@/lib/data/seven-day-growth-report";

/**
 * Server-rendered daily-series chart.
 *
 * One row per series; each row is a seven-bar SVG sparkline. `count`
 * mode scales bars to the chart-wide maximum; `rate` mode scales each
 * bar 0–100%. A day with no data (`null`) renders as the faint track
 * only. No client JavaScript — the chart is plain SVG.
 */

const BAR_W = 14;
const BAR_GAP = 4;
const CHART_H = 34;

function svgWidth(days: number): number {
  return days * BAR_W + Math.max(0, days - 1) * BAR_GAP;
}

export function DailySeriesChart({
  chart,
  testId,
}: {
  chart: DailySeriesChartData;
  testId?: string;
}) {
  const days = chart.dayLabels.length;
  const width = svgWidth(days);

  let chartMax = 1;
  if (chart.mode === "count") {
    for (const s of chart.series) {
      for (const v of s.values) {
        if (typeof v === "number" && v > chartMax) chartMax = v;
      }
    }
  }

  const barHeight = (value: number): number => {
    const ratio = chart.mode === "rate" ? Math.min(1, value / 100) : value / chartMax;
    const raw = Math.round(ratio * CHART_H);
    // Keep a non-zero value visible as a 2px stub.
    return value > 0 ? Math.max(2, raw) : 0;
  };

  return (
    <div
      className="rounded-2xl border border-ink/10 bg-paper p-4"
      data-testid={testId ?? "daily-series-chart"}
    >
      <h3 className="font-display text-lg text-ink">{chart.title}</h3>
      <p className="mt-1 font-serif text-xs text-ink-soft">{chart.description}</p>

      {chart.series.length === 0 ? (
        <p className="mt-4 font-mono text-xs text-ink-faint" data-testid="daily-series-empty">
          No activity in the last 7 days.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div className="min-w-max font-mono text-xs">
            {/* Day-label header, aligned to each bar centre. */}
            <div className="flex items-end gap-3 pb-1">
              <span className="w-36 shrink-0" />
              <svg width={width} height={14} aria-hidden="true">
                {chart.dayLabels.map((label, i) => (
                  <text
                    key={i}
                    x={i * (BAR_W + BAR_GAP) + BAR_W / 2}
                    y={10}
                    textAnchor="middle"
                    className="fill-ink-faint"
                    style={{ fontSize: 8 }}
                  >
                    {label}
                  </text>
                ))}
              </svg>
              <span className="w-14 shrink-0" />
            </div>

            {chart.series.map((series) => (
              <div
                key={series.label}
                className="flex items-center gap-3 border-t border-ink/5 py-1"
                data-testid={`daily-series-row-${series.label}`}
              >
                <span className="w-36 shrink-0 truncate text-ink-soft" title={series.label}>
                  {series.label}
                </span>
                <svg
                  width={width}
                  height={CHART_H}
                  role="img"
                  aria-label={`${series.label}: ${series.summary}`}
                >
                  {series.values.map((value, i) => {
                    const x = i * (BAR_W + BAR_GAP);
                    const h = value == null ? 0 : barHeight(value);
                    return (
                      <g key={i}>
                        <rect
                          x={x}
                          y={0}
                          width={BAR_W}
                          height={CHART_H}
                          rx={2}
                          fill="currentColor"
                          className="text-ink/10"
                        />
                        {h > 0 ? (
                          <rect
                            x={x}
                            y={CHART_H - h}
                            width={BAR_W}
                            height={h}
                            rx={2}
                            fill="currentColor"
                            className={
                              chart.mode === "rate" ? "text-liturgical-blue" : "text-ink/70"
                            }
                          />
                        ) : null}
                      </g>
                    );
                  })}
                </svg>
                <span
                  className="w-14 shrink-0 text-right tabular-nums text-ink"
                  data-testid={`daily-series-summary-${series.label}`}
                >
                  {series.summary}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
