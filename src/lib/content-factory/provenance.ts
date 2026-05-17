/**
 * Field provenance helpers.
 *
 * Every required field in a built content package carries a
 * FieldProvenance record. The record answers four questions: where
 * the value came from (URL, host, document, heading, section), how
 * it was produced (extraction method, extractor version), how
 * confident the extractor is (0..1), and when the value was
 * extracted.
 *
 * Deterministic rules (slug normalisation, sacrament group mapping,
 * ISO date parse) record a method of `deterministic` with confidence
 * 1.0 and no snippet hash — see the contract on `FieldProvenance`.
 */

import { createHash } from "node:crypto";
import type { FieldProvenance, PackageProvenance, SourceDocumentSnapshot } from "./types";

export function hashSnippet(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return createHash("sha256").update(trimmed).digest("hex");
}

export function provenance(args: {
  document: SourceDocumentSnapshot;
  method: string;
  builderVersion: string;
  snippet?: string | null;
  heading?: string | null;
  section?: string | null;
  confidence?: number;
}): FieldProvenance {
  return {
    sourceUrl: args.document.sourceUrl,
    sourceHost: args.document.sourceHost,
    sourceDocumentId: args.document.id ?? null,
    sourceHeading: args.heading ?? null,
    sourceSection: args.section ?? null,
    snippetHash: args.snippet ? hashSnippet(args.snippet) : null,
    extractionMethod: args.method,
    extractorVersion: args.builderVersion,
    confidence: clampConfidence(args.confidence ?? 0.85),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Deterministic field provenance — used for values derived from
 * internal rules (slug normalisation, sacrament group mapping).
 * No snippet hash, confidence 1.0.
 */
export function deterministicProvenance(args: {
  document: SourceDocumentSnapshot;
  method: string;
  builderVersion: string;
  rule: string;
}): FieldProvenance {
  return {
    sourceUrl: args.document.sourceUrl,
    sourceHost: args.document.sourceHost,
    sourceDocumentId: args.document.id ?? null,
    sourceHeading: null,
    sourceSection: args.rule,
    snippetHash: null,
    extractionMethod: `deterministic:${args.method}`,
    extractorVersion: args.builderVersion,
    confidence: 1,
    timestamp: new Date().toISOString(),
  };
}

export function mergeProvenance(...records: PackageProvenance[]): PackageProvenance {
  const out: PackageProvenance = {};
  for (const r of records) {
    if (!r) continue;
    Object.assign(out, r);
  }
  return out;
}

function clampConfidence(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Required fields without provenance fail QA unless they come from a
 * deterministic internal rule. This helper enforces that invariant
 * at build time.
 */
export function ensureProvenance(args: {
  payload: Record<string, unknown>;
  provenance: PackageProvenance;
  requiredFields: ReadonlyArray<string>;
  deterministicFields?: ReadonlyArray<string>;
}): { ok: true } | { ok: false; missing: string[] } {
  const det = new Set(args.deterministicFields ?? []);
  const missing: string[] = [];
  for (const f of args.requiredFields) {
    const present = args.payload[f] != null && args.payload[f] !== "";
    if (!present) {
      missing.push(`${f}:value`);
      continue;
    }
    if (det.has(f)) continue;
    if (!args.provenance[f]) missing.push(`${f}:provenance`);
  }
  if (missing.length === 0) return { ok: true };
  return { ok: false, missing };
}
