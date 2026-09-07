/**
 * Bounded parish-website communion verification.
 *
 * Discovery (parish-osm.ts) publishes parishes on OpenStreetMap's explicit
 * Catholic denomination tag and never fetches a website — that is what keeps
 * it fast and polite. This lane is the other half of the bargain: over time
 * it reads each published parish's own website (30 sites per run, 10 s each,
 * one at a time) and records a communion-with-Rome verdict:
 *
 *   - not-in-communion (Old Catholic, PNCC, SSPX, sedevacantist, Orthodox /
 *     Anglican identity, women's ordination …) → the row is UNPUBLISHED (never
 *     deleted — reversible), a human-review row explains why, and discovery is
 *     told not to republish it (`osm-skip`, one year).
 *   - in-communion → kept; any phone / Mass / confession details the site
 *     shows are folded in (enrich-only, through the protection gate); next
 *     check in 180 days.
 *   - unknown (site unreadable / no signal) → kept on the strength of the OSM
 *     tag; next check in 90 days.
 *
 * Each parish carries its own verdict + `nextDueAt` in `payload._meta.
 * websiteVerification` (meta, so it never counts as a content change), the
 * catalog cursor is persisted after EVERY site, and the run stops at a
 * wall-clock budget below its watchdog — a killed run never repeats work.
 */

import type { PrismaClient } from "@prisma/client";

import { inspectParishWebsite, type CommunionVerdict } from "./communion-verifier";
import { applyProtectedContentUpdate } from "./content-protection";
import { writeAdminWorkerLog } from "./logs";
import { writeOsmSkip } from "./parish-osm";

const CURSOR_KEY = "parish-site-verify";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Re-check cadence per verdict. */
const RECHECK_IN_COMMUNION_MS = 180 * DAY_MS;
const RECHECK_UNKNOWN_MS = 90 * DAY_MS;
/** Discovery must not republish a parish that proved not in communion. */
const SKIP_NOT_IN_COMMUNION_MS = 365 * DAY_MS;

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export interface WebsiteVerificationMeta {
  status: CommunionVerdict["status"];
  checkedAt: number;
  nextDueAt: number;
  reason: string;
  /** True only when the site itself yielded an in-communion verdict. */
  verifiedViaWebsite: boolean;
}

type Row = { id: string; slug: string; title: string; payload: unknown };

function payloadOf(row: Row): Record<string, unknown> {
  return row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? { ...(row.payload as Record<string, unknown>) }
    : {};
}

function metaOf(payload: Record<string, unknown>): Partial<WebsiteVerificationMeta> | null {
  const meta = payload._meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const v = (meta as Record<string, unknown>).websiteVerification;
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Partial<WebsiteVerificationMeta>)
    : null;
}

/** A row is due when it has a website and no future `nextDueAt`. */
export function websiteVerificationDue(
  payload: Record<string, unknown>,
  now = Date.now(),
): boolean {
  if (typeof payload.website !== "string" || !payload.website.trim()) return false;
  const meta = metaOf(payload);
  return !(typeof meta?.nextDueAt === "number" && meta.nextDueAt > now);
}

function withMeta(
  payload: Record<string, unknown>,
  verification: WebsiteVerificationMeta,
): Record<string, unknown> {
  const meta =
    payload._meta && typeof payload._meta === "object" && !Array.isArray(payload._meta)
      ? { ...(payload._meta as Record<string, unknown>) }
      : {};
  return { ...payload, _meta: { ...meta, websiteVerification: verification } };
}

async function readCursor(prisma: PrismaClient): Promise<string | null> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: CURSOR_KEY } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = (row?.memoryValue as { cursorId?: unknown } | null)?.cursorId;
  return typeof v === "string" && v ? v : null;
}

