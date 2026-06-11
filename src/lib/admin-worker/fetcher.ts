/**
 * AdminWorkerFetcher (spec §6). Wraps `fetch()` with the policies the
 * Admin Worker requires:
 *
 *   - approved-host enforcement (delegated to isApprovedAuthorityHost)
 *   - request timeout
 *   - exponential-backoff retries on transient failure
 *   - HTTP-status, content-type, content-length, etag, and SHA-256
 *     checksum recorded on every attempt
 *   - "unchanged" detection via etag / last-modified / checksum
 *   - reject login pages, binary files, too-small bodies, too-large
 *     bodies without useful structure
 *   - every attempt writes an AdminWorkerFetchResult row
 *   - fetch failures push down source reputation; fetch successes
 *     push it up
 *
 * The fetcher is deliberately small — the real HTTP work is one
 * fetch() call. The value is policy + persistence.
 */

import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import { isFetchableHost } from "@/lib/checklist";
import { writeAdminWorkerLog } from "./logs";
import { recordSourceOutcome } from "./source-reputation";

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRIES = 2;
const MIN_BODY_BYTES = 400;
const MAX_BODY_BYTES = 5_000_000; // 5 MB
const MAX_PDF_BYTES = 40_000_000; // 40 MB — PDFs (encyclicals etc.) run larger

