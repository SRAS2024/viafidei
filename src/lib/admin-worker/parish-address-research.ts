/**
 * Parish address research — the `research-parish-addresses` lane.
 *
 * Measured 2026-10-31: of 20,516 parish rows only 35% had a street line, none
 * had a postal code, and 11,046 had no country; new parishes still arrived
 * ~45% without a street, and nothing ever went back to look. This lane does,
 * deterministically and politely:
 *
 *   1. it selects published OSM parishes still missing a street, locality,
 *      postal code or country code whose research is due
 *      (`_meta.addressResearch.nextDueAt` absent or past), never-researched
 *      rows first;
 *   2. looks them up by OSM id on Nominatim, 50 per request, at most ~10
 *      requests per run (nominatim-lookup.ts: one shared 1.1 s slot, a daily
 *      budget, a cooldown after a refusal);
 *   3. fills ONLY blank fields, enrich-only through the protection gate: the
 *      street line in the country's own order, locality, state, postal code
 *      (validated per country), country. A differing non-empty street or city
 *      is left alone;
 *   4. corrects a stored country code that disagrees with Nominatim's (the
 *      tile fallback stamped churches with a neighbouring country) with
 *      allowReplace and the OSM id as evidence, and logs one WARN sample;
 *   5. unpublishes — never deletes — what is not a parish at all (a wayside
 *      shrine, a cross, a Station of the Cross by Nominatim's tags or a strict
 *      name), with `_meta.excluded` and a one-year osm-skip so the sweep never
 *      republishes it; re-designates a "parish" that is a chapel; and
 *      regenerates the summary only while it is still the machine sentence;
 *   6. records the outcome on the row (`_meta.addressResearch`: complete /
 *      partial / needs_research; retry after 7 d, 30 d, then every 90 d).
 *
 * Each run also advances the dedup restore and the one-time early re-sweep
 * (parish-dedup-restore.ts). One INFO log per run. Self-throttled and bounded
 * by a wall-clock budget under the lane watchdog; idle under
 * ADMIN_WORKER_SKIP_NETWORK.
 */

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import { derivedColumnsFor } from "@/lib/content-shared/derived-columns";

import { computeContentChecksum } from "./cache-freshness";
import { applyProtectedContentUpdate } from "./content-protection";
import { writeAdminWorkerLog } from "./logs";
import {
  lookupOsmPlaces,
  nominatimAddressParts,
  osmLookupId,
  NOMINATIM_MAX_IDS_PER_REQUEST,
  type NominatimPlace,
} from "./nominatim-lookup";
import { parishAddressKeyForPayload } from "./parish-address";
import { composeStreetLine } from "./parish-address-format";
import {
  addressPrecisionOf,
  addressResearchMetaOf,
  nextAddressResearchMeta,
  type AddressPrecision,
  type AddressResearchMeta,
} from "./parish-address-status";
import { runParishDedupRestore, scheduleOsmResweepAfterKeyFix } from "./parish-dedup-restore";
import { designationFor, type ParishDesignation } from "./parish-discovery-runner";
import {
  machineParishSummary,
  osmParishSummary,
  parishExclusionFor,
  writeOsmSkip,
  type ParishExclusion,
} from "./parish-osm";

const THROTTLE_KEY = "parish-address-research-lastrun";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Discovery must not republish something that is not a parish. */
const EXCLUDED_SKIP_MS = 365 * DAY_MS;
/** Country corrections quoted in the one WARN log per run. */
const MAX_CORRECTION_SAMPLES = 10;
/** Excluded rows named in the per-run INFO log. */
const MAX_LOGGED_EXCLUSIONS = 20;

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function parishAddressResearchEnabled(): boolean {
  return process.env.ADMIN_WORKER_SKIP_NETWORK !== "1";
}

type ResearchRow = {
  id: string;
  slug: string;
  title: string;
  sourceRef: string | null;
  payload: unknown;
};

function payloadOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function withMeta(
  payload: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...payload, _meta: { ...payloadOf(payload._meta), ...patch } };
}

// ── The pure plan: what one Nominatim answer changes on one row ─────────────

export interface AddressResearchPlan {
  /** The full proposed payload, `_meta.addressResearch` included. */
  proposed: Record<string, unknown>;
  /** Blank fields this answer fills (enrichment). */
  filled: string[];
  /** Non-empty fields it replaces on evidence (country, designation, summary). */
  corrected: string[];
  countryCorrection: { from: string; to: string } | null;
  meta: AddressResearchMeta;
}

