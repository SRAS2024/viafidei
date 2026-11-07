import { ListSearch } from "@/components/ui/ListSearch";
import type { Translator } from "@/lib/i18n/translator";

import { HistoryYearSlider } from "./HistoryYearSlider";
import { HISTORY_PATH, historyHref, type HistoryLinkState } from "./historyUrl";
import {
  FILTER_KEYS,
  FILTER_LABELS,
  eraRange,
  eraRangeSpoken,
  formatCount,
  type HistoryView,
} from "./historyView";

type EraChoice = {
  key: string;
  name: string;
  years: string;
  yearsSpoken: string;
  count: number;
  href: string;
  current: boolean;
};

/**
 * One era choice: the name first, its years smaller, its count least of all.
 * An era with nothing under the current filters stays in its place in the grid,
 * so nothing jumps about, but is not a link to an empty list.
 */
function EraCell({ choice }: { choice: EraChoice }) {
  const inner = (
    <>
      <span className="vf-history-era-name">{choice.name}</span>
      <span className="vf-history-era-years" aria-hidden="true">
        {choice.years}
      </span>
      <span className="vf-history-era-count" aria-hidden="true">
        {formatCount(choice.count)}
      </span>
      <span className="sr-only">
        {`, ${choice.yearsSpoken}, `}
        {choice.count === 1 ? "1 event" : `${formatCount(choice.count)} events`}
      </span>
    </>
  );
  if (choice.count === 0 && !choice.current) {
    return <span className="vf-history-era vf-history-era-empty">{inner}</span>;
  }
  return (
    <a
      href={choice.href}
      aria-current={choice.current ? "true" : undefined}
      className={choice.current ? "vf-history-era vf-filter-active" : "vf-history-era"}
    >
      {inner}
    </a>
  );
}

function EraList({ choices }: { choices: EraChoice[] }) {
  return (
    <ul className="vf-history-eras">
      {choices.map((choice) => (
        <li key={choice.key}>
          <EraCell choice={choice} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Era choices. Wide screens show the whole grid; on a phone it folds into a
 * single native disclosure so the events appear soon. Only one of the two is
 * displayed at a time, and the hidden one is hidden from assistive technology.
 */
function EraChoices({
  view,
  base,
  firstLabel,
}: {
  view: HistoryView;
  base: HistoryLinkState;
  firstLabel: string;
}) {
  const maxYear = view.sliderMax;
  const choices: EraChoice[] = [
    {
      key: "all",
      name: "All eras",
      years: `${firstLabel}–today`,
      yearsSpoken: `from ${firstLabel} to today`,
      count: view.allErasCount,
      href: historyHref({ ...base, era: null }),
      current: view.era === null,
    },
    ...view.eraList.map((era) => ({
      key: era.key,
      name: era.label,
      years: eraRange(era, maxYear),
      yearsSpoken: eraRangeSpoken(era, maxYear),
      count: view.eraCounts[era.key] ?? 0,
      href: historyHref({ ...base, era: era.key }),
      current: view.era?.key === era.key,
    })),
  ];
  const current = choices.find((c) => c.current) ?? choices[0]!;
  return (
    <>
      <nav aria-label="Eras" className="vf-history-eras-grid">
        <EraList choices={choices} />
      </nav>
      <details data-history-menu className="vf-history-eras-fold">
        <summary className="vf-chip">
          <span className="min-w-0">
            <span className="vf-history-fold-label">Era: </span>
            {current.name}
          </span>
          <span className="vf-chip-count">
            {formatCount(current.count)}
            <span className="sr-only"> events</span>
          </span>
        </summary>
        <nav aria-label="Eras">
          <EraList choices={choices} />
        </nav>
      </details>
    </>
  );
}

/**
 * The theme filter, with the same labels, counts and look as <FilterChips>'
 * dropdown. It is a native disclosure rather than that component because this
 * page has to work with no script running. As in the dropdown, choosing the
 * active theme again clears it.
 */
function ThemeMenu({ view, base }: { view: HistoryView; base: HistoryLinkState }) {
  const filtered = view.theme !== "all";
  return (
    <details data-history-menu className="vf-history-menu">
      <summary className={filtered ? "vf-chip vf-filter-active" : "vf-chip"}>
        <span className="sr-only">Filter the timeline by theme: {filtered ? "" : "All"}</span>
        {filtered ? (
          <span>
            {FILTER_LABELS[view.theme]}{" "}
            <span className="vf-chip-count">
              {formatCount(view.themeCounts[view.theme])}
              <span className="sr-only"> events</span>
            </span>
          </span>
        ) : (
          <span aria-hidden="true">Filter</span>
        )}
      </summary>
      <ul className="vf-menu">
        {FILTER_KEYS.map((key) => {
          const active = key === view.theme;
          return (
            <li key={key}>
              <a
                href={historyHref({ ...base, theme: active ? "all" : key })}
                aria-current={active ? "true" : undefined}
                className="vf-menu-item"
              >
                <span className="min-w-0">{FILTER_LABELS[key]}</span>
                <span className="vf-chip-count">
                  {formatCount(view.themeCounts[key])}
                  <span className="sr-only"> events</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function OrderChoice({ view, base }: { view: HistoryView; base: HistoryLinkState }) {
  const order = view.params.order;
  return (
    <div role="group" aria-label="Order of events" className="vf-history-order">
      <a
        href={historyHref({ ...base, order: "oldest" })}
        aria-current={order === "oldest" ? "true" : undefined}
        className={order === "oldest" ? "vf-chip vf-filter-active" : "vf-chip"}
      >
        Oldest first
      </a>
      <a
        href={historyHref({ ...base, order: "newest" })}
        aria-current={order === "newest" ? "true" : undefined}
        className={order === "newest" ? "vf-chip vf-filter-active" : "vf-chip"}
      >
        Newest first
      </a>
    </div>
  );
}

/**
 * The control area, one composition: finding and filtering on one row, then the
 * eras in aligned rows, then the year.
 */
export function HistoryControls({
  view,
  firstLabel,
  t,
  locale,
}: {
  view: HistoryView;
  firstLabel: string;
  t: Translator;
  locale: string;
}) {
  const { theme, q } = view;
  const order = view.params.order;
  const base: HistoryLinkState = { era: view.era?.key, theme, q, order };
  return (
    <section aria-label="Find and filter events" className="vf-history-panel">
      <div className="vf-history-zone vf-history-tools">
        <ListSearch
          action={HISTORY_PATH}
          query={q}
          label="Find an event"
          keep={{
            era: view.era?.key,
            theme: theme === "all" ? null : theme,
            order: order === "newest" ? order : null,
          }}
          t={t}
          locale={locale}
        />
        <div className="vf-history-tools-end">
          <ThemeMenu view={view} base={base} />
          <OrderChoice view={view} base={base} />
        </div>
      </div>
      <div className="vf-history-zone">
        <EraChoices view={view} base={base} firstLabel={firstLabel} />
      </div>
      <div className="vf-history-zone">
        <HistoryYearSlider
          min={view.sliderMin}
          max={view.sliderMax}
          value={view.sliderYear}
          valueEraLabel={view.sliderEraLabel}
          eras={view.eraList.map(({ key, label, from, to }) => ({ key, label, from, to }))}
          keep={{ theme, q, order }}
        />
      </div>
    </section>
  );
}