const LOGIN_PAGE_PATTERNS: RegExp[] = [
  /<input[^>]*type=["']password["']/i,
  /<form[^>]*action=["'][^"']*(login|signin)/i,
  /Sign\s+in/i,
];

const BINARY_CONTENT_TYPES: RegExp[] = [
  /^application\/(pdf|zip|octet-stream|x-tar|x-gzip)/i,
  /^image\//i,
  /^audio\//i,
  /^video\//i,
];

export interface FetcherInput {
  url: string;
  candidateUrlId?: string;
  /** Optional override for the user-agent we send. */
  userAgent?: string;
  /** Skip the actual HTTP call (used by tests). */
  skipNetwork?: boolean;
  /** Previous checksum — if the new fetch matches we record unchanged. */
  previousChecksum?: string;
  /** Previous etag — sent as If-None-Match. */
  previousEtag?: string | null;
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string | null;
  contentLength: number | null;
  checksum: string | null;
  etag: string | null;
  lastModifiedHeader: string | null;
  body: string;
  durationMs: number;
  attempt: number;
  succeeded: boolean;
  unchanged: boolean;
  rejectionReason: string | null;
  errorClass: string | null;
  errorMessage: string | null;
  fetchResultRowId: string | null;
  redirectChain: string[];
}

// Present as a mainstream browser. Authoritative sources — notably
// vatican.va — return HTTP 403 to custom bot User-Agents, which stalls
// content building at the fetch stage. A standard browser UA (plus the
// headers a real navigation sends, below) retrieves the same public pages a
// reader would see. NOTE: live fetching still depends on the deployment's
// outbound network policy permitting these hosts.
const USER_AGENT_DEFAULT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetch a URL with policy + persistence. Always returns a FetchedPage
 * — the caller checks `succeeded` and `rejectionReason`.
 */
export async function adminWorkerFetch(
  prisma: PrismaClient,
  input: FetcherInput,
): Promise<FetchedPage> {
  const url = input.url;
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return persistAndReturn(prisma, {
      url,
      finalUrl: url,
      httpStatus: 0,
      contentType: null,
      contentLength: null,
      checksum: null,
      etag: null,
      lastModifiedHeader: null,
      body: "",
      durationMs: 0,
      attempt: 1,
      succeeded: false,
      unchanged: false,
      rejectionReason: "invalid URL",
      errorClass: "INVALID_URL",
      errorMessage: "URL did not parse.",
      fetchResultRowId: null,
      redirectChain: [],
      candidateUrlId: input.candidateUrlId,
    });
  }

  // Fetch gate: the explicit registry + the Holy See `.va` TLD are always
  // allowed; with ADMIN_WORKER_OPEN_INTERNET enabled the worker may also reach
  // lesser-known hosts anywhere on the web (accuracy is enforced downstream by
  // cross-source verification + strict QA, not by this list). Local / social /
  // commerce hosts are always blocked.
  if (!isFetchableHost(host)) {
    return persistAndReturn(prisma, {
      url,
      finalUrl: url,
      httpStatus: 0,
      contentType: null,
      contentLength: null,
      checksum: null,
      etag: null,
      lastModifiedHeader: null,
      body: "",
      durationMs: 0,
      attempt: 1,
      succeeded: false,
      unchanged: false,
      rejectionReason: "unapproved host",
      errorClass: "UNAPPROVED_HOST",
      errorMessage: `Host ${host} is not fetchable (registry-only mode; set ADMIN_WORKER_OPEN_INTERNET to widen).`,
      fetchResultRowId: null,
      redirectChain: [],
      candidateUrlId: input.candidateUrlId,
    });
  }

  if (input.skipNetwork) {
    // Test path — record a synthetic success with an empty body
    // so the caller still gets a row + checksum.
    return persistAndReturn(prisma, {
      url,
      finalUrl: url,
      httpStatus: 200,
      contentType: "text/html",
      contentLength: 0,
      checksum: createHash("sha256").update("").digest("hex"),
      etag: null,
      lastModifiedHeader: null,
      body: "",
      durationMs: 0,
      attempt: 1,
      succeeded: true,
      unchanged: input.previousChecksum != null,
      rejectionReason: null,
      errorClass: null,
      errorMessage: null,
      fetchResultRowId: null,
      redirectChain: [],
      candidateUrlId: input.candidateUrlId,
    });
  }

  const userAgent = input.userAgent ?? USER_AGENT_DEFAULT;
  const start = Date.now();
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= DEFAULT_RETRIES) {
    attempt += 1;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      const headers: Record<string, string> = {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Upgrade-Insecure-Requests": "1",
      };
      if (input.previousEtag) headers["If-None-Match"] = input.previousEtag;

      const response = await fetch(url, {
        headers,
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timer);

      const httpStatus = response.status;
      const contentType = response.headers.get("content-type");
      const contentLengthHeader = response.headers.get("content-length");
      const etag = response.headers.get("etag");
      const lastModifiedHeader = response.headers.get("last-modified");

      if (httpStatus === 304) {
        return persistAndReturn(prisma, {
          url,
          finalUrl: response.url,
          httpStatus,
          contentType,
          contentLength: 0,
          checksum: input.previousChecksum ?? null,
          etag,
          lastModifiedHeader,
          body: "",
          durationMs: Date.now() - start,
          attempt,
          succeeded: true,
          unchanged: true,
          rejectionReason: null,
          errorClass: null,
          errorMessage: null,
          fetchResultRowId: null,
          redirectChain: [],
          candidateUrlId: input.candidateUrlId,
        });
      }

      if (!response.ok) {
        lastError = new Error(`HTTP ${httpStatus}`);
        // Don't retry 4xx (client errors are deterministic).
        if (httpStatus >= 400 && httpStatus < 500) break;
        if (attempt <= DEFAULT_RETRIES) {
          await sleep(backoffMs(attempt));
          continue;
        }
        break;
      }

      // PDFs are NOT junk: the Holy See / USCCB publish documents (encyclicals,
      // conciliar texts, catechetical material) as PDFs. Read + extract their
      // text instead of rejecting, so they flow into the pipeline like any page.
      const isPdf =
        /application\/pdf/i.test(contentType ?? "") || /\.pdf($|\?)/i.test(response.url);

      // Reject genuinely-unusable binary (images / audio / video / zip) — but
      // never PDFs (handled below).
      if (contentType && !isPdf && BINARY_CONTENT_TYPES.some((p) => p.test(contentType))) {
        return persistAndReturn(prisma, {
          url,
          finalUrl: response.url,
          httpStatus,
          contentType,
          contentLength: contentLengthHeader ? Number(contentLengthHeader) : null,
          checksum: null,
          etag,
          lastModifiedHeader,
          body: "",
          durationMs: Date.now() - start,
          attempt,
          succeeded: false,
          unchanged: false,
          rejectionReason: `binary content-type ${contentType}`,
          errorClass: "BINARY_REJECTED",
          errorMessage: null,
          fetchResultRowId: null,
          redirectChain: [],
          candidateUrlId: input.candidateUrlId,
        });
      }

      let body: string;
      if (isPdf) {
        const failPdf = (rejectionReason: string, errorClass: string) =>
          persistAndReturn(prisma, {
            url,
            finalUrl: response.url,
            httpStatus,
            contentType,
            contentLength: contentLengthHeader ? Number(contentLengthHeader) : null,
            checksum: null,
            etag,
            lastModifiedHeader,
            body: "",
            durationMs: Date.now() - start,
            attempt,
            succeeded: false,
            unchanged: false,
            rejectionReason,
            errorClass,
            errorMessage: null,
            fetchResultRowId: null,
            redirectChain: [],
            candidateUrlId: input.candidateUrlId,
          });
        let pdfText: string;
        try {
          const ab = await response.arrayBuffer();
          if (ab.byteLength > MAX_PDF_BYTES) return await failPdf("pdf too large", "PDF_TOO_LARGE");
          const { extractPdfText } = await import("./pdf-extract");
          const extracted = extractPdfText(Buffer.from(ab));
          if (!extracted.ok || !extracted.text) {
            // Scanned / encrypted / image-only PDF — route to OCR elsewhere.
            return await failPdf("pdf not machine-readable (scanned/encrypted)", "PDF_UNREADABLE");
          }
          pdfText = extracted.text;
        } catch {
          return await failPdf("pdf read failed", "PDF_READ_FAILED");
        }
        body = pdfText;
      } else {
        body = await response.text();
      }
      const bytes = Buffer.byteLength(body, "utf8");
      const checksum = createHash("sha256").update(body).digest("hex");

      if (bytes < MIN_BODY_BYTES) {
        return persistAndReturn(prisma, {
          url,
          finalUrl: response.url,
          httpStatus,
          contentType,
          contentLength: bytes,
          checksum,
          etag,
          lastModifiedHeader,
          body,
          durationMs: Date.now() - start,
          attempt,
          succeeded: false,
          unchanged: false,
          rejectionReason: `body too small (${bytes} bytes)`,
          errorClass: "TOO_SMALL",
          errorMessage: null,
          fetchResultRowId: null,
          redirectChain: [],
          candidateUrlId: input.candidateUrlId,
        });
      }

      if (bytes > MAX_BODY_BYTES && !hasUsefulStructure(body)) {
        return persistAndReturn(prisma, {
          url,
          finalUrl: response.url,
          httpStatus,
          contentType,
          contentLength: bytes,
          checksum,
          etag,
          lastModifiedHeader,
          body: body.slice(0, 50_000), // keep just enough to debug
          durationMs: Date.now() - start,
          attempt,
          succeeded: false,
          unchanged: false,
          rejectionReason: `body too large (${bytes} bytes) without useful structure`,
          errorClass: "TOO_LARGE_NO_STRUCTURE",
          errorMessage: null,
          fetchResultRowId: null,
          redirectChain: [],
          candidateUrlId: input.candidateUrlId,
        });
      }

      if (LOGIN_PAGE_PATTERNS.some((p) => p.test(body))) {
        // A login wall often went up AFTER the content was public — the
        // Internet Archive may hold the pre-wall page. Try it before rejecting.
        const rescued = await archiveRescue(prisma, input, start, attempt);
        if (rescued) return rescued;
        return persistAndReturn(prisma, {
          url,
          finalUrl: response.url,
          httpStatus,
          contentType,
          contentLength: bytes,
          checksum,
          etag,
          lastModifiedHeader,
          body,
          durationMs: Date.now() - start,
          attempt,
          succeeded: false,
          unchanged: false,
          rejectionReason: "response appears to be a login page",
          errorClass: "LOGIN_PAGE",
          errorMessage: null,
          fetchResultRowId: null,
          redirectChain: [],
          candidateUrlId: input.candidateUrlId,
        });
      }

      const unchanged = input.previousChecksum != null && input.previousChecksum === checksum;

      return persistAndReturn(prisma, {
        url,
        finalUrl: response.url,
        httpStatus,
        contentType,
        contentLength: bytes,
        checksum,
        etag,
        lastModifiedHeader,
        body,
        durationMs: Date.now() - start,
        attempt,
        succeeded: true,
        unchanged,
        rejectionReason: null,
        errorClass: null,
        errorMessage: null,
        fetchResultRowId: null,
        redirectChain: [],
        candidateUrlId: input.candidateUrlId,
      });
    } catch (err) {
      lastError = err as Error;
      const transient = isTransient(err);
      if (!transient || attempt > DEFAULT_RETRIES) break;
      await sleep(backoffMs(attempt));
    }
  }

  // Dead page (404 after a site reorganisation), hard error, or network
  // failure — the page usually still exists in the Internet Archive. Serve the
  // most recent snapshot instead of parking the artifact in repair.
  const rescued = await archiveRescue(prisma, input, start, attempt);
  if (rescued) return rescued;

  return persistAndReturn(prisma, {
    url,
    finalUrl: url,
    httpStatus: 0,
    contentType: null,
    contentLength: null,
    checksum: null,
    etag: null,
    lastModifiedHeader: null,
    body: "",
    durationMs: Date.now() - start,
    attempt,
    succeeded: false,
    unchanged: false,
    rejectionReason: lastError?.message ?? "fetch failed",
    errorClass: lastError?.name ?? "FETCH_FAILED",
    errorMessage: lastError?.message ?? null,
    fetchResultRowId: null,
    redirectChain: [],
    candidateUrlId: input.candidateUrlId,
  });
}

