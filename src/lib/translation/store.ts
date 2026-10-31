/**
 * The ContentTranslation table (migration 0062), through parameterised raw
 * SQL — like the admin session store — so this module works against any
 * generated Prisma client, including one generated before the table existed.
 *
 * Web side: `readTranslations` (an in-process LRU in front of one indexed
 * query, bounded by a timeout) and `fileDemand` (a small buffer flushed in
 * one INSERT … ON CONFLICT DO NOTHING). Both fail open: a slow database, a
 * missing table or any error simply means the page shows the original text.
 *
 * Translator side: `claimPending`, `existingHashes` and `storeResults`.
 */

import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import type { Unit } from "./segments";

/** The part of a Prisma client the store uses (tests pass a stub). */
export type Db = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;

let dbOverride: Db | null = null;

async function db(): Promise<Db> {
  if (dbOverride) return dbOverride;
  const { prisma } = await import("@/lib/db/client");
  return prisma;
}

/** Tests (and the translator) can supply their own client. */
export function setTranslationDb(client: Db | null): void {
  dbOverride = client;
}

export function translationDisabled(): boolean {
  const v = (process.env.TRANSLATION_DISABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/* ------------------------------------------------------------------ */
/*  Failure handling                                                  */
/* ------------------------------------------------------------------ */

/** After a "relation does not exist" (or repeated errors), stop asking for a while. */
let pausedUntil = 0;
const PAUSE_MS = 5 * 60_000;

function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; meta?: { code?: string }; message?: string } | null;
  return (
    e?.code === "42P01" ||
    e?.meta?.code === "42P01" ||
    /ContentTranslation.*does not exist|relation .* does not exist/i.test(e?.message ?? "")
  );
}

function noteFailure(err: unknown): void {
  if (isMissingTable(err)) {
    pausedUntil = Date.now() + PAUSE_MS;
    console.warn("[translation] ContentTranslation table missing; serving originals for 5 minutes");
  }
}

export function translationsPaused(now = Date.now()): boolean {
  return now < pausedUntil;
}

/** Test hook. */
export function resetTranslationStoreState(): void {
  pausedUntil = 0;
  cache.clear();
  filed.clear();
  demand.clear();
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
}

/* ------------------------------------------------------------------ */
/*  Web: reading translations                                         */
/* ------------------------------------------------------------------ */

const POSITIVE_TTL_MS = 30 * 60_000;
/** A missing translation is re-checked soon: the translator may be filling it now. */
const NEGATIVE_TTL_MS = 45_000;
const CACHE_MAX = 60_000;
export const LOOKUP_TIMEOUT_MS = 400;

type CacheEntry = { text: string | null; at: number };
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string, now: number): CacheEntry | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  const ttl = hit.text === null ? NEGATIVE_TTL_MS : POSITIVE_TTL_MS;
  if (now - hit.at > ttl) {
    cache.delete(key);
    return undefined;
  }
  // Refresh recency (Map keeps insertion order).
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key: string, text: string | null, now: number): void {
  cache.delete(key);
  cache.set(key, { text, at: now });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`translation lookup timed out after ${ms} ms`)),
        ms,
      );
      (timer as { unref?: () => void }).unref?.();
    }),
  ]);
}

/**
 * Finished translations for `hashes` in `lang` (hash → raw model output).
 * Never throws and never waits longer than `LOOKUP_TIMEOUT_MS` on the database.
 */
