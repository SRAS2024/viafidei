/**
 * Baseline content seeder CLI (spec §21).
 *
 * Drives one canonical fixture per spec content type through the
 * full factory pipeline (builder → normalize → enrich → cross-source
 * validation → strict QA → persist → public display verify →
 * search / sitemap verify → cache revalidate).
 *
 * Invocation:
 *
 *   tsx scripts/seed-baseline.ts
 *
 * Exits non-zero when any baseline fixture fails to persist so a
 * deployment-verification job can detect the breakage and surface
 * it on the production-readiness page.
 */

import { seedBaselineContent } from "../src/lib/content-factory/baseline-seed";

async function main() {
  console.log("Running baseline content seeder…");
  const results = await seedBaselineContent();
  let failed = 0;
  for (const r of results) {
    const status = r.ok ? "OK " : "FAIL";
    console.log(`${status} ${r.contentType.padEnd(20)} ${r.slug.padEnd(30)} ${r.decision}`);
    if (!r.ok) failed += 1;
  }
  if (failed > 0) {
    console.error(`Baseline seeder failed ${failed} of ${results.length} fixtures.`);
    process.exit(1);
  }
  console.log(`Baseline seeder succeeded for all ${results.length} fixtures.`);
}

main().catch((err) => {
  console.error("Baseline seeder crashed:", err);
  process.exit(1);
});
