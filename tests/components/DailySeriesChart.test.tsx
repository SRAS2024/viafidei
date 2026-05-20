/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DailySeriesChart } from "@/components/diagnostics/DailySeriesChart";
import type { DailySeriesChartData } from "@/lib/data/seven-day-growth-report";

const DAYS = ["Wed 14", "Thu 15", "Fri 16", "Sat 17", "Sun 18", "Mon 19", "Tue 20"];

function chart(overrides: Partial<DailySeriesChartData> = {}): DailySeriesChartData {
  return {
    title: "Daily public package growth by content type",
    description: "New strict-public packages created each day, per content type.",
    mode: "count",
    dayLabels: DAYS,
    series: [
      { label: "Prayer", values: [1, 0, 2, 0, 3, 1, 4], summary: "11" },
      { label: "Saint", values: [0, 0, 0, 0, 0, 0, 0], summary: "0" },
    ],
    ...overrides,
  };
}

describe("DailySeriesChart", () => {
  it("renders the empty state when there are no series", () => {
    render(<DailySeriesChart chart={chart({ series: [] })} />);
    expect(screen.getByTestId("daily-series-empty")).toBeInTheDocument();
  });

  it("renders one row per series with its summary", () => {
    render(<DailySeriesChart chart={chart()} testId="chart-public-growth" />);
    expect(screen.getByTestId("chart-public-growth")).toBeInTheDocument();
    expect(screen.getByTestId("daily-series-row-Prayer")).toBeInTheDocument();
    expect(screen.getByTestId("daily-series-row-Saint")).toBeInTheDocument();
    expect(screen.getByTestId("daily-series-summary-Prayer")).toHaveTextContent("11");
  });

  it("renders the chart title and every day label", () => {
    render(<DailySeriesChart chart={chart()} />);
    expect(screen.getByText("Daily public package growth by content type")).toBeInTheDocument();
    for (const day of DAYS) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });

  it("renders a rate-mode chart with a percentage summary", () => {
    render(
      <DailySeriesChart
        chart={chart({
          title: "Daily source success rate by source",
          mode: "rate",
          series: [
            {
              label: "vatican.va",
              values: [100, 80, null, 90, 0, 75, 100],
              summary: "78%",
            },
          ],
        })}
      />,
    );
    expect(screen.getByTestId("daily-series-summary-vatican.va")).toHaveTextContent("78%");
  });
});
