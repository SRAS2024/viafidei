"use client";

import { useRef, useState, type ReactNode } from "react";

import { ParishCard } from "@/components/ui/ParishCard";
import {
  formatDistanceAway,
  formatRadius,
  navigatorLocales,
  parishDistanceMiles,
  resolveDistanceDisplay,
  type DistanceDisplay,
} from "@/lib/content-shared/distance";
import {
  COARSE_FIX,
  GEO_PERMISSION_DENIED,
  GEO_TIMEOUT,
  PRECISE_FIX,
  detectLocationPlatform,
  isRetryableGeoError,
  readGeolocationPermission,
  type LocationPlatform,
  type NavigatorLike,
} from "@/lib/content-shared/geolocation";
import type { ParishListItem } from "@/lib/data/published";

import type { LocatorLabels } from "./locator-labels";

/** What the button asks for first; the API widens from here on its own. */
const REQUESTED_RADIUS_MILES = 50;

type Located = {
  kind: "located";
  items: ParishListItem[];
  /** The visitor's own fix, kept only to label distances in this render. */
  origin: { latitude: number; longitude: number };
  /**
   * Units and wording, decided once from the site language and the browser's
   * own language list: metric outside English, and miles only for US English.
   */
  display: DistanceDisplay;
  requestedRadiusMiles: number;
  /** The radius that actually answered; null when the search was unlimited. */
  radiusMiles: number | null;
  widened: boolean;
};

/** Why the last tap did not end in a list of nearby parishes. */
type Problem =
  | "blocked"
  | "notShared"
  | "timeout"
  | "unavailable"
  | "unsupported"
  | "insecure"
  | "lookupFailed";

type LocateState =
  | { kind: "idle" }
  | { kind: "locating" }
  | Located
  | { kind: "problem"; problem: Problem; platform: LocationPlatform };

/**
 * Problems another tap can fix, so they get a Try again button. A browser with
 * no geolocation, or a page on plain http, will refuse every time.
 */
const RETRYABLE: ReadonlySet<Problem> = new Set<Problem>([
  "blocked",
  "notShared",
  "timeout",
  "unavailable",
  "lookupFailed",
]);

function problemMessage(problem: Problem, labels: LocatorLabels): string {
  switch (problem) {
    case "blocked":
      return labels.blocked;
    case "notShared":
      return labels.notShared;
    case "timeout":
      return labels.timeout;
    case "unsupported":
      return labels.unsupported;
    case "insecure":
      return labels.insecure;
    case "lookupFailed":
      return labels.lookupFailed;
    default:
      return labels.unavailable;
  }
}

/** Where location is switched back on, in the order worth checking. */
function stepsFor(platform: LocationPlatform, labels: LocatorLabels): string[] {
  const steps = labels.steps;
  switch (platform) {
    case "ios-safari":
      return [steps.iosSafariSettings, steps.iosSafariSite];
    case "ios-other":
      return [steps.iosOtherSettings];
    case "android":
      return [steps.androidSite, steps.androidDevice];
    default:
      return [steps.desktopSite, steps.desktopDevice];
  }
}

/**
 * What the visitor is told after a located search. Sparse coverage must never
 * present as a blank list: either the requested radius answered, or we say
 * plainly that it did not and that these are the nearest parishes instead.
 */
function locatedMessage(s: Located): string {
  if (s.items.length === 0) {
    return "We don't have any parishes in the directory yet. Check back soon.";
  }
  const units = s.display.system;
  const asked = formatRadius(s.requestedRadiusMiles, units) ?? `${s.requestedRadiusMiles} miles`;
  if (!s.widened) return `The parishes nearest you, within ${asked}.`;
  const lead = `No parishes within ${asked} yet.`;
  if (s.radiusMiles === null) return `${lead} Here are the nearest ones we have.`;
  const widened = formatRadius(s.radiusMiles, units) ?? `${s.radiusMiles} miles`;
  return `${lead} Here are the nearest ones, within ${widened}.`;
}

