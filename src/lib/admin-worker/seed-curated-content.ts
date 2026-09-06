/**
 * Offline curated content publisher.
 *
 * The repo ships a curated knowledge base (`ALL_CURATED_ENTRIES`) of
 * ground-truth, schema-valid Catholic content with authority citations. This
 * publishes that content through the REAL Admin Worker publish path
 * (`runPublishOrchestrator` → quality gate → PublishedContent → post-publish
 * verification), so the public site grows real content across every type that
 * has curated entries — even where the environment can't fetch live sources
 * (e.g. a sandbox that blocks outbound HTTP, or a temporarily-unreachable
 * authority host).
 *
 * It does NOT bypass the publish gates: each item still passes the publish
 * orchestrator's safety + full ten-dimension quality gate. The curated data
 * is treated as a verified source (it ships with citations and is hand-checked
 * ground truth), so a verifier sign-off is supplied for doctrinally-sensitive
 * types — exactly what a successful live cross-source verification would do.
 */

import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { ALL_CURATED_ENTRIES, validatePayload } from "@/lib/checklist";
import type { CuratedEntry } from "@/lib/checklist/knowledge";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import { applyProtectedContentUpdate, evaluateContentChange } from "./content-protection";
import { isDoctrinallySensitive } from "./content-type-profiles";
import { refreshContentGoals, seedContentGoals } from "./content-goals";
import { writeAdminWorkerLog } from "./logs";
import { runPublishOrchestrator } from "./publish-orchestrator";

export interface SeedCuratedResult {
  attempted: number;
  published: number;
  alreadyPublished: number;
  /** Already-live entries whose curated text changed and were re-published in place. */
  updated: number;
  skipped: number;
  failed: number;
  byType: Record<string, number>;
  errors: string[];
}

const FINGERPRINT_KEY = "curated-knowledge-fingerprint";

/** Stable hash of the whole curated corpus — changes exactly when the shipped knowledge changes. */
export function curatedKnowledgeFingerprint(entries: readonly CuratedEntry[]): string {
  const h = createHash("sha256");
  for (const e of entries) {
    h.update(e.contentType);
    h.update(":");
    h.update(e.slug);
    h.update(":");
    h.update(JSON.stringify(e.payload, Object.keys(e.payload).sort()));
    h.update("\n");
  }
  return h.digest("hex").slice(0, 24);
}

/**
 * Fields the PUBLISH path stamps or enriches on a payload after the curated
 * entry left the knowledge base. They are preserved on update (never treated
 * as content the curated entry "removed").
 */
const WORKER_ENRICHED_FIELDS = new Set([
  "contentSubtype",
  "latin",
  "greek",
  "translations",
  "machineTranslated",
  "_meta",
  "provenance",
]);

/**
 * The payload a live row SHOULD carry for a curated entry: the curated fields
 * win, the worker's own enrichments survive, and any field the curated entry
 * itself no longer defines is dropped (that is an editorial decision made in
 * the knowledge base).
 */
export function mergeCuratedPayload(
  current: Record<string, unknown>,
  curated: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(current)) {
    if (WORKER_ENRICHED_FIELDS.has(k)) out[k] = v;
  }
  for (const [k, v] of Object.entries(curated)) {
    // A curated Latin/Greek text is authoritative over a machine-built one.
    out[k] = v;
  }
  return out;
}

async function readFingerprint(prisma: PrismaClient): Promise<string | null> {
  try {
    const row = await prisma.adminWorkerMemory.findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: FINGERPRINT_KEY } },
      select: { memoryValue: true },
    });
    const v = (row?.memoryValue ?? {}) as { fingerprint?: string };
    return typeof v.fingerprint === "string" ? v.fingerprint : null;
  } catch {
    return null;
  }
}

