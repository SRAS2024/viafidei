#!/usr/bin/env tsx
/**
 * Why did the structured ingest drop those rows?
 *
 * Reads ONE page from a structured ingestor's real sources (Wikidata SPARQL +
 * Wikipedia REST), runs the real mappers, and prints the reason histogram with
 * example entities per reason — the same reason codes the pass log now
 * carries, so a log line and this script speak the same language.
 *
 * Motivation: on 2026-09-07 production reported
 *   wikidata-spiritual-practices: fetched 68, 1 already live, 66 SKIPPED
 * and nothing anywhere said why. This is the tool that answers that, and the
 * tool the next phase uses to decide which of those 66 are correct rejections
 * and which are bugs.
 *
 * SAFETY — this script is strictly READ-ONLY:
 *   - it never publishes and never calls the publish orchestrator;
 *   - its import graph contains no Prisma client and no publish orchestrator
 *     (the page fetch lives in `source-page.ts` precisely so this script does
 *     not have to import `ingest.ts`), so it CANNOT write to any database,
 *     local or production, and is safe to run while the worker keeps
 *     publishing;
 *   - it never advances a cursor or touches AdminWorkerMemory;
 *   - it is gentler on the sources than the ingest lane (concurrency 2, not 8,
 *     with a pause between batches), so a diagnostic run does not spend the
 *     worker's Wikidata / Wikipedia rate budget.
 *
 * Usage:
 *   npx tsx scripts/maintenance/diagnose-structured-ingest.ts --list
 *   npx tsx scripts/maintenance/diagnose-structured-ingest.ts SPIRITUAL_PRACTICE
 *   npx tsx scripts/maintenance/diagnose-structured-ingest.ts wikidata-saints \
 *       --batch 40 --offset 200 --examples 5
 *   npx tsx scripts/maintenance/diagnose-structured-ingest.ts SAINT --json
 *
 * The target is a content type (SAINT) or an ingestor id (wikidata-saints).
 * Flags: --batch N (default 25), --offset N (default 0), --examples N
 * (default 3), --concurrency N (default 2), --spacing MS (default 400),
 * --json for machine-readable output.
 *
 * ADMIN_WORKER_SKIP_NETWORK=1 disables all outbound requests; the script says
 * so and exits rather than reporting a page of `wikipedia_fetch_failed`.
 */
import {
  diagnoseStructuredPage,
  rejectionsByCode,
  type DiagnosedRejection,
} from "../../src/lib/admin-worker/structured/diagnose";
import { STRUCTURED_INGESTORS } from "../../src/lib/admin-worker/structured/ingestors";
import { structuredNetworkEnabled } from "../../src/lib/admin-worker/structured/http";

interface Options {
  target: string | null;
  batch: number;
  offset: number;
  examples: number;
  concurrency: number;
  spacingMs: number;
  json: boolean;
  list: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    target: null,
    batch: 25,
    offset: 0,
    examples: 3,
    concurrency: 2,
    spacingMs: 400,
    json: false,
    list: false,
  };
  const num = (raw: string | undefined, fallback: number): number => {
    const n = Number((raw ?? "").trim());
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--list":
        opts.list = true;
        break;
      case "--json":
        opts.json = true;
        break;
      case "--batch":
        opts.batch = num(argv[(i += 1)], opts.batch);
        break;
      case "--offset":
        opts.offset = num(argv[(i += 1)], opts.offset);
        break;
      case "--examples":
        opts.examples = num(argv[(i += 1)], opts.examples);
        break;
      case "--concurrency":
        opts.concurrency = num(argv[(i += 1)], opts.concurrency);
        break;
      case "--spacing":
        opts.spacingMs = num(argv[(i += 1)], opts.spacingMs);
        break;
      default:
        if (!arg.startsWith("-") && !opts.target) opts.target = arg;
        break;
    }
  }
  return opts;
}

