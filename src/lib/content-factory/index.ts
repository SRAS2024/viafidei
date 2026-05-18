/**
 * Public surface of the content factory.
 *
 * The content factory sits between source fetching and strict QA. It
 * is the only path through which content reaches the public catalog:
 *
 *   Source discovery → Source fetch → SourceDocument
 *     → Builder (one per content type)
 *     → Normalize → Enrich
 *     → Strict QA
 *     → persistBuiltPackage()
 *     → Public render gate
 *     → Monitoring (SourceQualityScore + ContentPackageBuildLog)
 */

export * from "./types";
export {
  recordSourceDocument,
  getSourceDocument,
  syntheticSourceDocument,
  cleanSourceBody,
  type RecordSourceDocumentInput,
  type RecordedSourceDocument,
} from "./source-document";
export { recordBuildLog, listRecentBuildFailures } from "./build-log";
export { provenance, deterministicProvenance, ensureProvenance } from "./provenance";
export { normalizePackage } from "./normalize";
export { enrichPackage } from "./enrich";
export { persistBuiltPackage, type PersistResult, type PersistBuiltPackageInput } from "./persist";
export { runContentFactory, type FactoryRunInput, type FactoryRunResult } from "./factory";
export { recordScoreEvent, listSourceQualityScores } from "./source-scoring";
export { runGrowthIntelligence, type GrowthIntelligenceReport } from "./growth-intelligence";
export {
  BUILDER_VERSION_REGISTRY,
  getBuilderRegistryEntry,
  listBuilderRegistry,
  type BuilderRegistryEntry,
} from "./builder-registry";
export {
  BUILDER_REGISTRY,
  getBuilder,
  PrayerBuilder,
  SaintBuilder,
  MarianApparitionBuilder,
  ParishBuilder,
  DevotionBuilder,
  NovenaBuilder,
  SacramentBuilder,
  RosaryBuilder,
  ConsecrationBuilder,
  SpiritualGuidanceBuilder,
  LiturgyBuilder,
  HistoryBuilder,
  buildScriptureBlock,
  APP_SCRIPTURE_TRANSLATION_POLICY,
} from "./builders";
