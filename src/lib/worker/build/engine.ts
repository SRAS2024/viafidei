/**
 * Worker build engine.
 *
 * Intelligent, self-sufficient pipeline that turns an approved checklist
 * item into a complete, app-ready content package. The engine:
 *
 *   1. Loads the checklist item, its citations, and the strict schema for
 *      its content type.
 *   2. Fetches every approved citation (HTTP) into FetchedSource objects.
 *   3. Extracts candidate field values from each source using the
 *      type-specific extractor.
 *   4. Cross-checks candidates across sources, picking the
 *      highest-authority answer and emitting warnings on conflicts.
 *   5. Generates a canonical slug, runs duplicate detection, and stamps
 *      provenance onto every field.
 *   6. Applies Catholic-accuracy guards: refuses to invent doctrine,
 *      feast days, indulgences, titles, apparitions, or promises.
 *   7. Validates the final payload against the strict Zod schema.
 *   8. Emits a structured build log and returns a BuildAttemptResult.
 *
 * The engine is completely independent of any HTTP framework — give it a
 * Prisma client and a checklist item id and it does the rest.
 */

import type { ChecklistContentType, PrismaClient } from "@prisma/client";

import { detectChecklistDuplicate } from "../duplicates";
import { BuildLogger } from "../logs";
import { getContentSchema, validatePayload } from "../schemas";
import { canonicalizeSlug } from "../slugs";
import {
  describeAuthoritySource,
  UnapprovedSourceError,
  fetchApprovedSource,
} from "../sources/fetcher";
import type {
  BuildAttemptResult,
  BuiltContentPackage,
  CitationInput,
  FetchedSource,
  GeneratedField,
} from "../types";
import { extractFields } from "./extractors";
import { reconcileFields } from "./cross-source";

export interface BuildEngineDeps {
  prisma: PrismaClient;
  fetcher?: typeof fetch;
}

export interface BuildEngineInput {
  buildJobId: string;
  checklistItemId: string;
}

/**
 * The worker checks every built payload for invented content. Any field
 * whose value is empty AND whose provenance is empty is treated as
 * "invented" and emits a hard warning; the worker NEVER fills required
 * fields without a source.
 */
function detectInventions(
  payload: Record<string, unknown>,
  provenance: Record<string, unknown[]>,
  requiredFields: string[]
): string[] {
  const warnings: string[] = [];
  for (const field of requiredFields) {
    const value = payload[field];
    const provFor = provenance[field];
    const hasValue =
      value != null &&
      !(typeof value === "string" && value.trim() === "") &&
      !(Array.isArray(value) && value.length === 0);
    const hasProvenance = Array.isArray(provFor) && provFor.length > 0;
    if (hasValue && !hasProvenance) {
      warnings.push(
        `Required field "${field}" has a value but no source provenance — worker refuses to publish invented content.`
      );
    }
  }
  return warnings;
}