export async function readTranslations(
  lang: string,
  hashes: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (translationDisabled() || hashes.length === 0) return out;
  const now = Date.now();
  const missing: string[] = [];
  for (const hash of new Set(hashes)) {
    const hit = cacheGet(`${lang}:${hash}`, now);
    if (hit === undefined) missing.push(hash);
    else if (hit.text !== null) out.set(hash, hit.text);
  }
  if (missing.length === 0 || translationsPaused(now)) return out;
  try {
    const client = await db();
    const rows = await withTimeout(
      client.$queryRaw<Array<{ sourceHash: string; text: string }>>(Prisma.sql`
        SELECT "sourceHash", "text" FROM "ContentTranslation"
        WHERE "lang" = ${lang}
          AND "sourceHash" = ANY(${missing}::text[])
          AND "status" = 'done' AND "text" IS NOT NULL`),
      LOOKUP_TIMEOUT_MS,
    );
    const found = new Set<string>();
    const at = Date.now();
    for (const row of rows) {
      found.add(row.sourceHash);
      out.set(row.sourceHash, row.text);
      cacheSet(`${lang}:${row.sourceHash}`, row.text, at);
    }
    for (const hash of missing) if (!found.has(hash)) cacheSet(`${lang}:${hash}`, null, at);
  } catch (err) {
    noteFailure(err);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Web: filing demand                                                */
/* ------------------------------------------------------------------ */

export interface DemandRow {
  lang: string;
  hash: string;
  unit: Unit;
}

const FILED_TTL_MS = 30 * 60_000;
const DEMAND_BUFFER_MAX = 5_000;
const DEMAND_BATCH = 400;
const FLUSH_DELAY_MS = 1_500;

const filed = new Map<string, number>(); // lang:hash → when filed
const demand = new Map<string, DemandRow>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Ask the translator for units a visitor's page needed and did not find.
 * Buffered and deduplicated in memory; written in batches, never awaited by
 * the page.
 */
export function fileDemand(rows: readonly DemandRow[]): void {
  if (translationDisabled() || translationsPaused() || rows.length === 0) return;
  const now = Date.now();
  for (const row of rows) {
    const key = `${row.lang}:${row.hash}`;
    const at = filed.get(key);
    if (at !== undefined && now - at < FILED_TTL_MS) continue;
    if (demand.size >= DEMAND_BUFFER_MAX) break;
    demand.set(key, row);
  }
  if (demand.size && !flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushDemand();
    }, FLUSH_DELAY_MS);
    (flushTimer as { unref?: () => void }).unref?.();
  }
}

/** Write buffered demand now (exported for tests and graceful shutdown). */
export async function flushDemand(): Promise<number> {
  let written = 0;
  while (demand.size) {
    const batch = [...demand.values()].slice(0, DEMAND_BATCH);
    for (const row of batch) demand.delete(`${row.lang}:${row.hash}`);
    try {
      const client = await db();
      const values = batch.map(
        (
          r,
        ) => Prisma.sql`(${randomUUID()}, ${r.lang}, ${r.hash}, ${r.unit.kind}, ${r.unit.sourceLang},
          ${r.unit.source}, ${r.unit.protect}::text[], 'pending', NOW(), NOW(), NOW())`,
      );
      await client.$executeRaw(Prisma.sql`
        INSERT INTO "ContentTranslation"
          ("id", "lang", "sourceHash", "kind", "sourceLang", "source", "protect", "status",
           "requestedAt", "createdAt", "updatedAt")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("lang", "sourceHash") DO NOTHING`);
      const now = Date.now();
      for (const row of batch) filed.set(`${row.lang}:${row.hash}`, now);
      while (filed.size > CACHE_MAX) filed.delete(filed.keys().next().value!);
      written += batch.length;
    } catch (err) {
      noteFailure(err);
      demand.clear();
      break;
    }
  }
  return written;
}

/* ------------------------------------------------------------------ */
/*  Translator side                                                   */
/* ------------------------------------------------------------------ */

export interface PendingRow {
  id: string;
  lang: string;
  sourceHash: string;
  kind: string;
  sourceLang: string;
  source: string;
  protect: string[];
  attempts: number;
}

/**
 * Claim up to `limit` pending rows — oldest visitor demand first, all in one
 * language (the language of the oldest row, unless `lang` is given) so one
 * model load serves the whole batch. A claim lapses after `leaseMs`, so a
 * translator that dies mid-batch never strands work.
 */
