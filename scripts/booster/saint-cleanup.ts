#!/usr/bin/env tsx
/**
 * Booster: clean up the published saint catalogue (see
 * src/lib/admin-worker/structured/saint-cleanup.ts for the rules).
 *
 *   1. unpublish (never delete) the Orthodox-only figures — Severus of Antioch
 *      (Q729105), Empress Theodora (Q204843) and any row whose Wikidata record
 *      proves the veneration is not Catholic (the repair lane's own rule);
 *      rows whose ARTICLE alone names another communion are only listed as
 *      suspects, unless `--unpublish-suspects`;
 *   2. re-status the "venerable" rows that came from the Orthodox monastic
 *      honorific (Q12774503) from their Catholic P411 status, else from the
 *      article infobox, else unpublish them;
 *   3. remove the feast of every Venerable / Servant of God whose stage is
 *      confirmed — a row Wikidata or its article puts past Venerable (Wikidata
 *      lags the causes) keeps its feast and is listed for review instead;
 *   4. list (no writes) published saints whose feast contradicts the first
 *      feast date of their article's infobox.
 *
 * DRY RUN BY DEFAULT: everything is read and decided, nothing is written.
 * `--apply` writes through the worker's own paths — unpublishStructuredSaint
 * (flag + WARN AdminWorkerLog + review row) and applyProtectedContentUpdate
 * (versioned, reversible) + an AdminWorkerLog row per change — and a summary
 * row (`booster_saint_cleanup`).
 *
 * Network: Wikidata Query Service (one request per 100 saints, through the
 * shared gate) and Wikipedia's Action API, one article at a time with the
 * worker's User-Agent. The feast audit reads one article per published saint
 * (~3,000); `--audit-limit=N` bounds it, `--only=` skips it.
 *
 * usage: tsx scripts/booster/saint-cleanup.ts [--apply] [--unpublish-suspects]
 *          [--only=orthodox,restatus,feastless,feast-audit]
 *          [--audit-limit=N] [--report=/path/report.json]
 *
 * DATABASE_URL names the database. Run the dry run first, read the actions and
 * the suspects, then run the same command again with --apply.
 */

// Every change must leave its log row: lift the per-event INFO sampler for this
// operator process only.
process.env.ADMIN_WORKER_EVENT_BUDGET_PER_HOUR ??= "100000";
process.env.INTELLIGENCE_BRAIN_ENABLED = "0";

import { writeFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  CLEANUP_CATEGORIES,
  runSaintCleanup,
  type CleanupCategory,
} from "../../src/lib/admin-worker/structured/saint-cleanup";
import { structuredNetworkEnabled } from "../../src/lib/admin-worker/structured/http";
import { parseBoosterFlags, wholeNumberFlag } from "./cli-args";

