export type {
  IngestedKind,
  IngestedItem,
  IngestedPrayer,
  IngestedSaint,
  IngestedApparition,
  IngestedParish,
  IngestedDevotion,
  AdapterContext,
  AdapterResult,
  ConditionalState,
  SourceAdapter,
  IngestionRunSummary,
} from "./types";

export { normalizeSlug, isSlugUnique } from "./slug";
export { computeChecksum, checksumString } from "./checksum";
export { sanitize, validateItem } from "./validate";

export {
  registerAdapter,
  unregisterAdapter,
  getAdapter,
  listAdapters,
  listAdapterKeys,
  clearRegistry,
} from "./registry";

export { runAdapter, type RunnerOptions } from "./runner";
export {
  runAllActiveJobs,
  runJobByName,
  type SchedulerSummary,
  type SchedulerJobResult,
} from "./scheduler";

export {
  persistItems,
  dedupeBatch,
  normalizeExternalKey,
  type PersistResult,
  type PersistOutcome,
} from "./persist";

export {
  registerVaticanAdapters,
  ensureVaticanSchedule,
  hasRegisteredAdapters,
  isApprovedHost,
  isApprovedUrl,
  listApprovedHosts,
  buildAllVaticanCrawlers,
} from "./sources";
