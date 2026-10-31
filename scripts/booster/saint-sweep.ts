#!/usr/bin/env tsx
/**
 * Booster: sweep the whole Wikidata SAINT corpus through the worker's own
 * structured ingest, page after page, until the corpus is exhausted (rules in
 * src/lib/admin-worker/structured/sweep.ts).
 *
 *   - SAME PUBLISH PATH: every page is one `runStructuredIngest` pass — the
 *     fixed saint mapper and its feast / stage gates, the live-row dedup, the
 *     rejection memory, `runPublishOrchestrator`. Nothing is published that the
 *     worker's lane would not publish.
 *   - RESUMABLE: the sweep walks its own cursor, `wikidata-saints@booster`,
 *     stored in AdminWorkerMemory; rerun the command and it carries on from
 *     the last page it finished. `--restart` starts over from offset 0 (and
 *     ends the rest a finished sweep takes); `--wake` ends the rest the ingest
 *     imposes after the Query Service was declared unusable, keeping the
 *     offset.
 *   - SERIAL WIKIPEDIA: one request in flight at a time in this process (the
 *     http.ts queue, Retry-After honoured), rows mapped one at a time, with a
 *     `--spacing-ms` gap between request starts (default 100) and the
 *     worker's identifying User-Agent. A lease makes a lease-aware worker
 *     leave SAINT alone while the sweep runs; the sweep warns if the running
 *     worker predates leases (then pause its structured lane, or deploy this
 *     branch first).
 *   - LOGS PROGRESS: one line per page here, the pass's own
 *     `structured_knowledge_ingest` AdminWorkerLog row per page, and a
 *     `booster_structured_sweep` row at the start and at the end.
 *   - Ctrl-C stops after the page in hand (a second Ctrl-C stops at once; the
 *     lease is released either way, and an interrupted page is simply redone).
 *
 * Preview a page without writing anything first, if wanted:
 *   npx tsx scripts/maintenance/diagnose-structured-ingest.ts SAINT --batch 200 --offset N
 *
 * usage: tsx scripts/booster/saint-sweep.ts [--max-pages=N] [--batch=200]
 *          [--limit=N] [--spacing-ms=100] [--page-budget-min=30]
 *          [--restart | --wake] [--holder=NAME]
 *
 * DATABASE_URL names the database; the network must be enabled
 * (ADMIN_WORKER_SKIP_NETWORK unset).
 */

// Every page's pass must leave its log row: lift the per-event INFO sampler
// for this operator process only. The ingest never consults the brain.
process.env.ADMIN_WORKER_EVENT_BUDGET_PER_HOUR ??= "100000";
process.env.INTELLIGENCE_BRAIN_ENABLED = "0";

import { hostname } from "node:os";

import { PrismaClient } from "@prisma/client";

import { structuredNetworkEnabled } from "../../src/lib/admin-worker/structured/http";
import { ingestorFor } from "../../src/lib/admin-worker/structured/ingestors";
import { releaseIngestorLease } from "../../src/lib/admin-worker/structured/lease";
import { runStructuredSweep } from "../../src/lib/admin-worker/structured/sweep";
import { parseBoosterFlags, wholeNumberFlag } from "./cli-args";

const USAGE =
  "usage: tsx scripts/booster/saint-sweep.ts [--max-pages=N] [--batch=200] [--limit=N] " +
  "[--spacing-ms=100] [--page-budget-min=30] [--restart | --wake] [--holder=NAME]";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const parsed = parseBoosterFlags(process.argv.slice(2), {
    switches: ["restart", "wake"],
    values: ["max-pages", "batch", "limit", "spacing-ms", "page-budget-min", "holder"],
  });
  if (!parsed.ok) {
    console.error(`${parsed.error}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  const flags = parsed.flags;
  if (flags.has("restart") && flags.has("wake")) {
    console.error("--restart and --wake are exclusive");
    process.exitCode = 2;
    return;
  }
  // Every count is at least 1: a page of 0, a limit of 0 or a budget of 0
  // finishes nothing, holds its page and asks the Query Service for it again.
  const numbers = {
    maxPages: wholeNumberFlag(flags, "max-pages", 1),
    batch: wholeNumberFlag(flags, "batch", 1),
    limit: wholeNumberFlag(flags, "limit", 1),
    pageBudgetMin: wholeNumberFlag(flags, "page-budget-min", 1),
    spacing: wholeNumberFlag(flags, "spacing-ms", 0),
  };
  const bad = Object.values(numbers).find((n) => n.error);
  if (bad) {
    console.error(`${bad.error}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  if (!structuredNetworkEnabled()) {
    console.error("ADMIN_WORKER_SKIP_NETWORK=1: the sweep has to read Wikidata and Wikipedia.");
    process.exitCode = 2;
    return;
  }
  const maxPages = numbers.maxPages.value;
  const batch = numbers.batch.value ?? 200;
  const limit = numbers.limit.value;
  const pageBudgetMin = numbers.pageBudgetMin.value ?? 30;
  const spacing = numbers.spacing.value ?? 100;
  // Read at request time by the serial Wikimedia queue (http.ts).
  process.env.ADMIN_WORKER_WIKIMEDIA_SPACING_MS = String(spacing);

  const ingestorId = ingestorFor("SAINT")?.id ?? "wikidata-saints";
  const holderFlag = flags.get("holder");
  const holder =
    typeof holderFlag === "string"
      ? holderFlag
      : `${ingestorId}-sweep@${hostname()}:${process.pid}`;
  const prisma = new PrismaClient();

  let signals = 0;
  const onSignal = () => {
    signals += 1;
    if (signals === 1) {
      log("stopping after the page in hand (Ctrl-C again to stop now)");
      return;
    }
    if (signals === 2) {
      // The interrupted page is redone on the next run; release the lease so
      // the worker takes SAINT back at once instead of when it expires.
      log("stopping now; releasing the lease");
      void releaseIngestorLease(prisma, ingestorId, holder).finally(() => process.exit(130));
      return;
    }
    process.exit(130);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    const result = await runStructuredSweep(prisma, {
      contentType: "SAINT",
      batch,
      limit,
      maxPages,
      pageBudgetMs: pageBudgetMin * 60 * 1000,
      restart: flags.has("restart"),
      wake: flags.has("wake"),
      holder,
      shouldStop: () => signals > 0,
      log: (line) => log(line),
    });
    console.log(
      `\n${result.stop}: ${result.detail}\n` +
        `published ${result.published} over ${result.pages} page(s), offset ${result.startOffset ?? "?"} → ${result.endOffset ?? "?"}; ` +
        `${result.alreadyPublished} already live, ${result.rejectionsDeferred} known rejections deferred, ${result.skipped} skipped` +
        `; ${Math.round(result.elapsedMs / 60000)} min` +
        (result.workerIgnoringLease
          ? `\nWARNING: the worker ran SAINT at ${result.workerIgnoringLease} despite the lease.`
          : ""),
    );
    if (
      result.stop === "leased_elsewhere" ||
      result.stop === "unknown_content_type" ||
      result.stop === "stalled"
    ) {
      process.exitCode = 3;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[saint-sweep] fatal:", e);
  process.exitCode = 1;
});
