export { prisma } from "./client";
export {
  checkRequiredTables,
  checkSeedContent,
  checkMigrationsApplied,
  probePublicContentTables,
  PUBLIC_CONTENT_TABLES,
  type TableCheckResult,
  type MigrationCheckResult,
} from "./tables";
export { assertDatabaseReady, type InitResult } from "./init";
