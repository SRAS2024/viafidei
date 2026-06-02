"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Parish = {
  id: string;
  slug: string;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source?: "internal" | "osm";
};

type NearbyParish = { parish: Parish; distanceKm: number };

type Props = {
  parishes: Parish[];
  placeholder: string;
};

const STORAGE_PERMISSION_KEY = "vf-parish-location-permission";
const PAGE_SIZE = 9;
type StoredPermission = "granted" | "denied" | "prompt";

function PageButtons({
  page,
  totalPages,
  onSelect,
}: {
  page: number;
  totalPages: number;
  onSelect: (next: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages: Array<number | "…"> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    const left = Math.max(2, page - 1);
    const right = Math.min(totalPages - 1, page + 1);
    if (left > 2) pages.push("…");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("…");
    pages.push(totalPages);
  }
  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
      {pages.map((p, idx) => {
        if (p === "…") {
          return (
            <span
              key={`gap-${idx}`}
              aria-hidden="true"
              className="px-2 font-serif text-sm text-ink-faint"
            >
              …
            </span>
          );
        }
        const isCurrent = p === page;
        const classes = [
          "inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-sm border px-3 font-serif text-sm transition",
          isCurrent
            ? "border-ink/40 bg-ink/5 text-ink"
            : "border-ink/15 text-ink-soft hover:border-ink/30 hover:text-ink",
        ].join(" ");
        return (
          <button
            type="button"
            key={p}
            onClick={() => onSelect(p)}
            className={classes}
            aria-current={isCurrent ? "page" : undefined}
            aria-label={`Page ${p}`}
          >
            {p}
          </button>
        );
      })}
    </nav>
  );
}

function readStoredPermission(): StoredPermission {
  if (typeof window === "undefined") return "prompt";
  const v = window.localStorage.getItem(STORAGE_PERMISSION_KEY);
  if (v === "granted" || v === "denied") return v;
  return "prompt";
}

function writeStoredPermission(value: StoredPermission) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PERMISSION_KEY, value);
}

const NEARBY_RADIUS_KM = 25;
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Parish finder with three coordinated modes:
 *
 *   1. Nearby (geolocation): When the user opts in, queries
 *      `/api/parishes/near` which merges curated DB rows with a live
 *      OpenStreetMap fallback. The user is asked once and the answer is
 *      remembered locally so we don't re-prompt on every visit.
 *
 *   2. Local search: Substring filter on the in-memory catalog the page
 *      was server-rendered with. Instant and works offline.
 *
 *   3. Global search: When the local filter returns nothing (or the user
 *      keeps typing past 2 chars), we hit `/api/parishes/search` to look up
 *      parishes anywhere in the world via OpenStreetMap.
 *
 * Both internal and OSM-sourced rows are linked via /spiritual-guidance/[slug];
 * OSM-only rows use slugs of the form `osm-<type>-<id>`, and the detail page
 * recognizes that prefix and renders an external-listing layout.
 */
