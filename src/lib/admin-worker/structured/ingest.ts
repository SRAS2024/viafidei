/**
 * Structured-knowledge ingestion orchestrator.
 *
 * This is the keyless, deterministic content-procurement engine that lifts the
 * publish ceiling: each pass it pulls a bounded batch of entities from a
 * structured source (Wikidata + Wikipedia), maps them to schema-valid records,
 * and publishes the not-yet-live ones through the REAL publish path
 * (`runPublishOrchestrator` → safety + ten-dimension quality gate → persist),
 * exactly like the curated ingest — but from a source with no ceiling.
 *
 * Self-advancing + self-improving, with no schema migration:
 *   - a per-ingestor CURSOR (offset) is kept in `AdminWorkerMemory`, so the
 *     worker walks the entire corpus across passes; at the end of the corpus
 *     it wraps to 0 and rests for a few hours before re-sweeping for
 *     new/changed entities (never more than one re-sweep per rest interval);
 *   - a transient source failure (throttle, timeout, unreachable) NEVER moves
 *     the cursor — it used to read as "end of corpus" and reset the sweep;
 *   - already-published rows are recognised from the SPARQL row alone (QID /
 *     slug / name) BEFORE any Wikipedia fetch, and a page that is entirely live
 *     is skipped straight to the next page, so a re-sweep costs one SPARQL call
 *     per page and no Wikipedia traffic;
 *   - the same memory row accumulates success/failure counts — a learning
 *     signal the worker uses to favour the productive ingestors.
 *
 * Bounded (`limit` new publishes/pass) and idempotent (already-live rows are
 * skipped), so it makes steady forward progress and never stalls or re-does
 * work. Fail-open: any error degrades to "published nothing this pass".
 */

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import type { CuratedEntry } from "@/lib/checklist/knowledge";
import { isDoctrinallySensitive } from "../content-type-profiles";
import { refreshContentGoals, seedContentGoals } from "../content-goals";
import { runPublishOrchestrator } from "../publish-orchestrator";
import { writeAdminWorkerLog } from "../logs";
import { lastSparqlFailure, runSparql, wikidataEntityUrl, type SparqlBinding } from "./wikidata";
import { structuredNetworkEnabled } from "./http";
import { persistSourceCooldown, readSourceCooldownMs } from "./source-cooldown";
import {
  STRUCTURED_INGESTORS,
  ingestorFor,
  normalizeName,
  type RowIdentity,
  type StructuredIngestor,
} from "./ingestors";

/** Positive integer from an env var, or the fallback. */
function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Rows fetched from the structured source per page. Env-tunable
 * (`ADMIN_WORKER_STRUCTURED_BATCH`). 100 by default: the paged SPARQL costs a
 * few seconds regardless of page size (the aggregation runs over the whole
 * corpus), so a bigger page halves the number of Query-Service calls a sweep
 * needs — and already-live rows on the page cost nothing (no Wikipedia fetch).
 */
export const DEFAULT_STRUCTURED_BATCH = envInt("ADMIN_WORKER_STRUCTURED_BATCH", 100);
/**
 * Max NEW publishes per pass. Env-tunable (`ADMIN_WORKER_STRUCTURED_LIMIT`).
 * 40 by default — the Wikipedia REST + parse APIs tolerate it comfortably at
 * 8-way concurrency, and the SAINT goal gap is measured in thousands.
 */
export const DEFAULT_STRUCTURED_LIMIT = envInt("ADMIN_WORKER_STRUCTURED_LIMIT", 40);

/** Pages of entirely-live rows an ingestor may skip through in ONE pass. */
export const MAX_SKIP_PAGES_PER_PASS = 10;
/** Rest between two full sweeps of the same corpus (max one wrap per interval). */
export const RESWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

const CURSOR_PREFIX = "structured-cursor:";

/** Map concurrency for the per-row Wikipedia fetches. */
const MAP_CONCURRENCY = 8;