async function writeCursor(prisma: PrismaClient, cursorId: string | null): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: CURSOR_KEY } },
      update: { memoryValue: { cursorId }, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: CURSOR_KEY,
        memoryValue: { cursorId },
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

export interface ParishWebsiteVerificationResult {
  ran: boolean;
  scanned: number;
  checked: number;
  inCommunion: number;
  unknown: number;
  unpublished: number;
  enriched: number;
  detail: string;
}

/**
 * Verify up to `limit` due parish websites (default 30). Safe to call every
 * pass: self-cursoring, budgeted, fail-open per site. Honours
 * ADMIN_WORKER_SKIP_NETWORK (idle).
 */
export async function runParishWebsiteVerification(
  prisma: PrismaClient,
  opts: { limit?: number; passId?: string; budgetMs?: number; now?: () => number } = {},
): Promise<ParishWebsiteVerificationResult> {
  const out: ParishWebsiteVerificationResult = {
    ran: false,
    scanned: 0,
    checked: 0,
    inCommunion: 0,
    unknown: 0,
    unpublished: 0,
    enriched: 0,
    detail: "",
  };
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") {
    out.detail = "skip-network — website verification idle";
    return out;
  }
  const nowFn = opts.now ?? Date.now;
  const limit = opts.limit ?? envInt("ADMIN_WORKER_PARISH_VERIFY_LIMIT", 30);
  // 30 sites × 10 s worst case = 300 s; the deadline keeps a run under a
  // 6-minute watchdog with margin and the per-site cursor makes any cut clean.
  const deadline =
    nowFn() + (opts.budgetMs ?? envInt("ADMIN_WORKER_PARISH_VERIFY_BUDGET_MS", 5 * 60 * 1000));
  // Scan a wider window than `limit` so runs over an already-verified stretch
  // of the catalog still find due rows without walking it one row at a time.
  const window = limit * 4;

  const cursorId = await readCursor(prisma);
  const rows = (await prisma.publishedContent
    .findMany({
      where: {
        contentType: "PARISH" as never,
        isPublished: true,
        ...(cursorId ? { id: { gt: cursorId } } : {}),
      },
      orderBy: { id: "asc" },
      take: window,
      select: { id: true, slug: true, title: true, payload: true },
    })
    .catch(() => [])) as Row[];
  out.ran = true;
  out.scanned = rows.length;

  let lastScanned: string | null = null;
  let stoppedEarly = false;
  for (const row of rows) {
    if (out.checked >= limit || nowFn() > deadline) {
      stoppedEarly = true;
      break;
    }
    lastScanned = row.id;
    const payload = payloadOf(row);
    if (!websiteVerificationDue(payload, nowFn())) continue;
    out.checked += 1;
    try {
      await verifyOne(prisma, row, payload, out, opts.passId, nowFn);
    } catch {
      /* fail-open per parish */
    }
    // Persist after EVERY site so a watchdog kill never repeats a fetch.
    await writeCursor(prisma, row.id);
  }
  // Wrap to the start once the catalog end is reached (a short window fully
  // consumed); otherwise continue after the last row looked at.
  const reachedEnd = !stoppedEarly && rows.length < window;
  await writeCursor(prisma, reachedEnd ? null : (lastScanned ?? cursorId));

  out.detail = `website verification: ${out.checked} checked (${out.inCommunion} in communion, ${out.unknown} unknown, ${out.unpublished} unpublished, ${out.enriched} enriched) over ${out.scanned} scanned`;
  return out;
}