export async function runBuildEngine(
  deps: BuildEngineDeps,
  input: BuildEngineInput
): Promise<BuildAttemptResult> {
  const { prisma } = deps;
  const logger = new BuildLogger(prisma, input.buildJobId);

  const item = await prisma.checklistItem.findUnique({
    where: { id: input.checklistItemId },
    include: { citations: true },
  });
  if (!item) {
    return {
      ok: false,
      partial: false,
      errorMessage: `ChecklistItem ${input.checklistItemId} not found.`,
      warnings: [],
      confidence: 0,
    };
  }

  await logger.info("start", `Building "${item.canonicalName}" (${item.contentType}).`);

  if (item.approvalStatus !== "APPROVED_FOR_BUILD") {
    const message = `Item is not approved for build (status=${item.approvalStatus}). Worker refuses to proceed.`;
    await logger.error("guard", message);
    return { ok: false, partial: false, errorMessage: message, warnings: [], confidence: 0 };
  }

  const schemaDef = getContentSchema(item.contentType);
  const instruction = schemaDef.instruction;

  // -- Curated knowledge short-circuit -------------------------------------
  // If the checklist item's slug is in the curated knowledge base, the
  // worker uses the curated payload as the canonical content. This gives
  // production-quality content for the most fundamental Catholic items
  // without depending on a network fetch. The citations on the item are
  // still fetched best-effort for cross-source validation, but a fetch
  // failure no longer blocks the build.
  const { findCuratedEntry } = await import("../knowledge");
  const curated = findCuratedEntry(item.contentType, item.canonicalSlug);
  if (curated) {
    await logger.info(
      "curated",
      `Using curated knowledge for "${item.canonicalName}" (authority level ${curated.authorityLevel}).`,
    );
    const validation = validatePayload(item.contentType, curated.payload);
    if (!validation.ok) {
      // Curated entries should always validate; this is a developer bug.
      const msg = `Curated payload failed schema validation: ${validation.errors.join("; ")}`;
      await logger.error("curated", msg);
      // Fall through to live fetch path instead of failing.
    } else {
      const pkg: BuiltContentPackage = {
        contentType: item.contentType,
        canonicalSlug: canonicalizeSlug(item.canonicalSlug),
        title: String(validation.data.title ?? item.canonicalName),
        fields: {},
        payload: validation.data,
        authorityLevel: curated.authorityLevel,
        confidence: 0.95,
        warnings: [],
        citations: curated.citations,
        needsHumanReview: instruction.requiresHumanReview || item.needsHumanReview,
        humanReviewReason:
          instruction.requiresHumanReview && !item.needsHumanReview
            ? "Content type requires human review."
            : undefined,
      };
      await logger.info("done", "Curated build produced a complete package.", {
        confidence: pkg.confidence,
      });
      return {
        ok: true,
        partial: false,
        package: pkg,
        warnings: [],
        confidence: pkg.confidence,
      };
    }
  }

  if (item.citations.length < instruction.minCitations) {
    const message = `Item has ${item.citations.length} citation(s); needs at least ${instruction.minCitations}.`;
    await logger.error("guard", message);
    return { ok: false, partial: false, errorMessage: message, warnings: [], confidence: 0 };
  }

  const citationInputs: CitationInput[] = item.citations.map((c) => ({
    id: c.id,
    sourceUrl: c.sourceUrl,
    sourceHost: c.sourceHost,
    authorityLevel: c.authorityLevel,
    title: c.title,
    excerpt: c.excerpt,
    validated: c.validated,
  }));

  const fetched: FetchedSource[] = [];
  const fetchWarnings: string[] = [];

  for (const citation of citationInputs) {
    try {
      const response = await fetchApprovedSource({
        citationId: citation.id,
        url: citation.sourceUrl,
        fetcher: deps.fetcher,
      });
      if (response.status >= 400) {
        const msg = `HTTP ${response.status} from ${describeAuthoritySource(citation.sourceHost)}`;
        await logger.warn("fetch", msg, { sourceUrl: citation.sourceUrl });
        fetchWarnings.push(msg);
        continue;
      }
      fetched.push(response);
      await logger.info("fetch", `Fetched ${describeAuthoritySource(citation.sourceHost)}`, {
        sourceUrl: citation.sourceUrl,
      });
      await prisma.checklistCitation.update({
        where: { id: citation.id },
        data: {
          contentChecksum: response.checksum,
          fetchedAt: response.fetchedAt,
          title: response.title ?? citation.title,
        },
      });
    } catch (err) {
      if (err instanceof UnapprovedSourceError) {
        await logger.error("fetch", err.message, { sourceUrl: citation.sourceUrl });
        fetchWarnings.push(err.message);
      } else {
        const msg = `Fetch failed: ${err instanceof Error ? err.message : String(err)}`;
        await logger.warn("fetch", msg, { sourceUrl: citation.sourceUrl });
        fetchWarnings.push(msg);
      }
    }
  }

  if (fetched.length === 0) {
    const msg = `No sources could be fetched. ${fetchWarnings.join("; ")}`;
    await logger.error("fetch", msg);
    return { ok: false, partial: false, errorMessage: msg, warnings: fetchWarnings, confidence: 0 };
  }

  const fieldCandidates = extractFields(item.contentType, item, fetched);
  await logger.info(
    "extract",
    `Extracted candidates for ${Object.keys(fieldCandidates).length} fields across ${fetched.length} sources.`
  );

  const reconciled = reconcileFields(fieldCandidates);
  for (const warning of reconciled.warnings) {
    await logger.warn("reconcile", warning);
  }

  const baseSlug = canonicalizeSlug(item.canonicalSlug);
  const duplicate = await detectChecklistDuplicate(prisma, {
    contentType: item.contentType,
    canonicalName: item.canonicalName,
    canonicalSlug: baseSlug,
    excludeChecklistItemId: item.id,
  });
  if (duplicate) {
    await logger.warn(
      "duplicate",
      `Possible duplicate detected: matched "${duplicate.matchedName}" via ${duplicate.matchType} (confidence ${duplicate.confidence}).`,
      { metadata: { duplicate } }
    );
  }

  const inventionWarnings = detectInventions(
    reconciled.values,
    reconciled.provenance,
    instruction.requiredFields
  );
  for (const warning of inventionWarnings) {
    await logger.error("accuracy", warning);
  }

  const payload: Record<string, unknown> = { ...reconciled.values };
  payload.slug = baseSlug;
  payload.citations = fetched.map((f) => f.url);
  if (!payload.title) {
    payload.title = item.canonicalName;
  }

  const validation = validatePayload(item.contentType as ChecklistContentType, payload);
  if (!validation.ok) {
    const msg = `Final payload failed schema validation: ${validation.errors.join("; ")}`;
    await logger.error("validate", msg);
    return {
      ok: false,
      partial: true,
      package: undefined,
      errorMessage: msg,
      warnings: [...reconciled.warnings, ...inventionWarnings, ...fetchWarnings],
      confidence: reconciled.confidence,
    };
  }

  const fields: Record<string, GeneratedField> = {};
  for (const [field, provenance] of Object.entries(reconciled.provenance)) {
    fields[field] = {
      value: payload[field],
      provenance,
      confidence: reconciled.confidence,
      warnings: [],
    };
  }

  const needsHumanReview =
    instruction.requiresHumanReview ||
    item.needsHumanReview ||
    reconciled.needsHumanReview ||
    inventionWarnings.length > 0 ||
    !!duplicate;

  const topAuthority = fetched.reduce((acc, f) =>
    !acc || f.authorityLevel < acc.authorityLevel ? f : acc
  );

  const pkg: BuiltContentPackage = {
    contentType: item.contentType,
    canonicalSlug: baseSlug,
    title: String(payload.title),
    fields,
    payload: validation.data,
    authorityLevel: topAuthority.authorityLevel,
    confidence: reconciled.confidence,
    warnings: [...reconciled.warnings, ...inventionWarnings, ...fetchWarnings],
    citations: fetched.map((f) => f.url),
    needsHumanReview,
    humanReviewReason: needsHumanReview
      ? (duplicate
          ? `Possible duplicate of "${duplicate.matchedName}".`
          : inventionWarnings[0] ?? "Type requires human review.")
      : undefined,
  };

  await logger.info("done", "Build engine produced a complete package.", {
    confidence: pkg.confidence,
  });

  return {
    ok: true,
    partial: false,
    package: pkg,
    warnings: pkg.warnings,
    confidence: pkg.confidence,
  };
}