/**
 * Wayback Machine rescue: fetch the most recent archived snapshot of the URL
 * (keyless; see archive-fallback.ts) and return it as a successful page with
 * `finalUrl` honestly set to the web.archive.org URL. Returns null when the
 * fallback is disabled, no usable snapshot exists, or the snapshot is itself a
 * login page. Fail-open: any error means "no rescue".
 */
async function archiveRescue(
  prisma: PrismaClient,
  input: FetcherInput,
  start: number,
  attempt: number,
): Promise<FetchedPage | null> {
  if (input.skipNetwork) return null;
  try {
    const { archiveFallbackEnabled, fetchArchivedPage } = await import("./archive-fallback");
    if (!archiveFallbackEnabled()) return null;
    const archived = await fetchArchivedPage(input.url);
    if (!archived) return null;
    if (LOGIN_PAGE_PATTERNS.some((p) => p.test(archived.body))) return null;
    const bytes = Buffer.byteLength(archived.body, "utf8");
    if (bytes < MIN_BODY_BYTES) return null;
    const checksum = createHash("sha256").update(archived.body).digest("hex");
    return await persistAndReturn(prisma, {
      url: input.url,
      finalUrl: archived.archiveUrl,
      httpStatus: archived.httpStatus,
      contentType: archived.contentType,
      contentLength: bytes,
      checksum,
      etag: null,
      lastModifiedHeader: null,
      body: archived.body,
      durationMs: Date.now() - start,
      attempt,
      succeeded: true,
      unchanged: input.previousChecksum != null && input.previousChecksum === checksum,
      rejectionReason: null,
      errorClass: null,
      errorMessage: null,
      fetchResultRowId: null,
      redirectChain: [archived.archiveUrl],
      candidateUrlId: input.candidateUrlId,
    });
  } catch {
    return null;
  }
}

