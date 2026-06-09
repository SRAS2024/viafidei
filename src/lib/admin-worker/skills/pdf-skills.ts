/**
 * PDF handling skill pack. The worker can fetch + detect + classify PDFs and
 * route them correctly. There is no PDF *text* parser in the runtime (only
 * pdfkit, which generates PDFs), so extract_text_pdf / extract_vatican_pdf
 * honestly file a developer request for a PDF text-extraction / OCR capability
 * rather than pretending to parse — PDF failures create specific requests, not
 * generic extraction failures.
 */

import { adminWorkerFetch, type FetcherInput, type FetchedPage } from "../fetcher";
import { makeOpSkill } from "./skill-helpers";
import type { CertifiedSkill, SkillContext } from "./types";

function body(ctx: SkillContext): string {
  const i = ctx.input as Record<string, unknown>;
  return String(i.body ?? i.rawBody ?? "");
}
function url(ctx: SkillContext): string {
  return String((ctx.input as Record<string, unknown>).url ?? "");
}
function isPdf(ctx: SkillContext): boolean {
  const i = ctx.input as Record<string, unknown>;
  const ct = String(i.contentType ?? "").toLowerCase();
  return (
    ct.includes("pdf") || url(ctx).toLowerCase().endsWith(".pdf") || body(ctx).startsWith("%PDF")
  );
}

/** Route a PDF that needs a parser/OCR to a developer request (no false success). */
async function fileOcrRequest(ctx: SkillContext, why: string) {
  const fingerprint = `missing-skill:pdf_text_extraction`;
  const req = await ctx.prisma.adminWorkerDeveloperRequest
    .upsert({
      where: { fingerprint },
      create: {
        kind: "capability",
        title: "PDF text extraction / OCR capability needed",
        detail: `${why}. The runtime has no PDF text parser; a pdf-parse/OCR capability is required to extract this document.`,
        severity: "high",
        status: "OPEN",
        source: "skill-runtime",
        fingerprint,
        metadata: { url: url(ctx), capability: "pdf_text_extraction" },
      },
      update: { occurrences: { increment: 1 } },
      select: { id: true },
    })
    .catch(() => null);
  return {
    ok: false,
    detail: req ? "filed PDF text-extraction developer request" : "could not file request",
    outputEntityType: "AdminWorkerDeveloperRequest",
    outputEntityId: req?.id ?? null,
  };
}

export const pdfSkills: CertifiedSkill[] = [
  makeOpSkill({
    name: "detect_pdf",
    purpose: "Detect whether a fetched resource is a PDF.",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    onVerifyFail: "PROCEED",
    run: async (ctx) => ({ ok: true, detail: isPdf(ctx) ? "pdf" : "not a pdf" }),
  }),
  makeOpSkill({
    name: "fetch_pdf",
    purpose: "Fetch a PDF document from an approved host.",
    category: "SOURCE",
    inputs: ["url"],
    run: async (ctx) => {
      const page = (await adminWorkerFetch(
        ctx.prisma,
        ctx.input as unknown as FetcherInput,
      )) as FetchedPage;
      return {
        ok: page.succeeded,
        detail: page.succeeded ? "fetched" : (page.rejectionReason ?? `http ${page.httpStatus}`),
        outputEntityType: "AdminWorkerFetchResult",
        outputEntityId: page.fetchResultRowId,
      };
    },
  }),
  makeOpSkill({
    name: "detect_scanned_pdf",
    purpose: "Detect a scanned (image-only) PDF that needs OCR.",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    onVerifyFail: "PROCEED",
    run: async (ctx) => {
      const b = body(ctx);
      // A text PDF contains font/text operators; a scanned one is mostly image XObjects.
      const looksScanned = b.startsWith("%PDF") && /\/Image/.test(b) && !/\/Font|BT\s/.test(b);
      return { ok: true, detail: looksScanned ? "scanned (needs OCR)" : "text PDF" };
    },
  }),
  makeOpSkill({
    name: "extract_pdf_metadata",
    purpose: "Extract basic PDF metadata (version, size).",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const b = body(ctx);
      const m = b.match(/^%PDF-(\d+\.\d+)/);
      return { ok: m != null, detail: m ? `PDF ${m[1]}, ${b.length} bytes` : "no PDF header" };
    },
  }),
  makeOpSkill({
    name: "classify_pdf_document_type",
    purpose: "Classify a PDF document type from its URL/structure (encyclical, council, …).",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const u = url(ctx).toLowerCase();
      const type = /encyclical|enciclica/.test(u)
        ? "encyclical"
        : /exhort/.test(u)
          ? "apostolic_exhortation"
          : /const|council|concili/.test(u)
            ? "council_document"
            : /motu/.test(u)
              ? "motu_proprio"
              : "church_document";
      return { ok: true, detail: type };
    },
  }),
  makeOpSkill({
    name: "verify_pdf_citation",
    purpose: "Verify a PDF citation points at an approved host and a .pdf resource.",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const u = url(ctx).toLowerCase();
      const ok = /vatican\.va|usccb\.org/.test(u) && (u.endsWith(".pdf") || isPdf(ctx));
      return { ok, detail: ok ? "valid PDF citation" : "not an approved-host PDF" };
    },
  }),
  makeOpSkill({
    name: "route_scanned_pdf_to_review_or_ocr_request",
    purpose: "Route a scanned PDF to human review / file an OCR developer request.",
    category: "SOURCE",
    allowedInSafeDegradedMode: true,
    onVerifyFail: "HUMAN_REVIEW",
    run: async (ctx) => fileOcrRequest(ctx, "Scanned PDF requires OCR"),
  }),
  makeOpSkill({
    name: "extract_text_pdf",
    purpose: "Extract text from a PDF (routes to a developer request — no parser yet).",
    category: "EXTRACTION",
    contentTypes: ["CHURCH_DOCUMENT", "PAPAL_DOCUMENT", "COUNCIL_DOCUMENT"],
    onVerifyFail: "HUMAN_REVIEW",
    run: async (ctx) => fileOcrRequest(ctx, "PDF text extraction requested"),
  }),
  makeOpSkill({
    name: "extract_vatican_pdf_document",
    purpose:
      "Extract a structured Vatican PDF document (routes to a developer request — no parser yet).",
    category: "EXTRACTION",
    contentTypes: ["CHURCH_DOCUMENT", "PAPAL_DOCUMENT", "COUNCIL_DOCUMENT"],
    onVerifyFail: "HUMAN_REVIEW",
    run: async (ctx) => fileOcrRequest(ctx, "Vatican PDF structured extraction requested"),
  }),
];