async function verifyOne(
  prisma: PrismaClient,
  row: Row,
  payload: Record<string, unknown>,
  out: ParishWebsiteVerificationResult,
  passId: string | undefined,
  nowFn: () => number,
): Promise<void> {
  const website = String(payload.website);
  const { verdict, details } = await inspectParishWebsite(website);
  const now = nowFn();

  if (verdict.status === "not-in-communion") {
    const meta: WebsiteVerificationMeta = {
      status: verdict.status,
      checkedAt: now,
      nextDueAt: now + SKIP_NOT_IN_COMMUNION_MS,
      reason: verdict.reason,
      verifiedViaWebsite: false,
    };
    // Unpublish (reversible), never delete: the row keeps its payload so a
    // reviewer can restore it if the signal was a false positive.
    await prisma.publishedContent.update({
      where: { id: row.id },
      data: {
        isPublished: false,
        unpublishedAt: new Date(now),
        payload: withMeta(payload, meta) as never,
      },
    });
    out.unpublished += 1;
    await writeOsmSkip(
      prisma,
      row.slug,
      `not in communion: ${verdict.reason}`,
      SKIP_NOT_IN_COMMUNION_MS,
    );
    const existing = await prisma.humanReviewQueue
      .findFirst({
        where: {
          status: "PENDING",
          proposedAction: "UNPUBLISHED_PARISH_NOT_IN_COMMUNION",
          contentTitle: row.slug,
        },
        select: { id: true },
      })
      .catch(() => null);
    if (!existing) {
      await prisma.humanReviewQueue
        .create({
          data: {
            contentType: "PARISH",
            contentTitle: row.slug,
            proposedAction: "UNPUBLISHED_PARISH_NOT_IN_COMMUNION",
            reason: `Unpublished "${row.title}": its website (${website}) shows it is not in communion with Rome. ${verdict.reason}`,
            confidence: verdict.confidence,
            sourceEvidence: {
              website,
              communion: {
                status: verdict.status,
                positive: verdict.signals.positive,
                negative: verdict.signals.negative,
              },
            } as never,
            blockingGate: "communion-verifier",
            neededAction:
              "Confirm the parish is not in communion with Rome, or restore it if the signal was a false positive.",
            status: "PENDING",
          },
        })
        .catch(() => undefined);
    }
    await writeAdminWorkerLog(prisma, {
      passId: passId ?? null,
      category: "PUBLISHING",
      severity: "WARN",
      eventName: "parish_unpublished_not_in_communion",
      message: `Unpublished PARISH/${row.slug}: ${verdict.reason}`,
      contentType: "PARISH",
      relatedEntityId: row.id,
      safeMetadata: { website, negative: verdict.signals.negative },
    }).catch(() => undefined);
    return;
  }

  const inCommunion = verdict.status === "in-communion";
  const meta: WebsiteVerificationMeta = {
    status: verdict.status,
    checkedAt: now,
    nextDueAt: now + (inCommunion ? RECHECK_IN_COMMUNION_MS : RECHECK_UNKNOWN_MS),
    reason: verdict.reason,
    verifiedViaWebsite: inCommunion,
  };
  if (inCommunion) out.inCommunion += 1;
  else out.unknown += 1;

  // Enrich-only: fill details the row lacks. Changed values are the monthly
  // refresh's job (it is allowed to replace volatile schedule fields).
  const proposed = withMeta(payload, meta);
  let contentChanged = false;
  for (const key of ["phone", "massTimes", "confessionTimes"] as const) {
    const v = details[key];
    const cur = payload[key];
    if (v && (cur == null || (typeof cur === "string" && !cur.trim()))) {
      proposed[key] = v;
      contentChanged = true;
    }
  }
  if (contentChanged) {
    const res = await applyProtectedContentUpdate(prisma, {
      contentId: row.id,
      proposedPayload: proposed,
      reason: "parish-website-verification",
      qualityScore: 0.88,
      evidenceCount: 1,
      passId,
    }).catch(() => null);
    if (res?.applied) {
      out.enriched += 1;
      return; // the applied payload already carries the meta stamp
    }
  }
  // Meta-only stamp: not a content change, so it bypasses the protection
  // gate's "noop" (which would otherwise drop it) and is written directly.
  await prisma.publishedContent
    .update({ where: { id: row.id }, data: { payload: withMeta(payload, meta) as never } })
    .catch(() => undefined);
}