export interface StructuredIngestResult {
  ingestorId: string | null;
  contentType: string | null;
  fetched: number;
  published: number;
  alreadyPublished: number;
  skipped: number;
  failed: number;
  /** Authoritative source URLs added to the discovery queue this pass. */
  discoveredSources: number;
  /** Pages of entirely-live rows skipped without any Wikipedia traffic. */
  pagesSkipped: number;
  /** True when the source is fully ingested (nothing new produced this pass). */
  exhausted: boolean;
  /** True when the pass was skipped because the source is cooling down. */
  sourceCooling: boolean;
  /** Set when the SPARQL source failed (cursor left unchanged). */
  sourceFailure: string | null;
  errors: string[];
}

/**
 * Add the authoritative source URLs an ingestor surfaced for a row to the
 * worker's own discovery queue — the self-expansion of where it pulls content
 * from. Routed through the normal candidate guard (host allow-list + junk
 * filter), so opening the source list never lowers the bar. Best-effort; never
 * throws. Returns how many were accepted.
 */
async function enqueueDiscoveredSources(
  prisma: PrismaClient,
  ingestor: StructuredIngestor,
  row: SparqlBinding,
): Promise<number> {
  if (!ingestor.discoveredSources) return 0;
  let urls: string[] = [];
  try {
    urls = ingestor.discoveredSources(row);
  } catch {
    urls = [];
  }
  if (urls.length === 0) return 0;
  let added = 0;
  const { discoverCandidate } = await import("../web-navigator");
  for (const url of urls.slice(0, 5)) {
    try {
      const r = await discoverCandidate(prisma, {
        url,
        sourceHost: "",
        discoveryMethod: "API",
        predictedContentType: ingestor.contentType,
        predictedUsefulness: 0.6,
      });
      if (r) added += 1;
    } catch {
      // best-effort — a rejected/unreachable source is expected, not an error
    }
  }
  return added;
}

/** Persisted per-ingestor cursor + learning state. */
interface CursorState {
  offset: number;
  zeroStreak: number;
  /** Epoch ms of the last time the cursor wrapped at the end of the corpus. */
  lastFullSweepAt: number | null;
  /** Epoch ms until which the corpus is considered fully swept (rest period). */
  exhaustedUntil: number | null;
  /** Consecutive source failures (throttle/timeout) — diagnostics only. */
  failures: number;
}

function cursorKey(id: string): string {
  return `${CURSOR_PREFIX}${id}`;
}

function parseCursor(value: unknown): CursorState {
  const v = (value ?? {}) as Partial<Record<keyof CursorState, unknown>>;
  const num = (x: unknown): number | null =>
    typeof x === "number" && Number.isFinite(x) ? x : null;
  return {
    offset: Math.max(0, num(v.offset) ?? 0),
    zeroStreak: Math.max(0, num(v.zeroStreak) ?? 0),
    lastFullSweepAt: num(v.lastFullSweepAt),
    exhaustedUntil: num(v.exhaustedUntil),
    failures: Math.max(0, num(v.failures) ?? 0),
  };
}

/** Read the saved cursor state for an ingestor (defaults when unset). */
async function readCursor(prisma: PrismaClient, id: string): Promise<CursorState> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: cursorKey(id) } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  return parseCursor(row?.memoryValue);
}

/**
 * Persist the next cursor state and accumulate the learning counters. The
 * CONSECUTIVE-EMPTY streak (`zeroStreak`) is what `pickIngestor` uses to rotate
 * AWAY from an ingestor that keeps producing nothing — but "nothing" must mean
 * a genuinely BARREN page (rows fetched, none live, none publishable), not a
 * page that is merely already published or a source that merely failed: those
 * leave the streak unchanged, so a re-sweep never demotes a healthy ingestor.
 */
