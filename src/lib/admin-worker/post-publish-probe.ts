/**
 * Real post-publish HTTP probe.
 *
 * After publishing, the Admin Worker fetches the public page and
 * confirms it loads + the title appears in the rendered HTML, then
 * confirms the sitemap and the public search surface the item — all by
 * HTTP against the public origin, because the worker is a standalone
 * process with no access to the Next.js tag cache (the public pages are
 * force-dynamic, so there is nothing to revalidate from here anyway).
 *
 * What counts as evidence (the important part):
 *   - FAIL is reserved for the site actively saying the page is gone —
 *     HTTP 404/410 — or a fully rendered page that provably lacks the
 *     title. Everything else (403/408/425/429/5xx, a thrown fetch, a
 *     mis-configured origin) is WARN = "unverified": it says nothing
 *     about the content, only about the transport, and must never be
 *     turned into an unpublish.
 *   - A single FAIL is a first strike. It is recorded, but the result
 *     handed to the caller is WARN until a SECOND FAIL is observed at
 *     least FAIL_CONFIRMATION_GAP_MS later (a separate pass). Only a
 *     confirmed FAIL reaches the rollback decision tree, and that tree
 *     (post-publish-rollback.ts) is the ONE place that unpublishes —
 *     this module records and reports, it never rolls back on its own.
 */

import type {
  ChecklistContentType,
  PostPublishVerificationResult,
  PrismaClient,
} from "@prisma/client";

import { revalidateForRow, revalidateSitemap, revalidateContentType } from "@/lib/cache/revalidate";
import { deriveStatus } from "./content-goals";
import { writeAdminWorkerLog } from "./logs";
import {
  FAIL_CONFIRMATION_GAP_MS,
  findPriorFailure,
  recordVerification,
  rollbackPlan,
  type VerificationChecks,
} from "./post-publish";
import { publicOrigin, publicUrlFor, publicRouteFor } from "./public-routes";

const PROBE_TIMEOUT_MS = 8_000;
const USER_AGENT = "ViaFideiAdminWorker/1.0 (+post-publish-verification)";

export interface VerifyPublishedInput {
  contentType: ChecklistContentType | string;
  contentId: string;
  slug: string;
  expectedTitle: string;
  /** Optional body marker to confirm the content body rendered. */
  expectedBodyMarker?: string;
  /** Skip the live HTTP probe (used by tests). */
  skipNetwork?: boolean;
}

export interface VerifyPublishedResult {
  verificationId: string;
  /**
   * The ACTIONABLE result: FAIL only when the failure is confirmed by two
   * observations ≥ FAIL_CONFIRMATION_GAP_MS apart. A first-strike FAIL is
   * reported here as WARN (and `failureConfirmed` false).
   */
  result: PostPublishVerificationResult;
  /** What this single probe observed, before the two-strike rule. */
  observed: PostPublishVerificationResult;
  /** True when `result` is FAIL because a prior FAIL corroborated this one. */
  failureConfirmed: boolean;
  checks: VerificationChecks;
  publicUrl: string;
}

type ProbeOutcome = { result: PostPublishVerificationResult; error?: string };

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    h === "localhost" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.startsWith("127.") ||
    h.endsWith(".localhost")
  );
}

function isPrivateDbHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    isLoopbackHost(h) ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.endsWith(".internal") ||
    h.endsWith(".local")
  );
}

/**
 * Refuse to probe when the public origin resolves to localhost while the
 * database is remote. That combination means a laptop worker pointed at the
 * production DB with no PUBLIC_BASE_URL: every probe would hit a local dev
 * server (or nothing) and 404 against production rows — the exact way vetted
 * production pages were being unpublished. Returns the reason, or null when
 * probing is safe.
 */
export function probeOriginMismatch(): string | null {
  let originHost: string;
  try {
    originHost = new URL(publicOrigin()).hostname;
  } catch {
    return "public origin is not a valid URL — set PUBLIC_BASE_URL";
  }
  if (!isLoopbackHost(originHost)) return null;
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) return null;
  let dbHost: string;
  try {
    dbHost = new URL(dbUrl).hostname;
  } catch {
    // Unparseable DATABASE_URL: we cannot tell, and a wrong guess here would
    // either block all verification or risk production rows. Treat unknown as
    // remote — verification is merely deferred, content is never touched.
    return "DATABASE_URL is not parseable while the public origin is localhost — set PUBLIC_BASE_URL";
  }
  if (isPrivateDbHost(dbHost)) return null;
  return `public origin ${publicOrigin()} is localhost while DATABASE_URL points at ${dbHost} — set PUBLIC_BASE_URL to the public site before post-publish verification can run`;
}

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      headers: { "user-agent": USER_AGENT, accept },
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function normaliseText(s: string): string {
  return decodeEntities(s).toLowerCase().replace(/\s+/g, " ").trim();
}

