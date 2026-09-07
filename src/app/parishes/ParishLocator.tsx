"use client";

import Link from "next/link";
import { useState } from "react";

import { MapsAddressLink } from "@/components/ui/MapsAddressLink";
import { formatMiles } from "@/lib/content-shared/geo";
import { humanizeKey } from "@/lib/content-shared/field-presenters";
import type { ParishListItem } from "@/lib/data/published";

/** Human label for a stored designation; never the raw value. */
const DESIGNATION_LABEL: Readonly<Record<string, string>> = {
  parish: "Parish",
  shrine: "Shrine",
  cathedral: "Cathedral",
  basilica: "Basilica",
  "major-basilica": "Major Basilica",
  "minor-basilica": "Minor Basilica",
};

function designationLabel(designation: string): string {
  return DESIGNATION_LABEL[designation] ?? humanizeKey(designation || "parish");
}

type LocateState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "located"; items: ParishListItem[] }
  | { kind: "error"; message: string };

/**
 * The parish directory page, with an optional "parishes near me" view.
 *
 * The component receives ONE page of the directory (thirty projected rows) —
 * it used to receive every published parish and sort the whole array in the
 * browser, which at the directory's 200,000-record goal is tens of megabytes
 * of client props per visitor. When the visitor grants location access the
 * fifty nearest parishes are fetched from `/api/parishes/near`, which does the
 * bounding-box + haversine work in SQL. The coordinate is sent to this site's
 * own API and nowhere else, and is not stored.
 */
export function ParishLocator({ parishes, total }: { parishes: ParishListItem[]; total?: number }) {
  const [state, setState] = useState<LocateState>({ kind: "idle" });

  const nearby = state.kind === "located";
  const shown = nearby ? state.items : parishes;

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ kind: "error", message: "Location isn't available on this device." });
      return;
    }
    setState({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          try {
            const res = await fetch(
              `/api/parishes/near?lat=${encodeURIComponent(pos.coords.latitude)}&lng=${encodeURIComponent(
                pos.coords.longitude,
              )}&radiusMiles=50`,
            );
            if (!res.ok) throw new Error("near lookup failed");
            const data = (await res.json()) as { items?: ParishListItem[] };
            setState({ kind: "located", items: data.items ?? [] });
          } catch {
            // Fail open: the visitor keeps the directory they already have.
            setState({
              kind: "error",
              message: "We couldn't load parishes near you. The directory below still works.",
            });
          }
        })();
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. You can still browse the full directory below."
            : "We couldn't get your location. You can still browse the full directory below.";
        setState({ kind: "error", message });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={locate}
          disabled={state.kind === "locating"}
          className="vf-btn vf-btn-primary inline-flex items-center gap-2"
        >
          <LocationIcon />
          {state.kind === "locating" ? "Finding parishes near you…" : "Use my location"}
        </button>
        {nearby ? (
          <p className="text-xs text-ink-soft">
            {shown.length === 0
              ? "No parishes in our directory within 50 miles of you yet."
              : "The parishes nearest you, within 50 miles."}{" "}
            <button
              type="button"
              onClick={() => setState({ kind: "idle" })}
              className="vf-nav-link underline-offset-2"
            >
              Show the full directory
            </button>
          </p>
        ) : null}
        {state.kind === "error" ? (
          <p className="text-xs text-liturgical-red" role="status">
            {state.message}
          </p>
        ) : null}
        {!nearby && typeof total === "number" && total > parishes.length ? (
          <p className="text-xs text-ink-faint">
            {total.toLocaleString()} parishes in the directory.
          </p>
        ) : null}
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {shown.map((p) => (
          <li key={p.id}>
            <Link
              href={`/parishes/${p.slug}`}
              className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="vf-eyebrow">{designationLabel(p.designation)}</p>
                {typeof p.distanceMiles === "number" ? (
                  <span className="shrink-0 rounded-sm bg-liturgical-gold/15 px-2 py-0.5 text-[11px] font-medium text-ink">
                    {formatMiles(p.distanceMiles)}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">{p.title}</h2>
              {p.location ? (
                <MapsAddressLink
                  variant="inline"
                  address={p.location}
                  latitude={p.latitude ?? undefined}
                  longitude={p.longitude ?? undefined}
                  className="mt-3 inline-flex items-start gap-1.5 font-serif leading-relaxed text-liturgical-blue underline-offset-2 hover:underline"
                />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
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