/**
 * Plan the update one Nominatim answer makes to one published row. Pure and
 * deterministic: fills blanks only, except the evidence-backed corrections —
 * a disagreeing country code, a "parish" that is tagged or named as a chapel,
 * and the machine summary sentence once its facts change.
 */
export function planAddressResearch(
  row: { title: string },
  payload: Record<string, unknown>,
  place: NominatimPlace,
  now: number,
): AddressResearchPlan {
  const parts = nominatimAddressParts(place);
  const next: Record<string, unknown> = { ...payload };
  const filled: string[] = [];
  const corrected: string[] = [];
  const blank = (key: string) => text(next[key]) === "";
  const fill = (key: string, value: string | undefined) => {
    if (value && blank(key)) {
      next[key] = value;
      filled.push(key);
    }
  };

  // Country first — the street order and the postcode format depend on it.
  // Nominatim's country is where the object lies; a stored code that differs
  // came from a tile fallback (or a mistagged element) and is replaced.
  let countryCorrection: AddressResearchPlan["countryCorrection"] = null;
  const storedCc = text(payload.countryCode).toUpperCase();
  if (parts.countryCode && storedCc && storedCc !== parts.countryCode) {
    countryCorrection = { from: storedCc, to: parts.countryCode };
    next.countryCode = parts.countryCode;
    corrected.push("countryCode");
    if (parts.country && parts.country !== text(payload.country)) {
      (blank("country") ? filled : corrected).push("country");
      next.country = parts.country;
    }
  } else {
    fill("countryCode", parts.countryCode);
    fill("country", parts.country);
  }

  // The street, state and postcode only when the row is (now) in Nominatim's
  // country: a row tagged with another country keeps its own address parts.
  let precision: AddressPrecision = addressPrecisionOf(next.address);
  if (parts.countryCode && parts.countryCode === text(next.countryCode).toUpperCase()) {
    if (blank("address") && parts.street) {
      next.address = composeStreetLine(parts.street, parts.houseNumber, parts.countryCode);
      filled.push("address");
      precision = parts.precision;
    }
    fill("state", parts.state);
    fill("postalCode", parts.postalCode);
  }
  fill("city", parts.locality);

  // A "parish" that OSM tags (or plainly names) as a chapel is a chapel.
  const designation = (text(payload.designation) || "parish") as ParishDesignation;
  if (designation === "parish" && designationFor(row.title, place.extratags) === "chapel") {
    next.designation = "chapel";
    corrected.push("designation");
  }

  // The machine sentence names the designation and the place: rewrite it
  // when those facts changed, and never touch a summary a person wrote.
  const machine = machineParishSummary(payload.summary, row.title);
  const placeChanged = ["city", "country", "countryCode"].some(
    (k) => filled.includes(k) || corrected.includes(k),
  );
  if (machine && (placeChanged || corrected.includes("designation"))) {
    const summary = osmParishSummary({
      name: row.title,
      designation: (text(next.designation) || "parish") as ParishDesignation,
      denomination: machine.denomination,
      city: text(next.city),
      country: text(next.country),
    });
    if (summary !== payload.summary) {
      next.summary = summary;
      corrected.push("summary");
    }
  }

  const key = parishAddressKeyForPayload(next);
  if (key) next.addressKey = key;
  else delete next.addressKey;

  const meta = nextAddressResearchMeta({
    previous: addressResearchMetaOf(payload),
    payload: next,
    returned: true,
    precision,
    sources: filled.length + corrected.length > 0 ? ["osm", "nominatim"] : ["osm"],
    now,
    countryCorrectedFrom: countryCorrection?.from,
  });
  return {
    proposed: withMeta(next, { addressResearch: meta }),
    filled,
    corrected: [...new Set(corrected)],
    countryCorrection,
    meta,
  };
}

// ── Selection ───────────────────────────────────────────────────────────────

/**
 * Published OSM parishes that are missing an address field and due for
 * research, never-researched first. One bounded query; the JSON predicates
 * run in Postgres so a 20,000-row catalog is never loaded to filter it.
 */