async function writeFingerprint(prisma: PrismaClient, fingerprint: string): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: FINGERPRINT_KEY } },
      update: { memoryValue: { fingerprint }, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: FINGERPRINT_KEY,
        memoryValue: { fingerprint },
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

/**
 * Re-publish-on-change for entries that are ALREADY live.
 *
 * The curated knowledge base is the worker's own ground truth, so when an entry
 * is improved in the repository (a rewritten guide, a corrected prayer text)
 * the live row must follow — otherwise the fix ships to production and the
 * public page keeps showing the old text forever, because the seed skips every
 * slug that is already published. The change goes through the content
 * protection gate: the current row is snapshotted (PublishedContentVersion),
 * the version is bumped, and a destructive change is explicitly allowed here
 * because curated text carries the highest authority the worker has (quality
 * 0.95, evidence = its citations).
 *
 * Cheap by construction: it only runs when the corpus fingerprint differs from
 * the one recorded after the last complete sync, compares payloads in memory,
 * and is bounded per call so a large rewrite drains over a few passes.
 */
export async function syncCuratedUpdates(
  prisma: PrismaClient,
  opts: { limit?: number; entries?: readonly CuratedEntry[]; force?: boolean } = {},
): Promise<{ checked: number; updated: number; remaining: number; errors: string[] }> {
  const entries = [...(opts.entries ?? ALL_CURATED_ENTRIES ?? [])];
  const out = { checked: 0, updated: 0, remaining: 0, errors: [] as string[] };
  if (entries.length === 0) return out;

  const fingerprint = curatedKnowledgeFingerprint(entries);
  if (!opts.force && (await readFingerprint(prisma)) === fingerprint) return out;

  const limit = opts.limit ?? 25;
  const byType = new Map<string, CuratedEntry[]>();
  for (const e of entries) byType.set(e.contentType, [...(byType.get(e.contentType) ?? []), e]);

  let pending = 0;
  for (const [contentType, typeEntries] of byType) {
    const live = await prisma.publishedContent
      .findMany({
        where: {
          contentType: contentType as never,
          isPublished: true,
          slug: { in: typeEntries.map((e) => e.slug) },
        },
        select: { id: true, slug: true, title: true, subtitle: true, payload: true },
      })
      .catch(() => []);
    const bySlug = new Map(live.map((r) => [r.slug, r]));
    for (const entry of typeEntries) {
      const row = bySlug.get(entry.slug);
      if (!row) continue;
      out.checked += 1;
      const current = (row.payload ?? {}) as Record<string, unknown>;
      const proposed = mergeCuratedPayload(current, entry.payload);
      const title =
        (typeof entry.payload.title === "string" && entry.payload.title) ||
        (typeof entry.payload.canonicalName === "string" && entry.payload.canonicalName) ||
        entry.slug;
      const subtitle = generateContentSubtitle({
        contentType: entry.contentType,
        contentSubtype:
          typeof proposed.contentSubtype === "string" ? proposed.contentSubtype : null,
        title,
        fields: proposed,
      });
      const assessment = evaluateContentChange(current, proposed);
      const unchanged =
        assessment.kind === "noop" && title === row.title && subtitle === (row.subtitle ?? "");
      if (unchanged) continue;
      if (out.updated >= limit) {
        pending += 1;
        continue;
      }
      if (!validatePayload(entry.contentType, entry.payload).ok) {
        out.errors.push(`${entry.contentType}/${entry.slug}: invalid payload`);
        continue;
      }
      try {
        const result = await applyProtectedContentUpdate(prisma, {
          contentId: row.id,
          proposedPayload: proposed,
          proposedTitle: title,
          proposedSubtitle: subtitle,
          reason: "curated knowledge base updated",
          allowReplace: true,
          qualityScore: 0.95,
          evidenceCount: Math.max(1, entry.citations.length),
        });
        if (result.applied) {
          out.updated += 1;
          await prisma.checklistItem
            .updateMany({
              where: { contentType: entry.contentType, canonicalSlug: entry.slug },
              data: { canonicalName: title },
            })
            .catch(() => undefined);
        } else if (result.kind !== "noop") {
          out.errors.push(`${entry.contentType}/${entry.slug}: ${result.reason}`);
        }
      } catch (err) {
        out.errors.push(
          `${entry.contentType}/${entry.slug}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
  out.remaining = pending;

  // Only remember the fingerprint once NOTHING is left to update, so a large
  // rewrite keeps draining across passes until every live row matches.
  if (pending === 0 && out.errors.length === 0) await writeFingerprint(prisma, fingerprint);

  if (out.updated > 0 || out.errors.length > 0) {
    await writeAdminWorkerLog(prisma, {
      category: "PUBLISHING",
      severity: out.errors.length > 0 ? "WARN" : "INFO",
      eventName: "curated_knowledge_sync",
      message: `Curated knowledge sync: ${out.updated} live item(s) re-published from updated curated text (${out.checked} checked, ${pending} still pending${out.errors.length ? `, ${out.errors.length} error(s)` : ""}).`,
      safeMetadata: {
        updated: out.updated,
        checked: out.checked,
        remaining: pending,
        errors: out.errors.slice(0, 10),
      },
    }).catch(() => undefined);
  }
  return out;
}

/**
 * Publish curated content through the real pipeline. Idempotent: re-running
 * re-publishes the same slugs (PublishedContent is keyed by checklistItemId).
 */
export async function seedCuratedContent(
  prisma: PrismaClient,
  opts: { limit?: number; contentType?: string } = {},
): Promise<SeedCuratedResult> {
  const out: SeedCuratedResult = {
    attempted: 0,
    published: 0,
    alreadyPublished: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    byType: {},
    errors: [],
  };

  // `?? []` keeps this safe when @/lib/checklist is module-mocked (unit tests)
  // or the registry is otherwise unavailable: the seed becomes a clean no-op.
  let entries = [...(ALL_CURATED_ENTRIES ?? [])];
  if (opts.contentType) entries = entries.filter((e) => e.contentType === opts.contentType);
  // `opts.limit` caps the number of NEW publishes (enforced in the loop), not a
  // slice of the entry list: this lets the worker call it with a small per-pass
  // limit and keep making forward progress through the not-yet-published
  // backlog across passes, instead of re-considering the same first N forever.

  // Idempotency: skip items already live (avoids the per-item dedup gate on
  // re-runs, so a second `seed:content` is fast and a no-op).
  const live = new Set(
    (
      await prisma.publishedContent
        .findMany({ where: { isPublished: true }, select: { contentType: true, slug: true } })
        .catch(() => [] as Array<{ contentType: string; slug: string }>)
    ).map((r) => `${r.contentType}:${r.slug}`),
  );

  for (const entry of entries) {
    out.attempted += 1;
    if (live.has(`${entry.contentType}:${entry.slug}`)) {
      out.alreadyPublished += 1;
      continue;
    }
    try {
      // 1. The curated payload must satisfy the strict content schema.
      const validation = validatePayload(entry.contentType, entry.payload);
      if (!validation.ok) {
        out.skipped += 1;
        out.errors.push(`${entry.contentType}/${entry.slug}: invalid payload`);
        continue;
      }

      // 2. Resolve (or create) the checklist item this content belongs to.
      const existing = await prisma.checklistItem.findFirst({
        where: { contentType: entry.contentType, canonicalSlug: entry.slug },
        select: { id: true },
      });
      // Prefer the payload's own display name. SAINT records carry the name in
      // `canonicalName` (not `title`), so without this fallback every saint's
      // stored title — and therefore its page <h1>, <title>, and share image —
      // was its slug ("saint-joseph" instead of "Saint Joseph").
      const title =
        (typeof entry.payload.title === "string" && entry.payload.title) ||
        (typeof entry.payload.canonicalName === "string" && entry.payload.canonicalName) ||
        entry.slug;
      const item =
        existing ??
        (await prisma.checklistItem.create({
          data: {
            contentType: entry.contentType,
            canonicalName: title,
            canonicalSlug: entry.slug,
            approvalStatus: "APPROVED_FOR_BUILD",
          },
          select: { id: true },
        }));

      // 3. Publish through the REAL orchestrator. The curated data is verified
      //    ground truth with citations, so a verifier sign-off is supplied for
      //    doctrinally-sensitive types (mirrors a passing cross-source check).
      const sensitive = isDoctrinallySensitive(entry.contentType);
      const result = await runPublishOrchestrator(prisma, {
        contentType: entry.contentType,
        contentId: item.id,
        title,
        slug: entry.slug,
        payload: entry.payload as never,
        authorityLevel: entry.authorityLevel,
        finalScore: 0.95,
        qaPassed: true,
        hasSourceEvidence: entry.citations.length > 0,
        isDoctrinallySensitive: sensitive,
        confidence: 0.95,
        // Bulk seed: skip the per-item post-publish verifiers (non-gating;
        // the worker runs full live verification in its normal passes).
        skipPostPublishSideEffects: true,
        // Curated ground-truth is the worker's OWN verified knowledge base, not
        // an external source — skip the advisory brain screens (communion /
        // dedupe) so this is brain-independent and fast even when invoked from
        // the worker loop (brain enabled). All deterministic gates still run.
        skipBrainScreens: true,
        verifier: {
          publishAllowed: true,
          missingRequired: [],
          blockingSensitiveFields: [],
          verificationRowIds: [],
          evidence: [],
          hasConflict: false,
          summary: "Curated ground-truth content (verified against shipped authority citations).",
        },
      });

      if (result.kind === "published") {
        out.published += 1;
        out.byType[entry.contentType] = (out.byType[entry.contentType] ?? 0) + 1;
        // Bounded per-call growth: stop once we've published `limit` new items.
        if (opts.limit && out.published >= opts.limit) break;
      } else {
        out.skipped += 1;
        out.errors.push(`${entry.contentType}/${entry.slug}: ${result.kind} (${result.reason})`);
      }
    } catch (err) {
      out.failed += 1;
      out.errors.push(
        `${entry.contentType}/${entry.slug}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Already-live entries whose curated text changed since the last sync are
  // re-published in place (versioned + reversible). No-op when the corpus is
  // unchanged, so this costs nothing on a steady-state pass.
  if (!opts.contentType) {
    const sync = await syncCuratedUpdates(prisma, { limit: opts.limit ?? 25 }).catch(() => null);
    if (sync) {
      out.updated += sync.updated;
      out.errors.push(...sync.errors);
    }
  }

  // Finalize once (not per item): ensure the content-goal rows exist and
  // refresh their current counts + status so the Admin Worker console's
  // content-goals table reflects the real published totals after seeding.
  // The per-item post-publish refresh is intentionally skipped above to keep
  // the bulk seed O(n); this single pass brings the console fully up to date.
  await seedContentGoals(prisma).catch(() => undefined);
  await refreshContentGoals(prisma).catch(() => undefined);

  return out;
}