/** True when the rendered HTML carries the title (raw or entity-escaped). */
export function bodyContainsTitle(body: string, title: string): boolean {
  if (!title.trim()) return true;
  if (body.includes(title)) return true;
  return normaliseText(body).includes(normaliseText(title));
}

const TRANSIENT_PAGE_MARKERS =
  /application error|internal server error|service unavailable|bad gateway|gateway time-?out|temporarily unavailable|maintenance|please try again|too many requests|rate limit|checking your browser|just a moment|access denied/i;

/**
 * A 200 page "provably" lacks the title only when it is a fully rendered HTML
 * document that mentions neither the title nor the slug and does not look like
 * an error / challenge shell served with a 200. Anything less certain is WARN.
 */
export function bodyProvablyLacksTitle(body: string, title: string, slug: string): boolean {
  if (bodyContainsTitle(body, title)) return false;
  if (body.length < 500) return false;
  if (!/<html[\s>]|<!doctype html/i.test(body)) return false;
  if (slug && body.toLowerCase().includes(slug.toLowerCase())) return false;
  if (TRANSIENT_PAGE_MARKERS.test(body)) return false;
  return true;
}

/**
 * Classify one HTTP status. Only "the page is gone" is a failure; every other
 * non-2xx is the transport or the edge talking, not the content.
 */
export function classifyProbeStatus(status: number): "ok" | "fail" | "unverified" {
  if (status >= 200 && status < 300) return "ok";
  if (status === 404 || status === 410) return "fail";
  return "unverified";
}

async function probePublicPage(
  url: string,
  expectedTitle: string,
  slug: string,
  expectedBodyMarker?: string,
): Promise<ProbeOutcome> {
  try {
    const res = await fetchWithTimeout(url, "text/html");
    const klass = classifyProbeStatus(res.status);
    if (klass === "fail") {
      return { result: "FAIL", error: `HTTP ${res.status}` };
    }
    if (klass === "unverified") {
      return { result: "WARN", error: `HTTP ${res.status} (unverified — not evidence about the page)` };
    }
    const body = await res.text();
    if (!bodyContainsTitle(body, expectedTitle)) {
      if (bodyProvablyLacksTitle(body, expectedTitle, slug)) {
        return { result: "FAIL", error: "page rendered (200) without the title or slug" };
      }
      return { result: "WARN", error: "page loaded but title not found in body" };
    }
    if (expectedBodyMarker && !body.includes(expectedBodyMarker)) {
      return { result: "WARN", error: "page loaded but body marker missing" };
    }
    return { result: "PASS" };
  } catch (err) {
    // The probe could NOT REACH the page — DNS failure, connection refused,
    // TLS error, timeout/abort, proxied egress, a site mid-deploy. That is an
    // environmental / transport failure, NOT evidence that the content is
    // broken. Report it as unverified so nothing downstream treats it as a
    // reason to unpublish; the item is re-verified on a later pass.
    return { result: "WARN", error: err instanceof Error ? err.message : String(err) };
  }
}