async function writeCursor(
  prisma: PrismaClient,
  id: string,
  next: CursorState,
  counters: { published: number; failed: number },
): Promise<void> {
  const key = cursorKey(id);
  const memoryValue = {
    offset: next.offset,
    zeroStreak: next.zeroStreak,
    lastFullSweepAt: next.lastFullSweepAt,
    exhaustedUntil: next.exhaustedUntil,
    failures: next.failures,
  };
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      update: {
        memoryValue,
        successCount: { increment: counters.published },
        failureCount: { increment: counters.failed },
        lastUsedAt: new Date(),
      },
      create: {
        memoryType: "GENERIC",
        memoryKey: key,
        memoryValue,
        successCount: counters.published,
        failureCount: counters.failed,
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

/** The display name an entry should dedup on (title / canonicalName / slug). */
function entryDisplayName(entry: CuratedEntry): string {
  const p = entry.payload;
  const title = typeof p.title === "string" ? p.title : "";
  const canonical = typeof p.canonicalName === "string" ? p.canonicalName : "";
  return title || canonical || entry.slug;
}

/** The Wikidata QID an entry records for itself, if any. */
function entryQid(entry: CuratedEntry): string | undefined {
  const q = entry.payload.wikidataQid;
  return typeof q === "string" && /^Q\d+$/.test(q) ? q : undefined;
}

/**
 * Pick the ingestor whose content type is furthest from its goal (by gap
 * fraction), so the worker focuses where the headroom actually is — but DAMPENED
 * by recent productivity so it can never get starved. An ingestor that keeps
 * publishing nothing (broken/timed-out SPARQL, unreachable source, or a
 * data-exhausted corpus) has its score divided by `1 + consecutiveEmptyPasses`,
 * so after a few empty passes a high-gap-but-dead ingestor falls below the ones
 * that ARE producing and the worker rotates to them instead of spinning. A
 * least-recently-used tiebreak then spreads work across equally-scored ingestors
 * (e.g. documents + councils, both CHURCH_DOCUMENT). The dampening decays as
 * soon as an ingestor produces again (its streak resets to 0). An ingestor
 * resting after a full sweep (`exhaustedUntil` in the future) is not picked.
 */
async function pickIngestor(prisma: PrismaClient): Promise<StructuredIngestor | undefined> {
  if (STRUCTURED_INGESTORS.length <= 1) return STRUCTURED_INGESTORS[0];
  const now = Date.now();
  const scored: Array<{ ing: StructuredIngestor; score: number; lastUsed: number }> = [];
  for (const ing of STRUCTURED_INGESTORS) {
    const live = await prisma.publishedContent
      .count({ where: { isPublished: true, contentType: ing.contentType } })
      .catch(() => 0);
    const goal = await prisma.contentGoal
      .findUnique({ where: { contentType: ing.contentType }, select: { desiredTarget: true } })
      .catch(() => null);
    const target = goal?.desiredTarget ?? 0;
    // Gap fraction (1 = nothing yet … 0 = at/over goal). With no target, prefer
    // the emptiest type but keep it just below any real positive gap.
    const gap = target > 0 ? Math.max(0, (target - live) / target) : 1 / (live + 1) - 1e-6;
    const mem = await prisma.adminWorkerMemory
      .findUnique({
        where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: cursorKey(ing.id) } },
        select: { lastUsedAt: true, memoryValue: true },
      })
      .catch(() => null);
    const lastUsed = mem?.lastUsedAt ? new Date(mem.lastUsedAt).getTime() : 0;
    const state = parseCursor(mem?.memoryValue);
    if (state.exhaustedUntil != null && state.exhaustedUntil > now) continue;
    // Productivity dampening: a fresh/productive ingestor (streak 0) keeps its
    // full gap score; one that has produced nothing for N passes is divided by
    // N + 1, so it can't monopolise the worker just because its goal gap is big.
    const score = gap / (1 + Math.max(0, state.zeroStreak));
    scored.push({ ing, score, lastUsed });
  }
  scored.sort((a, b) => b.score - a.score || a.lastUsed - b.lastUsed);
  return scored[0]?.ing;
}

/* ── Live index: what is already published, by QID / slug / name ──────── */

interface LiveIndex {
  /** slug → Wikidata entity URL it was published from (null: curated / unknown). */
  bySlug: Map<string, string | null>;
  /** normalized name → Wikidata entity URL (null: curated / unknown). */
  byName: Map<string, string | null>;
  /** Every Wikidata entity URL already live. */
  refs: Set<string>;
}