export async function claimPending(
  client: Db,
  opts: { claimant: string; limit: number; lang?: string; leaseMs?: number; maxAttempts?: number },
): Promise<PendingRow[]> {
  const leaseCutoff = new Date(Date.now() - (opts.leaseMs ?? 15 * 60_000));
  const maxAttempts = opts.maxAttempts ?? 4;
  const langFilter = opts.lang
    ? Prisma.sql`AND "lang" = ${opts.lang}`
    : Prisma.sql`AND "lang" = (
        SELECT "lang" FROM "ContentTranslation"
        WHERE "status" = 'pending' AND "attempts" < ${maxAttempts}
          AND ("claimedAt" IS NULL OR "claimedAt" < ${leaseCutoff})
        ORDER BY "requestedAt" ASC NULLS LAST LIMIT 1)`;
  return client.$queryRaw<PendingRow[]>(Prisma.sql`
    UPDATE "ContentTranslation" SET "claimedAt" = NOW(), "claimedBy" = ${opts.claimant}, "updatedAt" = NOW()
    WHERE "id" IN (
      SELECT "id" FROM "ContentTranslation"
      WHERE "status" = 'pending' AND "attempts" < ${maxAttempts}
        AND ("claimedAt" IS NULL OR "claimedAt" < ${leaseCutoff})
        ${langFilter}
      ORDER BY "requestedAt" ASC NULLS LAST
      LIMIT ${opts.limit}
      FOR UPDATE SKIP LOCKED)
    RETURNING "id", "lang", "sourceHash", "kind", "sourceLang", "source", "protect", "attempts"`);
}

/** Which of `hashes` already have a row (any status) in `lang`. */
export async function existingHashes(
  client: Db,
  lang: string,
  hashes: readonly string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < hashes.length; i += 5_000) {
    const chunk = hashes.slice(i, i + 5_000);
    const rows = await client.$queryRaw<Array<{ sourceHash: string }>>(Prisma.sql`
      SELECT "sourceHash" FROM "ContentTranslation"
      WHERE "lang" = ${lang} AND "sourceHash" = ANY(${chunk}::text[]) AND "status" <> 'pending'`);
    for (const r of rows) out.add(r.sourceHash);
  }
  return out;
}

export interface TranslationResult {
  lang: string;
  hash: string;
  unit: Unit;
  /** null = no model could translate it acceptably (the original stays). */
  text: string | null;
  model: string;
}

/** Upsert finished (or given-up) units. */
export async function storeResults(
  client: Db,
  results: readonly TranslationResult[],
): Promise<void> {
  for (let i = 0; i < results.length; i += 200) {
    const batch = results.slice(i, i + 200);
    const values = batch.map(
      (
        r,
      ) => Prisma.sql`(${randomUUID()}, ${r.lang}, ${r.hash}, ${r.unit.kind}, ${r.unit.sourceLang},
        ${r.unit.source}, ${r.unit.protect}::text[], ${r.text}, ${r.model},
        ${r.text === null ? "untranslated" : "done"}, NOW(), NOW())`,
    );
    await client.$executeRaw(Prisma.sql`
      INSERT INTO "ContentTranslation"
        ("id", "lang", "sourceHash", "kind", "sourceLang", "source", "protect", "text", "model",
         "status", "createdAt", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("lang", "sourceHash") DO UPDATE SET
        "text" = EXCLUDED."text", "model" = EXCLUDED."model", "status" = EXCLUDED."status",
        "claimedAt" = NULL, "claimedBy" = NULL, "updatedAt" = NOW()`);
  }
}

/** A claimed row that failed (the model host was unreachable, say): try again later. */
export async function releaseClaims(client: Db, ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  await client.$executeRaw(Prisma.sql`
    UPDATE "ContentTranslation"
    SET "claimedAt" = NULL, "claimedBy" = NULL, "attempts" = "attempts" + 1, "updatedAt" = NOW()
    WHERE "id" = ANY(${[...ids]}::text[])`);
}

/** Per-language counts for the translator's status line. */
export async function translationCounts(
  client: Db,
): Promise<Array<{ lang: string; status: string; count: number }>> {
  const rows = await client.$queryRaw<Array<{ lang: string; status: string; count: bigint }>>(
    Prisma.sql`SELECT "lang", "status", COUNT(*)::bigint AS "count" FROM "ContentTranslation" GROUP BY 1, 2 ORDER BY 1, 2`,
  );
  return rows.map((r) => ({ lang: r.lang, status: r.status, count: Number(r.count) }));
}