/**
 * The parish directory page, with an optional "parishes near me" view.
 *
 * The component receives ONE page of the directory (thirty projected rows) —
 * it used to receive every published parish and sort the whole array in the
 * browser, which at the directory's 200,000-record goal is tens of megabytes
 * of client props per visitor. When the visitor grants location access the
 * fifty nearest parishes are fetched from `/api/parishes/near`, which does the
 * bounding-box + haversine work in SQL and widens the radius by itself when
 * nothing is close. The coordinate is sent to this site's own API and nowhere
 * else, is never written down, and is held in this component's state only for
 * as long as the "near me" view is on screen.
 *
 * Every tap of "Use my location" asks the device, from inside the tap itself:
 * iOS shows its Allow / Don't Allow sheet only for a request made during a
 * user gesture, and a device that already allows the site simply answers.
 * Nothing is remembered between taps — not an earlier refusal, not a stored
 * flag, not the Permissions API's opinion — because the visitor may have just
 * changed the setting, and a button that answers "denied" without asking is
 * exactly the failure this replaced. The Permissions API is read only after a
 * refusal, to say whether the browser has the site blocked or the device
 * simply did not share, followed by where this platform keeps the switch.
 */
export function ParishLocator({
  parishes,
  total,
  locale,
  awayTemplate,
  labels,
  empty,
}: {
  parishes: ParishListItem[];
  total?: number;
  /** The site language (`vf_locale` cookie, else Accept-Language); English if absent. */
  locale?: string;
  /** The dictionary's `parishes.distanceAway` phrase in that language. */
  awayTemplate?: string;
  /** The control's words in that language (`parishLocatorLabels`). */
  labels: LocatorLabels;
  /** Shown in place of the directory when this page of it has no parishes. */
  empty?: ReactNode;
}) {
  const [state, setState] = useState<LocateState>({ kind: "idle" });
  // Each tap is a new attempt; an answer that arrives for an older one is dropped.
  const attemptRef = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const located = state.kind === "located" ? state : null;
  const problem = state.kind === "problem" ? state : null;
  const shown = located ? located.items : parishes;

  const locate = () => {
    const attempt = ++attemptRef.current;
    const isCurrent = () => attempt === attemptRef.current;
    const nav = typeof navigator === "undefined" ? undefined : navigator;
    const platform = detectLocationPlatform(nav as NavigatorLike | undefined);
    const fail = (reason: Problem) => setState({ kind: "problem", problem: reason, platform });

    // A page served over plain http is never given a position; say so rather
    // than blame a setting the visitor cannot find.
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      fail("insecure");
      return;
    }
    const geolocation: Geolocation | undefined = nav?.geolocation;
    if (!geolocation || typeof geolocation.getCurrentPosition !== "function") {
      fail("unsupported");
      return;
    }
    const device: Geolocation = geolocation;
    // Read once, here rather than at render: the component is server-rendered
    // too, and there is no navigator on the server to hydrate against.
    const display = resolveDistanceDisplay(locale, navigatorLocales(nav));
    setState({ kind: "locating" });

    const showNearby = async (pos: GeolocationPosition) => {
      const origin = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      try {
        const res = await fetch(
          `/api/parishes/near?lat=${encodeURIComponent(origin.latitude)}&lng=${encodeURIComponent(
            origin.longitude,
          )}&radiusMiles=${REQUESTED_RADIUS_MILES}`,
        );
        if (!res.ok) throw new Error("near lookup failed");
        const data = (await res.json()) as {
          items?: ParishListItem[];
          requestedRadiusMiles?: number;
          radiusMiles?: number | null;
          widened?: boolean;
        };
        if (!isCurrent()) return;
        setState({
          kind: "located",
          items: data.items ?? [],
          origin,
          display,
          requestedRadiusMiles: data.requestedRadiusMiles ?? REQUESTED_RADIUS_MILES,
          radiusMiles: data.radiusMiles === undefined ? REQUESTED_RADIUS_MILES : data.radiusMiles,
          widened: data.widened === true,
        });
      } catch {
        // Fail open: the visitor keeps the directory they already have.
        if (isCurrent()) fail("lookupFailed");
      }
    };

    const refused = (err: GeolocationPositionError | null, retried: boolean) => {
      if (!isCurrent()) return;
      const code = err?.code;
      // No fix in time, or none at all: ask once more, coarse and patient,
      // before telling the visitor anything.
      if (!retried && isRetryableGeoError(code)) {
        ask(COARSE_FIX, true);
        return;
      }
      if (code === GEO_PERMISSION_DENIED) {
        void readGeolocationPermission(nav as NavigatorLike | undefined).then((permission) => {
          if (isCurrent()) fail(permission === "denied" ? "blocked" : "notShared");
        });
        return;
      }
      fail(code === GEO_TIMEOUT ? "timeout" : "unavailable");
    };

    function ask(options: PositionOptions, retried: boolean) {
      try {
        device.getCurrentPosition(
          (pos) => {
            if (isCurrent()) void showNearby(pos);
          },
          (err) => refused(err, retried),
          options,
        );
      } catch {
        refused(null, retried);
      }
    }

    // Synchronously, inside the tap: this call is what puts the Allow sheet
    // on an iPhone's screen.
    ask(PRECISE_FIX, false);
  };

  const tryAgain = () => {
    // The Try again button leaves with the message; keep keyboard focus on
    // the control that stays.
    buttonRef.current?.focus();
    locate();
  };

  const steps =
    problem && (problem.problem === "blocked" || problem.problem === "notShared")
      ? stepsFor(problem.platform, labels)
      : [];

  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-2">
        {/* Never disabled and never renamed: a tap while an earlier ask is
            still open simply asks again, and the name a screen reader
            announced is the name that stays focused. */}
        <button
          ref={buttonRef}
          type="button"
          onClick={locate}
          className="vf-btn vf-btn-primary inline-flex items-center gap-2"
        >
          <LocationIcon />
          {labels.button}
        </button>
        {/* Always in the page, so a screen reader hears each new answer. */}
        <div role="status" aria-live="polite" className="w-full max-w-xl text-center">
          {state.kind === "locating" ? (
            <p className="text-xs text-ink-soft">{labels.locating}</p>
          ) : null}
          {problem ? (
            <div className="rounded-sm border border-ink/20 bg-ink/5 p-4 text-left text-sm">
              <p className="font-serif text-ink">{problemMessage(problem.problem, labels)}</p>
              {steps.length > 0 ? (
                <>
                  <p className="mt-3 font-sans text-xs uppercase tracking-liturgical text-ink-faint">
                    {labels.howTo}
                  </p>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 font-serif text-ink-soft">
                    {steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        {problem && RETRYABLE.has(problem.problem) ? (
          <button type="button" onClick={tryAgain} className="vf-btn vf-btn-ghost">
            {labels.tryAgain}
          </button>
        ) : null}
        {located ? (
          <p className="text-xs text-ink-soft">
            {locatedMessage(located)}{" "}
            <button
              type="button"
              onClick={() => {
                attemptRef.current += 1;
                setState({ kind: "idle" });
              }}
              className="vf-nav-link underline-offset-2"
            >
              Show the full directory
            </button>
          </p>
        ) : null}
        {!located && typeof total === "number" && total > parishes.length ? (
          <p className="text-xs text-ink-faint">
            {total.toLocaleString()} parishes in the directory.
          </p>
        ) : null}
      </div>

      {!located && shown.length === 0 && empty ? (
        empty
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((p) => {
            // Only ever shown once the visitor has located themselves — the plain
            // directory has no origin to measure from and no distance to claim.
            const away = located ? distanceAway(located, p, awayTemplate) : null;
            return (
              <li key={p.id}>
                <ParishCard
                  name={p.title}
                  href={`/parishes/${p.slug}`}
                  designation={p.designation}
                  address={p.address}
                  postalCode={p.postalCode}
                  city={p.city}
                  state={p.state}
                  country={p.country}
                  countryCode={p.countryCode}
                  latitude={p.latitude}
                  longitude={p.longitude}
                  distanceSlot={
                    away ? <span className="font-serif text-sm text-ink-soft">{away}</span> : null
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * "800 ft away" / "A 2,4 km de distância", recomputed by haversine from the
 * visitor's own fix. The API's SQL distance is the fallback for a row whose
 * stored coordinate did not come back with the projection.
 */
function distanceAway(state: Located, p: ParishListItem, template?: string): string | null {
  const miles =
    parishDistanceMiles(state.origin, {
      latitude: p.latitude ?? undefined,
      longitude: p.longitude ?? undefined,
    }) ?? p.distanceMiles;
  return formatDistanceAway(miles, state.display, template);
}

function LocationIcon() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
