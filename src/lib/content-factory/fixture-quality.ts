/**
 * Fixture quality diagnostics.
 *
 * Runs every bundled builder fixture through the real builder and
 * reports, per builder:
 *
 *   - builder name + version + content type
 *   - fixture count (valid / invalid / messy)
 *   - valid-fixture pass count (valid + messy fixtures that build)
 *   - invalid-fixture rejection count (invalid fixtures that reject)
 *   - false positive count (invalid fixtures that wrongly BUILT)
 *   - false negative count (valid fixtures that wrongly FAILED)
 *   - missing coverage areas (fixture kinds with no fixture)
 *
 * Pure + synchronous — runs the builders' `build()` functions, never
 * touches the database. Backs the admin fixture-quality dashboard
 * and proves the fixture suite still discriminates valid from
 * invalid content.
 */

import { ALL_BUILDER_FIXTURES, type BuilderFixture } from "./builder-fixtures";
import { getBuilder } from "./builders";
import { BUILDER_VERSION_REGISTRY } from "./builder-registry";
import type { ContentTypeKey } from "./types";

export type FixtureQualityRow = {
  contentType: string;
  builderName: string;
  builderVersion: string;
  fixtureCount: number;
  validCount: number;
  invalidCount: number;
  messyCount: number;
  /** Valid + messy fixtures that produced a complete package. */
  validPassCount: number;
  /** Invalid fixtures the builder correctly refused to build. */
  invalidRejectionCount: number;
  /** Invalid fixtures that wrongly produced a complete package. */
  falsePositiveCount: number;
  /** Valid fixtures that wrongly failed to build. */
  falseNegativeCount: number;
  /** Fixture kinds with zero fixtures. */
  missingCoverageAreas: string[];
};

export type FixtureQualityReport = {
  generatedAt: Date;
  rows: FixtureQualityRow[];
  /** True when no builder has a false positive or false negative. */
  healthy: boolean;
};

const REQUIRED_KINDS: ReadonlyArray<BuilderFixture["kind"]> = ["valid", "invalid", "messy"];

/** Run one fixture through its builder; true when a complete package is built. */
function fixtureBuilds(fx: BuilderFixture): boolean {
  try {
    const builder = getBuilder(fx.contentType);
    const result = builder.build({
      document: fx.document,
      sourceId: null,
      workerJobId: null,
      ingestionBatchId: null,
      sourcePurposes: fx.document.sourcePurposes,
    });
    return result.outcome === "built_complete_package";
  } catch {
    return false;
  }
}

export function getFixtureQualityReport(): FixtureQualityReport {
  const rows: FixtureQualityRow[] = [];

  for (const [contentType, fixtures] of Object.entries(ALL_BUILDER_FIXTURES)) {
    const registry = BUILDER_VERSION_REGISTRY[contentType as ContentTypeKey];
    const valid = fixtures.filter((f) => f.kind === "valid");
    const invalid = fixtures.filter((f) => f.kind === "invalid");
    const messy = fixtures.filter((f) => f.kind === "messy");

    // Valid + messy fixtures are expected to build; invalid to reject.
    const validBuilt = valid.filter(fixtureBuilds).length;
    const messyBuilt = messy.filter(fixtureBuilds).length;
    const invalidBuilt = invalid.filter(fixtureBuilds).length;

    const missingCoverageAreas = REQUIRED_KINDS.filter(
      (kind) => !fixtures.some((f) => f.kind === kind),
    );

    rows.push({
      contentType,
      builderName: registry?.builderName ?? "unknown",
      builderVersion: registry?.builderVersion ?? "unknown",
      fixtureCount: fixtures.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      messyCount: messy.length,
      validPassCount: validBuilt + messyBuilt,
      invalidRejectionCount: invalid.length - invalidBuilt,
      falsePositiveCount: invalidBuilt,
      falseNegativeCount: valid.length - validBuilt,
      missingCoverageAreas,
    });
  }

  rows.sort((a, b) => a.contentType.localeCompare(b.contentType));
  return {
    generatedAt: new Date(),
    rows,
    healthy: rows.every((r) => r.falsePositiveCount === 0 && r.falseNegativeCount === 0),
  };
}