const USAGE =
  "usage: tsx scripts/booster/saint-cleanup.ts [--apply] [--unpublish-suspects] " +
  "[--only=orthodox,restatus,feastless,feast-audit] [--audit-limit=N] [--report=/path/report.json]";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  // A mistyped or malformed flag must never be read as something else:
  // "--unpublish-suspect" would run without the unpublish the operator meant,
  // and "--apply=false" used to WRITE.
  const parsed = parseBoosterFlags(process.argv.slice(2), {
    switches: ["apply", "unpublish-suspects"],
    values: ["only", "audit-limit", "report"],
  });
  if (!parsed.ok) {
    console.error(`${parsed.error}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  const flags = parsed.flags;
  const APPLY = flags.has("apply");
  const UNPUBLISH_SUSPECTS = flags.has("unpublish-suspects");
  const ONLY = String(flags.get("only") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const REPORT = String(flags.get("report") ?? "");
  const auditLimit = wholeNumberFlag(flags, "audit-limit", 0);
  if (auditLimit.error) {
    console.error(`${auditLimit.error}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  const AUDIT_LIMIT = auditLimit.value;
  const unknown = ONLY.filter((c) => !CLEANUP_CATEGORIES.includes(c as CleanupCategory));
  if (unknown.length) {
    console.error(
      `unknown --only part(s): ${unknown.join(", ")}; use ${CLEANUP_CATEGORIES.join(", ")}`,
    );
    process.exitCode = 2;
    return;
  }
  if (!structuredNetworkEnabled()) {
    console.error("ADMIN_WORKER_SKIP_NETWORK=1: the cleanup has to read Wikidata and Wikipedia.");
    process.exitCode = 2;
    return;
  }
  const prisma = new PrismaClient();
  try {
    log(
      APPLY
        ? "APPLY: changes will be written"
        : "DRY RUN: nothing will be written (--apply to write)",
    );
    const report = await runSaintCleanup(prisma, {
      apply: APPLY,
      categories: ONLY.length ? new Set(ONLY as CleanupCategory[]) : undefined,
      unpublishArticleSuspects: UNPUBLISH_SUSPECTS,
      auditLimit: AUDIT_LIMIT,
      log: (line) => log(line),
    });

    console.log("\n# actions (kind\tcategory\tapplied\tslug\tqid\tchanges\treason)");
    for (const a of report.actions) {
      console.log(
        [
          a.kind,
          a.category,
          a.applied === null ? "dry-run" : a.applied ? "applied" : `FAILED ${a.error ?? ""}`,
          a.slug,
          a.qid ?? "",
          JSON.stringify(a.changes),
          a.reason,
        ].join("\t"),
      );
    }
    console.log(
      "\n# stage review: sources disagree, nothing changed (slug\tqid\tpublished\twikidata\tarticle stage\tarticle)",
    );
    for (const r of report.stageReview) {
      console.log(
        [
          r.slug,
          r.qid ?? "",
          r.published,
          r.wikidata ?? "-",
          r.article ?? "-",
          r.articleUrl ?? "",
        ].join("\t"),
      );
    }
    console.log(
      `\n# suspects: article names only another communion (${UNPUBLISH_SUSPECTS ? "unpublished above" : "NOT changed; --unpublish-suspects to unpublish"}) (slug\tqid\tvenerated_in\tarticle)`,
    );
    for (const s of report.suspects) {
      console.log([s.slug, s.qid ?? "", s.venerated, s.article].join("\t"));
    }
    console.log(
      "\n# feast contradictions (kind\tslug\tqid\tpublished\tinfobox first\tinfobox value\tarticle)",
    );
    for (const c of report.feastContradictions) {
      console.log(
        [
          c.kind,
          c.slug,
          c.qid ?? "",
          c.publishedFeast,
          c.infoboxFeast,
          c.infoboxValue,
          c.article,
        ].join("\t"),
      );
    }
    const by = (k: string, cat: string) =>
      report.actions.filter((a) => a.kind === k && a.category === cat).length;
    console.log(
      `\n${report.dryRun ? "DRY RUN" : "APPLIED"}: examined ${report.examined} (${report.structured} from Wikidata, ` +
        `${report.factsResolved} resolved), ${report.articlesRead} articles read. ` +
        `Unpublish: ${by("unpublish", "orthodox")} Orthodox-only, ${by("unpublish", "restatus")} with no Catholic stage. ` +
        `Re-status: ${by("update", "restatus")}. Feast removed: ${report.actions.filter((a) => a.kind === "update" && a.changes.feastDay).length}. ` +
        `Stage review: ${report.stageReview.length}. ` +
        `Suspects listed: ${report.suspects.length}. ` +
        `Feast contradictions listed: ${report.feastContradictions.length}.` +
        (report.errors.length ? ` Errors: ${report.errors.join("; ")}` : ""),
    );
    if (REPORT) {
      writeFileSync(REPORT, JSON.stringify(report, null, 2));
      log(`report written to ${REPORT}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[saint-cleanup] fatal:", e);
  process.exitCode = 1;
});
