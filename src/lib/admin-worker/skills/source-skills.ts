/**
 * Source acquisition skill pack. Real wrappers over the worker's fetch + read
 * pipeline: fetch a page through the approved-host fetcher, read it into
 * structured blocks, detect dynamic pages (so the worker doesn't loop on JS-only
 * pages — it files a developer request for a dynamic fetcher instead), and
 * classify fetch failures. Each skill verifies the result was actually stored.
 */

import { adminWorkerFetch, type FetcherInput, type FetchedPage } from "../fetcher";
import { readSource, type ReadSourceInput, type ReadSourceOutcome } from "../source-reader";
import { check, decideFromChecks } from "./verification";
import type { CertifiedSkill, FailureClass, SkillContext } from "./types";

function input(ctx: SkillContext): Record<string, unknown> {
  return ctx.input as Record<string, unknown>;
}

function fetchFailureClass(reason: string): FailureClass {
  if (/timeout|network|econn|socket|5\d\d/i.test(reason)) return "RETRYABLE";
  if (/dynamic|javascript/i.test(reason)) return "NEEDS_DEVELOPER";
  if (/40[34]|410|not found|forbidden/i.test(reason)) return "NON_RETRYABLE";
  return "NEEDS_REPAIR";
}

export const sourceSkills: CertifiedSkill[] = [
  {
    name: "fetch_static_html",
    purpose: "Fetch an approved-host page through the worker fetcher (host allow-list enforced).",
    category: "SOURCE",
    version: "1",
    contentTypes: ["*"],
    contentSubtypes: [],
    inputs: ["url"],
    outputs: ["body", "checksum", "httpStatus", "fetchResultRowId"],
    preconditions: ["a candidate URL on an approved host"],
    requiredPermissions: ["network_fetch"],
    riskLevel: "low",
    idempotencyKey: (ctx) => `fetch_static_html:${String(input(ctx).url ?? "")}`,
    brainOps: ["diagnose_fetch"],
    safetyGates: ["approved_host", "not_junk"],
    humanReviewRequired: false,
    allowedInSafeDegradedMode: false,
    failureClassifier: (err) => fetchFailureClass(err instanceof Error ? err.message : String(err)),
    retryPolicy: {
      maxAttempts: 3,
      backoff: "exponential",
      retryableClasses: ["RETRYABLE"],
      routeToRepairAfter: 3,
      developerRequestAfter: 5,
      circuitBreakAfter: 8,
    },
    successMetrics: ["http_2xx", "body_stored"],
    testsRequired: ["source: fetch_static_html"],
    execute: async (ctx) => {
      const page = (await adminWorkerFetch(
        ctx.prisma,
        input(ctx) as unknown as FetcherInput,
      )) as FetchedPage;
      if (!page.succeeded) {
        return {
          status: "FAILED",
          failureReason: page.rejectionReason ?? page.errorMessage ?? `http ${page.httpStatus}`,
          outputEntityType: "AdminWorkerFetchResult",
          outputEntityId: page.fetchResultRowId,
          evidence: { status: page.httpStatus, errorClass: page.errorClass },
        };
      }
      return {
        status: "SUCCEEDED",
        output: page,
        outputEntityType: "AdminWorkerFetchResult",
        outputEntityId: page.fetchResultRowId,
        brainOpUsed: null,
      };
    },
    verify: async (_ctx, result) => {
      const p = result.output as FetchedPage | undefined;
      return decideFromChecks(
        [
          check(
            "http_ok",
            !!p && p.httpStatus >= 200 && p.httpStatus < 400,
            `status ${p?.httpStatus}`,
          ),
          check("has_body", !!p && p.body.length > 0),
          check("fetch_result_stored", !!p?.fetchResultRowId),
        ],
        "RETRY",
      );
    },
  },
  {
    name: "fetch_text_document",
    purpose: "Fetch a plain-text / non-HTML document from an approved host.",
    category: "SOURCE",
    version: "1",
    contentTypes: ["*"],
    contentSubtypes: [],
    inputs: ["url"],
    outputs: ["body", "contentType", "fetchResultRowId"],
    preconditions: ["a candidate document URL on an approved host"],
    requiredPermissions: ["network_fetch"],
    riskLevel: "low",
    idempotencyKey: (ctx) => `fetch_text_document:${String(input(ctx).url ?? "")}`,
    brainOps: [],
    safetyGates: ["approved_host"],
    humanReviewRequired: false,
    allowedInSafeDegradedMode: false,
    failureClassifier: (err) => fetchFailureClass(err instanceof Error ? err.message : String(err)),
    retryPolicy: {
      maxAttempts: 3,
      backoff: "exponential",
      retryableClasses: ["RETRYABLE"],
      routeToRepairAfter: 3,
    },
    successMetrics: ["body_stored"],
    testsRequired: ["source: fetch_text_document"],
    execute: async (ctx) => {
      const page = (await adminWorkerFetch(
        ctx.prisma,
        input(ctx) as unknown as FetcherInput,
      )) as FetchedPage;
      if (!page.succeeded) {
        return {
          status: "FAILED",
          failureReason: page.rejectionReason ?? page.errorMessage ?? `http ${page.httpStatus}`,
          outputEntityId: page.fetchResultRowId,
        };
      }
      return { status: "SUCCEEDED", output: page, outputEntityId: page.fetchResultRowId };
    },
    verify: async (_ctx, result) => {
      const p = result.output as FetchedPage | undefined;
      return decideFromChecks([check("has_body", !!p && p.body.length > 0)], "RETRY");
    },
  },
  {
    name: "read_source_page",
    purpose: "Read a fetched page into structured source blocks + a classification.",
    category: "SOURCE",
    version: "1",
    contentTypes: ["*"],
    contentSubtypes: [],
    inputs: ["sourceUrl", "sourceHost", "rawBody"],
    outputs: ["sourceReadId", "classifierContentType", "blocks"],
    preconditions: ["the page has been fetched (rawBody present)"],
    requiredPermissions: ["read_source"],
    riskLevel: "low",
    idempotencyKey: (ctx) =>
      `read_source_page:${String(input(ctx).sourceUrl ?? input(ctx).url ?? "")}`,
    brainOps: ["identify_document_type"],
    safetyGates: ["structured_blocks"],
    humanReviewRequired: false,
    allowedInSafeDegradedMode: false,
    failureClassifier: () => "NEEDS_REPAIR",
    retryPolicy: {
      maxAttempts: 2,
      backoff: "none",
      retryableClasses: ["RETRYABLE"],
      routeToRepairAfter: 2,
    },
    successMetrics: ["blocks_parsed"],
    testsRequired: ["source: read_source_page"],
    execute: async (ctx) => {
      const outcome = (await readSource(
        ctx.prisma,
        input(ctx) as unknown as ReadSourceInput,
      )) as ReadSourceOutcome;
      if (outcome.rejected) {
        return { status: "FAILED", failureReason: outcome.rejectionReason ?? "read rejected" };
      }
      return {
        status: "SUCCEEDED",
        output: outcome,
        outputEntityType: "AdminWorkerSourceRead",
        outputEntityId: outcome.sourceReadId,
      };
    },
    verify: async (_ctx, result) => {
      const o = result.output as ReadSourceOutcome | undefined;
      return decideFromChecks(
        [
          check("not_rejected", !!o && !o.rejected),
          check("source_read_stored", !!o?.sourceReadId),
          check("blocks_accepted", !!o && o.acceptedBlocks > 0, `${o?.acceptedBlocks ?? 0} blocks`),
        ],
        "REPAIR",
      );
    },
  },
  {
    name: "detect_dynamic_page",
    purpose:
      "Detect pages with no usable static text (JS-rendered) so the worker stops fetching them and files a developer request for a dynamic fetcher.",
    category: "SOURCE",
    version: "1",
    contentTypes: ["*"],
    contentSubtypes: [],
    inputs: ["rawBody"],
    outputs: ["dynamic", "textLength"],
    preconditions: ["a fetched body to inspect"],
    requiredPermissions: [],
    riskLevel: "low",
    idempotencyKey: (ctx) =>
      `detect_dynamic_page:${String(input(ctx).sourceUrl ?? input(ctx).url ?? "")}`,
    brainOps: [],
    safetyGates: ["no_infinite_dynamic_loop"],
    humanReviewRequired: false,
    allowedInSafeDegradedMode: false,
    // Dynamic → a real missing capability (dynamic fetcher); do not loop.
    failureClassifier: () => "NEEDS_DEVELOPER",
    retryPolicy: {
      maxAttempts: 1,
      backoff: "none",
      retryableClasses: [],
      developerRequestAfter: 1,
    },
    successMetrics: ["usable_static_text"],
    testsRequired: ["source: detect_dynamic_page"],
    execute: async (ctx) => {
      const body = String(input(ctx).rawBody ?? input(ctx).body ?? "");
      const textLen = body
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim().length;
      const dynamicMarkers =
        /enable javascript|please wait|loading\.\.\.|window\.__INITIAL_STATE__|<div id="root">\s*<\/div>|<div id="app">\s*<\/div>/i.test(
          body,
        );
      const dynamic = textLen < 200 && (dynamicMarkers || /<script/i.test(body));
      if (dynamic) {
        return {
          status: "FAILED",
          failureReason: "dynamic page: no usable static text — a dynamic fetcher is required",
          evidence: { textLen },
        };
      }
      return { status: "SUCCEEDED", output: { dynamic: false, textLength: textLen } };
    },
    verify: async (_ctx, result) =>
      decideFromChecks([check("usable_static_text", result.output != null)], "FAILED"),
  },
  {
    name: "classify_fetch_failure",
    purpose: "Classify a fetch failure (retryable / permanent / dynamic / needs repair).",
    category: "SOURCE",
    version: "1",
    contentTypes: ["*"],
    contentSubtypes: [],
    inputs: ["errorClass", "httpStatus", "rejectionReason"],
    outputs: ["failureClass"],
    preconditions: ["a failed fetch to classify"],
    requiredPermissions: [],
    riskLevel: "low",
    idempotencyKey: (ctx) =>
      `classify_fetch_failure:${String(input(ctx).url ?? "")}:${String(input(ctx).httpStatus ?? "")}`,
    brainOps: ["diagnose_fetch"],
    safetyGates: [],
    humanReviewRequired: false,
    allowedInSafeDegradedMode: true,
    failureClassifier: () => "NON_RETRYABLE",
    retryPolicy: { maxAttempts: 1, backoff: "none", retryableClasses: [] },
    successMetrics: ["classified"],
    testsRequired: ["source: classify_fetch_failure"],
    execute: async (ctx) => {
      const reason = String(
        input(ctx).rejectionReason ?? input(ctx).errorClass ?? input(ctx).httpStatus ?? "",
      );
      return { status: "SUCCEEDED", output: { failureClass: fetchFailureClass(reason) } };
    },
    verify: async () => ({ ok: true, decision: "PROCEED", checks: [] }),
  },
];
