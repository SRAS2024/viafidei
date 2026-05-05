import { logger } from "./logger";

/**
 * Categorise the reason a public content page or API route could not render
 * so the log line tells ops *why* the request bailed (missing record vs. DB
 * outage vs. bad slug lookup) rather than only "request failed". Each
 * category maps to a specific remediation: bad-slug → fix the link / sitemap;
 * missing-record → re-run the ingester; missing-table or missing-column →
 * run migrations; db-error → check the database connection / pool.
 */
export type PageFailureKind =
  | "missing_content"
  | "bad_slug"
  | "missing_record"
  | "missing_table"
  | "missing_column"
  | "db_connection"
  | "db_query"
  | "migration_required"
  | "validation_error"
  | "route_error";

export type PageFailureFields = {
  route: string;
  slug?: string;
  entityType?: string;
  table?: string;
  query?: string;
  error?: unknown;
};

const TABLE_MISSING_RE = /relation .* does not exist|table .* does not exist/i;
const COLUMN_MISSING_RE = /column .* does not exist|column .* of relation .* does not exist/i;
const CONNECTION_RE = /ECONN|ETIMEDOUT|connection|database is starting up|too many clients/i;
const MIGRATION_RE = /_prisma_migrations|migration/i;
const DB_QUERY_RE = /prisma|postgres|syntax error|column reference/i;

export function classifyPageError(error: unknown): PageFailureKind {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message) return "route_error";
  if (TABLE_MISSING_RE.test(message)) return "missing_table";
  if (COLUMN_MISSING_RE.test(message)) return "missing_column";
  if (CONNECTION_RE.test(message)) return "db_connection";
  if (MIGRATION_RE.test(message)) return "migration_required";
  if (DB_QUERY_RE.test(message)) return "db_query";
  return "route_error";
}

export function logPageMissingContent(fields: PageFailureFields & { reason?: PageFailureKind }) {
  logger.warn("page.content_missing", {
    kind: fields.reason ?? "missing_content",
    route: fields.route,
    slug: fields.slug,
    entityType: fields.entityType,
    table: fields.table,
  });
}

export function logPageError(fields: PageFailureFields) {
  const kind = classifyPageError(fields.error);
  const message = fields.error instanceof Error ? fields.error.message : String(fields.error ?? "");
  const stack = fields.error instanceof Error ? fields.error.stack : undefined;
  logger.error("page.render_failed", {
    kind,
    route: fields.route,
    slug: fields.slug,
    entityType: fields.entityType,
    table: fields.table,
    query: fields.query,
    error: message,
    stack,
  });
}

/**
 * Same classification as logPageError, but emitted with a route-handler
 * label so a 500 from /api/* shows up under "api.request_failed" instead of
 * "page.render_failed".
 */
export function logApiError(fields: PageFailureFields & { method?: string; status?: number }) {
  const kind = classifyPageError(fields.error);
  const message = fields.error instanceof Error ? fields.error.message : String(fields.error ?? "");
  const stack = fields.error instanceof Error ? fields.error.stack : undefined;
  logger.error("api.request_failed", {
    kind,
    method: fields.method,
    route: fields.route,
    status: fields.status,
    table: fields.table,
    query: fields.query,
    error: message,
    stack,
  });
}
