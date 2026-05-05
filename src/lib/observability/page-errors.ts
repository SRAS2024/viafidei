import { logger } from "./logger";

/**
 * Categorise the reason a public content page could not render so the log line
 * tells ops *why* the page bailed (missing record vs. DB outage vs. bad slug
 * lookup) rather than only "page failed". Each category maps to a specific
 * remediation: bad-slug → fix the link / sitemap; missing-record → re-run the
 * ingester; missing-table → run migrations; db-error → check the database
 * connection / pool.
 */
export type PageFailureKind =
  | "missing_content"
  | "bad_slug"
  | "missing_record"
  | "missing_table"
  | "db_connection"
  | "route_error";

export type PageFailureFields = {
  route: string;
  slug?: string;
  entityType?: string;
  error?: unknown;
};

const TABLE_MISSING_RE = /relation .* does not exist|table .* does not exist/i;
const CONNECTION_RE = /ECONN|ETIMEDOUT|connection|database is starting up|too many clients/i;

export function classifyPageError(error: unknown): PageFailureKind {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message) return "route_error";
  if (TABLE_MISSING_RE.test(message)) return "missing_table";
  if (CONNECTION_RE.test(message)) return "db_connection";
  return "route_error";
}

export function logPageMissingContent(fields: PageFailureFields & { reason?: PageFailureKind }) {
  logger.warn("page.content_missing", {
    kind: fields.reason ?? "missing_content",
    route: fields.route,
    slug: fields.slug,
    entityType: fields.entityType,
  });
}

export function logPageError(fields: PageFailureFields) {
  const kind = classifyPageError(fields.error);
  const message = fields.error instanceof Error ? fields.error.message : String(fields.error ?? "");
  logger.error("page.render_failed", {
    kind,
    route: fields.route,
    slug: fields.slug,
    entityType: fields.entityType,
    error: message,
  });
}
