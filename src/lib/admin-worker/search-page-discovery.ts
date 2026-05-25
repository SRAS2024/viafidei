/**
 * Approved-source search-page discovery (spec section 5, discovery
 * method SEARCH_PAGE). Some Catholic publishers expose an HTML
 * search results page at a known URL pattern (e.g.
 * `?search=<query>`). This module fires a search query, parses the
 * result page as if it were a directory, and inserts the result
 * URLs as candidates.
 *
 * The search-page templates ship in code so each publisher's query
 * shape can be reviewed via PR — no operator-controlled query
 * construction (which would risk crafted parameter injection).
 */

import type { ChecklistContentType, PrismaClient } from "@prisma/client";

import { discoverFromInternalLinks } from "./internal-link-discovery";
import { writeAdminWorkerLog } from "./logs";

export interface SearchTemplate {
  /** URL template with `{q}` replaced by the URL-encoded query. */
  template: string;
  /** Content type the query targets. */
  contentType: ChecklistContentType;
  /** Friendly note. */
  note?: string;
}

export const SEARCH_TEMPLATES: readonly SearchTemplate[] = [
  // Intentionally empty by default — operators add per-publisher
  // search templates via PR. The shape is here so the engine is ready
  // the moment the operator approves a new template.
] as const;

const RUNTIME_EXTRA: SearchTemplate[] = [];

export function addSearchTemplate(template: SearchTemplate): void {
  RUNTIME_EXTRA.push(template);
}

export function listSearchTemplates(): readonly SearchTemplate[] {
  return [...SEARCH_TEMPLATES, ...RUNTIME_EXTRA];
}

export interface SearchDiscoveryOutcome {
  templatesUsed: number;
  inserted: number;
  rejected: number;
}

export async function discoverFromSearchPages(
  prisma: PrismaClient,
  query: string,
): Promise<SearchDiscoveryOutcome> {
  const safeQuery = encodeURIComponent(query.trim()).slice(0, 100);
  if (!safeQuery) {
    return { templatesUsed: 0, inserted: 0, rejected: 0 };
  }
  const templates = listSearchTemplates();
  let inserted = 0;
  let rejected = 0;
  for (const tmpl of templates) {
    const url = tmpl.template.replace("{q}", safeQuery);
    // The result page is itself just an internal-link page — reuse
    // the existing extractor + host-allowlist + junk filter.
    const outcome = await discoverFromInternalLinks(prisma, url);
    inserted += outcome.inserted;
    rejected += outcome.rejected;
  }
  await writeAdminWorkerLog(prisma, {
    category: "SOURCE_DISCOVERY",
    severity: "INFO",
    eventName: "search_page_discovery",
    message: `Search-page discovery for "${query.slice(0, 50)}": ${inserted} inserted, ${rejected} rejected.`,
    safeMetadata: { templatesUsed: templates.length, inserted, rejected },
  });
  return { templatesUsed: templates.length, inserted, rejected };
}