async function selectDueRows(
  prisma: PrismaClient,
  limit: number,
  now: number,
): Promise<ResearchRow[]> {
  try {
    return await prisma.$queryRaw<ResearchRow[]>`
      SELECT "id", "slug", "title", "sourceRef", "payload"
      FROM "PublishedContent"
      WHERE "contentType" = 'PARISH'::"ChecklistContentType"
        AND "isPublished" = true
        AND "sourceRef" LIKE 'osm:%'
        AND (
          btrim(coalesce("payload"->>'address', '')) = ''
          OR btrim(coalesce("payload"->>'city', '')) = ''
          OR btrim(coalesce("payload"->>'postalCode', '')) = ''
          OR btrim(coalesce("payload"->>'countryCode', '')) = ''
        )
        AND coalesce(
          CASE
            WHEN ("payload"->'_meta'->'addressResearch'->>'nextDueAt') ~ '^[0-9]{1,15}$'
            THEN ("payload"->'_meta'->'addressResearch'->>'nextDueAt')::bigint
          END,
          0
        ) <= ${Math.floor(now)}::bigint
      ORDER BY ("payload"->'_meta'->'addressResearch') IS NULL DESC, "id" ASC
      LIMIT ${limit}`;
  } catch {
    return [];
  }
}

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * A provenance-only write (`_meta`, the derived key): not a content change, so
 * it bypasses the protection gate's "noop" — and restamps the freshness
 * checksum, which hashes the whole payload.
 */
async function writeMetaOnly(
  prisma: PrismaClient,
  row: ResearchRow,
  payload: Record<string, unknown>,
): Promise<void> {
  await prisma.publishedContent
    .update({
      where: { id: row.id },
      data: {
        payload: payload as never,
        contentChecksum: computeContentChecksum(row.title, payload),
        ...derivedColumnsFor("PARISH", payload),
      },
    })
    .catch(() => undefined);
}

/** The research state after an attempt that changed nothing on the row. */
function unchangedMeta(
  payload: Record<string, unknown>,
  returned: boolean,
  now: number,
): AddressResearchMeta {
  return nextAddressResearchMeta({
    previous: addressResearchMetaOf(payload),
    payload,
    returned,
    precision: addressPrecisionOf(payload.address),
    sources: ["osm"],
    now,
  });
}

/** Re-derive the key alongside a meta-only write (a stale key is dropped). */
function withCurrentKey(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  const key = parishAddressKeyForPayload(next);
  if (key) next.addressKey = key;
  else delete next.addressKey;
  return next;
}

/**
 * Not a parish: unpublish (reversible — the payload stays, with the reason)
 * and tell discovery not to republish it for a year.
 */
async function excludeRow(
  prisma: PrismaClient,
  row: ResearchRow,
  payload: Record<string, unknown>,
  exclusion: ParishExclusion,
  now: number,
): Promise<void> {
  const osmId = osmLookupId(row.sourceRef);
  const next = withMeta(payload, {
    excluded: {
      reason: exclusion.reason,
      evidence: `${exclusion.evidence}${osmId ? ` (OSM ${osmId}, Nominatim lookup)` : ""}`,
      at: now,
    },
  });
  await prisma.publishedContent
    .update({
      where: { id: row.id },
      data: {
        isPublished: false,
        unpublishedAt: new Date(now),
        payload: next as never,
        contentChecksum: computeContentChecksum(row.title, next),
      },
    })
    .catch(() => undefined);
  if (row.sourceRef) {
    await writeOsmSkip(prisma, row.sourceRef, `excluded: ${exclusion.reason}`, EXCLUDED_SKIP_MS);
  }
}

/** Nominatim's tags plus its main class/type, as one OSM-style tag set. */
function placeTags(place: NominatimPlace): Record<string, string> {
  const tags = { ...place.extratags };
  if (place.category === "historic" && !tags.historic) tags.historic = place.type;
  if (place.category === "man_made" && !tags.man_made) tags.man_made = place.type;
  return tags;
}

// ── The run ─────────────────────────────────────────────────────────────────

export interface ParishAddressResearchResult {
  ran: boolean;
  scanned: number;
  completed: number;
  partial: number;
  needsResearch: number;
  countryCorrected: number;
  excluded: number;
  redesignated: number;
  restored: number;
  requests: number;
  detail: string;
}

function tally(out: ParishAddressResearchResult, meta: AddressResearchMeta): void {
  if (meta.status === "complete") out.completed += 1;
  else if (meta.status === "partial") out.partial += 1;
  else out.needsResearch += 1;
}

/**
 * Apply one row's answer. `place` null = Nominatim answered without the
 * object. Fail-open: a row whose write fails is simply due again next run.
 */
