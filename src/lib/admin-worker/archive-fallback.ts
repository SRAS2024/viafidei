/**
 * Internet Archive (Wayback Machine) fetch fallback — keyless, free, public.
 *
 * The worker's most-observed live-pipeline stalls are dead or walled pages:
 * vatican.va URLs that 404 after a site reorganisation, articles that moved
 * behind a login. The page usually still EXISTS — in the Internet Archive.
 * When a fetch fails with an HTTP error (or hits a login wall), this fallback
 * asks the Wayback availability API for the most recent snapshot of that exact
 * URL and serves the archived body instead, so the artifact keeps moving
 * instead of parking in repair.
 *
 * Accuracy: the snapshot is the same document from the same authoritative host,
 * served verbatim by the archive — the content still faces extraction,
 * cross-source verification, and strict QA exactly like a live page. The
 * `finalUrl` is the web.archive.org URL so provenance/citations honestly show
 * where the bytes came from. Keyless, network-gated (no-op offline), on by
 * default (ADMIN_WORKER_ARCHIVE_FALLBACK=0 opts out), and fail-open: any error
 * just means "no fallback".
 */

const AVAILABILITY_ENDPOINT = "https://archive.org/wayback/available";
const TIMEOUT_MS = 12_000;
const MIN_BODY_BYTES = 400;

/** Keyless + on by default; disabled in skip-network and via opt-out env. */
export function archiveFallbackEnabled(): boolean {
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return false;
  const v = (process.env.ADMIN_WORKER_ARCHIVE_FALLBACK ?? "").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

interface AvailabilityResponse {
  archived_snapshots?: {
    closest?: { available?: boolean; url?: string; timestamp?: string; status?: string };
  };
}

/**
 * Ask the Wayback availability API for the most recent snapshot of a URL.
 * Returns the raw-content snapshot URL (the `id_` form, which serves the
 * original bytes without the Wayback toolbar), or null. Never throws.
 */
export async function findArchivedSnapshotUrl(url: string): Promise<string | null> {
  if (!archiveFallbackEnabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${AVAILABILITY_ENDPOINT}?url=${encodeURIComponent(url)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AvailabilityResponse;
    const closest = data.archived_snapshots?.closest;
    if (!closest?.available || !closest.timestamp) return null;
    if (closest.status && !/^2/.test(closest.status)) return null;
    return `https://web.archive.org/web/${closest.timestamp}id_/${url}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface ArchivedPage {
  /** The web.archive.org URL the body was served from. */
  archiveUrl: string;
  httpStatus: number;
  contentType: string | null;
  body: string;
}

/**
 * Fetch the most recent archived snapshot of a URL. Returns null when the
 * fallback is disabled, no snapshot exists, the snapshot fails to fetch, or
 * the body is too small to be a real page. Never throws.
 */
export async function fetchArchivedPage(url: string): Promise<ArchivedPage | null> {
  const archiveUrl = await findArchivedSnapshotUrl(url);
  if (!archiveUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(archiveUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type");
    // The archive serves the original bytes; only text is usable here (PDFs in
    // the archive are rare for our sources and the live PDF path covers them).
    if (contentType && !/text|html|xml|json/i.test(contentType)) return null;
    const body = await res.text();
    if (Buffer.byteLength(body, "utf8") < MIN_BODY_BYTES) return null;
    return { archiveUrl: res.url || archiveUrl, httpStatus: res.status, contentType, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