/** Name an entity the way an operator can paste it into a browser. */
function nameOf(e: DiagnosedRejection): string {
  const label = e.label ?? e.slug ?? "(unlabelled row)";
  return e.qid ? `${label} [${e.qid}]` : label;
}

function listIngestors(): void {
  console.log("Structured ingestors:\n");
  for (const i of STRUCTURED_INGESTORS) {
    console.log(`  ${i.id.padEnd(32)} ${i.contentType}`);
  }
  console.log("\nPass a content type or an ingestor id as the first argument.");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.list || !opts.target) {
    listIngestors();
    // `--list` is a successful run; no target at all is a usage error.
    process.exitCode = opts.list ? 0 : 1;
    return;
  }

  const target = opts.target;
  const ingestor = STRUCTURED_INGESTORS.find(
    (i) => i.id === target || i.contentType === target.toUpperCase(),
  );
  if (!ingestor) {
    console.error(`Unknown ingestor or content type: ${target}\n`);
    listIngestors();
    process.exitCode = 1;
    return;
  }

  if (!structuredNetworkEnabled()) {
    console.error(
      "ADMIN_WORKER_SKIP_NETWORK=1 is set — every source fetch would be a no-op and\n" +
        "the diagnosis would be meaningless. Unset it and re-run.",
    );
    process.exitCode = 1;
    return;
  }

  const started = Date.now();
  const diagnosis = await diagnoseStructuredPage({
    ingestor,
    batch: opts.batch,
    offset: opts.offset,
    concurrency: opts.concurrency,
    spacingMs: opts.spacingMs,
  });
  const byCode = rejectionsByCode(diagnosis, opts.examples);

  if (opts.json) {
    console.log(JSON.stringify({ ...diagnosis, byCode }, null, 2));
    return;
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n${ingestor.id}  (${ingestor.contentType})`);
  console.log(`READ-ONLY diagnosis — nothing published, no database touched.\n`);

  if (diagnosis.sourceFailed) {
    console.log("The SPARQL source FAILED for this page — no rows to diagnose.");
    console.log("Re-run in a few minutes; the query service throttles aggressively.");
    process.exitCode = 1;
    return;
  }

  const dropped = diagnosis.rejections.length;
  const pct = diagnosis.rows > 0 ? Math.round((dropped / diagnosis.rows) * 100) : 0;
  console.log(`  offset ${diagnosis.offset}, page ${diagnosis.batch}`);
  console.log(`  enumerated ${diagnosis.enumerated}, hydrated ${diagnosis.rows} row(s)`);
  console.log(`  mapped OK  ${diagnosis.accepted.length}`);
  console.log(`  dropped    ${dropped} (${pct}% of the page)   in ${seconds}s\n`);

  if (byCode.length === 0) {
    console.log("  Nothing was dropped on this page.");
  } else {
    console.log("  REASON HISTOGRAM");
    for (const { code, count } of byCode) {
      const share = diagnosis.rows > 0 ? Math.round((count / diagnosis.rows) * 100) : 0;
      console.log(`    ${String(count).padStart(4)}  ${String(share).padStart(3)}%  ${code}`);
    }
    console.log("\n  EXAMPLES");
    for (const { code, count, examples } of byCode) {
      console.log(`    ${code} (${count})`);
      for (const e of examples) {
        console.log(`      - ${nameOf(e)}`);
        if (e.detail) console.log(`          ${e.detail}`);
      }
    }
  }

  if (diagnosis.accepted.length > 0) {
    console.log("\n  WOULD PUBLISH");
    for (const e of diagnosis.accepted.slice(0, opts.examples)) {
      console.log(`    - ${e.label ?? e.slug ?? "(unnamed)"}${e.qid ? ` [${e.qid}]` : ""}`);
    }
    if (diagnosis.accepted.length > opts.examples) {
      console.log(`    … and ${diagnosis.accepted.length - opts.examples} more`);
    }
  }
  console.log("");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exitCode = 1;
});
