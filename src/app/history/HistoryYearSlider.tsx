"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { useHistoryNav } from "./HistoryShell";
import {
  HISTORY_PATH,
  HISTORY_YEAR_TARGET_ID,
  SLIDER_KEY_STEP,
  historyHref,
  type HistoryLinkState,
} from "./historyUrl";

export type SliderEra = { key: string; label: string; from: number; to: number };

type Props = {
  min: number;
  max: number;
  /** The year the server is showing. */
  value: number;
  /**
   * The era of the event the server is showing, which at a boundary year can be
   * the era it closes rather than the one that year opens.
   */
  valueEraLabel: string | null;
  eras: SliderEra[];
  /** Carried along when the list jumps: the theme, the search and the order. */
  keep: Pick<HistoryLinkState, "theme" | "q" | "order">;
};

/** How long after the last keypress the list follows the slider. */
const KEY_SETTLE_MS = 700;

/**
 * How long after the last change the list follows when neither a key nor a
 * pointer made it: VoiceOver's swipe moves a slider by a twentieth of its range
 * and then speaks the new value, and the reader should get to swipe again.
 */
const ASSISTED_SETTLE_MS = 1600;

function fixedAnchors(min: number, max: number): number[] {
  return [min, 500, 1000, 1500, max];
}

/**
 * Picks a year; the list jumps to it. The slider only reports where the reader
 * would like to be, and the server works out the era, the page and the row. The
 * readout follows the thumb live; the list moves when the thumb is let go, or
 * shortly after the last key. The typed box beside it is a plain GET form, so a
 * year can still be reached with no script running (the slider itself hides
 * then, since nothing could read it).
 *
 * The slider has no `step` attribute on purpose: the default step of 1 keeps it
 * on whole years, and WebKit moves a slider with no step attribute by 5% of its
 * range per VoiceOver swipe, a hundred years at a time. With `step="1"` written
 * out it would move one year per swipe, and nobody swipes 1,500 times to reach
 * the Reformation.
 */
export function HistoryYearSlider({ min, max, value, valueEraLabel, eras, keep }: Props) {
  const { navigate } = useHistoryNav();
  const [year, setYear] = useState(value);
  const held = useRef(false);
  const lastKeyAt = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelSettle = () => {
    if (settle.current) clearTimeout(settle.current);
    settle.current = null;
  };
  useEffect(() => cancelSettle, []);

  // Follow the server's view (another filter, a page, Back), unless the reader
  // has the thumb in hand or has a move still on its way.
  useEffect(() => {
    if (held.current || settle.current) return;
    setYear(value);
  }, [value]);

  const commit = (next: number) => {
    cancelSettle();
    // Already there: a press on the thumb that never moved it.
    if (next === value) return;
    // Repeated moves share one history entry, so Back returns to where the
    // reader was before they took up the slider.
    const replace = new URL(window.location.href).searchParams.has("year");
    navigate(historyHref({ ...keep, year: next }, HISTORY_YEAR_TARGET_ID), {
      landing: "target",
      replace,
    });
  };

  const commitSoon = (next: number, delay: number) => {
    cancelSettle();
    settle.current = setTimeout(() => {
      settle.current = null;
      commit(next);
    }, delay);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(year);
      return;
    }
    lastKeyAt.current = Date.now();
    const step = event.shiftKey ? 1 : SLIDER_KEY_STEP;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = year + step;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = year - step;
    if (next === null) return;
    event.preventDefault();
    // The list may have taken the page far from here; moving again brings the
    // slider, and its readout, back into view.
    event.currentTarget.scrollIntoView({ block: "nearest" });
    const clamped = Math.max(min, Math.min(max, next));
    setYear(clamped);
    commitSoon(clamped, KEY_SETTLE_MS);
  };

  const eraLabel =
    year === value && valueEraLabel
      ? valueEraLabel
      : (eras.find((e) => year >= e.from && year < e.to) ?? eras[eras.length - 1])?.label;
  const span = Math.max(1, max - min);
  const position = (y: number) => (y - min) / span;
  const placed = (y: number) => ({ "--p": position(y) }) as CSSProperties;
  const anchors = fixedAnchors(min, max);

  return (
    <div className="vf-history-year">
      <p className="vf-history-readout" aria-hidden="true">
        <span className="vf-history-readout-year">{year}</span>
        {eraLabel ? `, ${eraLabel}` : null}
      </p>
      <div className="vf-history-slider-wrap" style={placed(year)}>
        <input
          type="range"
          min={min}
          max={max}
          value={year}
          aria-label="Go to a year in Church history"
          aria-valuetext={eraLabel ? `${year}, ${eraLabel}` : String(year)}
          aria-describedby="history-year-hint"
          className="vf-history-slider"
          onChange={(event) => {
            const next = Number(event.target.value);
            setYear(next);
            if (held.current) return;
            // A key other than an arrow (Home, End, Page Up) arrives here too.
            const fromKey = Date.now() - lastKeyAt.current < 250;
            commitSoon(next, fromKey ? KEY_SETTLE_MS : ASSISTED_SETTLE_MS);
          }}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => {
            cancelSettle();
            held.current = true;
            const input = event.currentTarget;
            // On the window, because the pointer may be let go anywhere.
            const finish = (letGo: boolean) => {
              window.removeEventListener("pointerup", onUp);
              window.removeEventListener("pointercancel", onCancel);
              held.current = false;
              if (letGo) commit(Number(input.value));
              else setYear(value);
            };
            const onUp = () => finish(true);
            const onCancel = () => finish(false);
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onCancel);
          }}
        />
        <div className="vf-history-scale" aria-hidden="true">
          {eras
            .filter((e) => e.from > min && e.from < max)
            .map((e) => (
              <span key={e.key} className="vf-history-tick" style={placed(e.from)} />
            ))}
          {anchors.map((y, i) => (
            <span
              key={y}
              className={`vf-history-anchor ${
                i === 0
                  ? "vf-history-anchor-start"
                  : i === anchors.length - 1
                    ? "vf-history-anchor-end"
                    : i === 2
                      ? ""
                      : "vf-history-anchor-minor"
              }`}
              style={placed(y)}
            >
              {y}
            </span>
          ))}
        </div>
        <p id="history-year-hint" className="sr-only">
          Arrow keys move {SLIDER_KEY_STEP} years; hold Shift for one year at a time. The list jumps
          to the year you choose.
        </p>
      </div>
      <form
        method="get"
        action={`${HISTORY_PATH}#${HISTORY_YEAR_TARGET_ID}`}
        className="vf-history-goto"
      >
        {keep.theme && keep.theme !== "all" ? (
          <input type="hidden" name="theme" value={keep.theme} />
        ) : null}
        {keep.q ? <input type="hidden" name="q" value={keep.q} /> : null}
        {keep.order === "newest" ? <input type="hidden" name="order" value="newest" /> : null}
        <label htmlFor="history-year-input">Go to year</label>
        <input
          id="history-year-input"
          type="number"
          inputMode="numeric"
          name="year"
          min={min}
          max={max}
          required
          placeholder="Year"
          className="vf-input"
        />
        <button type="submit" className="vf-btn vf-btn-ghost vf-btn-sm">
          Go
        </button>
      </form>
    </div>
  );
}