export function ParishList({ parishes, placeholder }: Props) {
  const [q, setQ] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [nearby, setNearby] = useState<NearbyParish[] | null>(null);
  const [globalResults, setGlobalResults] = useState<Parish[] | null>(null);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [storedPermission, setStoredPermission] = useState<StoredPermission>("prompt");
  const [searchPage, setSearchPage] = useState(1);
  const [catalogPage, setCatalogPage] = useState(1);
  const [nearbyPage, setNearbyPage] = useState(1);
  const lastSearchRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSearchPage(1);
  }, [q]);

  // First render: read persisted permission. If previously granted, silently
  // re-use the device location so we don't re-prompt on every visit.
  useEffect(() => {
    const stored = readStoredPermission();
    setStoredPermission(stored);
    if (stored !== "granted") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {
        // OS-level revocation — downgrade to "ask again next time".
        writeStoredPermission("prompt");
        setStoredPermission("prompt");
      },
      { maximumAge: 5 * 60 * 1000, timeout: 7000 },
    );
  }, []);

  useEffect(() => {
    if (!coords) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/parishes/near?lat=${coords.lat}&lon=${coords.lon}&radiusKm=${NEARBY_RADIUS_KM}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items?: NearbyParish[] };
        if (Array.isArray(data.items)) setNearby(data.items);
      } catch {
        /* swallow abort/network errors */
      }
    })();
    return () => controller.abort();
  }, [coords]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return parishes;
    return parishes.filter((p) => {
      return (
        p.name.toLowerCase().includes(term) ||
        (p.city ?? "").toLowerCase().includes(term) ||
        (p.region ?? "").toLowerCase().includes(term) ||
        (p.country ?? "").toLowerCase().includes(term) ||
        (p.address ?? "").toLowerCase().includes(term)
      );
    });
  }, [parishes, q]);

  // Global search via /api/parishes/search — debounced.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setGlobalResults(null);
      setSearchingGlobal(false);
      lastSearchRef.current?.abort();
      return;
    }
    setSearchingGlobal(true);
    const controller = new AbortController();
    lastSearchRef.current?.abort();
    lastSearchRef.current = controller;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/parishes/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setGlobalResults([]);
          return;
        }
        const data = (await res.json()) as { items?: Parish[] };
        setGlobalResults(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setGlobalResults([]);
      } finally {
        setSearchingGlobal(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  function requestLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Your browser does not support geolocation.");
      return;
    }
    setLoadingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        writeStoredPermission("granted");
        setStoredPermission("granted");
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLoadingLocation(false);
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        writeStoredPermission(denied ? "denied" : "prompt");
        setStoredPermission(denied ? "denied" : "prompt");
        setLocationError(
          denied
            ? "Location permission was declined. You can still search by name or city below."
            : "Could not determine your location. Try again or search manually.",
        );
        setLoadingLocation(false);
      },
      { maximumAge: 5 * 60 * 1000, timeout: 10000 },
    );
  }

  // The locator combines results from three places. Display priority:
  //   - When the user is typing: show the merged search result (local + global)
  //   - When idle and coords exist: show "Parishes near you" then full catalog
  //   - When idle: show full catalog
  const showNearby = !!nearby && !q.trim();
  const showNearbyPrompt = !coords && storedPermission === "prompt";

  // The displayed list when the user is searching: union of local-filtered
  // results and any OSM matches we found, dedup'd by slug.
  const searchResults = useMemo(() => {
    if (!q.trim()) return null;
    const seen = new Set<string>();
    const out: Parish[] = [];
    for (const p of filtered) {
      if (seen.has(p.slug)) continue;
      seen.add(p.slug);
      out.push(p);
    }
    if (globalResults) {
      for (const p of globalResults) {
        if (seen.has(p.slug)) continue;
        seen.add(p.slug);
        out.push(p);
      }
    }
    return out;
  }, [q, filtered, globalResults]);

  return (
    <>
      <div className="mx-auto mb-6 max-w-lg">
        <input
          className="vf-input"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search parishes by name, city, or region"
        />
        {searchingGlobal ? (
          <p className="mt-2 text-center font-serif text-xs text-ink-faint">
            Searching parishes worldwide…
          </p>
        ) : null}
      </div>

      {showNearbyPrompt ? (
        <div className="mx-auto mb-8 max-w-lg vf-card rounded-sm p-4 text-center">
          <p className="font-serif text-sm text-ink-soft">
            Find parishes near you. We&rsquo;ll only ask for location once.
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              type="button"
              className="vf-btn vf-btn-primary"
              onClick={requestLocation}
              disabled={loadingLocation}
            >
              {loadingLocation ? "Locating…" : "Use my location"}
            </button>
            <button
              type="button"
              className="vf-btn vf-btn-cancel"
              onClick={() => {
                writeStoredPermission("denied");
                setStoredPermission("denied");
                setLocationError(null);
              }}
            >
              Not now
            </button>
          </div>
          {locationError ? (
            <p className="mt-3 font-serif text-xs text-ink-faint">{locationError}</p>
          ) : null}
        </div>
      ) : null}

      {showNearby && nearby && nearby.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-4 font-display text-2xl">Parishes near you</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {nearby.slice((nearbyPage - 1) * PAGE_SIZE, nearbyPage * PAGE_SIZE).map((entry) => (
              <ParishCard
                key={entry.parish.slug}
                parish={entry.parish}
                distanceKm={entry.distanceKm}
              />
            ))}
          </div>
          <PageButtons
            page={nearbyPage}
            totalPages={Math.max(1, Math.ceil(nearby.length / PAGE_SIZE))}
            onSelect={setNearbyPage}
          />
        </section>
      ) : null}

      {searchResults ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {searchResults.length === 0 ? (
              <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
                {searchingGlobal ? (
                  <p>Searching…</p>
                ) : (
                  <>
                    <p>No parishes match your search.</p>
                    <p className="mt-2 text-xs">Try a different city, region, or country.</p>
                  </>
                )}
              </div>
            ) : (
              searchResults
                .slice((searchPage - 1) * PAGE_SIZE, searchPage * PAGE_SIZE)
                .map((p) => <ParishCard key={p.slug} parish={p} />)
            )}
          </div>
          <PageButtons
            page={searchPage}
            totalPages={Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE))}
            onSelect={setSearchPage}
          />
        </>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {parishes.length === 0 ? (
              <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
                {coords
                  ? "No parishes found nearby. Try increasing the search radius or searching by city."
                  : "Use your device location, or type a city, region, or country to find parishes worldwide."}
              </div>
            ) : (
              parishes
                .slice((catalogPage - 1) * PAGE_SIZE, catalogPage * PAGE_SIZE)
                .map((p) => <ParishCard key={p.slug} parish={p} />)
            )}
          </div>
          <PageButtons
            page={catalogPage}
            totalPages={Math.max(1, Math.ceil(parishes.length / PAGE_SIZE))}
            onSelect={setCatalogPage}
          />
        </>
      )}
    </>
  );
}

function ParishCard({ parish, distanceKm }: { parish: Parish; distanceKm?: number }) {
  const location = [parish.address, parish.city, parish.region, parish.country]
    .filter(Boolean)
    .join(", ");
  return (
    <Link href={`/spiritual-guidance/${parish.slug}`}>
      <article className="vf-card h-full rounded-sm p-5 transition hover:border-ink/30 hover:-translate-y-0.5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-words font-display text-xl sm:text-2xl">{parish.name}</h3>
          {typeof distanceKm === "number" ? (
            <span className="shrink-0 font-serif text-xs text-ink-faint">
              {distanceKm.toFixed(1)} km
            </span>
          ) : null}
        </div>
        {location ? <p className="mt-2 break-words font-serif text-ink-soft">{location}</p> : null}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-faint">
          {parish.phone ? <span className="break-all">{parish.phone}</span> : null}
          {parish.websiteUrl ? (
            <span className="underline underline-offset-4">Website ↗</span>
          ) : null}
          {parish.source === "osm" ? (
            <span className="rounded-full border border-ink/15 px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-ink-faint">
              OSM
            </span>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