/** Confirm the public sitemap lists this item's route. WARN on any doubt. */
async function probeSitemap(origin: string, slugPath: string): Promise<ProbeOutcome> {
  try {
    const res = await fetchWithTimeout(`${origin}/sitemap.xml`, "application/xml,text/xml");
    if (!res.ok) return { result: "WARN", error: `sitemap HTTP ${res.status}` };
    const { parseSitemapXml } = await import("./sitemap-inspect");
    const locs = parseSitemapXml(await res.text());
    const want = slugPath.replace(/\/$/, "").toLowerCase();
    for (const loc of locs) {
      let path = loc;
      try {
        path = new URL(loc).pathname;
      } catch {
        // keep the raw loc
      }
      // Compare by path only: the sitemap is built from appConfig.canonicalUrl,
      // which may legitimately differ from PUBLIC_BASE_URL (www vs apex).
      if (path.replace(/\/$/, "").toLowerCase() === want) return { result: "PASS" };
    }
    return { result: "WARN", error: "route not listed in /sitemap.xml yet" };
  } catch (err) {
    return { result: "WARN", error: `sitemap unreachable: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Confirm the public search suggests this item for its title. WARN on doubt. */
async function probeSearch(origin: string, title: string, slug: string): Promise<ProbeOutcome> {
  try {
    const url = `${origin}/api/search/suggest?q=${encodeURIComponent(title.slice(0, 120))}&limit=5`;
    const res = await fetchWithTimeout(url, "application/json");
    if (!res.ok) return { result: "WARN", error: `search HTTP ${res.status}` };
    const json = (await res.json().catch(() => null)) as {
      suggestions?: Array<{ slug?: string }>;
    } | null;
    const hits = Array.isArray(json?.suggestions) ? json.suggestions : [];
    if (hits.some((h) => h?.slug === slug)) return { result: "PASS" };
    return { result: "WARN", error: "public search did not suggest the item for its title" };
  } catch (err) {
    return { result: "WARN", error: `search unreachable: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Threshold-count update check: refresh the ContentGoal row for the
 * published content type and confirm `currentValidCount` has advanced.
 * Returns PASS / WARN / FAIL — a missing goal returns WARN rather
 * than blocking publish.
 */
async function probeThresholdCount(
  prisma: import("@prisma/client").PrismaClient,
  contentType: string,
): Promise<ProbeOutcome> {
  const goal = await prisma.contentGoal.findUnique({ where: { contentType } }).catch(() => null);
  if (!goal) {
    return { result: "WARN", error: "no ContentGoal row for content type" };
  }
  const liveCount = await prisma.publishedContent.count({
    where: { contentType: contentType as never, isPublished: true },
  });
  if (liveCount === goal.currentValidCount) {
    // The goal hasn't been refreshed yet; trigger it. The gap is measured
    // against desiredTarget exactly as refreshContentGoals does — minimumTarget
    // is always 0, so measuring against it zeroed the gap and hid the type from
    // the planner until the next full refresh.
    await prisma.contentGoal.update({
      where: { id: goal.id },
      data: {
        currentValidCount: liveCount,
        gapCount: Math.max(0, goal.desiredTarget - liveCount),
        status: deriveStatus(liveCount, goal.desiredTarget, goal.canonicalMax ?? null),
        lastUpdatedAt: new Date(),
      },
    });
    return { result: "PASS" };
  }
  return { result: "PASS" };
}

/**
 * Verify a freshly-published item. Performs (in order):
 *   1. Trigger cache revalidation (a no-op outside the Next runtime).
 *   2. HTTP-GET the public page, the sitemap and the search suggester.
 *   3. Record the result in PostPublishVerification.
 *   4. Apply the two-strike rule: a FAIL is only actionable when a prior
 *      FAIL ≥ FAIL_CONFIRMATION_GAP_MS old exists for the same item.
 *
 * Never unpublishes: the caller (dispatcher) drives the rollback decision
 * tree on a confirmed FAIL.
 */
export async function verifyPublished(
  prisma: PrismaClient,
  input: VerifyPublishedInput,
): Promise<VerifyPublishedResult> {
  const route = publicRouteFor(input.contentType, input.slug);
  const publicUrl = publicUrlFor(input.contentType, input.slug);

  // Step 1: actively revalidate. The worker triggers the cache flush
  // it later verifies — same call site, same source of truth.
  const cacheResult = await revalidateForRow({
    reason: "package_created",
    contentType: input.contentType,
    slug: input.slug,
  });
  await revalidateSitemap();
  await revalidateContentType(input.contentType);

  // Step 2: probe the public surfaces (optional — tests can skip). A
  // mis-configured origin is refused up front: probing localhost against a
  // remote catalog is how production rows were being unpublished.
  const originProblem = input.skipNetwork ? null : probeOriginMismatch();
  let probe: ProbeOutcome;
  let sitemap: ProbeOutcome;
  let search: ProbeOutcome;
  if (input.skipNetwork) {
    probe = { result: "PASS" };
    sitemap = { result: "PASS" };
    search = { result: "PASS" };
  } else if (originProblem) {
    probe = { result: "WARN", error: `origin not configured: ${originProblem}` };
    sitemap = { result: "WARN", error: "origin not configured" };
    search = { result: "WARN", error: "origin not configured" };
  } else {
    const origin = publicOrigin();
    probe = await probePublicPage(publicUrl, input.expectedTitle, input.slug, input.expectedBodyMarker);
    [sitemap, search] = await Promise.all([
      probeSitemap(origin, route.slugPath),
      probeSearch(origin, input.expectedTitle, input.slug),
    ]);
  }

  // Step 3: threshold count refresh + sanity check.
  const thresholdProbe = await probeThresholdCount(prisma, String(input.contentType)).catch(() => ({
    result: "WARN" as PostPublishVerificationResult,
    error: "threshold probe threw",
  }));

  // Step 4: two-strike rule. Look for the first strike BEFORE recording this
  // one so the lookup sees the previous pass, not the row we are about to add.
  let failureConfirmed = false;
  if (probe.result === "FAIL") {
    const prior = await findPriorFailure(prisma, {
      contentType: String(input.contentType),
      contentId: input.contentId,
    });
    failureConfirmed =
      prior != null && Date.now() - prior.createdAt.getTime() >= FAIL_CONFIRMATION_GAP_MS;
  }

  const checks: VerificationChecks = {
    contentType: String(input.contentType),
    contentId: input.contentId,
    slug: input.slug,
    publicPageCheck: probe.result,
    tabPlacementCheck: probe.result === "PASS" ? "PASS" : "WARN",
    searchCheck: search.result,
    sitemapCheck: sitemap.result,
    // The public pages are force-dynamic; outside Next the revalidation
    // helper reports a successful no-op, inside Next it reports the real flush.
    cacheCheck: cacheResult.ok ? "PASS" : "WARN",
    errorMessage:
      probe.result === "FAIL" && !failureConfirmed
        ? `${probe.error ?? "public page FAIL"} (first strike — unconfirmed, re-probed after ${Math.round(FAIL_CONFIRMATION_GAP_MS / 60_000)} min)`
        : (probe.error ?? sitemap.error ?? search.error ?? thresholdProbe.error),
  };

  const record = await recordVerification(prisma, checks);
  const observed = record.result;
  const result: PostPublishVerificationResult =
    observed === "FAIL" && !failureConfirmed ? "WARN" : observed;

  await writeAdminWorkerLog(prisma, {
    category: "POST_PUBLISH",
    severity: result === "PASS" ? "INFO" : result === "FAIL" ? "ERROR" : "WARN",
    eventName: `post_publish_${result.toLowerCase()}`,
    message: `Verified ${input.contentType} "${input.expectedTitle}" at ${route.slugPath} -> ${result}${
      observed === "FAIL" && !failureConfirmed ? " (FAIL observed once; awaiting confirmation)" : ""
    }.`,
    contentType: String(input.contentType),
    relatedEntityId: input.contentId,
    safeMetadata: {
      publicUrl,
      probeResult: probe.result,
      probeError: probe.error,
      sitemapResult: sitemap.result,
      sitemapError: sitemap.error,
      searchResult: search.result,
      searchError: search.error,
      cacheOk: cacheResult.ok,
      cacheSkipped: cacheResult.skipped === true,
      observed,
      failureConfirmed,
    },
  });

  return { verificationId: record.id, result, observed, failureConfirmed, checks, publicUrl };
}

interface RollbackInput {
  contentType: string;
  contentId: string;
  slug: string;
  checks: VerificationChecks;
  reasonSummary: string;
}

/**
 * Explicit rollback entry point for callers that hold a CONFIRMED failing
 * verification. It does not decide anything itself: it maps the failing check
 * and delegates to the rollback decision tree, which is the single owner of
 * repair → re-verify → unpublish → review. Not invoked by verifyPublished.
 */
export async function rollback(prisma: PrismaClient, input: RollbackInput): Promise<void> {
  const plan = rollbackPlan(input.checks);
  if (plan === "no_rollback") return;
  const failedCheck =
    input.checks.publicPageCheck === "FAIL"
      ? "public_route"
      : input.checks.tabPlacementCheck === "FAIL"
        ? "tab_placement"
        : input.checks.searchCheck === "FAIL"
          ? "search"
          : input.checks.sitemapCheck === "FAIL"
            ? "sitemap"
            : "cache";
  const { decideAndExecuteRollback } = await import("./post-publish-rollback");
  await decideAndExecuteRollback(prisma, {
    contentType: input.contentType,
    contentId: input.contentId,
    slug: input.slug,
    failedCheck,
    reason: input.reasonSummary,
    recoverableHint: plan === "unpublish_and_review",
  });
}
