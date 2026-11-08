import { ListSearch } from "@/components/ui/ListSearch";
import { tPlural } from "@/lib/i18n/plural";
import type { Translator } from "@/lib/i18n/translator";

import { HistoryYearSlider } from "./HistoryYearSlider";
import { HISTORY_PATH, SLIDER_KEY_STEP, historyHref, type HistoryLinkState } from "./historyUrl";
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
  /** "35 events", in the reader's language and its plural. */
  countSpoken: string;
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
        {choice.countSpoken}
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
    <ul role="list" className="vf-history-eras">
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
  t,
  locale,
}: {
  view: HistoryView;
  base: HistoryLinkState;
  firstLabel: string;
  t: Translator;
  locale: string;
}) {
  const maxYear = view.sliderMax;
  const spokenCount = (count: number) => tPlural(t, locale, "history.eventCount", count);
  const choices: EraChoice[] = [
    {
      key: "all",
      name: t("history.era.all"),
      years: `${firstLabel}–today`,
      yearsSpoken: t("history.era.spokenToToday", { from: firstLabel }),
      count: view.allErasCount,
      countSpoken: spokenCount(view.allErasCount),
      href: historyHref({ ...base, era: null }),
      current: view.era === null,
    },
    ...view.eraList.map((era) => ({
      key: era.key,
      name: era.label,
      years: eraRange(era, maxYear),
      yearsSpoken: eraRangeSpoken(era, maxYear, t),
      count: view.eraCounts[era.key] ?? 0,
      countSpoken: spokenCount(view.eraCounts[era.key] ?? 0),
      href: historyHref({ ...base, era: era.key }),
      current: view.era?.key === era.key,
    })),
  ];
  const current = choices.find((c) => c.current) ?? choices[0]!;
  return (
    <>
      <nav aria-label={t("history.eras.nav")} className="vf-history-eras-grid">
        <EraList choices={choices} />
      </nav>
      <details data-history-menu className="vf-history-eras-fold">
        <summary className="vf-chip">
          <span className="min-w-0">
            <span className="vf-history-fold-label">{t("history.era.prefix")} </span>
            {current.name}
          </span>
          <span className="vf-chip-count">
            {formatCount(current.count)}
            <span className="sr-only"> events</span>
          </span>
        </summary>
        <nav aria-label={t("history.eras.nav")}>
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
function ThemeMenu({
  view,
  base,
  t,
}: {
  view: HistoryView;
  base: HistoryLinkState;
  t: Translator;
}) {
  const filtered = view.theme !== "all";
  return (
    <details data-history-menu className="vf-history-menu">
      <summary className={filtered ? "vf-chip vf-filter-active" : "vf-chip"}>
        <span className="sr-only">
          {t("history.theme.menu")} {filtered ? "" : t("history.theme.all")}
        </span>
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
      {/* role="list": Safari drops the role from a list with no markers. */}
      <ul role="list" className="vf-menu">
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

function OrderChoice({
  view,
  base,
  t,
}: {
  view: HistoryView;
  base: HistoryLinkState;
  t: Translator;
}) {
  const order = view.params.order;
  return (
    <div role="group" aria-label={t("history.order.label")} className="vf-history-order">
      <a
        href={historyHref({ ...base, order: "oldest" })}
        aria-current={order === "oldest" ? "true" : undefined}
        className={order === "oldest" ? "vf-chip vf-filter-active" : "vf-chip"}
      >
        {t("history.order.oldest")}
      </a>
      <a
        href={historyHref({ ...base, order: "newest" })}
        aria-current={order === "newest" ? "true" : undefined}
        className={order === "newest" ? "vf-chip vf-filter-active" : "vf-chip"}
      >
        {t("history.order.newest")}
      </a>
    </div>
  );
}

/**
 * The control area, one composition: finding and filtering on one row, then the
 * eras in aligned rows, then the year. The year joins the box above without being
 * inside it, because it has to be able to stay in view all the way down the list
 * while the slider is in use, and a sticky box goes no further than its parent.
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
    <>
      <section aria-label={t("history.find.region")} className="vf-history-panel vf-history-find">
        <div className="vf-history-zone vf-history-tools">
          <ListSearch
            action={HISTORY_PATH}
            query={q}
            label={t("history.find.search")}
            keep={{
              era: view.era?.key,
              theme: theme === "all" ? null : theme,
              order: order === "newest" ? order : null,
            }}
            t={t}
            locale={locale}
          />
          <div className="vf-history-tools-end">
            <ThemeMenu view={view} base={base} t={t} />
            <OrderChoice view={view} base={base} t={t} />
          </div>
        </div>
        <div className="vf-history-zone">
          <EraChoices view={view} base={base} firstLabel={firstLabel} t={t} locale={locale} />
        </div>
      </section>
      <HistoryYearSlider
        min={view.sliderMin}
        max={view.sliderMax}
        value={view.sliderYear}
        valueEraLabel={view.sliderEraLabel}
        eras={view.eraList.map(({ key, label, from, to }) => ({ key, label, from, to }))}
        keep={{ theme, q, order }}
        labels={{
          box: t("history.yearBox"),
          hint: t("history.sliderHint", { years: SLIDER_KEY_STEP }),
          slider: t("history.slider.label"),
          input: t("history.slider.input"),
          go: t("history.slider.go"),
        }}
      />
    </>
  );
}
