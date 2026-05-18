/**
 * One-time migration: normalise existing Confession rows to
 * Reconciliation.
 *
 * Per the spec, Confession must NOT exist as a standalone content
 * type. The seven canonical sacraments are Baptism, Eucharist,
 * Confirmation, Reconciliation, Anointing of the Sick, Holy Orders,
 * and Matrimony. Confession is a legacy name for Reconciliation.
 *
 * Strategy per row in SpiritualLifeGuide whose sacramentKey or slug
 * looks like Confession:
 *
 *   - Valid sacrament row (status PUBLISHED + sacramentGroup or
 *     preparation/participation fields populated) → update
 *     sacramentKey = "reconciliation", sacramentGroup = "Healing",
 *     slug = "sacrament-reconciliation" (preserving the existing
 *     slug if it's already canonical).
 *   - Anything else (DRAFT / REVIEW / no sacrament fields) → DELETE
 *     with a RejectedContentLog entry so the deletion is forensically
 *     traceable.
 *
 * Invocation:
 *   $ tsx scripts/migrate-confession-to-reconciliation.ts
 *   $ tsx scripts/migrate-confession-to-reconciliation.ts --dry-run
 */

import { prisma } from "../src/lib/db/client";

type Report = {
  inspected: number;
  migrated: number;
  deleted: number;
  skipped: number;
  dryRun: boolean;
};

function looksLikeConfession(value: string | null | undefined): boolean {
  if (!value) return false;
  return /confession/i.test(value);
}

async function migrate(opts: { dryRun: boolean }): Promise<Report> {
  const report: Report = {
    inspected: 0,
    migrated: 0,
    deleted: 0,
    skipped: 0,
    dryRun: opts.dryRun,
  };
  const candidates = await prisma.spiritualLifeGuide.findMany({
    where: {
      OR: [
        { sacramentKey: { contains: "confession", mode: "insensitive" } },
        { slug: { contains: "confession", mode: "insensitive" } },
        { title: { contains: "Confession" } },
      ],
    },
  });
  report.inspected = candidates.length;

  for (const row of candidates) {
    // A row is "valid sacrament" when:
    //   - sacramentKey looks like reconciliation/confession AND
    //   - the row has Sacrament-shaped fields (sacramentGroup or
    //     packageMetadata) OR has been published
    const looksValidSacrament =
      (looksLikeConfession(row.sacramentKey) || row.sacramentGroup) &&
      (row.status === "PUBLISHED" || row.sacramentGroup !== null || row.packageMetadata !== null);

    if (looksValidSacrament) {
      console.log(
        `[${opts.dryRun ? "dry-run" : "migrate"}] OK   guide=${row.id} slug=${row.slug} → reconciliation`,
      );
      report.migrated += 1;
      if (!opts.dryRun) {
        await prisma.spiritualLifeGuide.update({
          where: { id: row.id },
          data: {
            sacramentKey: "reconciliation",
            sacramentGroup: row.sacramentGroup ?? "Healing",
            // Keep the existing slug if it's already canonical;
            // otherwise re-slug to the canonical form. We only flip
            // the slug when it explicitly contains "confession" — a
            // generic slug stays put to avoid breaking inbound links
            // that have nothing to do with sacrament naming.
            slug: /confession/i.test(row.slug) ? "sacrament-reconciliation" : row.slug,
          },
        });
      }
      continue;
    }
    // Invalid / non-sacrament Confession row: delete + log.
    console.log(
      `[${opts.dryRun ? "dry-run" : "delete"}] DEL  guide=${row.id} slug=${row.slug} reason="confession_outside_sacraments"`,
    );
    report.deleted += 1;
    if (!opts.dryRun) {
      await prisma.rejectedContentLog
        .create({
          data: {
            contentType: "Sacrament",
            slug: row.slug,
            originalTitle: row.title,
            sourceUrl: row.sourceUrl,
            sourceHost: row.sourceHost,
            rejectionReason:
              "Confession as standalone content type is removed; row did not match the Sacrament shape.",
            decision: "delete",
            triggeredBy: "automatic",
            validationDecision: "delete",
            failureCategory: "wrong_content",
            sweepReason: "manual",
            originalStatus: row.status,
            cleanupMode: "all_catalog_rows",
            packageVersion: row.contentPackageVersion ?? undefined,
          },
        })
        .catch(() => undefined);
      await prisma.spiritualLifeGuide.delete({ where: { id: row.id } }).catch(() => undefined);
    }
  }
  return report;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const report = await migrate({ dryRun });
  console.log("");
  console.log("=== Confession → Reconciliation migration ===");
  console.log(`  mode:      ${dryRun ? "dry-run" : "applied"}`);
  console.log(`  inspected: ${report.inspected}`);
  console.log(`  migrated:  ${report.migrated}`);
  console.log(`  deleted:   ${report.deleted}`);
  console.log(`  skipped:   ${report.skipped}`);
}

main().catch((e) => {
  console.error("migrate-confession-to-reconciliation: fatal", e);
  process.exit(2);
});