async function researchRow(
  prisma: PrismaClient,
  row: ResearchRow,
  place: NominatimPlace | null,
  now: number,
  out: ParishAddressResearchResult,
  log: { corrections: Array<Record<string, string>>; exclusions: Array<Record<string, string>> },
  passId?: string,
): Promise<void> {
  // Plan from the row as it is NOW, not as it was at selection time: another
  // lane (website verification, the sweep's enrichment) may have written it
  // since, and a stale proposal would read as removing what it added.
  const fresh = await prisma.publishedContent
    .findUnique({ where: { id: row.id }, select: { payload: true, isPublished: true } })
    .catch(() => null);
  if (!fresh?.isPublished) return; // gone or unpublished meanwhile: nothing to research
  const payload = payloadOf(fresh.payload);
  const exclusion = parishExclusionFor(row.title, place ? placeTags(place) : {});
  if (exclusion) {
    await excludeRow(prisma, row, payload, exclusion, now);
    out.excluded += 1;
    if (log.exclusions.length < MAX_LOGGED_EXCLUSIONS) {
      log.exclusions.push({ id: row.id, slug: row.slug, reason: exclusion.reason });
    }
    return;
  }
  if (!place) {
    const meta = unchangedMeta(payload, false, now);
    await writeMetaOnly(prisma, row, withMeta(withCurrentKey(payload), { addressResearch: meta }));
    tally(out, meta);
    return;
  }

  const plan = planAddressResearch(row, payload, place, now);
  if (
    plan.filled.length + plan.corrected.length > 0 &&
    validatePayload("PARISH", plan.proposed).ok
  ) {
    const res = await applyProtectedContentUpdate(prisma, {
      contentId: row.id,
      proposedPayload: plan.proposed,
      reason: `parish-address-research (Nominatim lookup ${osmLookupId(row.sourceRef)})`,
      // Replacing a country, a designation or the machine summary needs
      // evidence: the lookup of this exact OSM object is that evidence.
      allowReplace: plan.corrected.length > 0,
      qualityScore: 0.9,
      evidenceCount: 1,
      passId,
    }).catch(() => null);
    if (res?.applied) {
      tally(out, plan.meta);
      if (plan.corrected.includes("designation")) out.redesignated += 1;
      if (plan.countryCorrection) {
        out.countryCorrected += 1;
        if (log.corrections.length < MAX_CORRECTION_SAMPLES) {
          log.corrections.push({
            slug: row.slug,
            from: plan.countryCorrection.from,
            to: plan.countryCorrection.to,
            osm: osmLookupId(row.sourceRef) ?? "",
          });
        }
      }
      return;
    }
  }
  // Nothing to change (or the gate refused): record the attempt so the row
  // is not looked up again before it is due.
  const meta = unchangedMeta(payload, true, now);
  await writeMetaOnly(prisma, row, withMeta(withCurrentKey(payload), { addressResearch: meta }));
  tally(out, meta);
}

async function throttleOk(prisma: PrismaClient, now: number): Promise<boolean> {
  const where = {
    memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: THROTTLE_KEY },
  };
  const row = await prisma.adminWorkerMemory
    .findUnique({ where, select: { lastUsedAt: true } })
    .catch(() => null);
  const last = row?.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
  if (now - last < envInt("ADMIN_WORKER_PARISH_RESEARCH_THROTTLE_MS", 2 * 60 * 1000)) return false;
  await prisma.adminWorkerMemory
    .upsert({
      where,
      update: { lastUsedAt: new Date(now) },
      create: {
        memoryType: "GENERIC",
        memoryKey: THROTTLE_KEY,
        memoryValue: {},
        lastUsedAt: new Date(now),
      },
    })
    .catch(() => undefined);
  return true;
}

/**
 * One research run: the restore and re-sweep steps, then up to `maxRequests`
 * lookups of 50 due parishes each, stopping at the wall-clock budget. Safe to
 * call every pass: self-throttled, budgeted, fail-open.
 */