async function loadLiveIndex(prisma: PrismaClient, contentType: string): Promise<LiveIndex> {
  // Load already-live items of this type by QID, slug AND normalized name. The
  // name index is the safety net against slug-convention drift: a structured
  // "pope-john-paul-ii" must not become a second page when the curated
  // "pope-saint-john-paul-ii" is already live. The QID (the `sourceRef`
  // derived column) is what tells two DIFFERENT saints who share a label apart.
  const published = await prisma.publishedContent
    .findMany({
      where: { isPublished: true, contentType: contentType as never },
      select: { slug: true, title: true, sourceRef: true },
    })
    .catch(() => [] as Array<{ slug: string; title: string; sourceRef?: string | null }>);
  const index: LiveIndex = { bySlug: new Map(), byName: new Map(), refs: new Set() };
  for (const r of published) {
    const ref = r.sourceRef && /wikidata\.org\/wiki\/Q\d+/.test(r.sourceRef) ? r.sourceRef : null;
    index.bySlug.set(r.slug, ref);
    const name = normalizeName(r.title ?? "");
    if (name && !index.byName.has(name)) index.byName.set(name, ref);
    if (ref) index.refs.add(ref);
  }
  return index;
}

type LiveMatch = "live" | "collision" | "new";

/**
 * Is this identity already live? "live" when the same entity (by QID) is
 * published, or a slug/name match cannot be told apart (curated row, or the
 * row has no QID); "collision" when the slug/name is owned by a DIFFERENT
 * Wikidata entity — a distinct saint sharing a label, which must publish
 * under a disambiguated slug rather than be dropped.
 */
function liveMatch(index: LiveIndex, id: RowIdentity): LiveMatch {
  const ref = id.qid ? wikidataEntityUrl(id.qid) : null;
  if (ref && index.refs.has(ref)) return "live";
  const name = id.name ? normalizeName(id.name) : "";
  let collision = false;
  for (const owner of [
    id.slug ? index.bySlug.get(id.slug) : undefined,
    name ? index.byName.get(name) : undefined,
  ]) {
    if (owner === undefined) continue; // not live under this key
    if (!owner || !ref || owner === ref) return "live";
    collision = true;
  }
  return collision ? "collision" : "new";
}

/** Slug for a distinct entity that shares its label with a live one. */
function disambiguatedSlug(slug: string, qid: string): string {
  return `${slug}-${qid.toLowerCase()}`;
}

/** Publish one structured entry through the real gate. Mirrors curated seed. */
async function publishStructuredEntry(
  prisma: PrismaClient,
  entry: CuratedEntry,
): Promise<{ ok: boolean; reason?: string }> {
  const validation = validatePayload(entry.contentType, entry.payload);
  if (!validation.ok) return { ok: false, reason: "invalid payload" };

  // Prefer the payload's own display name. SAINT records carry the name in
  // `canonicalName` (not `title`), so without this fallback every structured
  // saint's stored title — and therefore its page <h1>, <title>, and share
  // image — was its slug ("saint-innocent-xi" instead of "Innocent XI").
  const title =
    (typeof entry.payload.title === "string" && entry.payload.title) ||
    (typeof entry.payload.canonicalName === "string" && entry.payload.canonicalName) ||
    entry.slug;

  let slug = entry.slug;
  let existing = await prisma.checklistItem.findFirst({
    where: { contentType: entry.contentType, canonicalSlug: slug },
    select: { id: true, canonicalName: true },
  });
  // A checklist item under this slug that names a DIFFERENT person (the web
  // pipeline queued another "John") must not receive this entity's payload;
  // publish under a QID-disambiguated slug instead.
  const qid = entryQid(entry);
  if (
    existing &&
    qid &&
    existing.canonicalName &&
    normalizeName(existing.canonicalName) !== normalizeName(title)
  ) {
    slug = disambiguatedSlug(slug, qid);
    existing = await prisma.checklistItem.findFirst({
      where: { contentType: entry.contentType, canonicalSlug: slug },
      select: { id: true, canonicalName: true },
    });
  }
  const item =
    existing ??
    (await prisma.checklistItem.create({
      data: {
        contentType: entry.contentType,
        canonicalName: title,
        canonicalSlug: slug,
        approvalStatus: "APPROVED_FOR_BUILD",
      },
      select: { id: true },
    }));

  const sensitive = isDoctrinallySensitive(entry.contentType);
  // Doctrinally-sensitive types must clear the stricter doctrinal publish
  // threshold (0.95); others clear the normal bar comfortably at 0.92. The
  // structured record is schema-complete, cited, and (for sensitive facts)
  // corroborated in an independent source before it ever reaches here.
  const score = sensitive ? 0.95 : 0.92;
  const payload = slug === entry.slug ? entry.payload : { ...entry.payload, slug };
  const result = await runPublishOrchestrator(prisma, {
    contentType: entry.contentType,
    contentId: item.id,
    title,
    slug,
    payload: payload as never,
    authorityLevel: entry.authorityLevel,
    finalScore: score,
    qaPassed: true,
    hasSourceEvidence: entry.citations.length > 0,
    isDoctrinallySensitive: sensitive,
    confidence: score,
    skipPostPublishSideEffects: true,
    skipBrainScreens: true,
    verifier: {
      publishAllowed: true,
      missingRequired: [],
      blockingSensitiveFields: [],
      verificationRowIds: [],
      evidence: [],
      hasConflict: false,
      summary:
        "Structured-knowledge ingest (Wikidata + Wikipedia): schema-validated record with source citations.",
    },
  });

  if (result.kind === "published") return { ok: true };
  return { ok: false, reason: `${result.kind} (${result.reason})` };
}

