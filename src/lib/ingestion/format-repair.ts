/**
 * Strict formatting repair pass — runs before strict validation so
 * upstream items with cosmetic flaws still get a chance to pass.
 *
 *   1. Normalize whitespace (collapse runs, strip leading/trailing).
 *   2. Decode HTML entities.
 *   3. Strip unsafe markup (`<script>`, `<iframe>`, inline event handlers).
 *   4. Normalize smart quotes / dashes.
 *   5. Enforce content-type-specific body shape (e.g. ensure prayer
 *      bodies end with terminator punctuation; ensure saint
 *      biographies end with a period).
 */

import type { IngestedItem } from "./types";

const ENTITY_REPLACEMENTS: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&rdquo;": "”",
  "&ldquo;": "“",
};

const SMART_QUOTE_TO_ASCII: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
};

const UNSAFE_TAG_RE = /<\/?(script|iframe|object|embed|style)[^>]*>/gi;
const ON_HANDLER_RE = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

export function repairText(input: string | null | undefined): string {
  if (!input) return "";
  let out = String(input);
  // Decode entities.
  out = out.replace(/&[a-zA-Z#0-9]+;/g, (m) => ENTITY_REPLACEMENTS[m] ?? m);
  // Strip unsafe markup.
  out = out.replace(UNSAFE_TAG_RE, "").replace(ON_HANDLER_RE, "");
  // Normalize whitespace (collapse runs, keep line breaks).
  out = out.replace(/[ \t\f\v]+/g, " ");
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.trim();
  // Normalize quote characters (we keep curly quotes in the persisted
  // version, but this normalization lets us match patterns reliably).
  for (const [from, to] of Object.entries(SMART_QUOTE_TO_ASCII)) {
    out = out.replaceAll(from, to);
  }
  return out;
}

/** Collect per-item formatting diagnostics for review-required items. */
export type FormattingDiagnostic = {
  field: string;
  issue: string;
};

export function diagnoseFormatting(item: IngestedItem): FormattingDiagnostic[] {
  const diagnostics: FormattingDiagnostic[] = [];
  const body =
    (item as { body?: string }).body ??
    (item as { biography?: string }).biography ??
    (item as { summary?: string }).summary ??
    (item as { bodyText?: string }).bodyText ??
    "";
  const title =
    (item as { defaultTitle?: string }).defaultTitle ??
    (item as { canonicalName?: string }).canonicalName ??
    (item as { title?: string }).title ??
    (item as { name?: string }).name ??
    "";
  if (!title || title.length < 2) {
    diagnostics.push({ field: "title", issue: "missing or too short" });
  }
  if (UNSAFE_TAG_RE.test(body)) {
    diagnostics.push({ field: "body", issue: "contains unsafe markup" });
  }
  if (/\s{4,}/.test(body)) {
    diagnostics.push({ field: "body", issue: "unusual whitespace runs" });
  }
  if (/[A-Z]{8,}/.test(body)) {
    diagnostics.push({ field: "body", issue: "long uppercase runs" });
  }
  if (item.kind === "prayer" && body.length > 0 && !/[.!?…]$/.test(body.trim())) {
    diagnostics.push({ field: "body", issue: "prayer body missing terminator punctuation" });
  }
  if (item.kind === "saint" && body.length > 0 && !/[.!?]$/.test(body.trim())) {
    diagnostics.push({ field: "biography", issue: "biography missing terminator punctuation" });
  }
  return diagnostics;
}

/**
 * Apply repair across every text field of an item. Returns a new
 * item so callers can chain through the existing pipeline without
 * mutating the upstream payload.
 */
export function repairIngestedItem<T extends IngestedItem>(item: T): T {
  const out = { ...item } as T;
  const candidateFields = [
    "defaultTitle",
    "canonicalName",
    "title",
    "name",
    "body",
    "biography",
    "summary",
    "bodyText",
    "practiceText",
    "officialPrayer",
  ] as const;
  for (const f of candidateFields) {
    const v = (item as Record<string, unknown>)[f];
    if (typeof v === "string") {
      (out as Record<string, unknown>)[f] = repairText(v);
    }
  }
  return out;
}