export async function runParishAddressResearch(
  prisma: PrismaClient,
  opts: {
    passId?: string;
    force?: boolean;
    now?: () => number;
    fetchImpl?: typeof fetch;
    /** Lookup requests per run (default 10; `ADMIN_WORKER_PARISH_RESEARCH_REQUESTS`). */
    maxRequests?: number;
  } = {},
): Promise<ParishAddressResearchResult> {
  const nowFn = opts.now ?? Date.now;
  const out: ParishAddressResearchResult = {
    ran: false,
    scanned: 0,
    completed: 0,
    partial: 0,
    needsResearch: 0,
    countryCorrected: 0,
    excluded: 0,
    redesignated: 0,
    restored: 0,
    requests: 0,
    detail: "",
  };
  if (!parishAddressResearchEnabled()) {
    out.detail = "skip-network — address research idle";
    return out;
  }
  if (!opts.force && !(await throttleOk(prisma, nowFn()))) {
    out.detail = "throttled";
    return out;
  }
  out.ran = true;
  const deadline = nowFn() + envInt("ADMIN_WORKER_PARISH_RESEARCH_BUDGET_MS", 4 * 60 * 1000);

  // Database-only catch-up from the old address key: re-sweep scheduling and
  // the restore of wrongly unpublished parishes (both bounded, both resumable).
  const resweep = await scheduleOsmResweepAfterKeyFix(prisma, { now: nowFn() }).catch(() => null);
  const restore = await runParishDedupRestore(prisma, { passId: opts.passId, now: nowFn }).catch(
    () => null,
  );
  out.restored = restore?.restored ?? 0;

  const maxRequests = opts.maxRequests ?? envInt("ADMIN_WORKER_PARISH_RESEARCH_REQUESTS", 10);
  const rows = await selectDueRows(prisma, maxRequests * NOMINATIM_MAX_IDS_PER_REQUEST, nowFn());
  out.scanned = rows.length;
  const log = {
    corrections: [] as Array<Record<string, string>>,
    exclusions: [] as Array<Record<string, string>>,
  };
  let stopped: string | null = null;

  for (let start = 0; start < rows.length && !stopped; start += NOMINATIM_MAX_IDS_PER_REQUEST) {
    if (nowFn() > deadline) {
      stopped = "run budget spent";
      break;
    }
    const chunk = rows.slice(start, start + NOMINATIM_MAX_IDS_PER_REQUEST);
    // A row whose sourceRef is not an OSM id cannot be looked up at all.
    for (const row of chunk.filter((r) => !osmLookupId(r.sourceRef))) {
      await researchRow(prisma, row, null, nowFn(), out, log, opts.passId);
    }
    const lookable = chunk.filter((r) => osmLookupId(r.sourceRef));
    if (lookable.length === 0) continue;
    const res = await lookupOsmPlaces(
      prisma,
      lookable.map((r) => r.sourceRef!),
      { maxRequests: 1, fetchImpl: opts.fetchImpl, now: nowFn },
    );
    out.requests += res.requests;
    for (const row of lookable) {
      const ref = row.sourceRef!;
      const place = res.places.get(ref);
      if (place) await researchRow(prisma, row, place, nowFn(), out, log, opts.passId);
      else if (res.notReturned.includes(ref))
        await researchRow(prisma, row, null, nowFn(), out, log, opts.passId);
      // Unresolved (budget, cooldown, failure): nothing is known — due again.
    }
    if (res.stopReason) stopped = res.error ? `${res.stopReason}: ${res.error}` : res.stopReason;
  }

  if (log.corrections.length > 0) {
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId ?? null,
      category: "PUBLISHING",
      severity: "WARN",
      eventName: "parish_country_corrected",
      message: `Corrected the country of ${out.countryCorrected} parish(es) to Nominatim's (e.g. ${log.corrections
        .slice(0, 3)
        .map((c) => `${c.slug}: ${c.from}→${c.to}`)
        .join(", ")}).`,
      contentType: "PARISH",
      safeMetadata: { corrected: out.countryCorrected, samples: log.corrections },
    }).catch(() => undefined);
  }

  out.detail =
    `address research: ${out.scanned} due, ${out.requests} lookup(s); ${out.completed} complete, ` +
    `${out.partial} partial, ${out.needsResearch} need research, ${out.countryCorrected} country fix(es), ` +
    `${out.excluded} excluded, ${out.redesignated} chapel(s); ${out.restored} restored` +
    (resweep && resweep.scheduled > 0 ? `; ${resweep.scheduled} tile(s) made due early` : "") +
    (stopped ? ` (stopped: ${stopped})` : "");
  if (out.scanned === 0 && out.restored === 0 && !(resweep && resweep.scheduled > 0)) return out;
  await writeAdminWorkerLog(prisma, {
    passId: opts.passId ?? null,
    category: "PUBLISHING",
    severity: "INFO",
    eventName: "parish_address_research",
    message: out.detail,
    contentType: "PARISH",
    safeMetadata: {
      scanned: out.scanned,
      completed: out.completed,
      partial: out.partial,
      needsResearch: out.needsResearch,
      countryCorrected: out.countryCorrected,
      excluded: out.excluded,
      redesignated: out.redesignated,
      restored: out.restored,
      requests: out.requests,
      ...(log.exclusions.length > 0 ? { exclusions: log.exclusions } : {}),
      ...(restore && restore.restoredSlugs.length > 0
        ? { restoredSlugs: restore.restoredSlugs }
        : {}),
      ...(restore && restore.dedupPairs.length > 0 ? { keptDuplicates: restore.dedupPairs } : {}),
    },
  }).catch(() => undefined);
  return out;
}