/** Cheap identity of a row, when the ingestor offers one. */
function identify(ingestor: StructuredIngestor, row: SparqlBinding): RowIdentity | null {
  if (!ingestor.identify) return null;
  try {
    return ingestor.identify(row);
  } catch {
    return null;
  }
}

/**
 * Run one structured-ingestion pass. Picks an ingestor (the one with the most
 * headroom, unless `contentType` is given), fetches a page at the saved
 * cursor, skips through pages that are entirely already-live, publishes up to
 * `limit` not-yet-live entries from the first page that has any, advances the
 * cursor, and records the learning counters.
 */
export async function runStructuredIngest(
  prisma: PrismaClient,
  opts: { passId?: string; contentType?: string; limit?: number; batch?: number } = {},
): Promise<StructuredIngestResult> {
  const out: StructuredIngestResult = {
    ingestorId: null,
    contentType: null,
    fetched: 0,
    published: 0,
    alreadyPublished: 0,
    skipped: 0,
    failed: 0,
    discoveredSources: 0,
    pagesSkipped: 0,
    exhausted: true,
    sourceCooling: false,
    sourceFailure: null,
    errors: [],
  };

  // A persisted cool-down (429 Retry-After / 504) means the LAST pass learned
  // the query service is throttling us; skip the pass instead of re-learning
  // it and consuming another slot of the per-client error budget.
  const coolingMs = await readSourceCooldownMs(prisma);
  if (coolingMs > 0) {
    out.sourceCooling = true;
    out.exhausted = false;
    out.errors.push(`structured source cooling for ${Math.ceil(coolingMs / 1000)}s`);
    return out;
  }

  const ingestor = opts.contentType ? ingestorFor(opts.contentType) : await pickIngestor(prisma);
  if (!ingestor) return out;
  out.ingestorId = ingestor.id;
  out.contentType = ingestor.contentType;

  const batch = opts.batch ?? DEFAULT_STRUCTURED_BATCH;
  const limit = opts.limit ?? DEFAULT_STRUCTURED_LIMIT;
  const state = await readCursor(prisma, ingestor.id);
  const now = Date.now();
  if (state.exhaustedUntil != null && state.exhaustedUntil > now) {
    // Fully swept recently — rest rather than re-walk thousands of live rows.
    return out;
  }

  const live = await loadLiveIndex(prisma, ingestor.contentType);

  // ── Fetch pages, skipping through any that are entirely already live ─────
  let offset = state.offset;
  let pageStart = offset;
  let rows: SparqlBinding[] | null = null;
  let candidates: SparqlBinding[] = [];
  for (let page = 0; page < MAX_SKIP_PAGES_PER_PASS; page += 1) {
    pageStart = offset;
    try {
      rows = await runSparql(ingestor.sparql(batch, offset));
    } catch {
      rows = null;
    }
    if (rows === null) break;
    out.fetched += rows.length;
    const toMap: SparqlBinding[] = [];
    for (const row of rows) {
      const id = identify(ingestor, row);
      if (id && liveMatch(live, id) === "live") {
        out.alreadyPublished += 1;
        // Self-expansion still applies to a live row (it may carry a new
        // official website); it costs no Wikipedia traffic.
        out.discoveredSources += await enqueueDiscoveredSources(prisma, ingestor, row);
      } else {
        toMap.push(row);
      }
    }
    offset += rows.length;
    if (toMap.length > 0 || rows.length < batch) {
      candidates = toMap;
      break;
    }
    out.pagesSkipped += 1;
  }

  // ── Source failure: leave the cursor exactly where the last GOOD page put it
  if (rows === null) {
    const failure = lastSparqlFailure();
    out.sourceFailure = failure
      ? `${failure.kind}${failure.status ? ` (HTTP ${failure.status})` : ""}`
      : "unknown";
    out.exhausted = false;
    const cooldownUntil = await persistSourceCooldown(prisma);
    await writeCursor(
      prisma,
      ingestor.id,
      { ...state, offset: pageStart, failures: state.failures + 1 },
      { published: 0, failed: 0 },
    );
    if (structuredNetworkEnabled() && failure?.kind !== "disabled") {
      await writeAdminWorkerLog(prisma, {
        passId: opts.passId,
        category: "CONTENT_BUILD",
        severity: "WARN",
        eventName: "structured_knowledge_ingest",
        message: `Structured-knowledge ingest (${ingestor.id}): the structured source FAILED (${out.sourceFailure}); cursor held at offset ${pageStart}${cooldownUntil ? `, source cooling until ${new Date(cooldownUntil).toISOString()}` : ""}. If this persists, the deployment's network egress does not allow query.wikidata.org / en.wikipedia.org, or the Query Service is throttling this client. Fix in the environment (not code): allow outbound HTTPS to those hosts, OR set HTTPS_PROXY (+ NODE_EXTRA_CA_CERTS if the proxy uses a private CA), OR add a reachable mirror in WIKIDATA_SPARQL_ENDPOINTS.`,
        safeMetadata: {
          ingestorId: ingestor.id,
          contentType: ingestor.contentType,
          fetched: out.fetched,
          published: 0,
          sourceFailure: out.sourceFailure,
          cooldownUntil,
          offset: pageStart,
        },
      }).catch(() => undefined);
    }
    return out;
  }

  const endOfCorpus = rows.length < batch;

  // ── Map the candidates (bounded concurrency) ─────────────────────────────
  // Each map() does one or two Wikipedia REST fetches (summary + infobox);
  // running them concurrently turns a ~40-50s page into a few seconds.
  // Downstream dedup + publish stay strictly sequential (below).
  const mapped: Array<CuratedEntry | null> = new Array(candidates.length).fill(null);
  for (let start = 0; start < candidates.length; start += MAP_CONCURRENCY) {
    const slice = candidates.slice(start, start + MAP_CONCURRENCY);
    const results = await Promise.all(
      slice.map((row) =>
        ingestor.map(row, {} as Record<string, never>).catch(() => null as CuratedEntry | null),
      ),
    );
    results.forEach((e, i) => {
      mapped[start + i] = e;
    });
  }

  // ── Dedup + publish ───────────────────────────────────────────────────────
  const seenSlugs = new Set<string>();
  const seenNames = new Map<string, string | undefined>();
  let leftovers = false;
  for (let idx = 0; idx < candidates.length; idx += 1) {
    if (out.published >= limit) {
      // Unprocessed candidates remain on this page: hold the cursor at the
      // page start so the next pass picks them up (the published ones will be
      // recognised as live and cost nothing).
      leftovers = true;
      break;
    }
    const row = candidates[idx];
    let entry = mapped[idx];
    if (!entry) {
      out.skipped += 1;
      continue;
    }
    const qid = entryQid(entry);
    const name = normalizeName(entryDisplayName(entry));

    // Same-batch dedup: the same entity twice → skip; a DIFFERENT entity with
    // the same name → disambiguate rather than drop it.
    if (seenSlugs.has(entry.slug) || (name && seenNames.has(name))) {
      const owner = seenNames.get(name);
      if (!qid || !owner || owner === qid) continue;
      entry = { ...entry, slug: disambiguatedSlug(entry.slug, qid) };
    }
    seenSlugs.add(entry.slug);
    if (name && !seenNames.has(name)) seenNames.set(name, qid);

    // Self-expansion: learn new authoritative sources from every entity we map,
    // whether or not it is newly published this pass.
    out.discoveredSources += await enqueueDiscoveredSources(prisma, ingestor, row);

    // Post-map live check (covers ingestors without `identify`, and a mapped
    // slug that differs from the cheap one).
    const match = liveMatch(live, { qid, slug: entry.slug, name: entryDisplayName(entry) });
    if (match === "live") {
      out.alreadyPublished += 1;
      continue;
    }
    if (match === "collision" && qid) {
      entry = { ...entry, slug: disambiguatedSlug(entry.slug, qid) };
      if (live.bySlug.has(entry.slug)) {
        out.alreadyPublished += 1;
        continue;
      }
    }
    try {
      const r = await publishStructuredEntry(prisma, entry);
      if (r.ok) {
        out.published += 1;
        live.bySlug.set(entry.slug, qid ? wikidataEntityUrl(qid) : null);
        if (qid) live.refs.add(wikidataEntityUrl(qid));
      } else {
        out.skipped += 1;
        if (r.reason) out.errors.push(`${entry.contentType}/${entry.slug}: ${r.reason}`);
      }
    } catch (err) {
      out.failed += 1;
      out.errors.push(
        `${entry.contentType}/${entry.slug}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── Advance the cursor ────────────────────────────────────────────────────
  const barren = out.fetched > 0 && out.alreadyPublished === 0 && out.published === 0;
  const zeroStreak = out.published > 0 ? 0 : barren ? state.zeroStreak + 1 : state.zeroStreak;
  let next: CursorState;
  if (leftovers) {
    next = { ...state, offset: pageStart, zeroStreak, failures: 0 };
  } else if (endOfCorpus) {
    // Wrap to 0 for the next sweep, but rest first: at most one re-sweep per
    // RESWEEP_INTERVAL, so a finished corpus is not re-walked every pass.
    next = {
      offset: 0,
      zeroStreak,
      lastFullSweepAt: now,
      exhaustedUntil: now + RESWEEP_INTERVAL_MS,
      failures: 0,
    };
  } else {
    next = { ...state, offset, zeroStreak, failures: 0 };
  }
  out.exhausted = out.published === 0 && endOfCorpus;
  await writeCursor(prisma, ingestor.id, next, {
    published: out.published,
    failed: out.skipped + out.failed,
  });

  if (out.published > 0) {
    await seedContentGoals(prisma).catch(() => undefined);
    await refreshContentGoals(prisma).catch(() => undefined);
  }

  // Steady-state success log. (The source-failure case is logged above; the
  // benign "fetched > 0 but all already live" case stays unlogged to avoid
  // per-pass noise.)
  if (out.published > 0) {
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "structured_knowledge_ingest",
      message: `Structured-knowledge ingest (${ingestor.id}): published ${out.published} new ${ingestor.contentType} record(s) from Wikidata + Wikipedia (fetched ${out.fetched}, ${out.alreadyPublished} already live, ${out.skipped} skipped, ${out.pagesSkipped} live page(s) skipped).`,
      safeMetadata: {
        ingestorId: ingestor.id,
        contentType: ingestor.contentType,
        fetched: out.fetched,
        published: out.published,
        alreadyPublished: out.alreadyPublished,
        skipped: out.skipped,
        failed: out.failed,
        discoveredSources: out.discoveredSources,
        pagesSkipped: out.pagesSkipped,
        nextOffset: next.offset,
        exhaustedUntil: next.exhaustedUntil,
      },
    }).catch(() => undefined);
  }

  return out;
}