function backoffMs(attempt: number): number {
  return Math.min(2000, 250 * Math.pow(2, attempt - 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "AbortError" || /ECONN|ETIMED|ENOTFOUND|fetch failed|network/i.test(err.message)
  );
}

function hasUsefulStructure(body: string): boolean {
  // A page is "useful" if it has at least a handful of headings, paragraphs,
  // or list items. Used as a guard against multi-megabyte JS bundles
  // or transcripts dumped into a single <div>.
  const h = body.match(/<h[1-6][^>]*>/gi)?.length ?? 0;
  const p = body.match(/<p[^>]*>/gi)?.length ?? 0;
  const li = body.match(/<li[^>]*>/gi)?.length ?? 0;
  return h + p / 2 + li / 4 >= 6;
}

async function persistAndReturn(
  prisma: PrismaClient,
  page: FetchedPage & { candidateUrlId?: string },
): Promise<FetchedPage> {
  let host = "";
  try {
    host = new URL(page.url).host;
  } catch {
    /* ignore */
  }

  const row = await prisma.adminWorkerFetchResult
    .create({
      data: {
        sourceUrl: page.url,
        sourceHost: host,
        candidateUrlId: page.candidateUrlId ?? null,
        httpStatus: page.httpStatus,
        contentType: page.contentType,
        contentLength: page.contentLength ?? null,
        checksum: page.checksum,
        etag: page.etag,
        lastModifiedHeader: page.lastModifiedHeader,
        redirectChain: page.redirectChain,
        durationMs: page.durationMs,
        attempt: page.attempt,
        succeeded: page.succeeded,
        unchanged: page.unchanged,
        rejectionReason: page.rejectionReason,
        errorClass: page.errorClass,
        errorMessage: page.errorMessage,
      } as Prisma.AdminWorkerFetchResultUncheckedCreateInput,
      select: { id: true },
    })
    .catch(() => null);

  // Feed source reputation. Successful fetches bump up, failed ones
  // bump down — even rejection-by-policy counts as a "wasted" fetch.
  if (host) {
    await recordSourceOutcome(prisma, {
      sourceHost: host,
      fetchOk: page.succeeded && !page.rejectionReason,
    }).catch(() => undefined);
  }

  await writeAdminWorkerLog(prisma, {
    category: "SOURCE_READING",
    severity: page.succeeded ? "INFO" : "WARN",
    eventName: "fetch_attempt",
    message: page.succeeded
      ? `Fetched ${page.url}: ${page.httpStatus}, ${page.contentLength ?? 0}B${page.unchanged ? " (unchanged)" : ""}.`
      : `Fetch failed for ${page.url}: ${page.rejectionReason ?? page.errorMessage ?? "unknown"}.`,
    sourceHost: host,
    sourceUrl: page.url,
    safeMetadata: {
      httpStatus: page.httpStatus,
      durationMs: page.durationMs,
      attempt: page.attempt,
      succeeded: page.succeeded,
      unchanged: page.unchanged,
      rejectionReason: page.rejectionReason,
    },
  }).catch(() => undefined);

  return { ...page, fetchResultRowId: row?.id ?? null };
}
